# Surcharges de droits par utilisateur (Phase 1 — UI) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à l'administrateur d'accorder/retirer, par utilisateur, la visibilité et les droits Créer/Modifier/Supprimer de chaque page, en surchargeant le rôle — au niveau de l'interface.

**Architecture :** Une colonne `User.permissions` (JSONB, écarts au rôle) ; toute la logique de décision isolée dans un module pur `src/lib/permissions.js` ; `AuthContext` expose `hasAccess(page)` (étendu) et `can(action, page)` ; une matrice d'administration sur la page Utilisateurs ; les boutons CRUD des pages ressources sont masqués via `can(...)`. Les administrateurs ignorent toujours les surcharges.

**Tech Stack :** React, Vite, TanStack Query v5, Supabase JS, lucide-react, Tailwind.

**Spec :** `docs/superpowers/specs/2026-07-20-user-permission-overrides-design.md`

## Global Constraints

- **Application UI uniquement** (pas de RLS dans cette phase). C'est un garde d'interface.
- **Grain** : page × {view, create, update, delete}.
- **Stockage épars** dans `User.permissions` : n'écrire que les écarts au défaut du rôle ; `null` = 100 % rôle.
- **Administrateur (`roleName === 'Administrateur'`) immunisé** : `hasAccess`/`can` renvoient toujours `true`.
- **Pas de framework de test** dans le repo (scripts : `dev`, `build`, `lint`, `preview`). Vérification = `npm run build` + `npx eslint <fichiers>` + contrôles manuels décrits. La logique pure est vérifiée par un script Node ponctuel.
- **Boutons masqués** (pas seulement désactivés) quand un droit est refusé.
- **React Query v5** : `onSuccess`/`onError` n'existent PAS sur `useQuery` (valides sur `useMutation`).
- **ESLint** : `preserve-caught-error` exige `{ cause: err }` sur une erreur re-levée ; pas d'import inutilisé.
- Clés de page = clés de `ROUTE_ACCESS` : `dashboard, projects, clients, calendar, tasks, productions, editorial, team, finance, invoices, documents, ai, users, history, bilan, settings`.

---

## File Structure

- **Create** `supabase/migrations/0025_user_permissions.sql` — ajoute la colonne.
- **Create** `src/lib/permissions.js` — logique pure : liste des pages, défauts, `computeHasAccess`, `computeCan`, `effectiveMatrix`, `diffFromRole`.
- **Modify** `src/context/AuthContext.jsx` — `hasAccess` via `computeHasAccess` ; nouveau `can` ; exposition dans la valeur du contexte.
- **Create** `src/components/PermissionsModal.jsx` — éditeur matrice, écrit `User.permissions`.
- **Modify** `src/pages/Users.jsx` — bouton « Droits » par utilisateur non-admin + rendu du modal.
- **Modify** pages ressources (masquage CRUD via `can`) : `Projects.jsx`, `Clients.jsx`, `ClientDetail.jsx`, `Finance.jsx`, `Invoices.jsx`, `Tasks.jsx`, `Calendar.jsx`, `Productions.jsx`, `Documents.jsx`, `EditorialCalendar.jsx`.

---

## Task 1 : Migration + module de logique pure

**Files:**
- Create: `supabase/migrations/0025_user_permissions.sql`
- Create: `src/lib/permissions.js`

**Interfaces produites (consommées par les tâches suivantes) :**
- `PERMISSION_PAGES: { key: string, label: string, readOnly?: boolean }[]`
- `computeHasAccess(roleName: string, permissions: object|null, page: string): boolean`
- `computeCan(roleName: string, permissions: object|null, page: string, action: 'create'|'update'|'delete'): boolean`
- `effectiveMatrix(roleName, permissions): { [page]: { view, create, update, delete } }`
- `diffFromRole(roleName, matrix): object|null`

- [ ] **Step 1 : Écrire la migration**

`supabase/migrations/0025_user_permissions.sql` :
```sql
-- Migration 0025 — Surcharges de droits par utilisateur (Phase 1, UI)
-- Stocke les écarts au rôle par page : { "finance": { "view": false }, ... }
alter table "User" add column if not exists "permissions" jsonb;
```

- [ ] **Step 2 : Écrire le module pur**

`src/lib/permissions.js` :
```js
import { ROUTE_ACCESS } from './constants'

// Pages contrôlables. readOnly = pas d'actions CRUD (seule la visibilité compte).
export const PERMISSION_PAGES = [
  { key: 'dashboard', label: 'Tableau de bord', readOnly: true },
  { key: 'projects', label: 'Projets' },
  { key: 'clients', label: 'Clients' },
  { key: 'calendar', label: 'Calendrier' },
  { key: 'tasks', label: 'Tâches' },
  { key: 'productions', label: 'Productions' },
  { key: 'editorial', label: 'Éditorial' },
  { key: 'team', label: 'Équipe', readOnly: true },
  { key: 'finance', label: 'Finances' },
  { key: 'invoices', label: 'Factures' },
  { key: 'documents', label: 'Documents' },
  { key: 'ai', label: 'IA', readOnly: true },
  { key: 'users', label: 'Utilisateurs' },
  { key: 'history', label: 'Historique', readOnly: true },
  { key: 'bilan', label: 'Bilan', readOnly: true },
  { key: 'settings', label: 'Paramètres', readOnly: true },
]

export const CRUD_ACTIONS = ['create', 'update', 'delete']

// Actions déjà réservées à l'admin dans le code actuel (à ne pas desserrer).
export const ADMIN_ONLY_DEFAULT = {
  finance: ['update', 'delete'],
}

export function isAdminRole(roleName) {
  return roleName === 'Administrateur'
}

export function defaultView(roleName, page) {
  const allowed = ROUTE_ACCESS[page]
  if (!allowed) return true // route inconnue = non restreinte
  return allowed.includes(roleName)
}

export function defaultCan(roleName, page, action) {
  if (ADMIN_ONLY_DEFAULT[page]?.includes(action)) return false // non-admin par défaut
  return defaultView(roleName, page)
}

export function computeHasAccess(roleName, permissions, page) {
  if (isAdminRole(roleName)) return true
  const ov = permissions?.[page]?.view
  if (ov === true) return true
  if (ov === false) return false
  return defaultView(roleName, page)
}

export function computeCan(roleName, permissions, page, action) {
  if (isAdminRole(roleName)) return true
  if (!computeHasAccess(roleName, permissions, page)) return false
  const ov = permissions?.[page]?.[action]
  if (ov === false) return false
  if (ov === true) return true
  return defaultCan(roleName, page, action)
}

// Matrice booléenne effective (pour préremplir l'UI d'admin).
export function effectiveMatrix(roleName, permissions) {
  const m = {}
  for (const { key } of PERMISSION_PAGES) {
    m[key] = {
      view: computeHasAccess(roleName, permissions, key),
      create: computeCan(roleName, permissions, key, 'create'),
      update: computeCan(roleName, permissions, key, 'update'),
      delete: computeCan(roleName, permissions, key, 'delete'),
    }
  }
  return m
}

// Convertit une matrice éditée en surcharges éparses (écarts au défaut du rôle).
export function diffFromRole(roleName, matrix) {
  const out = {}
  for (const { key, readOnly } of PERMISSION_PAGES) {
    const pageDiff = {}
    if (matrix[key].view !== defaultView(roleName, key)) pageDiff.view = matrix[key].view
    if (!readOnly) {
      for (const action of CRUD_ACTIONS) {
        if (matrix[key][action] !== defaultCan(roleName, key, action)) {
          pageDiff[action] = matrix[key][action]
        }
      }
    }
    if (Object.keys(pageDiff).length) out[key] = pageDiff
  }
  return Object.keys(out).length ? out : null
}
```

- [ ] **Step 3 : Vérifier la table de vérité (script Node ponctuel)**

Créer un fichier temporaire `check-perms.mjs` à la racine :
```js
import assert from 'node:assert'
import {
  computeHasAccess, computeCan, diffFromRole, defaultView,
} from './src/lib/permissions.js'

// Admin : tout autorisé, surcharges ignorées.
assert.equal(computeHasAccess('Administrateur', { finance: { view: false } }, 'finance'), true)
assert.equal(computeCan('Administrateur', { finance: { delete: false } }, 'finance', 'delete'), true)

// Manager : voit finance par défaut, mais update/delete réservés admin.
assert.equal(computeHasAccess('Manager', null, 'finance'), true)
assert.equal(computeCan('Manager', null, 'finance', 'delete'), false)
assert.equal(computeCan('Manager', null, 'finance', 'create'), true)

// Surcharge : retirer la vue de finance à un Manager.
assert.equal(computeHasAccess('Manager', { finance: { view: false } }, 'finance'), false)
// Un droit refusé sur une page invisible reste refusé.
assert.equal(computeCan('Manager', { finance: { view: false } }, 'finance', 'create'), false)

// Surcharge : accorder delete transaction à un Manager précis.
assert.equal(computeCan('Manager', { finance: { delete: true } }, 'finance', 'delete'), true)

// Octroi d'une page hors rôle : Photographe n'a pas clients par défaut.
assert.equal(computeHasAccess('Photographe', null, 'clients'), false)
assert.equal(computeHasAccess('Photographe', { clients: { view: true } }, 'clients'), true)

// diffFromRole : ne stocke que les écarts.
assert.deepEqual(diffFromRole('Manager', {
  ...Object.fromEntries(['dashboard','projects','clients','calendar','tasks','productions','editorial','team','finance','invoices','documents','ai','users','history','bilan','settings'].map(k => [k, { view: defaultView('Manager', k), create: true, update: true, delete: true }])),
  finance: { view: true, create: true, update: false, delete: false },
}), null) // rien ne dévie du défaut Manager

console.log('OK permissions truth table')
```
Run : `node check-perms.mjs`
Expected : `OK permissions truth table` (aucune AssertionError).

- [ ] **Step 4 : Supprimer le fichier temporaire**

Run : `rm check-perms.mjs`

- [ ] **Step 5 : Lint + commit**

Run : `npx eslint src/lib/permissions.js` (attendu : aucune erreur)
```bash
git add supabase/migrations/0025_user_permissions.sql src/lib/permissions.js
git commit -m "feat(permissions): module de logique pure + migration colonne User.permissions"
```

---

## Task 2 : Câbler AuthContext (visibilité automatique + `can`)

**Files:**
- Modify: `src/context/AuthContext.jsx`

**Interfaces:**
- Consomme : `computeHasAccess`, `computeCan` de `src/lib/permissions.js`.
- Produit : `useAuth().hasAccess(page)` (comportement étendu, même signature) et `useAuth().can(action, page)`.

- [ ] **Step 1 : Importer le module**

Ajouter en haut de `src/context/AuthContext.jsx`, sous l'import de `ROUTE_ACCESS` (ou en le remplaçant s'il n'est plus utilisé ailleurs) :
```js
import { computeHasAccess, computeCan } from '../lib/permissions'
```
Retirer l'import `ROUTE_ACCESS` seulement s'il n'a plus d'usage dans le fichier après l'étape 2 (sinon le laisser).

- [ ] **Step 2 : Remplacer `hasAccess` et ajouter `can`**

Remplacer la fonction `hasAccess` existante par :
```js
  const hasAccess = (page) => {
    if (!user) return false
    const roleName = user.roleRel?.name || user.role
    return computeHasAccess(roleName, user.permissions, page)
  }

  const can = (action, page) => {
    if (!user) return false
    const roleName = user.roleRel?.name || user.role
    return computeCan(roleName, user.permissions, page, action)
  }
```

- [ ] **Step 3 : Exposer `can` dans la valeur du contexte**

Dans l'objet `value`, ajouter `can,` à côté de `hasAccess,`.

- [ ] **Step 4 : Build + commit**

Run : `npm run build` (attendu : `✓ built`) ; `npx eslint src/context/AuthContext.jsx` (attendu : uniquement l'erreur pré-existante `react-refresh/only-export-components` sur l'export `useAuth`, aucune nouvelle).
```bash
git add src/context/AuthContext.jsx
git commit -m "feat(permissions): hasAccess consulte les surcharges + expose can()"
```

**Vérif manuelle** (après application de la migration 0025) : la visibilité des pages suit désormais `permissions.view` — testée en Task 3.

---

## Task 3 : Matrice d'administration (PermissionsModal + page Utilisateurs)

**Files:**
- Create: `src/components/PermissionsModal.jsx`
- Modify: `src/pages/Users.jsx`

**Interfaces:**
- Consomme : `PERMISSION_PAGES`, `CRUD_ACTIONS`, `effectiveMatrix`, `diffFromRole`.
- Produit : composant `<PermissionsModal user={user} onClose={fn} />`.

- [ ] **Step 1 : Créer le composant matrice**

`src/components/PermissionsModal.jsx` :
```jsx
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { PERMISSION_PAGES, CRUD_ACTIONS, effectiveMatrix, diffFromRole } from '../lib/permissions'
import Modal from './ui/Modal'
import { btnPrimary, btnSecondary } from '../lib/ui'

const COL_LABELS = { view: 'Voir', create: 'Créer', update: 'Modifier', delete: 'Supprimer' }
const COLS = ['view', ...CRUD_ACTIONS]

export default function PermissionsModal({ user, onClose }) {
  const queryClient = useQueryClient()
  const roleName = user.roleRel?.name || user.role
  const [matrix, setMatrix] = useState(() => effectiveMatrix(roleName, user.permissions))

  const toggle = (page, col) =>
    setMatrix((m) => ({ ...m, [page]: { ...m[page], [col]: !m[page][col] } }))

  const saveMutation = useMutation({
    mutationFn: async (permissions) => {
      const { error } = await supabase.from('User').update({ permissions }).eq('id', user.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['team'] })
      toast.success('Droits mis à jour')
      onClose()
    },
    onError: (err) => toast.error(err.message),
  })

  const reset = () => {
    setMatrix(effectiveMatrix(roleName, null))
    saveMutation.mutate(null)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Droits — ${user.name}`}
      maxWidth="max-w-2xl"
      footer={
        <>
          <button type="button" onClick={reset} disabled={saveMutation.isPending} className={btnSecondary}>
            Réinitialiser (suivre le rôle)
          </button>
          <div className="flex-1" />
          <button type="button" onClick={onClose} className={btnSecondary}>Annuler</button>
          <button
            type="button"
            onClick={() => saveMutation.mutate(diffFromRole(roleName, matrix))}
            disabled={saveMutation.isPending}
            className={btnPrimary}
          >
            Enregistrer
          </button>
        </>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead>
            <tr className="border-b border-c-border text-xs uppercase text-text-muted">
              <th className="p-2 font-medium">Page</th>
              {COLS.map((c) => (
                <th key={c} className="p-2 text-center font-medium">{COL_LABELS[c]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_PAGES.map(({ key, label, readOnly }) => (
              <tr key={key} className="border-b border-c-border last:border-0">
                <td className="p-2 text-text-primary">{label}</td>
                {COLS.map((col) => {
                  const disabled = readOnly && col !== 'view'
                  return (
                    <td key={col} className="p-2 text-center">
                      {disabled ? (
                        <span className="text-text-muted">—</span>
                      ) : (
                        <input
                          type="checkbox"
                          checked={matrix[key][col]}
                          onChange={() => toggle(key, col)}
                          className="h-4 w-4 accent-accent-purple"
                        />
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-text-muted">
        Ces droits s'appliquent à l'interface de cet utilisateur et priment sur son rôle.
        L'administrateur n'est jamais restreint.
      </p>
    </Modal>
  )
}
```
> Vérifier que `Modal` accepte la prop `maxWidth` (utilisée par `Projects.jsx`) ; sinon retirer la prop.

- [ ] **Step 2 : Ajouter le bouton « Droits » sur la page Utilisateurs**

Dans `src/pages/Users.jsx` :
1. Importer l'icône et le composant :
```jsx
import { ShieldCheck } from 'lucide-react'
import PermissionsModal from '../components/PermissionsModal'
```
2. Ajouter l'état sous les autres `useState` du composant :
```jsx
const [permUser, setPermUser] = useState(null)
```
3. Sur chaque ligne/carte utilisateur, pour un utilisateur **non-administrateur**, ajouter un bouton :
```jsx
{(u.roleRel?.name || u.role) !== 'Administrateur' && (
  <button
    type="button"
    onClick={() => setPermUser(u)}
    className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-bg-hover hover:text-accent-purple"
    title="Gérer les droits"
    aria-label="Gérer les droits"
  >
    <ShieldCheck size={16} />
  </button>
)}
```
   (Adapter `u` au nom de la variable d'itération réelle de `Users.jsx`.)
4. Rendre le modal une seule fois, avant la fermeture du composant :
```jsx
{permUser && <PermissionsModal user={permUser} onClose={() => setPermUser(null)} />}
```

- [ ] **Step 3 : Build + lint + commit**

Run : `npm run build` ; `npx eslint src/components/PermissionsModal.jsx src/pages/Users.jsx`
```bash
git add src/components/PermissionsModal.jsx src/pages/Users.jsx
git commit -m "feat(permissions): matrice d'administration des droits par utilisateur"
```

**Vérif manuelle** (migration 0025 appliquée) : Utilisateurs → « Droits » sur un non-admin → décocher « Voir » sur Finances → Enregistrer → cet utilisateur ne voit plus Finances (menu + route) ; l'admin, si.

---

## Task 4 : Masquage CRUD — Projets & Clients

**Files:**
- Modify: `src/pages/Projects.jsx`, `src/pages/Clients.jsx`, `src/pages/ClientDetail.jsx`

**Interfaces:** Consomme `useAuth().can`.

- [ ] **Step 1 : Projets**

Dans `src/pages/Projects.jsx`, récupérer `can` : `const { user, can } = useAuth()` (l'import `useAuth` existe déjà).
- Bouton « Nouveau projet » : envelopper `{can('create','projects') && (<button …>Nouveau projet</button>)}`.
- Bouton crayon d'édition (carte) : envelopper `{can('update','projects') && (<button … openEditModal …>)}`.
- Dans le modal, bouton « Supprimer » : condition actuelle `editingProject &&` → `editingProject && can('delete','projects') &&`.

- [ ] **Step 2 : Clients (liste + détail)**

Dans `src/pages/Clients.jsx` : ajouter `import { useAuth } from '../context/AuthContext'` puis `const { can } = useAuth()`.
- Bouton « Nouveau client » : `{can('create','clients') && (<button …>)}`.
- Dans le modal d'édition, bouton « Supprimer » : condition `editingClient &&` → `editingClient && can('delete','clients') &&`.

Dans `src/pages/ClientDetail.jsx` (importe déjà `useAuth`) : `const { user, can } = useAuth()`.
- Bouton « Modifier » (en-tête) : `{can('update','clients') && (<button … openEdit …>)}`.
- Bouton « Supprimer » : remplacer la condition `isAdmin` par `can('delete','clients')` (l'admin renvoie déjà `true`).

- [ ] **Step 3 : Build + lint + commit**

Run : `npm run build` ; `npx eslint src/pages/Projects.jsx src/pages/Clients.jsx src/pages/ClientDetail.jsx`
```bash
git add src/pages/Projects.jsx src/pages/Clients.jsx src/pages/ClientDetail.jsx
git commit -m "feat(permissions): masquage CRUD Projets & Clients selon can()"
```

---

## Task 5 : Masquage CRUD — Finances & Factures

**Files:**
- Modify: `src/pages/Finance.jsx`, `src/pages/Invoices.jsx`

- [ ] **Step 1 : Finances**

Dans `src/pages/Finance.jsx` (importe déjà `useAuth`) : `const { user, can } = useAuth()`.
- Bouton « Ajouter » (onglet Transactions) : `{can('create','finance') && (<button … openCreateTx …>)}`.
- Ouverture en édition sur clic de ligne : remplacer `onClick={isAdmin ? () => openEditTx(tx) : undefined}` par `onClick={can('update','finance') ? () => openEditTx(tx) : undefined}` et la classe `isAdmin ? 'cursor-pointer …' : ''` par `can('update','finance') ? '…' : ''`.
- Dans le modal transaction, bouton « Supprimer » : `isAdmin && editingTx &&` → `can('delete','finance') && editingTx &&`.

- [ ] **Step 2 : Factures**

Dans `src/pages/Invoices.jsx` : s'assurer d'avoir `const { can } = useAuth()` (ajouter l'import `useAuth` si absent).
- Bouton de création de facture/reçu : `{can('create','invoices') && (…)}`.
- Boutons/actions d'édition : `{can('update','invoices') && (…)}`.
- Boutons de suppression : `{can('delete','invoices') && (…)}`.
  (Repérer les boutons réels via leurs icônes `Plus`/`Pencil`/`Trash2` ; appliquer le même patron de masquage.)

- [ ] **Step 3 : Build + lint + commit**

Run : `npm run build` ; `npx eslint src/pages/Finance.jsx src/pages/Invoices.jsx`
```bash
git add src/pages/Finance.jsx src/pages/Invoices.jsx
git commit -m "feat(permissions): masquage CRUD Finances & Factures selon can()"
```

---

## Task 6 : Masquage CRUD — Tâches, Calendrier, Productions

**Files:**
- Modify: `src/pages/Tasks.jsx`, `src/pages/Calendar.jsx`, `src/pages/Productions.jsx`

- [ ] **Step 1 : Câbler `can`**

Dans chacun des trois fichiers, obtenir `can` depuis `useAuth` (ajouter l'import si absent).

- [ ] **Step 2 : Masquer les boutons**

Pour chaque page, avec la clé correspondante (`tasks`, `calendar`, `productions`) :
- Bouton de création (« Nouvel/Ajouter … », icône `Plus`) : `{can('create', <page>) && (…)}`.
- Ouverture en édition (clic carte/case ou bouton crayon) : n'attacher le `onClick` d'édition que si `can('update', <page>)` (sinon `undefined` et retirer les styles `cursor-pointer`/hover d'édition).
- Bouton « Supprimer » (icône `Trash2`, souvent dans le modal ou le détail d'événement) : `{can('delete', <page>) && (…)}`.

- [ ] **Step 3 : Build + lint + commit**

Run : `npm run build` ; `npx eslint src/pages/Tasks.jsx src/pages/Calendar.jsx src/pages/Productions.jsx`
```bash
git add src/pages/Tasks.jsx src/pages/Calendar.jsx src/pages/Productions.jsx
git commit -m "feat(permissions): masquage CRUD Tâches, Calendrier, Productions selon can()"
```

---

## Task 7 : Masquage CRUD — Documents & Éditorial

**Files:**
- Modify: `src/pages/Documents.jsx`, `src/pages/EditorialCalendar.jsx`

- [ ] **Step 1 : Câbler `can`**

Obtenir `can` depuis `useAuth` dans les deux fichiers (ajouter l'import si absent).

- [ ] **Step 2 : Masquer les boutons**

- `Documents.jsx` (clé `documents`) : bouton d'ajout/upload → `{can('create','documents') && (…)}` ; boutons de suppression → `{can('delete','documents') && (…)}`.
- `EditorialCalendar.jsx` (clé `editorial`) : bouton de création → `{can('create','editorial') && (…)}` ; édition → gate `can('update','editorial')` ; suppression → `{can('delete','editorial') && (…)}`.

- [ ] **Step 3 : Build + lint + commit**

Run : `npm run build` ; `npx eslint src/pages/Documents.jsx src/pages/EditorialCalendar.jsx`
```bash
git add src/pages/Documents.jsx src/pages/EditorialCalendar.jsx
git commit -m "feat(permissions): masquage CRUD Documents & Éditorial selon can()"
```

---

## Task 8 : Vérification finale

- [ ] **Step 1 : Build complet**

Run : `npm run build` (attendu : `✓ built`).

- [ ] **Step 2 : Lint global**

Run : `npm run lint` — vérifier qu'aucune **nouvelle** erreur n'est introduite (seules subsistent les erreurs pré-existantes déjà connues : `react-refresh/only-export-components` sur `AuthContext`, imports inutilisés `Pencil`/`PROJECT_STATUS_OPTIONS` dans `ProjectDetail`).

- [ ] **Step 3 : Contrôles manuels (migration 0025 appliquée)**

Vérifier, connecté en admin, via Utilisateurs → « Droits » sur un utilisateur non-admin de test :
- Décocher **Voir** Finances → l'utilisateur ne voit plus Finances (menu + accès direct à l'URL bloqué), l'admin oui.
- Décocher **Supprimer** Clients → bouton « Supprimer » masqué sur la fiche client pour lui.
- Cocher **Voir** une page hors de son rôle → elle apparaît pour lui.
- Cocher **Supprimer** Finances (défaut admin-only) → l'utilisateur peut supprimer une transaction.
- « Réinitialiser (suivre le rôle) » → l'utilisateur retrouve exactement le comportement de son rôle.
- Ligne **Administrateur** : pas de bouton « Droits ».

- [ ] **Step 4 : Note de déploiement**

Rappeler à l'utilisateur : appliquer `0025_user_permissions.sql` dans le SQL Editor Supabase pour activer la fonctionnalité (sans la colonne, `user.permissions` est `undefined` → comportement 100 % rôle, sans erreur).

---

## Self-Review (couverture de la spec)

- Modèle `User.permissions` JSONB → Task 1 (migration + module). ✓
- `hasAccess` étendu + `can` + admin immunisé → Task 1 (logique) + Task 2 (contexte). ✓
- `ADMIN_ONLY_DEFAULT` (préserver finance update/delete admin-only) → Task 1. ✓
- Matrice d'admin sur page Utilisateurs + « Réinitialiser » + stockage épars → Task 3. ✓
- Câblage CRUD des pages ressources listées → Tasks 4–7. ✓
- Migration 0025 → Task 1 + rappel Task 8. ✓
- Caveat sécurité UI-only → Global Constraints + note Task 8. ✓
