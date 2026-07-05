import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, Calendar, Wallet } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAlert } from '../context/AlertContext'
import { formatCurrency, formatDate } from '../lib/format'
import {
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_COLORS,
  PROJECT_STATUS_OPTIONS,
} from '../lib/constants'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import { inputClass, labelClass, btnPrimary, btnSecondary, btnDanger } from '../lib/ui'

const EMPTY_FORM = {
  name: '',
  description: '',
  clientId: '',
  typeId: '',
  status: 'PLANNING',
  budget: '',
  amountPaid: '',
  startDate: '',
  deadline: '',
}

async function fetchProjects() {
  const { data, error } = await supabase
    .from('Project')
    .select('*, clientRel:Client(id, name), typeRel:ProjectType(id, name, color)')
    .order('deadline', { ascending: true, nullsFirst: false })
  if (error) throw error
  return data || []
}

async function fetchClients() {
  const { data, error } = await supabase.from('Client').select('id, name').order('name')
  if (error) throw error
  return data || []
}

async function fetchProjectTypes() {
  const { data, error } = await supabase.from('ProjectType').select('*').order('name')
  if (error) throw error
  return data || []
}

export default function Projects() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showAlert } = useAlert()
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [clientFilter, setClientFilter] = useState('ALL')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProject, setEditingProject] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
    onError: (err) => toast.error(err.message),
  })
  const { data: clients = [] } = useQuery({ queryKey: ['clients-list'], queryFn: fetchClients })
  const { data: projectTypes = [] } = useQuery({ queryKey: ['project-types'], queryFn: fetchProjectTypes })

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (statusFilter !== 'ALL' && p.status !== statusFilter) return false
      if (typeFilter !== 'ALL' && p.typeId !== typeFilter) return false
      if (clientFilter !== 'ALL' && p.clientId !== clientFilter) return false
      return true
    })
  }, [projects, statusFilter, typeFilter, clientFilter])

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      if (editingProject) {
        const { error } = await supabase.from('Project').update(payload).eq('id', editingProject.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('Project').insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success(editingProject ? 'Projet mis à jour' : 'Projet créé')
      closeModal()
    },
    onError: (err) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('Project').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Projet supprimé')
      closeModal()
    },
    onError: (err) => toast.error(err.message),
  })

  const openCreateModal = () => {
    setEditingProject(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  const openEditModal = (project) => {
    setEditingProject(project)
    setForm({
      name: project.name || '',
      description: project.description || '',
      clientId: project.clientId || '',
      typeId: project.typeId || '',
      status: project.status || 'PLANNING',
      budget: project.budget ?? '',
      amountPaid: project.amountPaid ?? '',
      startDate: project.startDate || '',
      deadline: project.deadline || '',
    })
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingProject(null)
    setForm(EMPTY_FORM)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name.trim()) {
      showAlert('Le nom du projet est requis.')
      return
    }
    saveMutation.mutate({
      name: form.name.trim(),
      description: form.description.trim() || null,
      clientId: form.clientId || null,
      typeId: form.typeId || null,
      status: form.status,
      budget: form.budget === '' ? 0 : Number(form.budget),
      amountPaid: form.amountPaid === '' ? 0 : Number(form.amountPaid),
      startDate: form.startDate || null,
      deadline: form.deadline || null,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-center">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`${inputClass} sm:w-auto`}>
            <option value="ALL">Tous les statuts</option>
            {PROJECT_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {PROJECT_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={`${inputClass} sm:w-auto`}>
            <option value="ALL">Tous les types</option>
            {projectTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} className={`${inputClass} sm:w-auto`}>
            <option value="ALL">Tous les clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <button onClick={openCreateModal} className={`${btnPrimary} w-full sm:w-auto`}>
          <Plus size={16} />
          Nouveau projet
        </button>
      </div>

      {isLoading ? (
        <p className="text-text-secondary">Chargement…</p>
      ) : filtered.length === 0 ? (
        <p className="text-text-secondary">Aucun projet ne correspond aux filtres.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((project) => {
            const progress =
              project.budget > 0 ? Math.min(100, Math.round((project.amountPaid / project.budget) * 100)) : 0
            return (
              <div
                key={project.id}
                onClick={() => navigate(`/projects/${project.id}`)}
                className="cursor-pointer rounded-xl border border-c-border bg-bg-card p-5 transition-colors hover:border-accent-purple/50"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-text-primary">{project.name}</h3>
                  <Badge color={PROJECT_STATUS_COLORS[project.status]}>
                    {PROJECT_STATUS_LABELS[project.status]}
                  </Badge>
                </div>

                {project.typeRel && (
                  <div className="mb-3">
                    <Badge color={project.typeRel.color}>{project.typeRel.name}</Badge>
                  </div>
                )}

                <p className="mb-3 line-clamp-2 text-sm text-text-secondary">
                  {project.description || 'Aucune description'}
                </p>

                <p className="mb-3 text-sm text-text-secondary">
                  Client : <span className="text-text-primary">{project.clientRel?.name || '—'}</span>
                </p>

                <div className="mb-3">
                  <div className="mb-1 flex items-center justify-between text-xs text-text-muted">
                    <span className="flex items-center gap-1">
                      <Wallet size={12} /> {formatCurrency(project.amountPaid)} / {formatCurrency(project.budget)}
                    </span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-hover">
                    <div className="h-full rounded-full bg-accent-purple" style={{ width: `${progress}%` }} />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-text-muted">
                  <span className="flex items-center gap-1">
                    <Calendar size={12} /> {formatDate(project.deadline)}
                  </span>
                  <Pencil size={14} className="text-text-muted" />
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingProject ? 'Modifier le projet' : 'Nouveau projet'}
        maxWidth="max-w-2xl"
        footer={
          <>
            {editingProject && (
              <button
                type="button"
                onClick={() => deleteMutation.mutate(editingProject.id)}
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
            <button type="submit" form="project-form" disabled={saveMutation.isPending} className={btnPrimary}>
              Enregistrer
            </button>
          </>
        }
      >
        <form id="project-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Nom du projet</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className={inputClass}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Client</label>
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
              <label className={labelClass}>Type de projet</label>
              <select
                value={form.typeId}
                onChange={(e) => setForm((f) => ({ ...f, typeId: e.target.value }))}
                className={inputClass}
              >
                <option value="">Aucun</option>
                {projectTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>Statut</label>
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              className={inputClass}
            >
              {PROJECT_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {PROJECT_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Budget total (GNF)</label>
              <input
                type="number"
                min="0"
                step="1"
                value={form.budget}
                onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Montant payé (GNF)</label>
              <input
                type="number"
                min="0"
                step="1"
                value={form.amountPaid}
                onChange={(e) => setForm((f) => ({ ...f, amountPaid: e.target.value }))}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Date de début</label>
              <input
                type="date"
                value={form.startDate || ''}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Deadline</label>
              <input
                type="date"
                value={form.deadline || ''}
                onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
                className={inputClass}
              />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  )
}
