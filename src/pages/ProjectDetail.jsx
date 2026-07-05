import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ArrowLeft, Pencil, Trash2, Plus, Info, ListTodo, Film, Wallet,
  Calendar, CheckCircle2, Clock, AlertCircle,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAlert } from '../context/AlertContext'
import { formatDate, formatCurrency } from '../lib/format'
import {
  PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS, PROJECT_STATUS_OPTIONS,
  TASK_STATUS_LABELS, TASK_STATUS_OPTIONS, TASK_PRIORITY_LABELS, TASK_PRIORITY_COLORS, TASK_PRIORITY_OPTIONS,
} from '../lib/constants'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import { inputClass, labelClass, btnPrimary, btnSecondary, btnDanger } from '../lib/ui'

/* ── Fetch helpers ─────────────────────────────────────────────── */

async function fetchProject(id) {
  const { data, error } = await supabase
    .from('Project')
    .select('*, clientRel:Client(id, name), typeRel:ProjectType(id, name, color)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

async function fetchProjectTasks(projectId) {
  const { data, error } = await supabase
    .from('Task')
    .select('*, assigneeRel:User(id, name, avatarBg)')
    .eq('projectId', projectId)
    .order('createdAt', { ascending: false })
  if (error) throw error
  return data || []
}

async function fetchProjectProductions(projectId) {
  const { data, error } = await supabase
    .from('Production')
    .select('*, files:ProductionFile(*)')
    .eq('projectId', projectId)
    .order('recordingDate', { ascending: true })
  if (error) throw error
  return data || []
}

async function fetchProjectEvents(projectId) {
  const { data, error } = await supabase
    .from('Event')
    .select('*, typeRel:EventType(id, name, color)')
    .eq('projectId', projectId)
    .order('date', { ascending: true })
  if (error) throw error
  return data || []
}

async function fetchMembers() {
  const { data, error } = await supabase.from('User').select('id, name, avatarBg').order('name')
  if (error) throw error
  return data || []
}

/* ── Constants ──────────────────────────────────────────────────── */

const TABS = [
  { key: 'info', label: 'Informations', icon: Info },
  { key: 'tasks', label: 'Tâches', icon: ListTodo },
  { key: 'productions', label: 'Productions', icon: Film },
  { key: 'finance', label: 'Finances', icon: Wallet },
  { key: 'calendar', label: 'Calendrier', icon: Calendar },
]

const PRODUCTION_TYPES = ['Podcast', 'Photo', 'Vidéo', 'Shooting']
const PRODUCTION_STATUS = {
  PLANNED: { label: 'Planifié', color: '#22d3ee' },
  RECORDED: { label: 'Enregistré', color: '#f59e0b' },
  EDITING: { label: 'En montage', color: '#9d3bf1' },
  READY: { label: 'Prêt', color: '#10b981' },
}

const EMPTY_TASK = { title: '', description: '', assigneeId: '', priority: 'MEDIUM', status: 'TODO', dueDate: '' }
const EMPTY_PRODUCTION = { title: '', type: 'Podcast', recordingDate: '', location: '', status: 'PLANNED' }

/* ── Main Page ──────────────────────────────────────────────────── */

export default function ProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showAlert } = useAlert()
  const [activeTab, setActiveTab] = useState('info')
  const [taskOpen, setTaskOpen] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [taskForm, setTaskForm] = useState(EMPTY_TASK)
  const [prodOpen, setProdOpen] = useState(false)
  const [editingProd, setEditingProd] = useState(null)
  const [prodForm, setProdForm] = useState(EMPTY_PRODUCTION)

  /* Queries */
  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => fetchProject(id),
    onError: (err) => toast.error(err.message),
  })

  const { data: tasks = [] } = useQuery({ queryKey: ['project-tasks', id], queryFn: () => fetchProjectTasks(id) })
  const { data: productions = [] } = useQuery({ queryKey: ['project-productions', id], queryFn: () => fetchProjectProductions(id) })
  const { data: events = [] } = useQuery({ queryKey: ['project-events', id], queryFn: () => fetchProjectEvents(id) })
  const { data: members = [] } = useQuery({ queryKey: ['members-list'], queryFn: fetchMembers })

  /* Task mutations */
  const saveTaskMutation = useMutation({
    mutationFn: async (payload) => {
      if (editingTask) {
        const { error } = await supabase.from('Task').update(payload).eq('id', editingTask.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('Task').insert({ ...payload, projectId: id })
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-tasks', id] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      toast.success(editingTask ? 'Tâche mise à jour' : 'Tâche créée')
      setTaskOpen(false)
      setEditingTask(null)
      setTaskForm(EMPTY_TASK)
    },
    onError: (err) => toast.error(err.message),
  })

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId) => {
      const { error } = await supabase.from('Task').delete().eq('id', taskId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-tasks', id] })
      toast.success('Tâche supprimée')
    },
    onError: (err) => toast.error(err.message),
  })

  /* Production mutations */
  const saveProdMutation = useMutation({
    mutationFn: async (payload) => {
      if (editingProd) {
        const { error } = await supabase.from('Production').update(payload).eq('id', editingProd.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('Production').insert({ ...payload, projectId: id })
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-productions', id] })
      toast.success(editingProd ? 'Production mise à jour' : 'Production créée')
      setProdOpen(false)
      setEditingProd(null)
      setProdForm(EMPTY_PRODUCTION)
    },
    onError: (err) => toast.error(err.message),
  })

  if (isLoading) return <p className="text-text-secondary">Chargement…</p>
  if (!project) return <p className="text-text-secondary">Projet introuvable.</p>

  const progress = project.budget > 0
    ? Math.min(100, Math.round((project.amountPaid / project.budget) * 100))
    : 0

  const taskDone = tasks.filter(t => t.status === 'DONE').length
  const taskTotal = tasks.length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/projects')}
            className="rounded-lg p-2 text-text-muted transition-colors hover:bg-bg-hover hover:text-text-primary"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-xl font-bold text-text-primary">{project.name}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge color={PROJECT_STATUS_COLORS[project.status]}>{PROJECT_STATUS_LABELS[project.status]}</Badge>
              {project.typeRel && <Badge color={project.typeRel.color}>{project.typeRel.name}</Badge>}
              {project.clientRel && <span className="text-xs text-text-muted">Client : {project.clientRel.name}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-c-border bg-bg-card p-4">
          <p className="text-xs text-text-muted">Tâches</p>
          <p className="mt-1 text-lg font-bold text-accent-purple">{taskDone}/{taskTotal}</p>
          <p className="text-xs text-text-muted">terminées</p>
        </div>
        <div className="rounded-xl border border-c-border bg-bg-card p-4">
          <p className="text-xs text-text-muted">Budget</p>
          <p className="mt-1 text-lg font-bold text-c-warning">{formatCurrency(project.budget)}</p>
        </div>
        <div className="rounded-xl border border-c-border bg-bg-card p-4">
          <p className="text-xs text-text-muted">Encaissé</p>
          <p className="mt-1 text-lg font-bold text-c-success">{formatCurrency(project.amountPaid)}</p>
        </div>
        <div className="rounded-xl border border-c-border bg-bg-card p-4">
          <p className="text-xs text-text-muted">Deadline</p>
          <p className="mt-1 text-sm font-bold text-text-primary">{project.deadline ? formatDate(project.deadline) : '—'}</p>
        </div>
      </div>

      {/* Payment progress */}
      <div className="rounded-xl border border-c-border bg-bg-card p-4">
        <div className="mb-2 flex justify-between text-xs text-text-muted">
          <span>Paiement encaissé</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-bg-hover">
          <div className="h-full rounded-full bg-accent-purple transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-c-border bg-bg-panel p-1">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === key
                ? 'bg-accent-purple text-white'
                : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab: Info */}
      {activeTab === 'info' && (
        <div className="rounded-xl border border-c-border bg-bg-card p-5 space-y-3">
          {project.description && (
            <div>
              <p className="text-xs text-text-muted mb-1">Description</p>
              <p className="text-sm text-text-secondary whitespace-pre-wrap">{project.description}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 text-sm">
            <div><p className="text-xs text-text-muted">Début</p><p className="text-text-primary">{project.startDate ? formatDate(project.startDate) : '—'}</p></div>
            <div><p className="text-xs text-text-muted">Deadline</p><p className="text-text-primary">{project.deadline ? formatDate(project.deadline) : '—'}</p></div>
            <div><p className="text-xs text-text-muted">Solde restant</p><p className="text-text-primary">{formatCurrency(Math.max(0, project.budget - project.amountPaid))}</p></div>
          </div>
        </div>
      )}

      {/* Tab: Tasks */}
      {activeTab === 'tasks' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">{tasks.length} tâche{tasks.length !== 1 ? 's' : ''}</h3>
            <button onClick={() => { setEditingTask(null); setTaskForm(EMPTY_TASK); setTaskOpen(true) }} className={btnPrimary}>
              <Plus size={15} /> Ajouter une tâche
            </button>
          </div>
          {tasks.length === 0 ? (
            <p className="text-sm text-text-muted">Aucune tâche.</p>
          ) : (
            <div className="space-y-2">
              {tasks.map((t) => (
                <div key={t.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-c-border bg-bg-card p-4 cursor-pointer hover:border-accent-purple/40"
                  onClick={() => { setEditingTask(t); setTaskForm({ title: t.title, description: t.description || '', assigneeId: t.assigneeId || '', priority: t.priority, status: t.status, dueDate: t.dueDate || '' }); setTaskOpen(true) }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {t.status === 'DONE' ? <CheckCircle2 size={16} className="text-c-success shrink-0" /> : t.status === 'BLOCKED' ? <AlertCircle size={16} className="text-c-danger shrink-0" /> : <Clock size={16} className="text-text-muted shrink-0" />}
                    <div className="min-w-0">
                      <p className={`text-sm font-medium truncate ${t.status === 'DONE' ? 'line-through text-text-muted' : 'text-text-primary'}`}>{t.title}</p>
                      {t.assigneeRel && <p className="text-xs text-text-muted">{t.assigneeRel.name}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge color={TASK_PRIORITY_COLORS[t.priority]}>{TASK_PRIORITY_LABELS[t.priority]}</Badge>
                    <Badge color={t.status === 'DONE' ? '#10b981' : t.status === 'BLOCKED' ? '#ef4444' : '#22d3ee'}>{TASK_STATUS_LABELS[t.status]}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Productions */}
      {activeTab === 'productions' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">{productions.length} production{productions.length !== 1 ? 's' : ''}</h3>
            <button onClick={() => { setEditingProd(null); setProdForm(EMPTY_PRODUCTION); setProdOpen(true) }} className={btnPrimary}>
              <Plus size={15} /> Ajouter
            </button>
          </div>
          {productions.length === 0 ? (
            <p className="text-sm text-text-muted">Aucune production.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {productions.map((p) => {
                const s = PRODUCTION_STATUS[p.status] || { label: p.status, color: '#6e6a75' }
                return (
                  <div key={p.id} className="rounded-xl border border-c-border bg-bg-card p-4 cursor-pointer hover:border-accent-purple/40"
                    onClick={() => { setEditingProd(p); setProdForm({ title: p.title, type: p.type, recordingDate: p.recordingDate || '', location: p.location || '', status: p.status }); setProdOpen(true) }}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="font-medium text-text-primary text-sm">{p.title}</p>
                      <Badge color={s.color}>{s.label}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-text-muted">
                      <span className="rounded bg-bg-hover px-2 py-0.5">{p.type}</span>
                      {p.recordingDate && <span>{formatDate(p.recordingDate)}</span>}
                      {p.location && <span>📍 {p.location}</span>}
                    </div>
                    <p className="mt-2 text-xs text-text-muted">{p.files?.length || 0} fichier{p.files?.length !== 1 ? 's' : ''}</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab: Finance */}
      {activeTab === 'finance' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-c-border bg-bg-card p-4">
              <p className="text-xs text-text-muted">Budget total</p>
              <p className="mt-1 text-lg font-bold text-accent-purple">{formatCurrency(project.budget)}</p>
            </div>
            <div className="rounded-xl border border-c-border bg-bg-card p-4">
              <p className="text-xs text-text-muted">Montant encaissé</p>
              <p className="mt-1 text-lg font-bold text-c-success">{formatCurrency(project.amountPaid)}</p>
            </div>
            <div className="rounded-xl border border-c-border bg-bg-card p-4">
              <p className="text-xs text-text-muted">Solde restant</p>
              <p className="mt-1 text-lg font-bold text-c-warning">{formatCurrency(Math.max(0, project.budget - project.amountPaid))}</p>
            </div>
          </div>
          <div className="rounded-xl border border-c-border bg-bg-card p-5">
            <h4 className="text-sm font-semibold text-text-primary mb-3">Progression du paiement</h4>
            <div className="mb-2 flex justify-between text-xs text-text-muted">
              <span>{formatCurrency(project.amountPaid)} encaissé</span>
              <span>{progress}%</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-bg-hover">
              <div className="h-full rounded-full bg-gradient-to-r from-accent-purple to-accent-cyan transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* Tab: Calendar */}
      {activeTab === 'calendar' && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">{events.length} événement{events.length !== 1 ? 's' : ''}</h3>
          {events.length === 0 ? (
            <p className="text-sm text-text-muted">Aucun événement lié.</p>
          ) : (
            <div className="space-y-2">
              {events.map((e) => (
                <div key={e.id} className="flex items-start gap-3 rounded-xl border border-c-border bg-bg-card p-4">
                  <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: e.typeRel?.color || '#22d3ee' }} />
                  <div>
                    <p className="text-sm font-medium text-text-primary">{e.title}</p>
                    <p className="text-xs text-text-muted">{e.typeRel?.name} · {formatDate(e.date)}{e.location ? ` · ${e.location}` : ''}</p>
                    {e.description && <p className="mt-1 text-xs text-text-secondary">{e.description}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Task Modal */}
      <Modal open={taskOpen} onClose={() => { setTaskOpen(false); setEditingTask(null); setTaskForm(EMPTY_TASK) }}
        title={editingTask ? 'Modifier la tâche' : 'Nouvelle tâche'}
        footer={
          <>
            {editingTask && (
              <button type="button" onClick={() => { deleteTaskMutation.mutate(editingTask.id); setTaskOpen(false) }} className={btnDanger}>
                <Trash2 size={15} /> Supprimer
              </button>
            )}
            <div className="flex-1" />
            <button type="button" onClick={() => setTaskOpen(false)} className={btnSecondary}>Annuler</button>
            <button type="submit" form="task-form-detail" disabled={saveTaskMutation.isPending} className={btnPrimary}>Enregistrer</button>
          </>
        }
      >
        <form id="task-form-detail" onSubmit={(e) => {
          e.preventDefault()
          if (!taskForm.title.trim()) { showAlert('Le titre est requis'); return }
          saveTaskMutation.mutate({
            title: taskForm.title.trim(),
            description: taskForm.description || null,
            assigneeId: taskForm.assigneeId || null,
            priority: taskForm.priority,
            status: taskForm.status,
            dueDate: taskForm.dueDate || null,
          })
        }} className="space-y-4">
          <div><label className={labelClass}>Titre *</label><input required className={inputClass} value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} /></div>
          <div><label className={labelClass}>Description</label><textarea rows={3} className={inputClass} value={taskForm.description} onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))} /></div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Assigné à</label>
              <select className={inputClass} value={taskForm.assigneeId} onChange={e => setTaskForm(f => ({ ...f, assigneeId: e.target.value }))}>
                <option value="">— Aucun —</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div><label className={labelClass}>Échéance</label><input type="date" className={inputClass} value={taskForm.dueDate} onChange={e => setTaskForm(f => ({ ...f, dueDate: e.target.value }))} /></div>
            <div>
              <label className={labelClass}>Priorité</label>
              <select className={inputClass} value={taskForm.priority} onChange={e => setTaskForm(f => ({ ...f, priority: e.target.value }))}>
                {TASK_PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{TASK_PRIORITY_LABELS[p]}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Statut</label>
              <select className={inputClass} value={taskForm.status} onChange={e => setTaskForm(f => ({ ...f, status: e.target.value }))}>
                {TASK_STATUS_OPTIONS.map(s => <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>)}
              </select>
            </div>
          </div>
        </form>
      </Modal>

      {/* Production Modal */}
      <Modal open={prodOpen} onClose={() => { setProdOpen(false); setEditingProd(null); setProdForm(EMPTY_PRODUCTION) }}
        title={editingProd ? 'Modifier la production' : 'Nouvelle production'}
        footer={
          <>
            <div className="flex-1" />
            <button type="button" onClick={() => setProdOpen(false)} className={btnSecondary}>Annuler</button>
            <button type="submit" form="prod-form" disabled={saveProdMutation.isPending} className={btnPrimary}>Enregistrer</button>
          </>
        }
      >
        <form id="prod-form" onSubmit={(e) => {
          e.preventDefault()
          if (!prodForm.title.trim()) { showAlert('Le titre est requis'); return }
          saveProdMutation.mutate({
            title: prodForm.title.trim(),
            type: prodForm.type,
            recordingDate: prodForm.recordingDate || null,
            location: prodForm.location || null,
            status: prodForm.status,
          })
        }} className="space-y-4">
          <div><label className={labelClass}>Titre *</label><input required className={inputClass} value={prodForm.title} onChange={e => setProdForm(f => ({ ...f, title: e.target.value }))} /></div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Type</label>
              <select className={inputClass} value={prodForm.type} onChange={e => setProdForm(f => ({ ...f, type: e.target.value }))}>
                {PRODUCTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Statut</label>
              <select className={inputClass} value={prodForm.status} onChange={e => setProdForm(f => ({ ...f, status: e.target.value }))}>
                {Object.entries(PRODUCTION_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div><label className={labelClass}>Date d&apos;enregistrement</label><input type="date" className={inputClass} value={prodForm.recordingDate} onChange={e => setProdForm(f => ({ ...f, recordingDate: e.target.value }))} /></div>
            <div><label className={labelClass}>Lieu</label><input className={inputClass} value={prodForm.location} onChange={e => setProdForm(f => ({ ...f, location: e.target.value }))} /></div>
          </div>
        </form>
      </Modal>
    </div>
  )
}
