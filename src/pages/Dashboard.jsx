import { useQuery } from '@tanstack/react-query'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { FolderKanban, ListTodo, Building2, Wallet, AlertTriangle, CalendarClock, Activity } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { formatCurrency, formatDate, formatDateTime, isOverdue } from '../lib/format'
import {
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_COLORS,
  PROJECT_STATUS_OPTIONS,
  TASK_PRIORITY_COLORS,
  TASK_PRIORITY_LABELS,
} from '../lib/constants'
import Badge from '../components/ui/Badge'
import StatCard from '../components/ui/StatCard'
import ObjectivesWidget from '../components/ObjectivesWidget'

async function fetchDashboardData() {
  const [projectsRes, clientsRes, tasksRes, eventsRes] = await Promise.all([
    supabase
      .from('Project')
      .select('*, clientRel:Client(id, name), typeRel:ProjectType(id, name, color)')
      .order('deadline', { ascending: true }),
    supabase.from('Client').select('*'),
    supabase
      .from('Task')
      .select('*, assigneeRel:User(id, name, avatarBg), projectRel:Project(id, name)')
      .order('dueDate', { ascending: true }),
    supabase
      .from('Event')
      .select('*, typeRel:EventType(id, name, color), projectRel:Project(id, name)')
      .order('date', { ascending: true }),
  ])

  for (const res of [projectsRes, clientsRes, tasksRes, eventsRes]) {
    if (res.error) throw res.error
  }

  return {
    projects: projectsRes.data || [],
    clients: clientsRes.data || [],
    tasks: tasksRes.data || [],
    events: eventsRes.data || [],
  }
}

export default function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboardData,
    onError: (err) => toast.error(err.message || 'Erreur de chargement du tableau de bord'),
  })

  const projects = data?.projects || []
  const clients = data?.clients || []
  const tasks = data?.tasks || []
  const events = data?.events || []

  const activeProjects = projects.filter((p) => p.status !== 'DELIVERED').length
  const inProgressTasks = tasks.filter((t) => t.status === 'IN_PROGRESS').length
  const activeClients = clients.filter((c) => c.status === 'ACTIF').length
  const totalCollected = projects.reduce((sum, p) => sum + (Number(p.amountPaid) || 0), 0)

  const chartData = PROJECT_STATUS_OPTIONS.map((status) => ({
    status,
    label: PROJECT_STATUS_LABELS[status],
    count: projects.filter((p) => p.status === status).length,
    color: PROJECT_STATUS_COLORS[status],
  }))

  const now = new Date()

  const upcoming = [
    ...events
      .filter((e) => new Date(e.date) >= now)
      .map((e) => ({
        id: 'event-' + e.id,
        date: e.date,
        title: e.title,
        sub: e.projectRel?.name,
        color: e.typeRel?.color || '#22d3ee',
        label: e.typeRel?.name || 'Événement',
      })),
    ...projects
      .filter((p) => p.deadline && p.status !== 'DELIVERED' && new Date(p.deadline) >= now)
      .map((p) => ({
        id: 'deadline-' + p.id,
        date: p.deadline,
        title: p.name,
        sub: p.clientRel?.name,
        color: '#f59e0b',
        label: 'Deadline projet',
      })),
  ]
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 5)

  const urgentTasks = tasks
    .filter((t) => t.status !== 'DONE' && (t.priority === 'URGENT' || isOverdue(t.dueDate)))
    .sort((a, b) => new Date(a.dueDate || 0) - new Date(b.dueDate || 0))
    .slice(0, 5)

  const recentActivity = [
    ...tasks.map((t) => ({
      id: 'task-' + t.id,
      date: t.updatedAt,
      text: `Tâche « ${t.title} » — ${TASK_PRIORITY_LABELS[t.priority] || t.status}`,
    })),
    ...projects.map((p) => ({
      id: 'project-' + p.id,
      date: p.updatedAt,
      text: `Projet « ${p.name} » mis à jour`,
    })),
  ]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5)

  if (isLoading) {
    return <p className="text-text-secondary">Chargement…</p>
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={FolderKanban} label="Projets actifs" value={activeProjects} color="#9d3bf1" />
        <StatCard icon={ListTodo} label="Tâches en cours" value={inProgressTasks} color="#22d3ee" />
        <StatCard icon={Building2} label="Clients actifs" value={activeClients} color="#10b981" />
        <StatCard icon={Wallet} label="Total encaissé" value={formatCurrency(totalCollected)} color="#f59e0b" />
      </div>

      <ObjectivesWidget />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-c-border bg-bg-card p-4 sm:p-6 lg:col-span-2">
          <h2 className="mb-4 text-base font-semibold text-text-primary">Projets par statut</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2e2b3d" vertical={false} />
              <XAxis dataKey="label" stroke="#6e6a75" fontSize={11} tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={50} />
              <YAxis stroke="#6e6a75" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: '#1f1d2b', border: '1px solid #2e2b3d', borderRadius: 8 }}
                labelStyle={{ color: '#f0eef8' }}
              />
              <Bar dataKey="count" name="Projets" radius={[6, 6, 0, 0]}>
                {chartData.map((entry) => (
                  <Cell key={entry.status} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-c-border bg-bg-card p-4 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <CalendarClock size={18} className="text-accent-cyan" />
            <h2 className="text-base font-semibold text-text-primary">Prochaines échéances</h2>
          </div>
          {upcoming.length === 0 ? (
            <p className="text-sm text-text-muted">Aucune échéance à venir.</p>
          ) : (
            <ul className="space-y-3">
              {upcoming.map((item) => (
                <li key={item.id} className="flex items-start gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text-primary">{item.title}</p>
                    <p className="text-xs text-text-muted">
                      {item.label} · {formatDateTime(item.date)}
                      {item.sub ? ` · ${item.sub}` : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-c-border bg-bg-card p-4 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle size={18} className="text-c-warning" />
            <h2 className="text-base font-semibold text-text-primary">Tâches urgentes / en retard</h2>
          </div>
          {urgentTasks.length === 0 ? (
            <p className="text-sm text-text-muted">Aucune tâche urgente.</p>
          ) : (
            <ul className="space-y-3">
              {urgentTasks.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text-primary">{t.title}</p>
                    <p className="text-xs text-text-muted">
                      {t.projectRel?.name || 'Sans projet'} · Échéance {formatDate(t.dueDate)}
                    </p>
                  </div>
                  <Badge color={TASK_PRIORITY_COLORS[t.priority]}>{TASK_PRIORITY_LABELS[t.priority]}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-c-border bg-bg-card p-4 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <Activity size={18} className="text-accent-purple" />
            <h2 className="text-base font-semibold text-text-primary">Activité récente</h2>
          </div>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-text-muted">Aucune activité récente.</p>
          ) : (
            <ul className="space-y-3">
              {recentActivity.map((a) => (
                <li key={a.id} className="text-sm">
                  <p className="text-text-primary">{a.text}</p>
                  <p className="text-xs text-text-muted">{formatDateTime(a.date)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
