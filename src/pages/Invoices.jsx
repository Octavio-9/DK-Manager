import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus, Trash2, FileText, Search, Download, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatDate, formatCurrency } from '../lib/format'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import { inputClass, labelClass, btnPrimary, btnSecondary, btnDanger } from '../lib/ui'
import { downloadInvoicePDF } from '../lib/invoicePdf'

/* ── Constants ──────────────────────────────────────────────────── */

const INVOICE_STATUS = {
  PENDING:   { label: 'En attente', color: '#f59e0b' },
  PAID:      { label: 'Payée',      color: '#10b981' },
  OVERDUE:   { label: 'En retard',  color: '#ef4444' },
  CANCELLED: { label: 'Annulée',    color: '#6e6a75' },
}

const STATUS_OPTIONS = Object.keys(INVOICE_STATUS)

const EMPTY_FORM = {
  clientId: '',
  dueDate: '',
  status: 'PENDING',
  items: [{ description: '', quantity: 1, price: '', paid: 0 }],
}

/* ── Fetch helpers ──────────────────────────────────────────────── */

async function fetchInvoices() {
  const { data, error } = await supabase
    .from('Invoice')
    .select('*, clientRel:Client(id, name), items:InvoiceItem(*)')
    .order('createdAt', { ascending: false })
  if (error) throw error
  return data || []
}

async function fetchClients() {
  const { data, error } = await supabase.from('Client').select('id, name').order('name')
  if (error) throw error
  return data || []
}

/* ── Invoice number generator ─────────────────────────────────── */

function generateInvoiceNumber() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const rand = String(Math.floor(Math.random() * 9000) + 1000)
  return `DK-${y}${m}-${rand}`
}

/* ── Row component ───────────────────────────────────────────────── */

function InvoiceRow({ invoice, onEdit }) {
  const [expanded, setExpanded] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const s = INVOICE_STATUS[invoice.status] || { label: invoice.status, color: '#6e6a75' }

  async function handleDownload(e) {
    e.stopPropagation()
    setDownloading(true)
    try { await downloadInvoicePDF(invoice) }
    catch (err) { console.error('PDF error:', err) }
    finally { setDownloading(false) }
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

/* ── Main Page ───────────────────────────────────────────────────── */

export default function Invoices() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: fetchInvoices,
    onError: (err) => toast.error(err.message),
  })

  const { data: clients = [] } = useQuery({ queryKey: ['clients-list'], queryFn: fetchClients })

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      if (statusFilter !== 'ALL' && inv.status !== statusFilter) return false
      if (search) {
        const q = search.toLowerCase()
        if (!inv.invoiceNumber.toLowerCase().includes(q) && !(inv.clientRel?.name || '').toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [invoices, statusFilter, search])

  /* Totals */
  const totalBilled   = invoices.reduce((s, i) => s + Number(i.total || 0), 0)
  const totalPaid     = invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + Number(i.total || 0), 0)
  const totalPending  = invoices.filter(i => i.status === 'PENDING').reduce((s, i) => s + Number(i.total || 0), 0)
  const totalOverdue  = invoices.filter(i => i.status === 'OVERDUE').reduce((s, i) => s + Number(i.total || 0), 0)

  /* Mutations */
  const saveMutation = useMutation({
    mutationFn: async ({ formData, invoiceId }) => {
      const lineTotal = formData.items.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.quantity) || 0), 0)
      const payload = {
        clientId: formData.clientId || null,
        dueDate: formData.dueDate || null,
        status: formData.status,
        total: lineTotal,
      }

      if (invoiceId) {
        const { error } = await supabase.from('Invoice').update(payload).eq('id', invoiceId)
        if (error) throw error
        // Replace items
        await supabase.from('InvoiceItem').delete().eq('invoiceId', invoiceId)
        if (formData.items.length > 0) {
          const { error: itemErr } = await supabase.from('InvoiceItem').insert(
            formData.items.filter(it => it.description.trim()).map(it => ({
              invoiceId,
              description: it.description,
              quantity: Number(it.quantity) || 1,
              price: Number(it.price) || 0,
              paid: Number(it.paid) || 0,
            }))
          )
          if (itemErr) throw itemErr
        }
      } else {
        const invoiceNumber = generateInvoiceNumber()
        const { data: created, error } = await supabase
          .from('Invoice')
          .insert({ ...payload, invoiceNumber })
          .select()
          .single()
        if (error) throw error
        if (formData.items.length > 0) {
          const { error: itemErr } = await supabase.from('InvoiceItem').insert(
            formData.items.filter(it => it.description.trim()).map(it => ({
              invoiceId: created.id,
              description: it.description,
              quantity: Number(it.quantity) || 1,
              price: Number(it.price) || 0,
              paid: Number(it.paid) || 0,
            }))
          )
          if (itemErr) throw itemErr
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      toast.success(editingInvoice ? 'Facture mise à jour' : 'Facture créée')
      closeModal()
    },
    onError: (err) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('Invoice').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      toast.success('Facture supprimée')
      closeModal()
    },
    onError: (err) => toast.error(err.message),
  })

  /* Helpers */
  const openCreateModal = () => {
    setEditingInvoice(null)
    setForm({ ...EMPTY_FORM, items: [{ description: '', quantity: 1, price: '' }] })
    setModalOpen(true)
  }

  const openEditModal = (inv) => {
    setEditingInvoice(inv)
    setForm({
      clientId: inv.clientId || '',
      dueDate: inv.dueDate || '',
      status: inv.status,
      items: inv.items?.length
        ? inv.items.map(it => ({ description: it.description, quantity: it.quantity, price: it.price, paid: it.paid ?? 0 }))
        : [{ description: '', quantity: 1, price: '', paid: 0 }],
    })
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingInvoice(null)
    setForm(EMPTY_FORM)
  }

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { description: '', quantity: 1, price: '', paid: 0 }] }))
  const removeItem = (i) => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }))
  const updateItem = (i, field, value) => setForm(f => ({
    ...f,
    items: f.items.map((it, idx) => idx === i ? { ...it, [field]: value } : it),
  }))

  const lineTotal = form.items.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.quantity) || 0), 0)

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Total facturé',   value: formatCurrency(totalBilled),  color: '#9d3bf1' },
          { label: 'Payé',            value: formatCurrency(totalPaid),    color: '#10b981' },
          { label: 'En attente',      value: formatCurrency(totalPending), color: '#f59e0b' },
          { label: 'En retard',       value: formatCurrency(totalOverdue), color: '#ef4444' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-c-border bg-bg-card p-4">
            <p className="text-xs text-text-muted">{s.label}</p>
            <p className="mt-1 text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Rechercher…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${inputClass} pl-9 sm:w-52`}
            />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`${inputClass} sm:w-auto`}>
            <option value="ALL">Tous les statuts</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{INVOICE_STATUS[s].label}</option>
            ))}
          </select>
        </div>
        <button onClick={openCreateModal} className={`${btnPrimary} w-full sm:w-auto`}>
          <Plus size={16} /> Nouvelle facture
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-c-border bg-bg-card">
        {isLoading ? (
          <p className="p-6 text-text-secondary">Chargement…</p>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <FileText size={40} className="text-text-muted/40" />
            <p className="text-text-secondary">Aucune facture.</p>
            <button onClick={openCreateModal} className={btnPrimary}><Plus size={15} /> Créer une facture</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left">
              <thead>
                <tr className="border-b border-c-border text-xs uppercase text-text-muted">
                  <th className="p-4 font-medium">N° Facture</th>
                  <th className="p-4 font-medium">Client</th>
                  <th className="p-4 font-medium">Total</th>
                  <th className="p-4 font-medium">Échéance</th>
                  <th className="p-4 font-medium">Statut</th>
                  <th className="p-4" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => (
                  <InvoiceRow key={inv.id} invoice={inv} onEdit={openEditModal} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingInvoice ? `Modifier — ${editingInvoice.invoiceNumber}` : 'Nouvelle facture'}
        maxWidth="max-w-2xl"
        footer={
          <>
            {editingInvoice && (
              <button type="button" onClick={() => deleteMutation.mutate(editingInvoice.id)} disabled={deleteMutation.isPending} className={btnDanger}>
                <Trash2 size={15} /> Supprimer
              </button>
            )}
            <div className="flex-1" />
            {editingInvoice && (
              <button
                type="button"
                onClick={async () => {
                  try { await downloadInvoicePDF(editingInvoice) }
                  catch { toast.error('Erreur lors de la génération du PDF') }
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
      >
        <form
          id="invoice-form"
          onSubmit={(e) => {
            e.preventDefault()
            saveMutation.mutate({ formData: form, invoiceId: editingInvoice?.id || null })
          }}
          className="space-y-5"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Client</label>
              <select value={form.clientId} onChange={(e) => setForm(f => ({ ...f, clientId: e.target.value }))} className={inputClass}>
                <option value="">— Aucun —</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Statut</label>
              <select value={form.status} onChange={(e) => setForm(f => ({ ...f, status: e.target.value }))} className={inputClass}>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{INVOICE_STATUS[s].label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Date d&apos;échéance</label>
              <input type="date" value={form.dueDate} onChange={(e) => setForm(f => ({ ...f, dueDate: e.target.value }))} className={inputClass} />
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className={labelClass}>Lignes de facture</label>
              <button type="button" onClick={addItem} className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-accent-purple hover:bg-accent-purple/10 transition-colors">
                <Plus size={13} /> Ajouter
              </button>
            </div>
            <div className="overflow-hidden rounded-lg border border-c-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-c-border bg-bg-panel text-xs uppercase text-text-muted">
                    <th className="p-3 text-left font-medium">Description</th>
                    <th className="p-3 text-right font-medium w-16">Qté</th>
                    <th className="p-3 text-right font-medium w-24">P.U. (GNF)</th>
                    <th className="p-3 text-right font-medium w-24">Payé (GNF)</th>
                    <th className="p-3 text-right font-medium w-24">Reste</th>
                    <th className="p-3 w-10" />
                  </tr>
                </thead>
                <tbody>
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
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap justify-end gap-6 border-t border-c-border pt-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-text-muted">Total facturé</span>
                <span className="font-bold text-text-primary">{formatCurrency(lineTotal)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-text-muted">Total payé</span>
                <span className="font-bold text-c-success">
                  {formatCurrency(form.items.reduce((s, it) => s + (Number(it.paid) || 0), 0))}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-text-muted">Reste</span>
                <span className="font-bold text-c-danger">
                  {formatCurrency(Math.max(0, lineTotal - form.items.reduce((s, it) => s + (Number(it.paid) || 0), 0)))}
                </span>
              </div>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  )
}
