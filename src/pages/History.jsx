import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, ScrollText } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatDate, formatTime } from '../lib/format'
import Avatar from '../components/ui/Avatar'
import { inputClass } from '../lib/ui'

const PAGE_SIZE = 50

const ENTITY_LABELS = {
  Event: 'événement',
  Project: 'projet',
  Task: 'tâche',
  Client: 'client',
  ClientContact: 'contact',
  Production: 'production',
  Invoice: 'facture',
  Transaction: 'transaction',
  Document: 'document',
  FinanceCategory: 'catégorie financière',
  ObligationTemplate: 'dépense obligatoire',
  SocialPost: 'publication éditoriale',
  MonthlyBoard: "tableau d'objectifs",
  User: 'utilisateur',
}

const ENTITY_FILTERS = [
  { value: '', label: 'Toutes les entités' },
  { value: 'Project', label: 'Projets' },
  { value: 'Task', label: 'Tâches' },
  { value: 'Event', label: 'Événements' },
  { value: 'Client', label: 'Clients' },
  { value: 'ClientContact', label: 'Contacts' },
  { value: 'Production', label: 'Productions' },
  { value: 'Invoice', label: 'Factures' },
  { value: 'Transaction', label: 'Transactions' },
  { value: 'Document', label: 'Documents' },
  { value: 'FinanceCategory', label: 'Catégories financières' },
  { value: 'ObligationTemplate', label: 'Dépenses obligatoires' },
  { value: 'SocialPost', label: 'Éditorial' },
  { value: 'MonthlyBoard', label: 'Objectifs' },
  { value: 'User', label: 'Utilisateurs' },
]

const ACTION_FILTERS = [
  { value: '', label: 'Toutes les actions' },
  { value: 'created', label: 'Créations' },
  { value: 'updated', label: 'Modifications' },
  { value: 'deleted', label: 'Suppressions' },
]

const ACTION_META = {
  created: { verb: 'a créé', icon: Plus, color: '#10b981' },
  updated: { verb: 'a modifié', icon: Pencil, color: '#22d3ee' },
  deleted: { verb: 'a supprimé', icon: Trash2, color: '#ef4444' },
}

function dayLabel(dateStr) {
  const d = new Date(dateStr)
  d.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.getTime() === today.getTime()) return "Aujourd'hui"
  if (d.getTime() === yesterday.getTime()) return 'Hier'
  return formatDate(dateStr)
}

function groupByDay(rows) {
  const groups = []
  let current = null
  for (const row of rows) {
    const label = dayLabel(row.createdAt)
    if (!current || current.label !== label) {
      current = { label, rows: [] }
      groups.push(current)
    }
    current.rows.push(row)
  }
  return groups
}

export default function History() {
  const [entity, setEntity] = useState('')
  const [action, setAction] = useState('')
  const [limit, setLimit] = useState(PAGE_SIZE)

  const { data = [], isLoading } = useQuery({
    queryKey: ['activity-log', entity, action, limit],
    queryFn: async () => {
      let q = supabase
        .from('ActivityLog')
        .select('*, userRel:User!userId(id, name, avatarBg, avatarUrl)')
        .order('createdAt', { ascending: false })
        .limit(limit + 1)
      if (entity) q = q.eq('entity', entity)
      if (action) q = q.eq('action', action)
      const { data, error } = await q
      if (error) throw error
      return data || []
    },
    onError: (err) => toast.error(err.message),
  })

  const rows = data.slice(0, limit)
  const hasMore = data.length > limit
  const groups = groupByDay(rows)

  const resetAnd = (setter) => (e) => {
    setter(e.target.value)
    setLimit(PAGE_SIZE)
  }

  return (
    <div className="space-y-6">
      {/* Filtres */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <select value={entity} onChange={resetAnd(setEntity)} className={`${inputClass} sm:w-56`}>
          {ENTITY_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
        <select value={action} onChange={resetAnd(setAction)} className={`${inputClass} sm:w-56`}>
          {ACTION_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <p className="text-text-secondary">Chargement…</p>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-c-border bg-bg-card py-16 text-center">
          <ScrollText size={32} className="text-text-muted" />
          <p className="text-text-secondary">Aucune activité enregistrée pour ces filtres.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.label}>
              <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
                {group.label}
              </h3>
              <div className="overflow-hidden rounded-xl border border-c-border bg-bg-card">
                {group.rows.map((row) => {
                  const meta = ACTION_META[row.action] || ACTION_META.updated
                  const Icon = meta.icon
                  const author = row.userRel?.name || 'Système'
                  const kind = ENTITY_LABELS[row.entity] || row.entity
                  return (
                    <div
                      key={row.id}
                      className="flex items-center gap-3 border-b border-c-border p-3 last:border-0 sm:px-4"
                    >
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                        style={{ backgroundColor: `${meta.color}20`, color: meta.color }}
                      >
                        <Icon size={15} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-text-primary">
                          <span className="font-semibold">{author}</span>{' '}
                          <span className="text-text-secondary">{meta.verb} {kind}</span>
                          {row.entityLabel ? (
                            <span className="font-medium"> «&nbsp;{row.entityLabel}&nbsp;»</span>
                          ) : null}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="hidden text-xs text-text-muted sm:inline">{formatTime(row.createdAt)}</span>
                        <Avatar name={author} bg={row.userRel?.avatarBg} src={row.userRel?.avatarUrl} size="xs" />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {hasMore && (
            <div className="flex justify-center">
              <button
                onClick={() => setLimit((l) => l + PAGE_SIZE)}
                className="rounded-lg border border-c-border bg-bg-card px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-hover"
              >
                Charger plus
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
