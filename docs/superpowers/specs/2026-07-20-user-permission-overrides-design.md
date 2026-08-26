# Surcharges de droits par utilisateur (Phase 1 — UI)

**Date :** 2026-07-20
**Statut :** Design approuvé, en attente de relecture avant plan d'implémentation

## Contexte

L'application gère l'accès par **rôle** :
- Visibilité des pages : `hasAccess(route)` dans `AuthContext`, alimenté par `ROUTE_ACCESS` (route → liste de rôles). Utilisé par le menu (`Sidebar.jsx`) et le garde de routes (`App.jsx`).
- CRUD : pas centralisé — quelques vérifications `isAdmin` éparses (Finance, Calendrier…).
- Sécurité réelle : RLS Postgres basée sur `get_user_role()`.

L'administrateur veut pouvoir **accorder ou retirer, par utilisateur** (au-delà du rôle) : la visibilité d'une page et les droits **Créer / Modifier / Supprimer** sur chaque page.

## Objectif

Permettre à l'admin de surcharger, par utilisateur, la visibilité et le CRUD de chaque page — les surcharges primant sur le rôle.

## Hors périmètre (Phase 2 éventuelle)

- **Application en base (RLS).** Cette phase est un garde **d'interface** uniquement : elle masque/désactive dans l'app. Un utilisateur techniquement capable d'appeler l'API directement avec son jeton n'est pas bloqué par cette phase. Un durcissement RLS par utilisateur (réécriture des policies de toutes les tables) est une phase ultérieure, non couverte ici.
- Granularité par bouton/action individuelle (on reste au grain page × CRUD).

## Modèle de données

Nouvelle colonne `permissions jsonb` sur `"User"` (nullable).

On n'y stocke que les **écarts au rôle** (surcharges éparses) :

```json
{
  "finance":  { "view": false },
  "projects": { "create": false, "delete": false }
}
```

- Clé de 1er niveau = clé de page (mêmes clés que `ROUTE_ACCESS` : `projects`, `clients`, `finance`, …).
- Sous-clés : `view`, `create`, `update`, `delete` — booléen explicite.
- Sous-clé absente = on suit la valeur par défaut du rôle.
- `permissions` `null` ou `{}` = comportement 100 % rôle (utilisateur jamais personnalisé).

## Sémantique du helper (dans `AuthContext`)

Soit `roleName` le rôle de l'utilisateur, `isAdmin = roleName === 'Administrateur'`, `ov = user.permissions || {}`.

**Valeur par défaut du rôle :**
- `defaultView(page) = ROUTE_ACCESS[page]?.includes(roleName) ?? true`
- `defaultCrud(page, action)` :
  - si `(page, action)` figure dans `ADMIN_ONLY_DEFAULT` → réservé à l'admin par défaut (donc `false` pour un non-admin) ;
  - sinon `defaultView(page)` (si le rôle voit la page, il peut y agir par défaut).

`ADMIN_ONLY_DEFAULT` capture le comportement **actuel** du code (actions déjà réservées à l'admin), pour ne rien desserrer :
```js
// L'admin peut tout de même accorder ces actions à un utilisateur précis
// via une surcharge explicite `true`.
const ADMIN_ONLY_DEFAULT = {
  finance: ['update', 'delete'], // édition/suppression de transaction (aujourd'hui `isAdmin`)
}
```

**`hasAccess(page)`** (étend l'existant) :
1. `isAdmin` → `true`.
2. `ov[page]?.view === true` → `true` ; `=== false` → `false`.
3. sinon `defaultView(page)`.

**`can(action, page)`** avec `action ∈ {create, update, delete}` (nouveau) :
1. `isAdmin` → `true`.
2. si `!hasAccess(page)` → `false` (on n'agit pas sur une page qu'on ne voit pas).
3. `ov[page]?.[action] === false` → `false` (retrait explicite).
4. `ov[page]?.[action] === true` → `true` (octroi explicite — peut desserrer un défaut admin-only).
5. sinon `defaultCrud(page, action)`.

**Règles invariantes :**
- **L'Administrateur ignore toujours les surcharges** — on ne peut ni verrouiller un admin, ni se bloquer soi-même hors du gestionnaire de droits.
- Les surcharges peuvent **accorder** (ex. `view: true` sur une page que le rôle ne voit pas) comme **retirer** (`view: false`).

## UI d'administration

Sur la page **Utilisateurs** (déjà réservée à l'admin) :
- Un bouton **« Droits »** par utilisateur (masqué pour les lignes Administrateur, puisque immunisées).
- Ouvre un modal **matrice** : lignes = pages, colonnes = **Voir / Créer / Modifier / Supprimer**, cases à cocher.
  - État initial de chaque case = valeur **effective** (défaut du rôle fusionné avec surcharge existante).
  - Les pages en lecture seule (dashboard, historique, bilan) n'affichent que **Voir**.
- Bouton **« Réinitialiser (suivre le rôle) »** → efface les surcharges de l'utilisateur (`permissions = null`).
- **Enregistrer** : calcule les écarts vs défaut du rôle et écrit uniquement ceux-ci dans `permissions` (stockage épars → l'héritage du rôle reste vivant pour tout ce qui n'est pas explicitement surchargé).

Écriture : `supabase.from('User').update({ permissions }).eq('id', userId)`. Après succès, invalider les requêtes utilisateurs ; l'utilisateur concerné verra le changement à son prochain chargement de session (`refreshUser`/reconnexion).

## Câblage CRUD (frontend)

La visibilité est automatique (via `hasAccess`, déjà branché sur menu + routes).

Brancher `can('create'|'update'|'delete', <page>)` sur les boutons correspondants des pages ressources (masquer ou désactiver) :

- **Projets** (`Projects.jsx`) : Nouveau projet / éditer / supprimer.
- **Clients** (`Clients.jsx`, `ClientDetail.jsx`) : Nouveau client / modifier / supprimer.
- **Finances** (`Finance.jsx`) : Ajouter transaction / modifier / supprimer.
- **Factures** (`Invoices.jsx`) : créer / modifier / supprimer.
- **Tâches** (`Tasks.jsx`) : créer / modifier / supprimer.
- **Calendrier** (`Calendar.jsx`) : créer / modifier / supprimer.
- **Productions** (`Productions.jsx`) : créer / modifier / supprimer.
- **Documents** (`Documents.jsx`) : créer / supprimer.
- **Éditorial** (`EditorialCalendar.jsx`) : créer / modifier / supprimer.
- **Utilisateurs** (`Users.jsx`) : page déjà réservée à l'admin (les admins ignorent les surcharges) → pas de câblage nécessaire, laissé tel quel.

Convention : bouton **masqué** si le droit est refusé (plutôt que désactivé), pour rester cohérent avec la visibilité des pages.

## Migration

`supabase/migrations/0025_user_permissions.sql` :
```sql
alter table "User" add column if not exists "permissions" jsonb;
```
À appliquer via le SQL Editor Supabase (MCP actuellement déconnecté).

## Tests / vérification

- Build (`npm run build`) + lint des fichiers touchés.
- Vérifs manuelles clés :
  - Retirer `view` d'une page à un utilisateur → page absente du menu + route bloquée pour lui, inchangée pour les autres.
  - Retirer `delete` sur Clients à un utilisateur → bouton Supprimer masqué chez lui, présent chez l'admin.
  - Accorder `view` d'une page hors rôle → page visible pour cet utilisateur.
  - Administrateur : toujours tout visible/possible, bouton « Droits » absent sur les lignes admin.
  - « Réinitialiser » → l'utilisateur reprend exactement le comportement de son rôle.

## Décisions actées

- Application **UI uniquement** en Phase 1 (choix utilisateur), avec caveat sécurité assumé.
- Grain **page × {view, create, update, delete}**.
- Stockage **épars** (écarts au rôle) dans `User.permissions` JSONB.
- **Admins immunisés** aux surcharges.
