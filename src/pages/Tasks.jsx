import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus, Trash2, Calendar, Play, CheckCircle2, Lock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useAlert } from '../context/AlertContext'
import { notifyUsers } from '../lib/notifications'
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
    .select('*, assigneeRel:User(id, name, avatarBg, avatarUrl), projectRel:Project(id, name)')
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

// IDs des managers/admins — destinataires des notifications de fin de tâche
async function fetchManagerIds() {
  const { data, error } = await supabase.from('User').select('id, roleRel:Role(name)')
  if (error) throw error
  return (data || [])
    .filter((u) => u.roleRel?.name === 'Administrateur' || u.roleRel?.name === 'Manager')
    .map((u) => u.id)
}

export default function Tasks() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { showAlert } = useAlert()
  const role = user?.roleRel?.name || user?.role
  const isManager = role === 'Administrateur' || role === 'Manager'

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
  const { data: managerIds = [] } = useQuery({ queryKey: ['manager-ids'], queryFn: fetchManagerIds })

  // Le modal est en lecture seule pour tout le monde sauf les managers/admins
  const readOnly = !isManager

  const columns = useMemo(() => {
    const map = {}
    for (const status of TASK_STATUS_OPTIONS) map[status] = []
    for (const t of tasks) {
      if (map[t.status]) map[t.status].push(t)
    }
    return map
  }, [tasks])

  // Prévient la personne assignée via la table Notification (temps réel dans le Topbar)
  const notifyAssignee = (assigneeId, title) => {
    if (!assigneeId || assigneeId === user?.id) return
    return notifyUsers([assigneeId], {
      message: `${user?.name || 'Un responsable'} vous a assigné la tâche « ${title} »`,
      type: 'task',
      link: '/tasks',
    })
  }

  // Prévient l'assigné quand sa tâche est mise « en révision » (exclut l'auteur)
  const notifyReview = (assigneeId, title) => {
    if (!assigneeId || assigneeId === user?.id) return
    return notifyUsers([assigneeId], {
      message: `${user?.name || 'Un responsable'} a mis votre tâche « ${title} » en révision`,
      type: 'task',
      link: '/tasks',
    })
  }

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      if (editingTask) {
        const prevAssignee = editingTask.assigneeId || null
        const { error } = await supabase.from('Task').update(payload).eq('id', editingTask.id)
        if (error) throw error
        // Notifier uniquement si l'assigné a changé
        if (payload.assigneeId && payload.assigneeId !== prevAssignee) {
          await notifyAssignee(payload.assigneeId, payload.title)
        }
        // Notifier l'assigné si la tâche vient de passer « en révision »
        if (payload.status === 'REVIEW' && editingTask.status !== 'REVIEW') {
          await notifyReview(payload.assigneeId, payload.title)
        }
      } else {
        const { error } = await supabase.from('Task').insert(payload)
        if (error) throw error
        await notifyAssignee(payload.assigneeId, payload.title)
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
      const task = tasks.find((t) => t.id === id)
      const { error } = await supabase.from('Task').update({ status }).eq('id', id)
      if (error) throw error
      // Quand un responsable met la tâche en révision, prévenir l'assigné
      if (status === 'REVIEW' && task && task.status !== 'REVIEW') {
        await notifyReview(task.assigneeId, task.title)
      }
      // Quand l'assigné termine sa tâche, prévenir les managers/admins
      if (status === 'DONE' && task && task.assigneeId === user?.id) {
        const recipients = managerIds.filter((mid) => mid !== user?.id)
        if (recipients.length > 0) {
          await notifyUsers(recipients, {
            message: `${user?.name || 'Un membre'} a terminé la tâche « ${task.title} »`,
            type: 'task',
            link: '/tasks',
          })
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (err) => toast.error(err.message),
  })

  const openCreateModal = (status) => {
    if (!isManager) return
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
    if (!isManager) return
    if (!form.title.trim()) {
      showAlert('Le titre de la tâche est requis.')
      return
    }
    // Une tâche nouvellement assignée démarre automatiquement dans « À faire »
    const assigned = form.assigneeId || null
    const status = !editingTask && assigned ? 'TODO' : form.status
    saveMutation.mutate({
      title: form.title.trim(),
      description: form.description.trim() || null,
      status,
      priority: form.priority,
      projectId: form.projectId || null,
      assigneeId: assigned,
      dueDate: form.dueDate || null,
    })
  }

  // Un utilisateur peut déplacer une tâche s'il est manager ou si la tâche lui est assignée
  const canMove = (task) => isManager || task.assigneeId === user?.id

  const handleDrop = (e, status) => {
    e.preventDefault()
    setDragOverColumn(null)
    const taskId = e.dataTransfer.getData('taskId')
    const task = tasks.find((t) => t.id === taskId)
    if (!task || task.status === status) return
    if (!canMove(task)) {
      toast.error("Vous ne pouvez déplacer que les tâches qui vous sont assignées.")
      return
    }
    moveMutation.mutate({ id: taskId, status })
  }

  // Boutons d'action rapide pour la personne assignée : Démarrer → En cours → Terminé
  const quickAction = (task) => {
    if (task.assigneeId !== user?.id) return null
    if (task.status === 'TODO') {
      return {
        label: 'Démarrer',
        icon: Play,
        next: 'IN_PROGRESS',
        className:
          'border-accent-cyan/40 text-accent-cyan hover:bg-accent-cyan/10',
      }
    }
    if (task.status === 'IN_PROGRESS' || task.status === 'REVIEW') {
      return {
        label: 'Terminer',
        icon: CheckCircle2,
        next: 'DONE',
        className: 'border-c-success/40 text-c-success hover:bg-c-success/10',
      }
    }
    return null
  }

  return (
    <div className="space-y-6">
      {isManager && (
        <div className="flex items-center justify-end">
          <button onClick={() => openCreateModal()} className={`${btnPrimary} w-full sm:w-auto`}>
            <Plus size={16} />
            Nouvelle tâche
          </button>
        </div>
      )}

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
                const action = quickAction(task)
                const draggable = canMove(task)
                return (
                  <div
                    key={task.id}
                    draggable={draggable}
                    onDragStart={(e) => draggable && e.dataTransfer.setData('taskId', task.id)}
                    onClick={() => openEditModal(task)}
                    className={`rounded-lg border border-c-border bg-bg-dark p-3 transition-colors hover:border-accent-purple/50 ${
                      draggable ? 'cursor-pointer' : 'cursor-pointer'
                    }`}
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
                        <Avatar name={task.assigneeRel.name} bg={task.assigneeRel.avatarBg} src={task.assigneeRel.avatarUrl} size="sm" />
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

                    {action && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          moveMutation.mutate({ id: task.id, status: action.next })
                        }}
                        disabled={moveMutation.isPending}
                        className={`mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${action.className}`}
                      >
                        <action.icon size={13} />
                        {action.label}
                      </button>
                    )}
                    {task.status === 'DONE' && task.assigneeId === user?.id && (
                      <p className="mt-3 flex items-center justify-center gap-1.5 text-xs font-medium text-c-success">
                        <CheckCircle2 size={13} />
                        Terminée
                      </p>
                    )}
                  </div>
                )
              })}
            </div>

            {isManager && (
              <button
                onClick={() => openCreateModal(status)}
                className="mt-2 flex items-center justify-center gap-1 rounded-lg border border-dashed border-c-border py-2 text-xs text-text-muted transition-colors hover:border-accent-purple hover:text-accent-purple"
              >
                <Plus size={14} />
                Ajouter
              </button>
            )}
          </div>
        ))}
      </div>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={readOnly ? 'Détails de la tâche' : editingTask ? 'Modifier la tâche' : 'Nouvelle tâche'}
        footer={
          readOnly ? (
            <>
              {editingTask && quickAction(editingTask) && (
                <button
                  type="button"
                  onClick={() => {
                    const a = quickAction(editingTask)
                    moveMutation.mutate({ id: editingTask.id, status: a.next })
                    closeModal()
                  }}
                  disabled={moveMutation.isPending}
                  className={btnPrimary}
                >
                  {(() => {
                    const A = quickAction(editingTask).icon
                    return <A size={16} />
                  })()}
                  {quickAction(editingTask).label}
                </button>
              )}
              <div className="flex-1" />
              <button type="button" onClick={closeModal} className={btnSecondary}>
                Fermer
              </button>
            </>
          ) : (
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
          )
        }
      >
        {readOnly && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-c-border bg-bg-hover px-3 py-2 text-xs text-text-muted">
            <Lock size={14} className="mt-0.5 shrink-0" />
            <span>
              Seuls les managers peuvent créer ou modifier les tâches. Vous pouvez faire avancer
              les tâches qui vous sont assignées avec les boutons dédiés.
            </span>
          </div>
        )}
        <form id="task-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Titre</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className={inputClass}
              disabled={readOnly}
            />
          </div>

          <div>
            <label className={labelClass}>Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className={inputClass}
              rows={3}
              disabled={readOnly}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Statut</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                className={inputClass}
                disabled={readOnly}
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
                disabled={readOnly}
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
                disabled={readOnly}
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
                disabled={readOnly}
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
              disabled={readOnly}
            />
          </div>
        </form>
      </Modal>
    </div>
  )
}
