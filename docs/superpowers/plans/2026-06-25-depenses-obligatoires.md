# Dépenses obligatoires Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Dépenses obligatoires" tab to the Finance page: a monthly checklist of recurring mandatory expenses (rent, subscriptions, etc.) that, when checked, creates a real expense `Transaction` so existing totals/charts stay accurate.

**Architecture:** Two new Supabase tables (`ObligationTemplate` for the user-managed list of obligation types, `ObligationEntry` for one row per obligation × month, snapshotting name/amount/category so history survives template edits). A new `src/lib/obligations.js` data layer (fetch + mutations) and a new `src/components/ObligationsTab.jsx` UI component, wired into `src/pages/Finance.jsx` as a new tab.

**Tech Stack:** React 19, Vite, @tanstack/react-query, @supabase/supabase-js, react-hot-toast, lucide-react, Tailwind CSS.

## Global Constraints

- Follow the spec exactly: `docs/superpowers/specs/2026-06-25-depenses-obligatoires-design.md`.
- Table names are PascalCase, quoted (`"ObligationTemplate"`); column names are camelCase, quoted (`"defaultAmount"`) — matches every existing migration in `supabase/migrations/`.
- RLS pattern must match existing Finance tables exactly: `select` policy uses `auth.role() = 'authenticated'`; write policy uses `public.get_user_role() is not null` (see `supabase/migrations/0002_update_schema.sql:303-339`).
- This repo has **no automated test runner** (no Jest/Vitest config, no `*.test.*` files outside `node_modules`). Verification for every task is: `npm run build` (catches syntax/type errors), `npm run lint`, and a manual walkthrough in the running dev server — consistent with how the rest of this codebase is verified.
- UI must reuse existing shared primitives: `Modal`, `Badge`, `inputClass`/`labelClass`/`btnPrimary`/`btnSecondary`/`btnDanger` from `src/lib/ui.js`, `formatCurrency` from `src/lib/format.js`. Do not introduce new styling primitives.
- Applying the SQL migration to the live Supabase project is a **shared, hard-to-reverse action** — do not run it automatically. Stop and ask the user to confirm/apply it before treating Task 1 as done.

---

## Task 1: Database migration — `ObligationTemplate` + `ObligationEntry`

**Files:**
- Create: `supabase/migrations/0005_obligations.sql`

**Interfaces:**
- Produces: tables `"ObligationTemplate"(id, name, "defaultAmount", "categoryId", active, "createdAt")` and `"ObligationEntry"(id, "templateId", month, name, amount, "categoryId", done, "paidDate", "transactionId", "createdAt")`, used by all later tasks via Supabase queries.

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/0005_obligations.sql
-- Dépenses obligatoires : modèles d'obligations + entrées mensuelles

create table if not exists "ObligationTemplate" (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  "defaultAmount" numeric not null default 0,
  "categoryId" uuid references "FinanceCategory"(id) on delete set null,
  active boolean not null default true,
  "createdAt" timestamptz not null default now()
);

create table if not exists "ObligationEntry" (
  id uuid primary key default gen_random_uuid(),
  "templateId" uuid references "ObligationTemplate"(id) on delete set null,
  month date not null,
  name text not null,
  amount numeric not null,
  "categoryId" uuid references "FinanceCategory"(id) on delete set null,
  done boolean not null default false,
  "paidDate" date,
  "transactionId" uuid references "Transaction"(id) on delete set null,
  "createdAt" timestamptz not null default now()
);

create unique index if not exists obligation_entry_template_month_key
  on "ObligationEntry" ("templateId", month)
  where "templateId" is not null;

alter table "ObligationTemplate" enable row level security;
alter table "ObligationEntry" enable row level security;

create policy "obligation_template_select" on "ObligationTemplate"
  for select using (auth.role() = 'authenticated');
create policy "obligation_template_write" on "ObligationTemplate"
  for all using (public.get_user_role() is not null)
  with check (public.get_user_role() is not null);

create policy "obligation_entry_select" on "ObligationEntry"
  for select using (auth.role() = 'authenticated');
create policy "obligation_entry_write" on "ObligationEntry"
  for all using (public.get_user_role() is not null)
  with check (public.get_user_role() is not null);
```

- [ ] **Step 2: Apply the migration — ASK THE USER FIRST**

This changes the live Supabase project referenced in `.env` (`VITE_SUPABASE_URL`). Before running anything, tell the user what will be applied and ask them to confirm. Once confirmed, apply it either:
  - via the Supabase Dashboard → SQL Editor → paste the file content → Run, or
  - via the Supabase MCP `apply_migration` tool, if the user wants it applied that way.

Do not proceed to verification until the user confirms it has been applied.

- [ ] **Step 3: Verify the tables exist**

Ask the user to confirm in the Supabase Dashboard (Table Editor) that `ObligationTemplate` and `ObligationEntry` appear, or use the Supabase MCP `list_tables` tool.
Expected: both tables listed, RLS enabled.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0005_obligations.sql
git commit -m "feat(db): add ObligationTemplate and ObligationEntry tables"
```

(Skip if this directory is not a git repository.)

---

## Task 2: Data layer — `src/lib/obligations.js`

**Files:**
- Create: `src/lib/obligations.js`

**Interfaces:**
- Consumes: `supabase` client from `src/lib/supabase.js`.
- Produces (used by Task 3):
  - `monthKey(date: Date): string` — formats to `'YYYY-MM-01'`
  - `fetchObligationTemplates(): Promise<Array<{id, name, defaultAmount, categoryId, active, categoryRel}>>`
  - `fetchObligationEntries(month: string): Promise<Array<{id, templateId, month, name, amount, categoryId, done, paidDate, transactionId, categoryRel}>>`
  - `generateMissingEntries(month: string, templates: Array, existingEntries: Array): Promise<Array>`
  - `payObligationEntry(entry: object, { amount: number, paidDate: string }): Promise<void>`
  - `unpayObligationEntry(entry: object): Promise<void>`
  - `saveObligationTemplate(payload: object, editingId?: string): Promise<void>`
  - `setObligationTemplateActive(id: string, active: boolean): Promise<void>`

- [ ] **Step 1: Write `src/lib/obligations.js`**

```js
import { supabase } from './supabase'

export function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
}

export async function fetchObligationTemplates() {
  const { data, error } = await supabase
    .from('ObligationTemplate')
    .select('*, categoryRel:FinanceCategory(id, name, color)')
    .order('name')
  if (error) throw error
  return data || []
}

export async function fetchObligationEntries(month) {
  const { data, error } = await supabase
    .from('ObligationEntry')
    .select('*, categoryRel:FinanceCategory(id, name, color)')
    .eq('month', month)
    .order('name')
  if (error) throw error
  return data || []
}

export async function generateMissingEntries(month, templates, existingEntries) {
  const existingTemplateIds = new Set(existingEntries.map((e) => e.templateId).filter(Boolean))
  const missing = templates.filter((t) => t.active && !existingTemplateIds.has(t.id))
  if (missing.length === 0) return []

  const rows = missing.map((t) => ({
    templateId: t.id,
    month,
    name: t.name,
    amount: t.defaultAmount,
    categoryId: t.categoryId,
  }))

  const { data, error } = await supabase
    .from('ObligationEntry')
    .insert(rows)
    .select('*, categoryRel:FinanceCategory(id, name, color)')
  if (error) throw error
  return data || []
}

export async function payObligationEntry(entry, { amount, paidDate }) {
  const { data: tx, error: txError } = await supabase
    .from('Transaction')
    .insert({
      type: 'EXPENSE',
      amount,
      categoryId: entry.categoryId,
      description: entry.name,
      date: paidDate,
    })
    .select()
    .single()
  if (txError) throw txError

  const { error } = await supabase
    .from('ObligationEntry')
    .update({ done: true, amount, paidDate, transactionId: tx.id })
    .eq('id', entry.id)
  if (error) throw error
}

export async function unpayObligationEntry(entry) {
  if (entry.transactionId) {
    const { error: txError } = await supabase.from('Transaction').delete().eq('id', entry.transactionId)
    if (txError) throw txError
  }
  const { error } = await supabase
    .from('ObligationEntry')
    .update({ done: false, paidDate: null, transactionId: null })
    .eq('id', entry.id)
  if (error) throw error
}

export async function saveObligationTemplate(payload, editingId) {
  if (editingId) {
    const { error } = await supabase.from('ObligationTemplate').update(payload).eq('id', editingId)
    if (error) throw error
  } else {
    const { error } = await supabase.from('ObligationTemplate').insert(payload)
    if (error) throw error
  }
}

export async function setObligationTemplateActive(id, active) {
  const { error } = await supabase.from('ObligationTemplate').update({ active }).eq('id', id)
  if (error) throw error
}
```

- [ ] **Step 2: Verify it builds**

Run: `npm run build`
Expected: build succeeds with no errors referencing `src/lib/obligations.js` (the file isn't imported anywhere yet, so this only checks syntax validity).

- [ ] **Step 3: Commit**

```bash
git add src/lib/obligations.js
git commit -m "feat: add obligations data layer"
```

(Skip if this directory is not a git repository.)

---

## Task 3: `ObligationsTab` component + wire into Finance page

**Files:**
- Create: `src/components/ObligationsTab.jsx`
- Modify: `src/pages/Finance.jsx`

**Interfaces:**
- Consumes: everything exported from `src/lib/obligations.js` (Task 2), `Modal`/`Badge` from `src/components/ui/`, `inputClass`/`labelClass`/`btnPrimary`/`btnSecondary`/`btnDanger` from `src/lib/ui.js`, `formatCurrency` from `src/lib/format.js`. Receives `categories` (array of `{id, name, color, type}`, already fetched in `Finance.jsx`) as a prop — no duplicate fetch.
- Produces: default export `ObligationsTab({ categories })`, rendered by `Finance.jsx`.

- [ ] **Step 1: Write `src/components/ObligationsTab.jsx`**

```jsx
import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ChevronLeft, ChevronRight, CheckCircle2, Circle, Settings2, Plus, Pencil, Trash2,
} from 'lucide-react'
import {
  fetchObligationTemplates, fetchObligationEntries, generateMissingEntries,
  payObligationEntry, unpayObligationEntry, saveObligationTemplate, setObligationTemplateActive,
  monthKey,
} from '../lib/obligations'
import { formatCurrency } from '../lib/format'
import Badge from './ui/Badge'
import Modal from './ui/Modal'
import { inputClass, labelClass, btnPrimary, btnSecondary } from '../lib/ui'

const MONTH_LABEL_FORMAT = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' })
const EMPTY_TEMPLATE = { name: '', defaultAmount: '', categoryId: '' }

export default function ObligationsTab({ categories }) {
  const queryClient = useQueryClient()
  const [monthDate, setMonthDate] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const month = monthKey(monthDate)

  const [manageOpen, setManageOpen] = useState(false)
  const [templateModalOpen, setTemplateModalOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState(null)
  const [templateForm, setTemplateForm] = useState(EMPTY_TEMPLATE)

  const [payModalOpen, setPayModalOpen] = useState(false)
  const [payingEntry, setPayingEntry] = useState(null)
  const [payForm, setPayForm] = useState({ amount: '', paidDate: '' })

  const { data: templates = [] } = useQuery({
    queryKey: ['obligation-templates'],
    queryFn: fetchObligationTemplates,
    onError: (e) => toast.error(e.message),
  })

  const { data: entries = [], isLoading: loadingEntries } = useQuery({
    queryKey: ['obligation-entries', month],
    queryFn: () => fetchObligationEntries(month),
    onError: (e) => toast.error(e.message),
  })

  const generateMutation = useMutation({
    mutationFn: () => generateMissingEntries(month, templates, entries),
    onSuccess: (created) => {
      if (created.length > 0) {
        queryClient.invalidateQueries({ queryKey: ['obligation-entries', month] })
      }
    },
    onError: (e) => toast.error(e.message),
  })

  useEffect(() => {
    if (templates.length === 0 || generateMutation.isPending) return
    const existingTemplateIds = new Set(entries.map((e) => e.templateId).filter(Boolean))
    const hasMissing = templates.some((t) => t.active && !existingTemplateIds.has(t.id))
    if (hasMissing) generateMutation.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates, entries, month])

  const total = entries.reduce((s, e) => s + Number(e.amount || 0), 0)
  const paid = entries.filter((e) => e.done).reduce((s, e) => s + Number(e.amount || 0), 0)
  const remaining = total - paid

  const payMutation = useMutation({
    mutationFn: ({ entry, amount, paidDate }) => payObligationEntry(entry, { amount, paidDate }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['obligation-entries', month] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      toast.success('Obligation marquée comme payée')
      closePayModal()
    },
    onError: (e) => toast.error(e.message),
  })

  const unpayMutation = useMutation({
    mutationFn: (entry) => unpayObligationEntry(entry),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['obligation-entries', month] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      toast.success('Paiement annulé')
    },
    onError: (e) => toast.error(e.message),
  })

  const saveTemplateMutation = useMutation({
    mutationFn: (payload) => saveObligationTemplate(payload, editingTemplate?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['obligation-templates'] })
      toast.success(editingTemplate ? 'Obligation mise à jour' : 'Obligation ajoutée')
      closeTemplateModal()
    },
    onError: (e) => toast.error(e.message),
  })

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }) => setObligationTemplateActive(id, active),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['obligation-templates'] }),
    onError: (e) => toast.error(e.message),
  })

  function openPayModal(entry) {
    setPayingEntry(entry)
    setPayForm({ amount: entry.amount, paidDate: new Date().toISOString().slice(0, 10) })
    setPayModalOpen(true)
  }
  function closePayModal() {
    setPayModalOpen(false)
    setPayingEntry(null)
    setPayForm({ amount: '', paidDate: '' })
  }

  function openCreateTemplate() {
    setEditingTemplate(null)
    setTemplateForm(EMPTY_TEMPLATE)
    setTemplateModalOpen(true)
  }
  function openEditTemplate(t) {
    setEditingTemplate(t)
    setTemplateForm({ name: t.name, defaultAmount: t.defaultAmount, categoryId: t.categoryId || '' })
    setTemplateModalOpen(true)
  }
  function closeTemplateModal() {
    setTemplateModalOpen(false)
    setEditingTemplate(null)
    setTemplateForm(EMPTY_TEMPLATE)
  }

  function goToMonth(offset) {
    setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + offset, 1))
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => goToMonth(-1)} className={btnSecondary} aria-label="Mois précédent">
            <ChevronLeft size={15} />
          </button>
          <p className="min-w-[140px] text-center text-sm font-semibold capitalize text-text-primary">
            {MONTH_LABEL_FORMAT.format(monthDate)}
          </p>
          <button onClick={() => goToMonth(1)} className={btnSecondary} aria-label="Mois suivant">
            <ChevronRight size={15} />
          </button>
        </div>
        <button onClick={() => setManageOpen(true)} className={btnSecondary}>
          <Settings2 size={15} /> Gérer les obligations
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-c-border bg-bg-card p-4">
          <p className="text-xs text-text-muted">Total obligations</p>
          <p className="text-lg font-bold text-text-primary">{formatCurrency(total)}</p>
        </div>
        <div className="rounded-xl border border-c-border bg-bg-card p-4">
          <p className="text-xs text-text-muted">Payé</p>
          <p className="text-lg font-bold text-c-success">{formatCurrency(paid)}</p>
        </div>
        <div className="rounded-xl border border-c-border bg-bg-card p-4">
          <p className="text-xs text-text-muted">Restant</p>
          <p className="text-lg font-bold text-c-danger">{formatCurrency(remaining)}</p>
        </div>
      </div>

      {loadingEntries ? (
        <p className="text-text-secondary">Chargement…</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-text-muted">Aucune obligation pour ce mois. Ajoutez-en via « Gérer les obligations ».</p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between gap-3 rounded-xl border border-c-border bg-bg-card p-4">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => (entry.done ? unpayMutation.mutate(entry) : openPayModal(entry))}
                  disabled={unpayMutation.isPending}
                  aria-label={entry.done ? 'Marquer comme non payé' : 'Marquer comme payé'}
                >
                  {entry.done ? <CheckCircle2 size={20} className="text-c-success" /> : <Circle size={20} className="text-text-muted" />}
                </button>
                <div className="min-w-0">
                  <p className={`text-sm font-medium truncate ${entry.done ? 'line-through text-text-muted' : 'text-text-primary'}`}>
                    {entry.name}
                  </p>
                  {entry.categoryRel && <Badge color={entry.categoryRel.color || '#6e6a75'}>{entry.categoryRel.name}</Badge>}
                </div>
              </div>
              <p className={`font-semibold shrink-0 ${entry.done ? 'text-c-success' : 'text-text-secondary'}`}>
                {formatCurrency(entry.amount)}
              </p>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={payModalOpen}
        onClose={closePayModal}
        title="Confirmer le paiement"
        footer={
          <>
            <button type="button" onClick={closePayModal} className={btnSecondary}>Annuler</button>
            <button type="submit" form="pay-form" disabled={payMutation.isPending} className={btnPrimary}>Valider</button>
          </>
        }
      >
        <form
          id="pay-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (!payForm.amount || isNaN(Number(payForm.amount))) { toast.error('Montant invalide'); return }
            payMutation.mutate({ entry: payingEntry, amount: Number(payForm.amount), paidDate: payForm.paidDate })
          }}
          className="space-y-4"
        >
          <p className="text-sm text-text-secondary">{payingEntry?.name}</p>
          <div>
            <label className={labelClass}>Montant (€) *</label>
            <input type="number" min="0" step="0.01" required value={payForm.amount} onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Date de paiement</label>
            <input type="date" value={payForm.paidDate} onChange={(e) => setPayForm((f) => ({ ...f, paidDate: e.target.value }))} className={inputClass} />
          </div>
        </form>
      </Modal>

      <Modal
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        title="Gérer les obligations"
        footer={<button type="button" onClick={() => setManageOpen(false)} className={btnSecondary}>Fermer</button>}
      >
        <div className="space-y-3">
          <button onClick={openCreateTemplate} className={btnPrimary}>
            <Plus size={15} /> Ajouter une obligation
          </button>
          {templates.length === 0 ? (
            <p className="text-sm text-text-muted">Aucune obligation définie.</p>
          ) : (
            <div className="space-y-2">
              {templates.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg border border-c-border p-3">
                  <div className="min-w-0">
                    <p className={`text-sm font-medium truncate ${t.active ? 'text-text-primary' : 'text-text-muted line-through'}`}>{t.name}</p>
                    <p className="text-xs text-text-muted">{formatCurrency(t.defaultAmount)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => openEditTemplate(t)} className="rounded-lg p-1.5 text-text-muted hover:bg-bg-hover hover:text-text-primary">
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => toggleActiveMutation.mutate({ id: t.id, active: !t.active })}
                      className="rounded-lg p-1.5 text-text-muted hover:bg-bg-hover hover:text-c-danger"
                      aria-label={t.active ? 'Désactiver' : 'Réactiver'}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={templateModalOpen}
        onClose={closeTemplateModal}
        title={editingTemplate ? "Modifier l'obligation" : 'Nouvelle obligation'}
        footer={
          <>
            <button type="button" onClick={closeTemplateModal} className={btnSecondary}>Annuler</button>
            <button type="submit" form="template-form" disabled={saveTemplateMutation.isPending} className={btnPrimary}>Enregistrer</button>
          </>
        }
      >
        <form
          id="template-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (!templateForm.name.trim()) { toast.error('Nom requis'); return }
            if (!templateForm.defaultAmount || isNaN(Number(templateForm.defaultAmount))) { toast.error('Montant invalide'); return }
            saveTemplateMutation.mutate({
              name: templateForm.name.trim(),
              defaultAmount: Number(templateForm.defaultAmount),
              categoryId: templateForm.categoryId || null,
            })
          }}
          className="space-y-4"
        >
          <div>
            <label className={labelClass}>Nom *</label>
            <input value={templateForm.name} onChange={(e) => setTemplateForm((f) => ({ ...f, name: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Montant par défaut (€) *</label>
            <input type="number" min="0" step="0.01" value={templateForm.defaultAmount} onChange={(e) => setTemplateForm((f) => ({ ...f, defaultAmount: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Catégorie</label>
            <select value={templateForm.categoryId} onChange={(e) => setTemplateForm((f) => ({ ...f, categoryId: e.target.value }))} className={inputClass}>
              <option value="">— Aucune —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </form>
      </Modal>
    </div>
  )
}
```

- [ ] **Step 2: Wire the tab into `src/pages/Finance.jsx`**

In the imports section near the top (`src/pages/Finance.jsx:8-20`), add the new icon and component import:

```js
import {
  Wallet, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  Plus, Trash2, BarChart3, List, ListChecks,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatCurrency, isOverdue } from '../lib/format'
import {
  TRANSACTION_TYPE_LABELS, TRANSACTION_TYPE_COLORS, TRANSACTION_TYPE_OPTIONS,
} from '../lib/constants'
import Badge from '../components/ui/Badge'
import StatCard from '../components/ui/StatCard'
import Modal from '../components/ui/Modal'
import ObligationsTab from '../components/ObligationsTab'
import { inputClass, labelClass, btnPrimary, btnSecondary, btnDanger } from '../lib/ui'
```

Replace the `TABS` constant (`src/pages/Finance.jsx:72-76`):

```js
const TABS = [
  { key: 'overview', label: 'Vue d\'ensemble', icon: BarChart3 },
  { key: 'transactions', label: 'Transactions', icon: List },
  { key: 'obligations', label: 'Dépenses obligatoires', icon: ListChecks },
  { key: 'projects', label: 'Projets', icon: Wallet },
]
```

Add the new tab's render block right after the "Tab: Transactions" block and before the "Tab: Projects" block (`src/pages/Finance.jsx`, just before `{/* ── Tab: Projects ── */}` at line 353):

```jsx
      {/* ── Tab: Dépenses obligatoires ── */}
      {activeTab === 'obligations' && <ObligationsTab categories={categories} />}

```

- [ ] **Step 3: Verify it builds and lints**

Run: `npm run build`
Expected: build succeeds, no errors.

Run: `npm run lint`
Expected: no new errors introduced in `src/components/ObligationsTab.jsx` or `src/pages/Finance.jsx`.

- [ ] **Step 4: Manual walkthrough in the browser**

Run: `npm run dev`, open the app, log in, go to **Finance**.

1. Click the new **"Dépenses obligatoires"** tab — it should show an empty state ("Aucune obligation pour ce mois...").
2. Click **"Gérer les obligations"** → **"Ajouter une obligation"** → fill in name "Loyer", montant "800", save. Modal closes, the template list shows "Loyer — 800 €".
3. Close the manage modal. The entries list should now show a row "Loyer" for the current month, unchecked, amount 800 €.
4. Click the circle icon next to "Loyer" → the pay confirmation modal opens pre-filled with 800 € and today's date → click "Valider". The row should switch to checked (green check, strikethrough), and the "Payé"/"Restant" totals update.
5. Go to the **Transactions** tab → a new EXPENSE transaction "Loyer" of 800 € dated today should appear.
6. Go back to **Dépenses obligatoires**, click the green check on "Loyer" → it should uncheck immediately (with a toast "Paiement annulé").
7. Go to **Transactions** again → the "Loyer" transaction should be gone.
8. Use the ◀ / ▶ buttons to navigate to the previous/next month — the list should update (previous months with no entries yet will show the empty state, since entries are only auto-generated for months that have been visited).

Expected: all steps behave as described, no console errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/ObligationsTab.jsx src/pages/Finance.jsx
git commit -m "feat: add Dépenses obligatoires tab to Finance page"
```

(Skip if this directory is not a git repository.)

---

## Self-Review Notes

- **Spec coverage:** data model (Task 1), monthly auto-generation (Task 3 `useEffect` + `generateMissingEntries`), month navigation (Task 3 `goToMonth`), pay/unpay creating/deleting a `Transaction` (Task 2 `payObligationEntry`/`unpayObligationEntry`), template management with soft-deactivate (Task 3 manage modal + `setObligationTemplateActive`), UI placement and reused primitives (Task 3) — all covered.
- **Type/signature consistency:** verified `payObligationEntry(entry, { amount, paidDate })`, `unpayObligationEntry(entry)`, `saveObligationTemplate(payload, editingId)`, `setObligationTemplateActive(id, active)`, `generateMissingEntries(month, templates, existingEntries)` and `monthKey(date)` are called identically to their definitions across Task 2 and Task 3.
- **Out of scope (per spec):** no reminders/notifications, no retroactive generation for months never visited, no per-month variable defaults beyond manual adjustment at pay time.
