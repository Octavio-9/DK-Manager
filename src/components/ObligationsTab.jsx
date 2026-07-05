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
import { useAlert } from '../context/AlertContext'
import Badge from './ui/Badge'
import Modal from './ui/Modal'
import { inputClass, labelClass, btnPrimary, btnSecondary } from '../lib/ui'

const MONTH_LABEL_FORMAT = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' })
const EMPTY_TEMPLATE = { name: '', defaultAmount: '', categoryId: '' }

export default function ObligationsTab({ categories }) {
  const queryClient = useQueryClient()
  const { showAlert } = useAlert()
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
            if (!payForm.amount || isNaN(Number(payForm.amount))) { showAlert('Montant invalide'); return }
            payMutation.mutate({ entry: payingEntry, amount: Number(payForm.amount), paidDate: payForm.paidDate })
          }}
          className="space-y-4"
        >
          <p className="text-sm text-text-secondary">{payingEntry?.name}</p>
          <div>
            <label className={labelClass}>Montant (GNF) *</label>
            <input type="number" min="0" step="1" required value={payForm.amount} onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))} className={inputClass} />
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
            if (!templateForm.name.trim()) { showAlert('Nom requis'); return }
            if (!templateForm.defaultAmount || isNaN(Number(templateForm.defaultAmount))) { showAlert('Montant invalide'); return }
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
            <label className={labelClass}>Montant par défaut (GNF) *</label>
            <input type="number" min="0" step="1" value={templateForm.defaultAmount} onChange={(e) => setTemplateForm((f) => ({ ...f, defaultAmount: e.target.value }))} className={inputClass} />
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
