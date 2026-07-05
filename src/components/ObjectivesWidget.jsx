import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Target, Plus, Pencil, Trash2, Check, XCircle, RotateCcw, Link2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useAlert } from '../context/AlertContext'
import { formatDate } from '../lib/format'
import Badge from './ui/Badge'
import Modal from './ui/Modal'
import { inputClass, labelClass, btnPrimary, btnSecondary, btnDanger } from '../lib/ui'

const PERIOD_LABELS = { week: 'Semaine', month: 'Mois' }
const STATUS_META = {
  active: { label: 'En cours', color: '#22d3ee' },
  achieved: { label: 'Atteint', color: '#10b981' },
  missed: { label: 'Manqué', color: '#ef4444' },
}

const EMPTY_FORM = {
  title: '',
  description: '',
  period: 'month',
  targetDate: '',
  indicator: '',
  clientId: '',
  projectId: '',
}

async function fetchObjectives() {
  const { data, error } = await supabase
    .from('MonthlyObjective')
    .select('*, clientRel:Client(id, name), projectRel:Project(id, name)')
    .order('status', { ascending: true })
    .order('targetDate', { ascending: true })
  if (error) throw error
  return data || []
}

async function fetchClients() {
  const { data, error } = await supabase.from('Client').select('id, name').order('name')
  if (error) throw error
  return data || []
}

async function fetchProjects() {
  const { data, error } = await supabase.from('Project').select('id, name').order('name')
  if (error) throw error
  return data || []
}

export default function ObjectivesWidget() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { showAlert } = useAlert()
  const role = user?.roleRel?.name || user?.role
  const isManager = role === 'Administrateur' || role === 'Manager'

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const { data: objectives = [] } = useQuery({
    queryKey: ['objectives'],
    queryFn: fetchObjectives,
    onError: (err) => toast.error(err.message || 'Erreur de chargement des objectifs'),
  })
  const { data: clients = [] } = useQuery({
    queryKey: ['objectives-clients'],
    queryFn: fetchClients,
    enabled: isManager,
  })
  const { data: projects = [] } = useQuery({
    queryKey: ['objectives-projects'],
    queryFn: fetchProjects,
    enabled: isManager,
  })

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      if (editing) {
        const { error } = await supabase.from('MonthlyObjective').update(payload).eq('id', editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('MonthlyObjective')
          .insert({ ...payload, createdBy: user?.id || null })
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objectives'] })
      toast.success(editing ? 'Objectif mis à jour' : 'Objectif ajouté')
      closeModal()
    },
    onError: (err) => toast.error(err.message),
  })

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }) => {
      const { error } = await supabase.from('MonthlyObjective').update({ status }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['objectives'] }),
    onError: (err) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('MonthlyObjective').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objectives'] })
      toast.success('Objectif supprimé')
      closeModal()
    },
    onError: (err) => toast.error(err.message),
  })

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  const openEdit = (obj) => {
    if (!isManager) return
    setEditing(obj)
    setForm({
      title: obj.title || '',
      description: obj.description || '',
      period: obj.period || 'month',
      targetDate: obj.targetDate || '',
      indicator: obj.indicator || '',
      clientId: obj.clientId || '',
      projectId: obj.projectId || '',
    })
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditing(null)
    setForm(EMPTY_FORM)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.title.trim()) {
      showAlert("Le titre de l'objectif est requis.")
      return
    }
    if (!form.targetDate) {
      showAlert("L'échéance est requise. Veuillez sélectionner une date à l'aide de l'icône du calendrier.")
      return
    }
    saveMutation.mutate({
      title: form.title.trim(),
      description: form.description.trim() || null,
      period: form.period,
      targetDate: form.targetDate,
      indicator: form.indicator.trim() || null,
      clientId: form.clientId || null,
      projectId: form.projectId || null,
    })
  }

  // Objectifs en cours en tête, puis les clôturés
  const activeObjectives = objectives.filter((o) => o.status === 'active')
  const closedObjectives = objectives.filter((o) => o.status !== 'active')

  const renderCard = (obj) => {
    const meta = STATUS_META[obj.status] || STATUS_META.active
    const link = obj.clientRel?.name || obj.projectRel?.name
    return (
      <div
        key={obj.id}
        onClick={() => openEdit(obj)}
        className={`rounded-lg border border-c-border bg-bg-dark p-3 transition-colors ${
          isManager ? 'cursor-pointer hover:border-accent-purple/50' : ''
        }`}
      >
        <div className="mb-1.5 flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-text-primary">{obj.title}</p>
          <div className="flex shrink-0 items-center gap-1.5">
            <Badge color="#9d3bf1">{PERIOD_LABELS[obj.period] || 'Mois'}</Badge>
            <Badge color={meta.color}>{meta.label}</Badge>
          </div>
        </div>
        {obj.description && (
          <p className="mb-2 text-xs text-text-secondary">{obj.description}</p>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
          <span>Échéance {formatDate(obj.targetDate)}</span>
          {obj.indicator && (
            <span className="flex items-center gap-1 text-accent-cyan">
              <Target size={12} />
              {obj.indicator}
            </span>
          )}
          {link && (
            <span className="flex items-center gap-1">
              <Link2 size={12} />
              {link}
            </span>
          )}
        </div>

        {isManager && (
          <div className="mt-3 flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {obj.status !== 'achieved' && (
              <button
                type="button"
                onClick={() => statusMutation.mutate({ id: obj.id, status: 'achieved' })}
                disabled={statusMutation.isPending}
                className="flex items-center gap-1 rounded-md border border-c-success/40 px-2 py-1 text-xs font-medium text-c-success transition-colors hover:bg-c-success/10 disabled:opacity-50"
              >
                <Check size={12} />
                Atteint
              </button>
            )}
            {obj.status !== 'missed' && (
              <button
                type="button"
                onClick={() => statusMutation.mutate({ id: obj.id, status: 'missed' })}
                disabled={statusMutation.isPending}
                className="flex items-center gap-1 rounded-md border border-c-danger/40 px-2 py-1 text-xs font-medium text-c-danger transition-colors hover:bg-c-danger/10 disabled:opacity-50"
              >
                <XCircle size={12} />
                Manqué
              </button>
            )}
            {obj.status !== 'active' && (
              <button
                type="button"
                onClick={() => statusMutation.mutate({ id: obj.id, status: 'active' })}
                disabled={statusMutation.isPending}
                className="flex items-center gap-1 rounded-md border border-c-border px-2 py-1 text-xs font-medium text-text-muted transition-colors hover:bg-bg-hover disabled:opacity-50"
              >
                <RotateCcw size={12} />
                Rouvrir
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-c-border bg-bg-card p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Target size={18} className="text-accent-purple" />
          <h2 className="text-base font-semibold text-text-primary">Objectifs à atteindre</h2>
        </div>
        {isManager && (
          <button onClick={openCreate} className={`${btnPrimary} px-3 py-1.5 text-xs`}>
            <Plus size={14} />
            Ajouter
          </button>
        )}
      </div>

      {objectives.length === 0 ? (
        <p className="text-sm text-text-muted">
          {isManager
            ? "Aucun objectif défini. Cliquez sur « Ajouter » pour en créer un."
            : 'Aucun objectif défini pour le moment.'}
        </p>
      ) : (
        <div className="space-y-4">
          {activeObjectives.length > 0 && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {activeObjectives.map(renderCard)}
            </div>
          )}
          {closedObjectives.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                Clôturés
              </p>
              <div className="grid grid-cols-1 gap-3 opacity-70 md:grid-cols-2">
                {closedObjectives.map(renderCard)}
              </div>
            </div>
          )}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? "Modifier l'objectif" : 'Nouvel objectif'}
        footer={
          <>
            {editing && (
              <button
                type="button"
                onClick={() => deleteMutation.mutate(editing.id)}
                disabled={deleteMutation.isPending}
                className={btnDanger}
              >
                <Trash2 size={16} />
                Supprimer
              </button>
            )}
            <div className="flex-1" />
            <button type="button" onClick={closeModal} className={btnSecondary}>
              Annuler
            </button>
            <button
              type="submit"
              form="objective-form"
              disabled={saveMutation.isPending}
              className={btnPrimary}
            >
              Enregistrer
            </button>
          </>
        }
      >
        <form id="objective-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Titre</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className={inputClass}
              placeholder="Ex : Signer 3 nouveaux clients"
            />
          </div>

          <div>
            <label className={labelClass}>Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className={inputClass}
              rows={3}
              placeholder="Détails, contexte, sous-étapes…"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Période</label>
              <select
                value={form.period}
                onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))}
                className={inputClass}
              >
                <option value="month">Mois</option>
                <option value="week">Semaine</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Échéance</label>
              <input
                type="date"
                value={form.targetDate || ''}
                onChange={(e) => setForm((f) => ({ ...f, targetDate: e.target.value }))}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Indicateur de réussite</label>
            <input
              type="text"
              value={form.indicator}
              onChange={(e) => setForm((f) => ({ ...f, indicator: e.target.value }))}
              className={inputClass}
              placeholder="Ex : 3 contrats signés, +20 % d'abonnés…"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Lier à un client (optionnel)</label>
              <select
                value={form.clientId}
                onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
                className={inputClass}
              >
                <option value="">Aucun</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Lier à un projet (optionnel)</label>
              <select
                value={form.projectId}
                onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}
                className={inputClass}
              >
                <option value="">Aucun</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  )
}
