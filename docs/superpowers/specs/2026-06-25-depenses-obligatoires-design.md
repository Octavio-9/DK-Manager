# Dépenses obligatoires — Design

## Contexte

Dans la page Finance, ajouter une section "Dépenses obligatoires" : une checklist mensuelle de dépenses récurrentes (loyer, abonnements, salaires, etc.) que l'utilisateur peut cocher au fur et à mesure qu'elles sont payées. Cocher une obligation crée automatiquement une transaction de dépense dans l'onglet Transactions existant, pour que les totaux et graphiques financiers restent cohérents.

## Modèle de données

### `ObligationTemplate`

Les modèles d'obligations gérés librement par l'utilisateur (ajout/édition/désactivation).

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `name` | text not null | ex. "Loyer" |
| `defaultAmount` | numeric not null | ex. 800 |
| `categoryId` | uuid, FK `FinanceCategory(id)` on delete set null | optionnel |
| `active` | boolean not null default true | désactiver sans perdre l'historique |
| `createdAt` | timestamptz not null default now() | |

### `ObligationEntry`

Une ligne par obligation × par mois. Les champs `name`/`amount`/`categoryId` sont **copiés** du modèle à la création de la ligne, pour que l'historique reste correct même si le modèle est modifié ou supprimé plus tard.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `templateId` | uuid, FK `ObligationTemplate(id)` on delete set null | nullable |
| `month` | date not null | toujours le 1er du mois, ex. `2026-06-01` |
| `name` | text not null | copié du modèle |
| `amount` | numeric not null | copié du modèle, modifiable au moment de cocher |
| `categoryId` | uuid, FK `FinanceCategory(id)` on delete set null | copié du modèle |
| `done` | boolean not null default false | |
| `paidDate` | date | renseigné quand `done = true` |
| `transactionId` | uuid, FK `Transaction(id)` on delete set null | lien vers la dépense créée |
| `createdAt` | timestamptz not null default now() | |

Contrainte unique : `(templateId, month)` quand `templateId is not null`, pour éviter la double génération automatique.

### RLS

Même politique que les tables Finance existantes (`FinanceCategory`, `Transaction`) :
- `select` : `auth.role() = 'authenticated'`
- écriture (`all`) : `public.get_user_role() is not null`

## Comportement

### Génération mensuelle automatique

À l'ouverture de l'onglet "Dépenses obligatoires" pour un mois donné :
1. Charger les `ObligationTemplate` actifs et les `ObligationEntry` du mois affiché.
2. Pour chaque modèle actif sans entrée pour ce mois, insérer une `ObligationEntry` (`done=false`, valeurs copiées du modèle).
3. Réafficher la liste à jour.

Cela garantit que chaque nouveau mois démarre avec une liste décochée, sans tâche de fond/cron nécessaire.

### Navigation entre les mois

Sélecteur "◀ Mois actuel ▶" pour consulter l'historique des mois précédents (lecture/édition des entrées déjà créées, pas de génération rétroactive pour les mois futurs au-delà du mois courant).

### Cocher une obligation

1. Clic sur la checkbox (non cochée) → ouvre une modale de confirmation pré-remplie : montant (modifiable), date de paiement (défaut = aujourd'hui), catégorie (lecture).
2. À la validation :
   - `update ObligationEntry set done=true, amount=<valeur saisie>, paidDate=<date>`
   - `insert Transaction` (`type='EXPENSE'`, `amount`, `categoryId`, `description=name`, `date=paidDate`)
   - `update ObligationEntry set transactionId=<id transaction créée>`
3. Invalider les queries `transactions` et `obligation-entries` pour rafraîchir les totaux/graphiques de la page Finance.

### Décocher une obligation payée

1. Clic sur la checkbox (cochée) → confirmation ("Annuler ce paiement ? La transaction associée sera supprimée.")
2. À la confirmation :
   - Si `transactionId` existe, `delete Transaction` correspondante.
   - `update ObligationEntry set done=false, paidDate=null, transactionId=null`

### Gestion des modèles

- Bouton "Gérer les obligations" → modale liste avec actions Ajouter / Modifier / Désactiver.
- Modale Ajouter/Modifier : champs `name`, `defaultAmount`, `categoryId` (select, optionnel).
- "Désactiver" met `active=false` (pas de suppression dure, pour ne pas casser les entrées historiques) ; un modèle désactivé n'est plus proposé pour la génération des mois futurs mais reste visible dans l'historique des entrées déjà créées.

## UI

Nouvel onglet **"Dépenses obligatoires"** dans `Finance.jsx`, entre "Transactions" et "Projets".

- En-tête : sélecteur de mois (◀ "Juin 2026" ▶) + bouton "Gérer les obligations".
- 3 indicateurs : Total obligations / Payé / Restant (somme des montants du mois affiché).
- Liste : checkbox, nom, badge catégorie, montant, statut visuel (coché = vert, en attente = neutre).
- Réutilisation des composants existants : `Modal`, `Badge`, `btnPrimary`/`btnSecondary`, classes `inputClass`/`labelClass`.

## Hors scope

- Pas de notifications/rappels automatiques pour les obligations non payées en fin de mois.
- Pas de génération rétroactive pour les mois futurs (seul le mois courant et les mois déjà visités génèrent des entrées).
- Pas de montant variable par défaut différent par mois autre que la copie du modèle (l'utilisateur ajuste manuellement au moment de cocher si besoin).
