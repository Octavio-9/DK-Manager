import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ChevronLeft, ChevronRight, Plus, Trash2, Pencil, Clock, FolderKanban } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAlert } from '../context/AlertContext'
import { formatDateTime } from '../lib/format'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import { inputClass, labelClass, btnPrimary, btnSecondary, btnDanger } from '../lib/ui'

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

const EMPTY_FORM = {
  title: '',
  description: '',
  date: '',
  endDate: '',
  projectId: '',
  typeId: '',
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function getCalendarDays(monthDate) {
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startOffset = (firstDay.getDay() + 6) % 7
  const days = []
  for (let i = 0; i < startOffset; i++) days.push(null)
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d))
  while (days.length % 7 !== 0) days.push(null)
  return days
}

function toDatetimeLocal(value) {
  if (!value) return ''
  const d = new Date(value)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

async function fetchEvents() {
  const { data, error } = await supabase
    .from('Event')
    .select('*, typeRel:EventType(id, name, color), projectRel:Project(id, name)')
    .order('date', { ascending: true })
  if (error) throw error
  return data || []
}

async function fetchEventTypes() {
  const { data, error } = await supabase.from('EventType').select('*').order('name')
  if (error) throw error
  return data || []
}

async function fetchProjects() {
  const { data, error } = await supabase.from('Project').select('id, name').order('name')
  if (error) throw error
  return data || []
}

export default function CalendarPage() {
  const queryClient = useQueryClient()
  const { showAlert } = useAlert()
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [detailEvent, setDetailEvent] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const { data: events = [] } = useQuery({
    queryKey: ['events'],
    queryFn: fetchEvents,
    onError: (err) => toast.error(err.message),
  })
  const { data: eventTypes = [] } = useQuery({ queryKey: ['event-types'], queryFn: fetchEventTypes })
  const { data: projects = [] } = useQuery({ queryKey: ['projects-list'], queryFn: fetchProjects })

  const days = useMemo(() => getCalendarDays(currentMonth), [currentMonth])
  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' })
        .format(currentMonth)
        .replace(/^./, (c) => c.toUpperCase()),
    [currentMonth]
  )

  const eventsByDay = useMemo(() => {
    const map = new Map()
    for (const e of events) {
      const d = new Date(e.date)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(e)
    }
    return map
  }, [events])

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      if (editingEvent) {
        const { error } = await supabase.from('Event').update(payload).eq('id', editingEvent.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('Event').insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success(editingEvent ? 'Événement mis à jour' : 'Événement créé')
      closeForm()
      setDetailEvent(null)
    },
    onError: (err) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('Event').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Événement supprimé')
      setDetailEvent(null)
      closeForm()
    },
    onError: (err) => toast.error(err.message),
  })

  const openCreateForm = (date) => {
    setEditingEvent(null)
    setForm({
      ...EMPTY_FORM,
      date: date ? toDatetimeLocal(new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 0)) : '',
    })
    setFormOpen(true)
  }

  const openEditForm = (event) => {
    setEditingEvent(event)
    setForm({
      title: event.title || '',
      description: event.description || '',
      date: toDatetimeLocal(event.date),
      endDate: toDatetimeLocal(event.endDate),
      projectId: event.projectId || '',
      typeId: event.typeId || '',
    })
    setFormOpen(true)
  }

  const closeForm = () => {
    setFormOpen(false)
    setEditingEvent(null)
    setForm(EMPTY_FORM)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.title.trim() || !form.date) {
      showAlert('Le titre et la date sont requis.')
      return
    }
    saveMutation.mutate({
      title: form.title.trim(),
      description: form.description.trim() || null,
      date: new Date(form.date).toISOString(),
      endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
      projectId: form.projectId || null,
      typeId: form.typeId || null,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center justify-center gap-3 sm:justify-start">
          <button
            onClick={() => setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
            className="rounded-lg border border-c-border p-2 text-text-secondary transition-colors hover:bg-bg-hover"
          >
            <ChevronLeft size={18} />
          </button>
          <h2 className="w-36 text-center text-base font-semibold text-text-primary sm:w-48 sm:text-lg">{monthLabel}</h2>
          <button
            onClick={() => setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
            className="rounded-lg border border-c-border p-2 text-text-secondary transition-colors hover:bg-bg-hover"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <button onClick={() => openCreateForm(new Date())} className={`${btnPrimary} w-full sm:w-auto`}>
          <Plus size={16} />
          Nouvel événement
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-c-border bg-bg-card">
        <div className="grid grid-cols-7 border-b border-c-border">
          {WEEKDAYS.map((d) => (
            <div key={d} className="p-1 text-center text-[10px] font-semibold uppercase text-text-muted sm:p-3 sm:text-xs">
              <span className="sm:hidden">{d.slice(0, 1)}</span>
              <span className="hidden sm:inline">{d}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day, i) => {
            const key = day ? `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}` : `empty-${i}`
            const dayEvents = day ? eventsByDay.get(key) || [] : []
            const isToday = day && sameDay(day, new Date())
            return (
              <div
                key={key}
                onClick={() => day && openCreateForm(day)}
                className={`min-h-16 border-b border-r border-c-border p-1 last:border-r-0 sm:min-h-28 sm:p-2 ${
                  day ? 'cursor-pointer hover:bg-bg-hover/50' : 'bg-bg-dark/30'
                }`}
              >
                {day && (
                  <>
                    <p
                      className={`mb-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] sm:h-6 sm:w-6 sm:text-xs ${
                        isToday ? 'bg-accent-purple font-bold text-white' : 'text-text-secondary'
                      }`}
                    >
                      {day.getDate()}
                    </p>
                    <div className="space-y-1">
                      {dayEvents.slice(0, 3).map((ev, idx) => (
                        <button
                          key={ev.id}
                          onClick={(e) => {
                            e.stopPropagation()
                            setDetailEvent(ev)
                          }}
                          className={`block w-full truncate rounded px-1.5 py-0.5 text-left text-xs font-medium ${
                            idx > 0 ? 'hidden sm:block' : ''
                          }`}
                          style={{
                            backgroundColor: `${ev.typeRel?.color || '#9d3bf1'}26`,
                            color: ev.typeRel?.color || '#9d3bf1',
                          }}
                        >
                          {ev.title}
                        </button>
                      ))}
                      {dayEvents.length > 3 && (
                        <p className="hidden px-1.5 text-xs text-text-muted sm:block">+{dayEvents.length - 3} autre(s)</p>
                      )}
                      {dayEvents.length > 1 && (
                        <p className="px-1 text-[10px] text-text-muted sm:hidden">+{dayEvents.length - 1}</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Event detail modal */}
      <Modal
        open={!!detailEvent}
        onClose={() => setDetailEvent(null)}
        title={detailEvent?.title}
        footer={
          detailEvent && (
            <>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(detailEvent.id)}
                disabled={deleteMutation.isPending}
                className={btnDanger}
              >
                <Trash2 size={16} />
                Supprimer
              </button>
              <div className="flex-1" />
              <button type="button" onClick={() => openEditForm(detailEvent)} className={btnPrimary}>
                <Pencil size={16} />
                Modifier
              </button>
            </>
          )
        }
      >
        {detailEvent && (
          <div className="space-y-3 text-sm">
            {detailEvent.typeRel && <Badge color={detailEvent.typeRel.color}>{detailEvent.typeRel.name}</Badge>}
            <p className="flex items-center gap-2 text-text-secondary">
              <Clock size={14} />
              {formatDateTime(detailEvent.date)}
              {detailEvent.endDate ? ` → ${formatDateTime(detailEvent.endDate)}` : ''}
            </p>
            {detailEvent.projectRel && (
              <p className="flex items-center gap-2 text-text-secondary">
                <FolderKanban size={14} />
                {detailEvent.projectRel.name}
              </p>
            )}
            {detailEvent.description && <p className="text-text-secondary">{detailEvent.description}</p>}
          </div>
        )}
      </Modal>

      {/* Create / edit event form */}
      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editingEvent ? "Modifier l'événement" : 'Nouvel événement'}
        footer={
          <>
            <button type="button" onClick={closeForm} className={btnSecondary}>
              Annuler
            </button>
            <button type="submit" form="event-form" disabled={saveMutation.isPending} className={btnPrimary}>
              Enregistrer
            </button>
          </>
        }
      >
        <form id="event-form" onSubmit={handleSubmit} className="space-y-4">
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
              <label className={labelClass}>Début</label>
              <input
                type="datetime-local"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Fin (optionnel)</label>
              <input
                type="datetime-local"
                value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                className={inputClass}
              />
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
              <label className={labelClass}>Type d'événement</label>
              <select
                value={form.typeId}
                onChange={(e) => setForm((f) => ({ ...f, typeId: e.target.value }))}
                className={inputClass}
              >
                <option value="">Aucun</option>
                {eventTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
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
