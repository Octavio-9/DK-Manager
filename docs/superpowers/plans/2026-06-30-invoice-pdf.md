# Invoice PDF — Reçu de paiement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un bouton "Télécharger PDF" sur chaque facture qui génère un reçu de paiement PDF (layout DK Production) avec suivi Payé/Reste par ligne.

**Architecture:** Nouvelle colonne `paid` sur `InvoiceItem` (migration SQL), composant `InvoicePDF` déclaratif (`@react-pdf/renderer`), helper `downloadInvoicePDF` qui produit un Blob et déclenche le téléchargement, bouton ajouté dans la liste et la modale `Invoices.jsx`.

**Tech Stack:** React 19, @react-pdf/renderer (nouvelle dépendance), Vite 8, Supabase.

## Global Constraints

- Aucun test runner dans ce projet — vérification = `npm run build` + `npm run lint` + walkthrough manuel dans le navigateur connecté.
- Convention de nommage tables : PascalCase quoted (`"InvoiceItem"`), colonnes camelCase quoted si elles contiennent des majuscules (`"invoiceId"`), mais `paid` est tout minuscule donc sans quotes suffit.
- Devise PDF : GNF, format `new Intl.NumberFormat('fr-FR').format(n) + ' GNF'` (sans décimales).
- Constantes société hardcodées dans `src/components/InvoicePDF.jsx` : phone `611-14-43-34`, email `contact@dkproduction.space`, adresse `Fossidet rond-point`.
- TOTAL du PDF = somme des `paid` de toutes les lignes (montant encaissé), PAS le total facturé.
- Pas de tampons/signatures graphiques — ligne de signature texte uniquement.
- Ne pas casser les fonctionnalités existantes (`InvoiceItem(*)` dans `fetchInvoices` inclura automatiquement `paid` après migration).

---

## Task 1: Migration SQL — colonne `paid` sur `InvoiceItem`

**Files:**
- Create: `supabase/migrations/0006_invoice_item_paid.sql`

**Interfaces:**
- Produit: colonne `paid numeric not null default 0` sur `"InvoiceItem"` — utilisée par Tasks 2 et 3.

- [ ] **Step 1: Écrire le fichier de migration**

Créer `supabase/migrations/0006_invoice_item_paid.sql` :

```sql
-- Ajout du montant payé par ligne de facture pour le reçu de paiement
alter table "InvoiceItem" add column if not exists paid numeric not null default 0;
```

- [ ] **Step 2: Appliquer la migration — DEMANDER CONFIRMATION à l'utilisateur**

Cette migration modifie la base Supabase en production. Arrêter et demander à l'utilisateur de l'appliquer via le Supabase Dashboard → SQL Editor, ou via l'outil MCP Supabase si disponible. Ne pas continuer avant confirmation.

- [ ] **Step 3: Vérifier**

Confirmer avec l'utilisateur que la colonne apparaît dans Table Editor → InvoiceItem, ou via `list_tables` Supabase MCP.

---

## Task 2: Composant PDF + helper téléchargement + config Vite

**Files:**
- Modify: `package.json` (npm install)
- Modify: `vite.config.js`
- Create: `src/components/InvoicePDF.jsx`
- Create: `src/lib/invoicePdf.js`

**Interfaces:**
- Consumes: `invoice` object avec shape `{ invoiceNumber, createdAt, clientRel: { name, phone, email }, items: [{ description, quantity, price, paid }] }`
- Produces:
  - `InvoicePDF` — default export, composant `@react-pdf/renderer` `<Document>` — consommé par `invoicePdf.js`
  - `downloadInvoicePDF(invoice: object): Promise<void>` — déclenche le téléchargement, exportée depuis `src/lib/invoicePdf.js`, utilisée dans Task 3

- [ ] **Step 1: Installer `@react-pdf/renderer`**

```bash
cd "c:\Users\lenovo\Documents\DK_manager"
npm install @react-pdf/renderer
```

Résultat attendu: `added N packages` sans erreur.

- [ ] **Step 2: Mettre à jour `vite.config.js` pour la compatibilité @react-pdf/renderer**

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  optimizeDeps: {
    include: ['@react-pdf/renderer'],
  },
})
```

- [ ] **Step 3: Créer `src/components/InvoicePDF.jsx`**

```jsx
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const COMPANY = {
  name: 'DK PRODUCTION',
  phone: '611-14-43-34',
  email: 'contact@dkproduction.space',
  address: 'Fossidet rond-point',
}

function fmtGNF(value) {
  return new Intl.NumberFormat('fr-FR').format(Number(value) || 0) + ' GNF'
}

const s = StyleSheet.create({
  page:         { padding: 40, fontSize: 10, fontFamily: 'Helvetica', color: '#000000' },
  headerRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  logo:         { width: 36, height: 36, backgroundColor: '#9d3bf1', borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  logoTxt:      { color: '#ffffff', fontSize: 14, fontFamily: 'Helvetica-Bold' },
  title:        { fontSize: 20, fontFamily: 'Helvetica-Bold', letterSpacing: 1 },
  metaRow:      { flexDirection: 'row', gap: 8, marginBottom: 20 },
  pill:         { borderRadius: 20, borderWidth: 1, borderColor: '#cccccc', paddingHorizontal: 12, paddingVertical: 4 },
  pillTxt:      { fontSize: 10 },
  divider:      { borderBottomWidth: 1, borderBottomColor: '#cccccc', marginBottom: 16 },
  infoRow:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  infoLbl:      { fontSize: 10, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  infoTxt:      { fontSize: 9, color: '#444444', lineHeight: 1.5 },
  attnLbl:      { fontSize: 10, fontFamily: 'Helvetica-Bold', textAlign: 'right', marginBottom: 4 },
  attnTxt:      { fontSize: 9, color: '#444444', textAlign: 'right', lineHeight: 1.5 },
  tHead:        { flexDirection: 'row', backgroundColor: '#000000', paddingVertical: 8, paddingHorizontal: 6 },
  tHeadDesc:    { color: '#ffffff', fontSize: 9, fontFamily: 'Helvetica-Bold', flex: 2 },
  tHeadCell:    { color: '#ffffff', fontSize: 9, fontFamily: 'Helvetica-Bold', flex: 1, textAlign: 'center' },
  tRow:         { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#dddddd', paddingVertical: 8, paddingHorizontal: 6 },
  tCellDesc:    { fontSize: 9, flex: 2 },
  tCell:        { fontSize: 9, flex: 1, textAlign: 'center' },
  totalBar:     { backgroundColor: '#000000', flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, marginTop: 2 },
  totalLbl:     { color: '#ffffff', fontSize: 11, fontFamily: 'Helvetica-Bold', marginRight: 12 },
  totalVal:     { color: '#ffffff', fontSize: 14, fontFamily: 'Helvetica-Bold' },
  footerRow:    { flexDirection: 'row', justifyContent: 'space-between', marginTop: 32 },
  paidBy:       { fontSize: 10, marginBottom: 20 },
  condLbl:      { fontSize: 9, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  condTxt:      { fontSize: 9, color: '#444444' },
  sigZone:      { alignItems: 'center', width: '40%' },
  sigLine:      { borderTopWidth: 1, borderTopColor: '#000000', width: '100%', marginBottom: 4 },
  sigTxt:       { fontSize: 9, textAlign: 'center' },
  thanks:       { textAlign: 'center', fontSize: 10, fontFamily: 'Helvetica-Bold', borderTopWidth: 1, borderTopColor: '#cccccc', paddingTop: 12, marginTop: 24 },
})

export default function InvoicePDF({ invoice }) {
  const client = invoice.clientRel || {}
  const items  = invoice.items || []
  const totalPaid = items.reduce((sum, it) => sum + (Number(it.paid) || 0), 0)
  const createdDate = invoice.createdAt
    ? new Date(invoice.createdAt).toLocaleDateString('fr-FR')
    : '—'

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* En-tête */}
        <View style={s.headerRow}>
          <View style={s.logo}><Text style={s.logoTxt}>DK</Text></View>
          <Text style={s.title}>REÇU DE PAIEMENT</Text>
          <View style={s.logo}><Text style={s.logoTxt}>DK</Text></View>
        </View>

        {/* N° facture + date */}
        <View style={s.metaRow}>
          <View style={s.pill}><Text style={s.pillTxt}>Facture n°{invoice.invoiceNumber}</Text></View>
          <View style={s.pill}><Text style={s.pillTxt}>{createdDate}</Text></View>
        </View>

        <View style={s.divider} />

        {/* Coordonnées */}
        <View style={s.infoRow}>
          <View>
            <Text style={s.infoLbl}>{COMPANY.name}</Text>
            <Text style={s.infoTxt}>{COMPANY.phone}</Text>
            <Text style={s.infoTxt}>{COMPANY.email}</Text>
            <Text style={s.infoTxt}>{COMPANY.address}</Text>
          </View>
          <View>
            <Text style={s.attnLbl}>À L'ATTENTION DE</Text>
            <Text style={s.attnTxt}>{client.name || '—'}</Text>
            {client.phone ? <Text style={s.attnTxt}>{client.phone}</Text> : null}
            {client.email ? <Text style={s.attnTxt}>{client.email}</Text> : null}
          </View>
        </View>

        {/* Tableau */}
        <View style={s.tHead}>
          <Text style={s.tHeadDesc}>DESCRIPTION</Text>
          <Text style={s.tHeadCell}>PRIX</Text>
          <Text style={s.tHeadCell}>PAYER</Text>
          <Text style={s.tHeadCell}>RESTE</Text>
        </View>
        {items.map((item, i) => {
          const prix  = (Number(item.price) || 0) * (Number(item.quantity) || 1)
          const payer = Number(item.paid) || 0
          const reste = Math.max(0, prix - payer)
          return (
            <View key={i} style={s.tRow}>
              <Text style={s.tCellDesc}>{item.description}</Text>
              <Text style={s.tCell}>{fmtGNF(prix)}</Text>
              <Text style={s.tCell}>{fmtGNF(payer)}</Text>
              <Text style={s.tCell}>{fmtGNF(reste)}</Text>
            </View>
          )
        })}

        {/* Bandeau TOTAL */}
        <View style={s.totalBar}>
          <Text style={s.totalLbl}>TOTAL :</Text>
          <Text style={s.totalVal}>{fmtGNF(totalPaid)}</Text>
        </View>

        {/* Pied de page */}
        <View style={s.footerRow}>
          <View>
            <Text style={s.paidBy}>Paiement effectué par {client.name || '—'}</Text>
            <Text style={s.condLbl}>Conditions de paiement</Text>
            <Text style={s.condTxt}>Paiement sous 15 jours</Text>
          </View>
          <View style={s.sigZone}>
            <View style={s.sigLine} />
            <Text style={s.sigTxt}>Le Directeur Général</Text>
          </View>
        </View>

        <Text style={s.thanks}>MERCI DE VOTRE CONFIANCE</Text>
      </Page>
    </Document>
  )
}
```

- [ ] **Step 4: Créer `src/lib/invoicePdf.js`**

```js
import { pdf } from '@react-pdf/renderer'
import { createElement } from 'react'
import InvoicePDF from '../components/InvoicePDF'

export async function downloadInvoicePDF(invoice) {
  const element = createElement(InvoicePDF, { invoice })
  const blob = await pdf(element).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `recu-${invoice.invoiceNumber}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 5: Vérifier que ça compile**

```bash
npm run build
```

Résultat attendu : build réussi, aucune erreur dans `InvoicePDF.jsx` ou `invoicePdf.js`.

---

## Task 3: Mettre à jour `Invoices.jsx` — colonne Payé + boutons téléchargement

**Files:**
- Modify: `src/pages/Invoices.jsx`

**Interfaces:**
- Consumes: `downloadInvoicePDF(invoice)` de `src/lib/invoicePdf.js` (Task 2), `paid` sur les items InvoiceItem (Task 1).

- [ ] **Step 1: Ajouter l'import et l'icône**

Remplacer le bloc d'import lucide-react existant (ligne 4) :

```js
import { Plus, Trash2, FileText, Search, Download, ChevronDown, ChevronUp } from 'lucide-react'
```

Ajouter l'import du helper après les autres imports (après ligne 9) :

```js
import { downloadInvoicePDF } from '../lib/invoicePdf'
```

- [ ] **Step 2: Ajouter `paid` dans `EMPTY_FORM` et `updateItem`**

Remplacer `EMPTY_FORM` (ligne 22-27) :

```js
const EMPTY_FORM = {
  clientId: '',
  dueDate: '',
  status: 'PENDING',
  items: [{ description: '', quantity: 1, price: '', paid: 0 }],
}
```

Remplacer la fonction `updateItem` (ligne 248-251) :

```js
const updateItem = (i, field, value) => setForm(f => ({
  ...f,
  items: f.items.map((it, idx) => idx === i ? { ...it, [field]: value } : it),
}))
```

(inchangée — supporte déjà n'importe quel champ, `paid` inclus.)

- [ ] **Step 3: Ajouter `paid` dans `openCreateModal` et `openEditModal`**

Dans `openCreateModal` (ligne 221-224), le `EMPTY_FORM` déjà mis à jour inclut `paid: 0` — pas de changement supplémentaire.

Remplacer le mapping des items dans `openEditModal` (ligne 233-235) :

```js
items: inv.items?.length
  ? inv.items.map(it => ({
      description: it.description,
      quantity: it.quantity,
      price: it.price,
      paid: it.paid ?? 0,
    }))
  : [{ description: '', quantity: 1, price: '', paid: 0 }],
```

- [ ] **Step 4: Ajouter `paid` dans `saveMutation` (inserts/updates InvoiceItem)**

Dans `saveMutation`, dans le `.map(it => ({...}))` des deux blocs d'insertion (update branch + create branch), ajouter le champ `paid`. Remplacer les deux blocs `.map` de lignes de facture :

```js
// Dans le bloc update (invoiceId truthy) :
formData.items.filter(it => it.description.trim()).map(it => ({
  invoiceId,
  description: it.description,
  quantity: Number(it.quantity) || 1,
  price: Number(it.price) || 0,
  paid: Number(it.paid) || 0,
}))

// Dans le bloc create :
formData.items.filter(it => it.description.trim()).map(it => ({
  invoiceId: created.id,
  description: it.description,
  quantity: Number(it.quantity) || 1,
  price: Number(it.price) || 0,
  paid: Number(it.paid) || 0,
}))
```

- [ ] **Step 5: Ajouter le bouton téléchargement dans `InvoiceRow`**

Ajouter un état de chargement et le bouton dans `InvoiceRow`. Remplacer la fonction `InvoiceRow` entière (lignes 58-114) :

```jsx
function InvoiceRow({ invoice, onEdit }) {
  const [expanded, setExpanded] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const s = INVOICE_STATUS[invoice.status] || { label: invoice.status, color: '#6e6a75' }

  async function handleDownload(e) {
    e.stopPropagation()
    setDownloading(true)
    try {
      await downloadInvoicePDF(invoice)
    } catch (err) {
      console.error('PDF error:', err)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <>
      <tr
        className="border-b border-c-border cursor-pointer hover:bg-bg-hover/30 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="p-4">
          <div className="flex items-center gap-2">
            {expanded ? <ChevronUp size={14} className="text-text-muted" /> : <ChevronDown size={14} className="text-text-muted" />}
            <span className="font-mono text-sm font-medium text-text-primary">{invoice.invoiceNumber}</span>
          </div>
        </td>
        <td className="p-4 text-sm text-text-secondary">{invoice.clientRel?.name || '—'}</td>
        <td className="p-4 text-sm font-semibold text-text-primary">{formatCurrency(invoice.total)}</td>
        <td className="p-4 text-sm text-text-secondary">{invoice.dueDate ? formatDate(invoice.dueDate) : '—'}</td>
        <td className="p-4"><Badge color={s.color}>{s.label}</Badge></td>
        <td className="p-4 text-right">
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={handleDownload}
              disabled={downloading}
              title="Télécharger PDF"
              className="rounded-lg p-1.5 text-text-muted border border-c-border hover:bg-bg-hover hover:text-accent-purple transition-colors disabled:opacity-40"
            >
              <Download size={14} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(invoice) }}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-text-secondary border border-c-border hover:bg-bg-hover hover:text-text-primary transition-colors"
            >
              Modifier
            </button>
          </div>
        </td>
      </tr>
      {expanded && invoice.items?.length > 0 && (
        <tr className="bg-bg-panel/50">
          <td colSpan={6} className="px-8 py-3">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-muted uppercase">
                  <th className="pb-1 text-left font-medium">Description</th>
                  <th className="pb-1 text-right font-medium w-20">Qté</th>
                  <th className="pb-1 text-right font-medium w-28">P.U.</th>
                  <th className="pb-1 text-right font-medium w-28">Payé</th>
                  <th className="pb-1 text-right font-medium w-28">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item, i) => (
                  <tr key={i} className="border-t border-c-border/50">
                    <td className="py-1.5 text-text-secondary">{item.description}</td>
                    <td className="py-1.5 text-right text-text-secondary">{item.quantity}</td>
                    <td className="py-1.5 text-right text-text-secondary">{formatCurrency(item.price)}</td>
                    <td className="py-1.5 text-right text-c-success">{formatCurrency(item.paid || 0)}</td>
                    <td className="py-1.5 text-right font-medium text-text-primary">{formatCurrency(item.quantity * item.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  )
}
```

- [ ] **Step 6: Ajouter la colonne "Payé" dans le formulaire de la modale**

Dans le formulaire (section `/* Items */`), remplacer le `<thead>` de la table des lignes (lignes 393-400) :

```jsx
<thead>
  <tr className="border-b border-c-border bg-bg-panel text-xs uppercase text-text-muted">
    <th className="p-3 text-left font-medium">Description</th>
    <th className="p-3 text-right font-medium w-20">Qté</th>
    <th className="p-3 text-right font-medium w-28">P.U. (GNF)</th>
    <th className="p-3 text-right font-medium w-28">Payé (GNF)</th>
    <th className="p-3 text-right font-medium w-24">Reste</th>
    <th className="p-3 w-10" />
  </tr>
</thead>
```

Remplacer chaque ligne du `<tbody>` (le `{form.items.map(...)}` bloc, lignes 402-444) :

```jsx
{form.items.map((item, i) => {
  const lineTotal = (Number(item.quantity) || 0) * (Number(item.price) || 0)
  const reste = Math.max(0, lineTotal - (Number(item.paid) || 0))
  return (
    <tr key={i} className="border-b border-c-border/60 last:border-0">
      <td className="p-2">
        <input
          placeholder="Description de la prestation…"
          value={item.description}
          onChange={(e) => updateItem(i, 'description', e.target.value)}
          className={`${inputClass} py-1.5`}
        />
      </td>
      <td className="p-2">
        <input
          type="number" min="1"
          value={item.quantity}
          onChange={(e) => updateItem(i, 'quantity', e.target.value)}
          className={`${inputClass} py-1.5 text-right`}
        />
      </td>
      <td className="p-2">
        <input
          type="number" min="0" step="0.01"
          value={item.price}
          onChange={(e) => updateItem(i, 'price', e.target.value)}
          className={`${inputClass} py-1.5 text-right`}
        />
      </td>
      <td className="p-2">
        <input
          type="number" min="0" step="0.01"
          value={item.paid}
          onChange={(e) => updateItem(i, 'paid', e.target.value)}
          className={`${inputClass} py-1.5 text-right`}
        />
      </td>
      <td className="p-2 text-right text-text-muted text-xs">
        {formatCurrency(reste)}
      </td>
      <td className="p-2 text-center">
        <button
          type="button"
          onClick={() => removeItem(i)}
          disabled={form.items.length === 1}
          className="rounded p-1 text-text-muted hover:text-c-danger disabled:opacity-30"
        >
          <Trash2 size={13} />
        </button>
      </td>
    </tr>
  )
})}
```

Remplacer le résumé total sous le tableau (lignes 447-452) :

```jsx
<div className="mt-3 flex justify-end gap-6 border-t border-c-border pt-3 text-sm">
  <div className="flex items-center gap-3">
    <span className="text-text-muted">Total facturé</span>
    <span className="font-bold text-text-primary">{formatCurrency(lineTotal)}</span>
  </div>
  <div className="flex items-center gap-3">
    <span className="text-text-muted">Total payé</span>
    <span className="font-bold text-c-success">
      {formatCurrency(form.items.reduce((s, it) => s + (Number(it.paid) || 0) * 1, 0))}
    </span>
  </div>
  <div className="flex items-center gap-3">
    <span className="text-text-muted">Reste</span>
    <span className="font-bold text-c-danger">
      {formatCurrency(Math.max(0, lineTotal - form.items.reduce((s, it) => s + (Number(it.paid) || 0) * 1, 0)))}
    </span>
  </div>
</div>
```

- [ ] **Step 7: Ajouter le bouton PDF dans le footer de la modale**

Dans le footer de la modale `<Modal>` (vers ligne 336-353), ajouter le bouton "Télécharger PDF" quand une facture est en édition. Remplacer le bloc `footer={...}` :

```jsx
footer={
  <>
    {editingInvoice && (
      <button
        type="button"
        onClick={() => deleteMutation.mutate(editingInvoice.id)}
        disabled={deleteMutation.isPending}
        className={btnDanger}
      >
        <Trash2 size={15} /> Supprimer
      </button>
    )}
    <div className="flex-1" />
    {editingInvoice && (
      <button
        type="button"
        onClick={async () => {
          try { await downloadInvoicePDF(editingInvoice) }
          catch (err) { toast.error('Erreur lors de la génération du PDF') }
        }}
        className={btnSecondary}
      >
        <Download size={15} /> Télécharger PDF
      </button>
    )}
    <button type="button" onClick={closeModal} className={btnSecondary}>Annuler</button>
    <button
      type="submit" form="invoice-form"
      disabled={saveMutation.isPending}
      className={btnPrimary}
    >
      Enregistrer
    </button>
  </>
}
```

- [ ] **Step 8: Vérifier build et lint**

```bash
npm run build
npm run lint
```

Résultat attendu : build réussi, aucune nouvelle erreur dans `Invoices.jsx`.

- [ ] **Step 9: Walkthrough manuel**

1. Ouvrir http://localhost:5173 → Login → **Factures**
2. Ouvrir une facture existante → vérifier la nouvelle colonne "Payé" dans le formulaire, et les colonnes RESTE calculées en live.
3. Saisir un montant dans "Payé" → vérifier que "Reste" se met à jour.
4. Enregistrer → fermer la modale → cliquer l'icône ⬇ sur la ligne → PDF téléchargé nommé `recu-DK-XXXXXX-XXXX.pdf`.
5. Ouvrir le PDF → vérifier : en-tête DK PRODUCTION, tableau DESCRIPTION/PRIX/PAYER/RESTE, bandeau TOTAL noir = somme des Payé, bas de page avec signature.
6. Rouvrir la facture via "Modifier" → cliquer "Télécharger PDF" dans la modale → même résultat.

---

## Self-Review

- **Spec coverage :** migration `paid` ✅, composant PDF ✅, helper download ✅, colonne Payé dans formulaire ✅, TOTAL = somme paid ✅, bouton liste ✅, bouton modale ✅, coordonnées hardcodées ✅, pas de tampon graphique ✅.
- **Placeholders :** aucun TBD ou TODO.
- **Cohérence types :** `downloadInvoicePDF(invoice)` défini dans Task 2 Step 4, appelé identiquement dans Task 3 Steps 5 et 7. `InvoicePDF({ invoice })` défini Task 2 Step 3, utilisé via `createElement` dans le helper. `item.paid` utilisé de façon identique dans le composant PDF et la modale.
