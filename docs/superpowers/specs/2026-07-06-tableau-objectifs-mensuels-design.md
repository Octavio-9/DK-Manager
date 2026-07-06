# Tableau d'objectifs mensuels — Conception

Date : 2026-07-06
Statut : validé (design), en attente de relecture de la spec

## Objectif

Remplacer le widget « Objectifs à atteindre » du dashboard (cartes basées sur
`MonthlyObjective`) par un **tableau-template mensuel** reproduisant le document
de suivi de DK Production : métriques par réseau (vues, abonnés), plus une liste
d'objectifs généraux. Le tableau est navigable par mois, éditable par les
managers/admins, et consultable par tous.

## Décisions validées

- **Structure** : template structuré, valeurs éditables (pas un tableur libre).
- **Sections de métriques dynamiques** : on peut ajouter/supprimer des sections
  au-delà des deux par défaut (Vues, Abonnés), chacune avec son titre et ses
  libellés de colonnes.
- **Nouveau mois** : créé en copiant le mois précédent (réseaux + objectifs +
  valeurs ; l'« actuel » repart des dernières valeurs, à ajuster).
- **Colonne Résultat** : auto-calculée = actuel ÷ objectif, en %, avec code
  couleur (vert ≥ 100 %, orange 50–99 %, rouge < 50 %).
- **Permissions** : tout le monde consulte ; seuls Managers/Admins modifient
  (UI + RLS).
- **Emplacement** : sur le dashboard, à la place du widget actuel.

## Modèle de données

Nouvelle table `MonthlyBoard`, une ligne par mois :

```
MonthlyBoard
  id         uuid PK
  month      int  (1-12)      -- NOT NULL
  year       int              -- NOT NULL
  data       jsonb            -- NOT NULL, structure ci-dessous
  createdBy  uuid -> User(id) on delete set null
  createdAt  timestamptz default now()
  updatedAt  timestamptz default now()
  UNIQUE (month, year)
```

```jsonc
data = {
  "metrics": [                         // sections ajoutables/supprimables
    {
      "key": "views",                  // identifiant stable (slug/uuid court)
      "title": "VUES CUMULÉES PAR RÉSEAU",
      "rowHeader": "Réseau",           // en-tête de la 1re colonne
      "currentLabel": "Vues cumulées actuelles",
      "targetLabel": "Objectif juillet",
      "rows": [
        { "label": "Facebook",  "current": 81000, "target": 140000 },
        { "label": "Instagram", "current": 167,   "target": 600 }
        // …
      ]
    }
    // …autres sections (abonnés, etc.)
  ],
  "generalObjectives": [
    "Finaliser l'application DK Manager d'ici le 15 juillet 2026",
    "Finaliser l'identité visuelle et le logo DK"
    // …
  ]
}
```

La colonne « Résultat » n'est pas stockée : elle est calculée à l'affichage
(`current / target`).

### Pourquoi JSONB

- Copier un mois = cloner l'objet JSON (trivial).
- Structure fixe côté sections → pas de besoin relationnel.
- Tout le tableau chargé en une seule ligne / une seule requête.

## RLS (Supabase)

```
ALTER TABLE "MonthlyBoard" ENABLE ROW LEVEL SECURITY;

-- Lecture : tout utilisateur connecté
CREATE POLICY board_select ON "MonthlyBoard"
  FOR SELECT USING (auth.role() = 'authenticated');

-- Écriture : managers/admins uniquement
CREATE POLICY board_write ON "MonthlyBoard"
  FOR ALL
  USING  (public.get_user_role() IN ('Manager','Administrateur'))
  WITH CHECK (public.get_user_role() IN ('Manager','Administrateur'));
```

## Composant UI — `MonthlyObjectivesBoard`

Remplace `ObjectivesWidget` dans `Dashboard.jsx`.

### Affichage (lecture seule)
- En-tête : logo DK (`DKLogo`) + titre « OBJECTIFS DU MOIS DE {MOIS} {ANNÉE} »
  + navigation ◀ ▶ entre les mois existants.
- Pour chaque section `metrics` : bandeau titre + tableau
  `{rowHeader} | {currentLabel} | {targetLabel} | Résultat`.
  - Résultat = `current/target` en %, coloré (vert/orange/rouge).
  - Ligne de total optionnelle : non (YAGNI pour l'instant).
- Section « OBJECTIFS GÉNÉRAUX DU MOIS » : liste numérotée.
- Thème sombre de l'app, bandeaux de section contrastés façon document source.

### Édition (managers/admins) — mode édition en ligne
- Bouton « Modifier » → cellules `current`/`target` deviennent des champs
  numériques ; libellés de section/colonnes éditables ; ajout/suppression de
  lignes ; ajout/suppression/réordonnancement des objectifs généraux ;
  ajout/suppression de **sections** entières.
- Boutons « Enregistrer » (écrit le JSONB via update) / « Annuler ».
- Bouton « Nouveau mois » → crée le mois suivant en copiant le mois courant.
- Mois sans tableau : état vide + bouton « Créer le tableau de ce mois »
  (copie du dernier mois existant, ou modèle par défaut si aucun).

### État / requêtes
- `useQuery(['monthly-board', year, month])` → charge la ligne du mois.
- `useMutation` upsert (insert/update) du JSONB.
- Navigation mois : état local `{year, month}`, défaut = mois courant.

## Migration

`0015_monthly_board.sql` : création de la table + index unique + RLS.
(La table `MonthlyObjective` et l'ancien `ObjectivesWidget` restent en place mais
inutilisés ; suppression éventuelle plus tard.)

## Hors périmètre (YAGNI)

- Historique/versions d'un mois.
- Graphiques d'évolution inter-mois.
- Export PDF du tableau (possible plus tard).
- Colonnes entièrement libres (on garde 1re colonne + actuel + objectif +
  résultat calculé).

## Fichiers touchés

- `supabase/migrations/0015_monthly_board.sql` (nouveau)
- `src/components/MonthlyObjectivesBoard.jsx` (nouveau)
- `src/pages/Dashboard.jsx` (remplace `ObjectivesWidget` par le nouveau)
- `src/components/ObjectivesWidget.jsx` (devient obsolète — suppression)
