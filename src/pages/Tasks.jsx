import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus, Trash2, Calendar } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatDate, isOverdue } from '../lib/format'
import {
  TASK_STATUS_LABELS,
  TASK_STATUS_OPTIONS,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_COLORS,
  TASK_PRIORITY_OPTIONS,
} from '../lib/constants'
import Badge from '../components/ui/Badge'
import Avatar from '../components/ui/Avatar'
import Modal from '../components/ui/Modal'
import { inputClass, labelClass, btnPrimary, btnSecondary, btnDanger } from '../lib/ui'

const EMPTY_FORM = {
  title: '',
  description: '',
  status: 'TODO',
  priority: 'MEDIUM',
  projectId: '',
  assigneeId: '',
  dueDate: '',
}

async function fetchTasks() {
  const { data, error } = await supabase
    .from('Task')
    .select('*, assigneeRel:User(id, name, avatarBg), projectRel:Project(id, name)')
    .order('createdAt', { ascending: false })
  if (error) throw error
  return data || []
}

async function fetchUsers() {
  const { data, error } = await supabase.from('User').select('id, name, avatarBg').order('name')
  if (error) throw error
  return data || []
}

async function fetchProjects() {
  const { data, error } = await supabase.from('Project').select('id, name').order('name')
  if (error) throw error
  return data || []
}

export default function Tasks() {
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [dragOverColumn, setDragOverColumn] = useState(null)

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: fetchTasks,
    onError: (err) => toast.error(err.message),
  })
  const { data: users = [] } = useQuery({ queryKey: ['users-list'], queryFn: fetchUsers })
  const { data: projects = [] } = useQuery({ queryKey: ['projects-list'], queryFn: fetchProjects })

  const columns = useMemo(() => {
    const map = {}
    for (const status of TASK_STATUS_OPTIONS) map[status] = []
    for (const t of tasks) {
      if (map[t.status]) map[t.status].push(t)
    }
    return map
  }, [tasks])

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      if (editingTask) {
        const { error } = await supabase.from('Task').update(payload).eq('id', editingTask.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('Task').insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success(editingTask ? 'Tâche mise à jour' : 'Tâche créée')
      closeModal()
    },
    onError: (err) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('Task').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Tâche supprimée')
      closeModal()
    },
    onError: (err) => toast.error(err.message),
  })

  const moveMutation = useMutation({
    mutationFn: async ({ id, status }) => {
      const { error } = await supabase.from('Task').update({ status }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (err) => toast.error(err.message),
  })

  const openCreateModal = (status) => {
    setEditingTask(null)
    setForm({ ...EMPTY_FORM, status: status || 'TODO' })
    setModalOpen(true)
  }

  const openEditModal = (task) => {
    setEditingTask(task)
    setForm({
      title: task.title || '',
      description: task.description || '',
      status: task.status || 'TODO',
      priority: task.priority || 'MEDIUM',
      projectId: task.projectId || '',
      assigneeId: task.assigneeId || '',
      dueDate: task.dueDate || '',
    })
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingTask(null)
    setForm(EMPTY_FORM)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.title.trim()) {
      toast.error('Le titre de la tâche est requis.')
      return
    }
    saveMutation.mutate({
      title: form.title.trim(),
      description: form.description.trim() || null,
      status: form.status,
      priority: form.priority,
      projectId: form.projectId || null,
      assigneeId: form.assigneeId || null,
      dueDate: form.dueDate || null,
    })
  }

  const handleDrop = (e, status) => {
    e.preventDefault()
    setDragOverColumn(null)
    const taskId = e.dataTransfer.getData('taskId')
    const task = tasks.find((t) => t.id === taskId)
    if (task && task.status !== status) {
      moveMutation.mutate({ id: taskId, status })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <button onClick={() => openCreateModal()} className={`${btnPrimary} w-full sm:w-auto`}>
          <Plus size={16} />
          Nouvelle tâche
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {TASK_STATUS_OPTIONS.map((status) => (
          <div
            key={status}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOverColumn(status)
            }}
            onDragLeave={() => setDragOverColumn((c) => (c === status ? null : c))}
            onDrop={(e) => handleDrop(e, status)}
            className={`flex min-h-[200px] flex-col rounded-xl border bg-bg-card p-3 transition-colors sm:min-h-[400px] ${
              dragOverColumn === status ? 'border-accent-purple' : 'border-c-border'
            }`}
          >
            <div className="mb-3 flex items-center justify-between px-1">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
                {TASK_STATUS_LABELS[status]}
              </h3>
              <span className="rounded-full bg-bg-hover px-2 py-0.5 text-xs text-text-muted">
                {columns[status].length}
              </span>
            </div>

            <div className="flex-1 space-y-2">
              {columns[status].map((task) => {
                const overdue = task.status !== 'DONE' && isOverdue(task.dueDate)
                return (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('taskId', task.id)}
                    onClick={() => openEditModal(task)}
                    className="cursor-pointer rounded-lg border border-c-border bg-bg-dark p-3 transition-colors hover:border-accent-purple/50"
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-text-primary">{task.title}</p>
                      <Badge color={TASK_PRIORITY_COLORS[task.priority]}>
                        {TASK_PRIORITY_LABELS[task.priority]}
                      </Badge>
                    </div>
                    {task.projectRel && (
                      <p className="mb-2 truncate text-xs text-text-muted">{task.projectRel.name}</p>
                    )}
                    <div className="flex items-center justify-between">
                      {task.assigneeRel ? (
                        <Avatar name={task.assigneeRel.name} bg={task.assigneeRel.avatarBg} size="sm" />
                      ) : (
                        <span />
                      )}
                      {task.dueDate && (
                        <span
                          className={`flex items-center gap-1 text-xs ${
                            overdue ? 'text-c-danger' : 'text-text-muted'
                          }`}
                        >
                          <Calendar size={12} />
                          {formatDate(task.dueDate)}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            <button
              onClick={() => openCreateModal(status)}
              className="mt-2 flex items-center justify-center gap-1 rounded-lg border border-dashed border-c-border py-2 text-xs text-text-muted transition-colors hover:border-accent-purple hover:text-accent-purple"
            >
              <Plus size={14} />
              Ajouter
            </button>
          </div>
        ))}
      </div>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingTask ? 'Modifier la tâche' : 'Nouvelle tâche'}
        footer={
          <>
            {editingTask && (
              <button
                type="button"
                onClick={() => deleteMutation.mutate(editingTask.id)}
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
            <button type="submit" form="task-form" disabled={saveMutation.isPending} className={btnPrimary}>
              Enregistrer
            </button>
          </>
        }
      >
        <form id="task-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Titre</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
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
              <label className={labelClass}>Statut</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                className={inputClass}
              >
                {TASK_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {TASK_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Priorité</label>
              <select
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                className={inputClass}
              >
                {TASK_PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {TASK_PRIORITY_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Projet</label>
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
            <div>
              <label className={labelClass}>Assigné à</label>
              <select
                value={form.assigneeId}
                onChange={(e) => setForm((f) => ({ ...f, assigneeId: e.target.value }))}
                className={inputClass}
              >
                <option value="">Personne</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>Date d'échéance</label>
            <input
              type="date"
              value={form.dueDate || ''}
              onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
              className={inputClass}
            />
          </div>
        </form>
      </Modal>
    </div>
  )
}
