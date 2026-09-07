import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus, Trash2, FileText, Search, Download, Printer, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatDate, formatCurrency } from '../lib/format'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import InvoicePreview from '../components/InvoicePreview'
import { inputClass, labelClass, btnPrimary, btnSecondary, btnDanger } from '../lib/ui'
import { downloadInvoicePDF, printInvoicePDF, preloadInvoicePdf } from '../lib/invoicePdf'
import { useAuth } from '../context/AuthContext'
import { notifyRoles } from '../lib/notifications'
import { syncInvoiceIncome } from '../lib/invoiceIncome'
import { EnterpriseTotalsButton } from '../components/EnterpriseTotals'
import { DEFAULT_PAYMENT_TERMS } from '../lib/constants'

/* ── Constants ──────────────────────────────────────────────────── */

const INVOICE_STATUS = {
  PENDING:   { label: 'En attente', color: '#f59e0b' },
  PAID:      { label: 'Payée',      color: '#10b981' },
  OVERDUE:   { label: 'En retard',  color: '#ef4444' },
  CANCELLED: { label: 'Annulée',    color: '#6e6a75' },
}

const STATUS_OPTIONS = Object.keys(INVOICE_STATUS)

const DOC_TYPE = {
  FACTURE: { label: 'Facture', color: '#9d3bf1' },
  RECU:    { label: 'Reçu',    color: '#10b981' },
}

const EMPTY_FORM = {
  documentType: 'FACTURE',
  clientName: '',
  dueDate: '',
  status: 'PENDING',
  paymentTerms: DEFAULT_PAYMENT_TERMS,
  sourceInvoiceId: null,
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

/* ── Document number generator (FAC- / REC-) ──────────────────── */

function generateDocNumber(type) {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const rand = String(Math.floor(Math.random() * 9000) + 1000)
  const prefix = type === 'RECU' ? 'REC' : 'FAC'
  return `${prefix}-${y}${m}-${rand}`
}

/* ── Row component ───────────────────────────────────────────────── */

function InvoiceRow({ invoice, onEdit, onGenerateReceipt }) {
  const [expanded, setExpanded] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [printing, setPrinting] = useState(false)
  const { can } = useAuth()
  const s = INVOICE_STATUS[invoice.status] || { label: invoice.status, color: '#6e6a75' }
  const t = DOC_TYPE[invoice.documentType] || DOC_TYPE.FACTURE
  const docLabel = (DOC_TYPE[invoice.documentType] || DOC_TYPE.FACTURE).label
  const canGenerateReceipt = invoice.documentType === 'FACTURE' && invoice.status === 'PAID'

  async function handleDownload(e) {
    e.stopPropagation()
    setDownloading(true)
    try { await downloadInvoicePDF(invoice) }
    catch (err) { console.error('PDF error:', err) }
    finally { setDownloading(false) }
  }

  async function handlePrint(e) {
    e.stopPropagation()
    setPrinting(true)
    try { await printInvoicePDF(invoice) }
    catch (err) { console.error('PDF error:', err) }
    finally { setPrinting(false) }
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
        <td className="p-4"><Badge color={t.color}>{t.label}</Badge></td>
        <td className="p-4 text-sm text-text-secondary">{invoice.clientRel?.name || invoice.clientName || '—'}</td>
        <td className="p-4 text-sm font-semibold text-text-primary">{formatCurrency(invoice.total)}</td>
        <td className="p-4 text-sm text-text-secondary">{invoice.dueDate ? formatDate(invoice.dueDate) : '—'}</td>
        <td className="p-4"><Badge color={s.color}>{s.label}</Badge></td>
        <td className="p-4 text-right">
          <div className="flex items-center justify-end gap-2">
            {canGenerateReceipt && can('create', 'invoices') && (
              <button
                onClick={(e) => { e.stopPropagation(); onGenerateReceipt(invoice) }}
                title="Générer le reçu de paiement"
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-c-success border border-c-success/40 hover:bg-c-success/10 transition-colors"
              >
                Générer le reçu
              </button>
            )}
            <button
              onClick={handlePrint}
              disabled={printing}
              title={`Imprimer ${docLabel.toLowerCase()}`}
              className="rounded-lg p-1.5 text-text-muted border border-c-border hover:bg-bg-hover hover:text-accent-purple transition-colors disabled:opacity-40"
            >
              {printing ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
            </button>
            <button
              onClick={handleDownload}
              disabled={downloading}
              title="Télécharger PDF"
              className="rounded-lg p-1.5 text-text-muted border border-c-border hover:bg-bg-hover hover:text-accent-purple transition-colors disabled:opacity-40"
            >
              {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            </button>
            {can('update', 'invoices') && (
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(invoice) }}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-text-secondary border border-c-border hover:bg-bg-hover hover:text-text-primary transition-colors"
              >
                Modifier
              </button>
            )}
          </div>
        </td>
      </tr>
      {expanded && invoice.items?.length > 0 && (
        <tr className="bg-bg-panel/50">
          <td colSpan={7} className="px-8 py-3">
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
  const { user, can } = useAuth()
  const isAdmin = (user?.roleRel?.name || user?.role) === 'Administrateur'
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [clientPrompt, setClientPrompt] = useState(null)
  const [monthDate, setMonthDate] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })

  // Précharge le moteur PDF et le logo dès l'ouverture de la page, pour que le
  // premier « Télécharger » n'ait plus à attendre le chargement du module.
  useEffect(() => { preloadInvoicePdf() }, [])

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: fetchInvoices,
    onError: (err) => toast.error(err.message),
  })

  const { data: clients = [] } = useQuery({ queryKey: ['clients-list'], queryFn: fetchClients })

  /* ── Vue mensuelle ── */
  const monthLabel = useMemo(
    () => new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' })
      .format(monthDate).replace(/^./, (c) => c.toUpperCase()),
    [monthDate],
  )
  const goToMonth = (offset) => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + offset, 1))

  const monthInvoices = useMemo(
    () => invoices.filter((inv) => {
      if (!inv.createdAt) return false
      const d = new Date(inv.createdAt)
      return d.getFullYear() === monthDate.getFullYear() && d.getMonth() === monthDate.getMonth()
    }),
    [invoices, monthDate],
  )

  const filtered = useMemo(() => {
    return monthInvoices.filter((inv) => {
      if (typeFilter !== 'ALL' && (inv.documentType || 'FACTURE') !== typeFilter) return false
      if (statusFilter !== 'ALL' && inv.status !== statusFilter) return false
      if (search) {
        const q = search.toLowerCase()
        const clientName = (inv.clientRel?.name || inv.clientName || '').toLowerCase()
        if (!inv.invoiceNumber.toLowerCase().includes(q) && !clientName.includes(q)) return false
      }
      return true
    })
  }, [monthInvoices, typeFilter, statusFilter, search])

  /* Totaux du mois sélectionné */
  const factureCount  = monthInvoices.filter(i => (i.documentType || 'FACTURE') === 'FACTURE').length
  const totalBilled   = monthInvoices.filter(i => (i.documentType || 'FACTURE') === 'FACTURE').reduce((s, i) => s + Number(i.total || 0), 0)
  const totalPaid     = monthInvoices.filter(i => i.status === 'PAID').reduce((s, i) => s + Number(i.total || 0), 0)
  const totalPending  = monthInvoices.filter(i => i.status === 'PENDING').reduce((s, i) => s + Number(i.total || 0), 0)
  const totalOverdue  = monthInvoices.filter(i => i.status === 'OVERDUE').reduce((s, i) => s + Number(i.total || 0), 0)

  /* Mutations */
  const saveMutation = useMutation({
    mutationFn: async ({ formData, invoiceId, clientId, clientName }) => {
      const isReceipt = formData.documentType === 'RECU'
      // Facture : total = montant dû ; Reçu : total = montant payé
      const billed = formData.items.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.quantity) || 0), 0)
      const paid   = formData.items.reduce((s, it) => s + (Number(it.paid) || 0), 0)
      const payload = {
        documentType: formData.documentType || 'FACTURE',
        clientId: clientId || null,
        clientName: clientName || null,
        dueDate: formData.dueDate || null,
        status: formData.status,
        paymentTerms: formData.paymentTerms?.trim() || null,
        total: isReceipt ? paid : billed,
        sourceInvoiceId: formData.sourceInvoiceId || null,
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

        // Notification : facture passée à « payée » ou « en retard »
        const prevStatus = editingInvoice?.status
        if (
          payload.documentType === 'FACTURE' &&
          payload.status !== prevStatus &&
          (payload.status === 'PAID' || payload.status === 'OVERDUE')
        ) {
          const num = editingInvoice?.invoiceNumber || ''
          const cli = clientName || editingInvoice?.clientRel?.name || editingInvoice?.clientName || ''
          const verb = payload.status === 'PAID' ? 'a été payée' : 'est en retard'
          await notifyRoles(
            ['Administrateur', 'Manager', 'Commercial'],
            {
              message: `La facture ${num}${cli ? ' — ' + cli : ''} ${verb}`,
              type: 'invoice',
              link: '/invoices',
            },
            { exclude: user?.id },
          )
        }

        // Revenu automatique : crée / met à jour / supprime la transaction liée
        await syncInvoiceIncome({
          id: invoiceId,
          status: payload.status,
          total: payload.total,
          documentType: payload.documentType,
          sourceInvoiceId: payload.sourceInvoiceId,
          transactionId: editingInvoice?.transactionId || null,
          clientId: payload.clientId,
          clientLabel: clientName || editingInvoice?.clientRel?.name || editingInvoice?.clientName || '',
          invoiceNumber: editingInvoice?.invoiceNumber || '',
        })
      } else {
        const invoiceNumber = generateDocNumber(payload.documentType)
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

        // Revenu automatique pour un document créé déjà payé (ex : reçu autonome)
        await syncInvoiceIncome({
          id: created.id,
          status: created.status,
          total: created.total,
          documentType: created.documentType,
          sourceInvoiceId: created.sourceInvoiceId,
          transactionId: null,
          clientId: created.clientId,
          clientLabel: clientName || '',
          invoiceNumber: created.invoiceNumber,
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      const noun = form.documentType === 'RECU' ? 'Reçu' : 'Facture'
      toast.success(editingInvoice ? `${noun} mis à jour` : `${noun} créé`)
      closeModal()
    },
    onError: (err) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      // Supprimer d'abord la transaction Revenu liée (le cas échéant)
      const { data: inv } = await supabase.from('Invoice').select('transactionId').eq('id', id).maybeSingle()
      if (inv?.transactionId) {
        await supabase.from('Transaction').delete().eq('id', inv.transactionId)
      }
      const { error } = await supabase.from('Invoice').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      toast.success('Facture supprimée')
      closeModal()
    },
    onError: (err) => toast.error(err.message),
  })

  /* Helpers */
  const openCreateModal = (documentType = 'FACTURE') => {
    setEditingInvoice(null)
    setForm({
      ...EMPTY_FORM,
      documentType,
      status: documentType === 'RECU' ? 'PAID' : 'PENDING',
      items: [{ description: '', quantity: 1, price: '', paid: 0 }],
    })
    setModalOpen(true)
  }

  const openEditModal = (inv) => {
    setEditingInvoice(inv)
    setForm({
      documentType: inv.documentType || 'FACTURE',
      clientName: inv.clientRel?.name || inv.clientName || '',
      dueDate: inv.dueDate || '',
      status: inv.status,
      paymentTerms: inv.paymentTerms || DEFAULT_PAYMENT_TERMS,
      sourceInvoiceId: inv.sourceInvoiceId || null,
      items: inv.items?.length
        ? inv.items.map(it => ({ description: it.description, quantity: it.quantity, price: it.price, paid: it.paid ?? 0 }))
        : [{ description: '', quantity: 1, price: '', paid: 0 }],
    })
    setModalOpen(true)
  }

  // Génère un reçu pré-rempli à partir d'une facture payée (montants réglés en totalité)
  const generateReceipt = (facture) => {
    setEditingInvoice(null)
    setForm({
      documentType: 'RECU',
      clientName: facture.clientRel?.name || facture.clientName || '',
      dueDate: facture.dueDate || '',
      status: 'PAID',
      paymentTerms: facture.paymentTerms || DEFAULT_PAYMENT_TERMS,
      sourceInvoiceId: facture.id,
      items: (facture.items?.length ? facture.items : [{ description: '', quantity: 1, price: '' }]).map((it) => ({
        description: it.description || '',
        quantity: it.quantity || 1,
        price: it.price || 0,
        paid: (Number(it.price) || 0) * (Number(it.quantity) || 1),
      })),
    })
    setModalOpen(true)
    toast.success('Reçu pré-rempli — vérifiez et enregistrez.')
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingInvoice(null)
    setForm(EMPTY_FORM)
  }

  /* Résolution du client : existant, nouveau (à enregistrer), ou libre */
  const submitInvoice = (formData) => {
    const typed = formData.clientName.trim()
    const invoiceId = editingInvoice?.id || null

    // Aucun client saisi
    if (!typed) {
      saveMutation.mutate({ formData, invoiceId, clientId: null, clientName: null })
      return
    }

    // Correspond à un client déjà enregistré (insensible à la casse)
    const match = clients.find((c) => c.name.trim().toLowerCase() === typed.toLowerCase())
    if (match) {
      saveMutation.mutate({ formData, invoiceId, clientId: match.id, clientName: null })
      return
    }

    // Nouveau nom → demander s'il faut l'enregistrer dans la base
    setClientPrompt({ formData, name: typed })
  }

  const handleClientDecision = async (persist) => {
    const { formData, name } = clientPrompt
    const invoiceId = editingInvoice?.id || null

    if (persist) {
      const { data, error } = await supabase
        .from('Client')
        .insert({ name })
        .select('id, name')
        .single()
      if (error) {
        toast.error(error.message)
        return
      }
      queryClient.invalidateQueries({ queryKey: ['clients-list'] })
      saveMutation.mutate({ formData, invoiceId, clientId: data.id, clientName: null })
    } else {
      saveMutation.mutate({ formData, invoiceId, clientId: null, clientName: name })
    }
    setClientPrompt(null)
  }

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { description: '', quantity: 1, price: '', paid: 0 }] }))
  const removeItem = (i) => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }))
  const updateItem = (i, field, value) => setForm(f => ({
    ...f,
    items: f.items.map((it, idx) => idx === i ? { ...it, [field]: value } : it),
  }))

  const lineTotal = form.items.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.quantity) || 0), 0)
  const totalPaidForm = form.items.reduce((s, it) => s + (Number(it.paid) || 0), 0)
  const isReceipt = form.documentType === 'RECU'

  return (
    <div className="space-y-6">
      {/* En-tête : sélecteur de mois + accès masqué aux totaux entreprise (admin) */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button onClick={() => goToMonth(-1)} className={btnSecondary} aria-label="Mois précédent">
            <ChevronLeft size={15} />
          </button>
          <p className="min-w-[150px] text-center text-sm font-semibold capitalize text-text-primary">{monthLabel}</p>
          <button onClick={() => goToMonth(1)} className={btnSecondary} aria-label="Mois suivant">
            <ChevronRight size={15} />
          </button>
          <span className="ml-1 text-xs text-text-muted">
            {factureCount} facture{factureCount !== 1 ? 's' : ''} ce mois-ci
          </span>
        </div>
        {isAdmin && <EnterpriseTotalsButton />}
      </div>

      {/* Stats du mois */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Facturé (mois)',  value: formatCurrency(totalBilled),  color: '#9d3bf1' },
          { label: 'Payé (mois)',     value: formatCurrency(totalPaid),    color: '#10b981' },
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
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={`${inputClass} sm:w-auto`}>
            <option value="ALL">Tous les types</option>
            <option value="FACTURE">Factures</option>
            <option value="RECU">Reçus</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`${inputClass} sm:w-auto`}>
            <option value="ALL">Tous les statuts</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{INVOICE_STATUS[s].label}</option>
            ))}
          </select>
        </div>
        {can('create', 'invoices') && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <button onClick={() => openCreateModal('FACTURE')} className={`${btnPrimary} w-full sm:w-auto`}>
              <Plus size={16} /> Nouvelle facture
            </button>
            <button onClick={() => openCreateModal('RECU')} className={`${btnSecondary} w-full sm:w-auto`}>
              <Plus size={16} /> Nouveau reçu
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-c-border bg-bg-card">
        {isLoading ? (
          <p className="p-6 text-text-secondary">Chargement…</p>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <FileText size={40} className="text-text-muted/40" />
            <p className="text-text-secondary">Aucun document pour {monthLabel}.</p>
            {can('create', 'invoices') && (
              <button onClick={() => openCreateModal('FACTURE')} className={btnPrimary}><Plus size={15} /> Créer une facture</button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="border-b border-c-border text-xs uppercase text-text-muted">
                  <th className="p-4 font-medium">N°</th>
                  <th className="p-4 font-medium">Type</th>
                  <th className="p-4 font-medium">Client</th>
                  <th className="p-4 font-medium">Total</th>
                  <th className="p-4 font-medium">Échéance</th>
                  <th className="p-4 font-medium">Statut</th>
                  <th className="p-4" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => (
                  <InvoiceRow key={inv.id} invoice={inv} onEdit={openEditModal} onGenerateReceipt={generateReceipt} />
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
        title={
          editingInvoice
            ? `Modifier — ${editingInvoice.invoiceNumber}`
            : isReceipt ? 'Nouveau reçu' : 'Nouvelle facture'
        }
        maxWidth="max-w-6xl"
        footer={
          <>
            {editingInvoice && can('delete', 'invoices') && (
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
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.35fr_1fr]">
        <form
          id="invoice-form"
          onSubmit={(e) => {
            e.preventDefault()
            submitInvoice(form)
          }}
          className="space-y-5"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Client</label>
              <input
                type="text"
                list="client-options"
                value={form.clientName}
                onChange={(e) => setForm(f => ({ ...f, clientName: e.target.value }))}
                placeholder="Sélectionner ou saisir un client…"
                className={inputClass}
                autoComplete="off"
              />
              <datalist id="client-options">
                {clients.map((c) => <option key={c.id} value={c.name} />)}
              </datalist>
              <p className="mt-1 text-xs text-text-muted">
                Choisissez un client existant ou saisissez un nouveau nom.
              </p>
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

          <div>
            <label className={labelClass}>Conditions de paiement</label>
            <textarea
              rows={2}
              value={form.paymentTerms}
              onChange={(e) => setForm(f => ({ ...f, paymentTerms: e.target.value }))}
              className={inputClass}
              placeholder="Mention affichée en bas du document…"
            />
            <p className="mt-1 text-xs text-text-muted">
              Pré-rempli avec la mention standard. Modifiable pour ce document uniquement.
            </p>
          </div>

          {/* Items */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className={labelClass}>{`Lignes ${isReceipt ? 'du reçu' : 'de la facture'}`}</label>
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
                    {isReceipt && <th className="p-3 text-right font-medium w-24">Payé (GNF)</th>}
                    <th className="p-3 text-right font-medium w-24">{isReceipt ? 'Reste' : 'Total'}</th>
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
                          type="number" min="0" step="1"
                          value={item.price}
                          onChange={(e) => updateItem(i, 'price', e.target.value)}
                          className={`${inputClass} py-1.5 text-right`}
                        />
                      </td>
                      {isReceipt && (
                        <td className="p-2">
                          <input
                            type="number" min="0" step="1"
                            value={item.paid}
                            onChange={(e) => updateItem(i, 'paid', e.target.value)}
                            className={`${inputClass} py-1.5 text-right`}
                          />
                        </td>
                      )}
                      <td className="p-2 text-right text-text-muted text-xs">
                        {formatCurrency(isReceipt ? reste : lineTotal)}
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
              {isReceipt ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-text-muted">Total facturé</span>
                    <span className="font-bold text-text-primary">{formatCurrency(lineTotal)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-text-muted">Total payé</span>
                    <span className="font-bold text-c-success">{formatCurrency(totalPaidForm)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-text-muted">Reste</span>
                    <span className="font-bold text-c-danger">
                      {formatCurrency(Math.max(0, lineTotal - totalPaidForm))}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-text-muted">Total à payer</span>
                  <span className="font-bold text-text-primary">{formatCurrency(lineTotal)}</span>
                </div>
              )}
            </div>
          </div>
        </form>

          {/* Aperçu en temps réel */}
          <div className="xl:sticky xl:top-0 xl:self-start">
            <p className="mb-2 text-xs font-medium text-text-muted">{`Aperçu ${isReceipt ? 'du reçu' : 'de la facture'}`}</p>
            <InvoicePreview
              documentType={form.documentType}
              clientName={form.clientName}
              items={form.items}
              dueDate={form.dueDate}
              paymentTerms={form.paymentTerms}
              invoiceNumber={editingInvoice?.invoiceNumber}
              createdAt={editingInvoice?.createdAt}
            />
          </div>
        </div>
      </Modal>

      {/* Popup : enregistrer le client saisi manuellement ? */}
      <Modal
        open={!!clientPrompt}
        onClose={() => setClientPrompt(null)}
        title="Nouveau client"
        maxWidth="max-w-md"
        footer={
          <>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => handleClientDecision(false)}
              disabled={saveMutation.isPending}
              className={btnSecondary}
            >
              Non, garder sur la facture
            </button>
            <button
              type="button"
              onClick={() => handleClientDecision(true)}
              disabled={saveMutation.isPending}
              className={btnPrimary}
            >
              Oui, enregistrer
            </button>
          </>
        }
      >
        <p className="text-sm text-text-secondary">
          Le client{' '}
          <span className="font-semibold text-text-primary">« {clientPrompt?.name} »</span>{' '}
          n&apos;existe pas encore dans la base de données. Voulez-vous l&apos;enregistrer pour le
          réutiliser plus tard&nbsp;?
        </p>
        <p className="mt-2 text-xs text-text-muted">
          Si vous choisissez « Non », le nom sera simplement conservé sur cette facture.
        </p>
      </Modal>
    </div>
  )
}
