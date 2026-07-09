# Traçabilité — Journal d'activité & verrouillage des événements passés

Date : 2026-07-09
Statut : validé par le client

## Contexte & objectif

DK_manager doit offrir une **traçabilité** de ce qui se passe dans l'application, et
**protéger les données passées**. Deux besoins liés :

1. **Journal d'activité (« livre de bord »)** — un registre chronologique de toutes les
   actions faites sur les entités opérationnelles, avec *qui*, *quoi*, *quel type d'action*,
   *quand*. On peut remonter dans le temps, jour par jour.
2. **Verrouillage des événements passés** — un événement dont la date de fin est dépassée
   devient figé (non modifiable, non supprimable) pour tout le monde **sauf l'Administrateur**.

## Décisions validées

| Décision | Choix retenu |
|---|---|
| Périmètre | Journal d'activité **+** verrouillage des événements passés |
| Entités tracées | **Événements, Projets, Tâches** uniquement (v1) |
| Niveau de détail | Action + résumé (qui / quoi / type d'action / élément) — **pas** de diff champ-par-champ |
| Accès au journal | **Administrateur uniquement** |
| Déclencheur de verrouillage | Date de **fin** dépassée (`coalesce(endDate, date) < now()`) |
| Qui peut éditer un événement verrouillé | **Administrateur seul** (pas les Managers) |
| Mécanisme de capture | **Triggers PostgreSQL** (inviolable, complet, centralisé) |

## Architecture

### 1. Capture par triggers (base de données)

Une fonction trigger unique `public.log_activity()` (en `security definer`) est branchée
`AFTER INSERT OR UPDATE OR DELETE` sur `Event`, `Project`, `Task`. À chaque changement, elle
écrit une ligne dans `ActivityLog`.

- **Auteur** : `auth.uid()` (l'utilisateur authentifié courant ; `null` si action côté service → affiché « Système »).
- **Libellé** : extrait via `to_jsonb(rec)->>'title'` sinon `->>'name'` → gère automatiquement
  `Event.title` / `Task.title` / `Project.name` sans code spécifique par table.
- **Snapshot** : `entityLabel` est copié au moment de l'action → le journal reste lisible même
  si l'élément est ensuite supprimé.

Avantage vs journalisation applicative : impossible d'oublier de tracer une action ou de la
contourner ; aucune logique dispersée dans le front.

### 2. Table `ActivityLog`

```
id          uuid  pk  default gen_random_uuid()
entity      text        -- 'Event' | 'Project' | 'Task'
entityId    uuid        -- id de la ligne concernée (peut pointer vers un élément supprimé)
action      text        -- 'created' | 'updated' | 'deleted'
entityLabel text        -- titre/nom au moment de l'action
userId      uuid        -- auteur (fk User, on delete set null), nullable
createdAt   timestamptz default now()
```

**RLS** :
- `SELECT` : `is_admin()` uniquement.
- Aucune policy `INSERT/UPDATE/DELETE` → les clients ne peuvent pas écrire/modifier le journal.
  Seul le trigger (`security definer`) insère. L'historique est donc infalsifiable.

Index : `("createdAt" desc)` pour la pagination, `(entity)` pour le filtre.

### 3. Verrouillage des événements passés (RLS sur `Event`)

On remplace la policy d'écriture globale par des policies séparées :

- `INSERT` : autorisé comme aujourd'hui (`get_user_role() <> 'viewer'`) — la création reste
  possible (rattrapage d'un oubli).
- `UPDATE` / `DELETE` : autorisés seulement si
  `get_user_role() <> 'viewer' AND (is_admin() OR coalesce("endDate", date) >= now())`.

→ Un non-admin ne peut plus modifier/supprimer un événement passé. L'admin, toujours.
La protection est **au niveau base** : elle ne dépend pas du front (impossible à contourner via l'API).

## Interface

### Page « Historique » (nouvelle)

- Entrée de menu **Historique** (icône `History`), route `/history`, visible **admin seulement**
  (`ROUTE_ACCESS.history = ['Administrateur']`, protégée aussi côté route et RLS).
- Liste chronologique **groupée par jour** (« Aujourd'hui », « Hier », « 8 juillet 2026 »…).
- Chaque ligne : avatar + nom de l'auteur (ou « Système »), phrase
  *« Octave a créé la tâche « Montage clip » »*, heure, + pastille icône/couleur selon l'action
  (vert = création, bleu = modification, rouge = suppression).
- **Filtres** : type d'entité (Tous / Événements / Projets / Tâches) et action (Toutes / Créations /
  Modifications / Suppressions).
- **Pagination** : bouton « Charger plus » (`.range()`, page de 50).
- Requête : `ActivityLog` + embed `userRel:User!userId(id,name,avatarBg,avatarUrl)`,
  tri `createdAt desc`.

### Calendrier — verrouillage visuel

- `isPast(event)` = `new Date(event.endDate || event.date) < new Date()`.
- Événement passé : petit **cadenas** + badge **« Archivé »** dans la fenêtre de détail ; dans la
  grille, léger marquage (opacité/cadenas).
- Fenêtre de détail d'un événement passé :
  - non-admin → boutons *Modifier/Supprimer* remplacés par la mention
    *« Événement archivé — modification réservée à l'administrateur »*.
  - admin → boutons conservés (peut toujours éditer), badge « Archivé » affiché en info.

## Fichiers concernés

- `supabase/migrations/0018_activity_log_and_event_lock.sql` (nouveau) — table, trigger, RLS, verrouillage Event.
- `src/pages/History.jsx` (nouveau) — page journal.
- `src/App.jsx` — route `/history` protégée.
- `src/components/Sidebar.jsx` — entrée de menu `history`.
- `src/lib/constants.js` — `ROUTE_ACCESS.history`.
- `src/components/Topbar.jsx` — titre `/history`.
- `src/pages/Calendar.jsx` — verrouillage UI des événements passés.

## Hors périmètre (v1 — YAGNI)

- Pas de diff champ-par-champ (avant → après).
- Pas de journal pour Clients / Factures / Documents / Utilisateurs.
- Pas de restauration des éléments supprimés.
- Pas de temps réel sur le journal (rafraîchissement via React Query suffit).

Ces extensions restent possibles plus tard sans refonte (même table, mêmes triggers à étendre).
