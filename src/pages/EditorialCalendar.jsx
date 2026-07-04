import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Plus, Trash2, ChevronLeft, ChevronRight, Film,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import { inputClass, labelClass, btnPrimary, btnSecondary, btnDanger } from '../lib/ui'

/* ── Custom Social Icons ────────────────────────────────────────── */
const Instagram = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className} style={props.style} width={props.size} height={props.size}>
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
)

const Linkedin = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className} style={props.style} width={props.size} height={props.size}>
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect width="4" height="12" x="2" y="9" />
    <circle cx="4" cy="4" r="2" />
  </svg>
)

const Youtube = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className} style={props.style} width={props.size} height={props.size}>
    <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17z" />
    <polygon points="10 15 15 12 10 9" />
  </svg>
)

const Facebook = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className} style={props.style} width={props.size} height={props.size}>
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
)

const Twitter = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className} style={props.style} width={props.size} height={props.size}>
    <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
  </svg>
)

/* ── Constants ──────────────────────────────────────────────────── */

const PLATFORMS = ['Instagram', 'LinkedIn', 'TikTok', 'YouTube', 'Facebook', 'Twitter']

const PLATFORM_META = {
  Instagram: { color: '#e1306c', icon: Instagram },
  LinkedIn:  { color: '#0a66c2', icon: Linkedin },
  TikTok:    { color: '#010101', icon: Film },
  YouTube:   { color: '#ff0000', icon: Youtube },
  Facebook:  { color: '#1877f2', icon: Facebook },
  Twitter:   { color: '#1da1f2', icon: Twitter },
}

const POST_STATUSES = {
  DRAFT:      { label: 'Brouillon',  color: '#6e6a75' },
  SCHEDULED:  { label: 'Planifié',   color: '#22d3ee' },
  PUBLISHED:  { label: 'Publié',     color: '#10b981' },
  CANCELLED:  { label: 'Annulé',     color: '#ef4444' },
}

const STATUS_OPTIONS = Object.keys(POST_STATUSES)
const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

const EMPTY_FORM = {
  platform: 'Instagram',
  content: '',
  scheduledAt: '',
  status: 'DRAFT',
  clientId: '',
  projectId: '',
  notes: '',
}

/* ── Fetch helpers ──────────────────────────────────────────────── */

async function fetchPosts() {
  const { data, error } = await supabase
    .from('SocialPost')
    .select('*, clientRel:Client(id, name), projectRel:Project(id, name)')
    .order('scheduledAt', { ascending: true, nullsFirst: false })
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

/* ── Week helpers ───────────────────────────────────────────────── */

function getWeekStart(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = (day === 0 ? -6 : 1 - day)
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

function formatDay(d) {
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()].slice(0, 3)}`
}

/* ── Post Card ──────────────────────────────────────────────────── */

function PostCard({ post, onClick }) {
  const meta = PLATFORM_META[post.platform] || {}
  const status = POST_STATUSES[post.status] || POST_STATUSES.DRAFT
  const Icon = meta.icon || Film
  return (
    <div
      onClick={onClick}
      className="group cursor-pointer rounded-lg border border-c-border bg-bg-card p-2.5 transition-all hover:border-accent-purple/50 hover:shadow-lg"
    >
      <div className="mb-1.5 flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5">
          <Icon size={12} style={{ color: meta.color }} />
          <span className="text-[10px] font-semibold" style={{ color: meta.color }}>{post.platform}</span>
        </div>
        <span className="text-[10px] rounded-full px-1.5 py-0.5" style={{ background: status.color + '22', color: status.color }}>
          {status.label}
        </span>
      </div>
      {post.content && (
        <p className="text-[11px] text-text-secondary line-clamp-2 leading-relaxed">{post.content}</p>
      )}
      {post.clientRel && (
        <p className="mt-1 text-[10px] text-text-muted truncate">👤 {post.clientRel.name}</p>
      )}
      {post.scheduledAt && (
        <p className="mt-0.5 text-[10px] text-text-muted">
          🕐 {new Date(post.scheduledAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
    </div>
  )
}

/* ── Main Page ───────────────────────────────────────────────────── */

export default function EditorialCalendar() {
  const queryClient = useQueryClient()
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()))
  const [platformFilter, setPlatformFilter] = useState('ALL')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingPost, setEditingPost] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [view, setView] = useState('week') // 'week' | 'list'

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['social-posts'],
    queryFn: fetchPosts,
    onError: (e) => toast.error(e.message),
  })
  const { data: clients = [] } = useQuery({ queryKey: ['clients-list'], queryFn: fetchClients })
  const { data: projects = [] } = useQuery({ queryKey: ['projects-list'], queryFn: fetchProjects })

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])

  const filteredPosts = useMemo(() => {
    return posts.filter(p => platformFilter === 'ALL' || p.platform === platformFilter)
  }, [posts, platformFilter])

  /* Mutations */
  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      if (editingPost) {
        const { error } = await supabase.from('SocialPost').update(payload).eq('id', editingPost.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('SocialPost').insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-posts'] })
      toast.success(editingPost ? 'Post mis à jour' : 'Post planifié')
      closeModal()
    },
    onError: (e) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('SocialPost').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-posts'] })
      toast.success('Post supprimé')
      closeModal()
    },
    onError: (e) => toast.error(e.message),
  })

  const openCreate = (day) => {
    setEditingPost(null)
    const iso = day ? `${day.toISOString().slice(0, 10)}T09:00` : ''
    setForm({ ...EMPTY_FORM, scheduledAt: iso })
    setModalOpen(true)
  }

  const openEdit = (post) => {
    setEditingPost(post)
    setForm({
      platform: post.platform,
      content: post.content || '',
      scheduledAt: post.scheduledAt ? post.scheduledAt.slice(0, 16) : '',
      status: post.status,
      clientId: post.clientId || '',
      projectId: post.projectId || '',
      notes: post.notes || '',
    })
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingPost(null)
    setForm(EMPTY_FORM)
  }

  /* Stats */
  const totalByPlatform = useMemo(() => {
    const m = {}
    posts.forEach(p => { m[p.platform] = (m[p.platform] || 0) + 1 })
    return m
  }, [posts])

  return (
    <div className="space-y-5">
      {/* Header + stats */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-text-primary">Calendrier Éditorial</h2>
          <p className="text-xs text-text-muted mt-0.5">Planification des publications réseaux sociaux</p>
        </div>
        <button onClick={() => openCreate(null)} className={`${btnPrimary} shrink-0`}>
          <Plus size={15} /> Nouveau post
        </button>
      </div>

      {/* Platform KPIs */}
      <div className="flex flex-wrap gap-2">
        {PLATFORMS.map((pl) => {
          const meta = PLATFORM_META[pl]
          const Icon = meta.icon
          const count = totalByPlatform[pl] || 0
          return (
            <button
              key={pl}
              onClick={() => setPlatformFilter(platformFilter === pl ? 'ALL' : pl)}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-all ${
                platformFilter === pl
                  ? 'border-transparent text-white shadow-lg'
                  : 'border-c-border bg-bg-card text-text-secondary hover:border-opacity-50'
              }`}
              style={platformFilter === pl ? { background: meta.color } : {}}
            >
              <Icon size={13} style={{ color: platformFilter === pl ? 'white' : meta.color }} />
              {pl}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${platformFilter === pl ? 'bg-white/20' : 'bg-bg-hover'}`}>{count}</span>
            </button>
          )
        })}
        {platformFilter !== 'ALL' && (
          <button onClick={() => setPlatformFilter('ALL')} className="rounded-xl border border-c-border bg-bg-card px-3 py-2 text-xs text-text-muted hover:text-text-primary">
            ✕ Réinitialiser
          </button>
        )}
      </div>

      {/* View toggle + Week nav */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekStart(w => addDays(w, -7))} className="rounded-lg p-2 text-text-muted hover:bg-bg-hover hover:text-text-primary">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold text-text-primary">
            {formatDay(weekDays[0])} — {formatDay(weekDays[6])} {weekDays[6].getFullYear()}
          </span>
          <button onClick={() => setWeekStart(w => addDays(w, 7))} className="rounded-lg p-2 text-text-muted hover:bg-bg-hover hover:text-text-primary">
            <ChevronRight size={16} />
          </button>
          <button
            onClick={() => setWeekStart(getWeekStart(new Date()))}
            className="ml-2 rounded-lg border border-c-border px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-hover"
          >
            Aujourd&apos;hui
          </button>
        </div>
        <div className="flex rounded-lg border border-c-border overflow-hidden">
          {['week', 'list'].map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${view === v ? 'bg-accent-purple text-white' : 'text-text-secondary hover:bg-bg-hover'}`}>
              {v === 'week' ? '📅 Semaine' : '📋 Liste'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Week view ── */}
      {view === 'week' && (
        <div className="overflow-x-auto rounded-xl border border-c-border bg-bg-card">
          <div className="grid min-w-[700px]" style={{ gridTemplateColumns: `repeat(7, 1fr)` }}>
            {/* Day headers */}
            {weekDays.map((day, i) => {
              const isToday = sameDay(day, new Date())
              return (
                <div
                  key={i}
                  className={`border-b border-r border-c-border px-3 py-2 text-center last:border-r-0 ${isToday ? 'bg-accent-purple/10' : ''}`}
                >
                  <p className={`text-xs font-semibold ${isToday ? 'text-accent-purple' : 'text-text-muted'}`}>{DAYS[i]}</p>
                  <p className={`text-sm font-bold ${isToday ? 'text-accent-purple' : 'text-text-primary'}`}>{day.getDate()}</p>
                </div>
              )
            })}
            {/* Day cells */}
            {weekDays.map((day, i) => {
              const dayPosts = filteredPosts.filter(p => {
                if (!p.scheduledAt) return false
                return sameDay(new Date(p.scheduledAt), day)
              })
              return (
                <div
                  key={`cell-${i}`}
                  className="border-r border-c-border last:border-r-0 min-h-[160px] p-2 space-y-1.5"
                >
                  {dayPosts.map(post => (
                    <PostCard key={post.id} post={post} onClick={() => openEdit(post)} />
                  ))}
                  <button
                    onClick={() => openCreate(day)}
                    className="w-full rounded-lg border border-dashed border-c-border py-1.5 text-[10px] text-text-muted opacity-0 hover:opacity-100 transition-opacity group-hover:opacity-100 hover:bg-bg-hover hover:text-text-primary"
                  >
                    + Ajouter
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── List view ── */}
      {view === 'list' && (
        <div className="space-y-3">
          {isLoading ? (
            <p className="text-text-secondary">Chargement…</p>
          ) : filteredPosts.length === 0 ? (
            <p className="text-sm text-text-muted">Aucun post planifié.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-c-border bg-bg-card">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-c-border text-xs uppercase text-text-muted">
                      <th className="p-4 font-medium">Date</th>
                      <th className="p-4 font-medium">Plateforme</th>
                      <th className="p-4 font-medium">Contenu</th>
                      <th className="p-4 font-medium">Client</th>
                      <th className="p-4 font-medium">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPosts.map((post) => {
                      const meta = PLATFORM_META[post.platform] || {}
                      const Icon = meta.icon || Film
                      const status = POST_STATUSES[post.status] || POST_STATUSES.DRAFT
                      return (
                        <tr key={post.id} onClick={() => openEdit(post)}
                          className="cursor-pointer border-b border-c-border last:border-0 hover:bg-bg-hover/30 transition-colors">
                          <td className="p-4 text-text-muted text-xs whitespace-nowrap">
                            {post.scheduledAt
                              ? new Date(post.scheduledAt).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                              : '— Non planifié'}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <Icon size={14} style={{ color: meta.color }} />
                              <span className="text-xs font-medium" style={{ color: meta.color }}>{post.platform}</span>
                            </div>
                          </td>
                          <td className="p-4 max-w-xs">
                            <p className="text-text-secondary text-xs line-clamp-2">{post.content || '—'}</p>
                          </td>
                          <td className="p-4 text-text-muted text-xs">{post.clientRel?.name || '—'}</td>
                          <td className="p-4">
                            <Badge color={status.color}>{status.label}</Badge>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingPost ? 'Modifier le post' : 'Nouveau post'}
        maxWidth="max-w-2xl"
        footer={
          <>
            {editingPost && (
              <button type="button" onClick={() => deleteMutation.mutate(editingPost.id)} disabled={deleteMutation.isPending} className={btnDanger}>
                <Trash2 size={15} /> Supprimer
              </button>
            )}
            <div className="flex-1" />
            <button type="button" onClick={closeModal} className={btnSecondary}>Annuler</button>
            <button type="submit" form="post-form" disabled={saveMutation.isPending} className={btnPrimary}>Enregistrer</button>
          </>
        }
      >
        <form
          id="post-form"
          onSubmit={(e) => {
            e.preventDefault()
            saveMutation.mutate({
              platform: form.platform,
              content: form.content || null,
              scheduledAt: form.scheduledAt || null,
              status: form.status,
              clientId: form.clientId || null,
              projectId: form.projectId || null,
              notes: form.notes || null,
            })
          }}
          className="space-y-4"
        >
          {/* Platform picker */}
          <div>
            <label className={labelClass}>Plateforme</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {PLATFORMS.map((pl) => {
                const meta = PLATFORM_META[pl]
                const Icon = meta.icon
                const active = form.platform === pl
                return (
                  <button
                    key={pl}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, platform: pl }))}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                      active ? 'border-transparent text-white' : 'border-c-border text-text-secondary hover:bg-bg-hover'
                    }`}
                    style={active ? { background: meta.color } : {}}
                  >
                    <Icon size={12} style={{ color: active ? 'white' : meta.color }} />
                    {pl}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className={labelClass}>Contenu</label>
            <textarea rows={4} className={inputClass} placeholder="Texte du post…" value={form.content} onChange={(e) => setForm(f => ({ ...f, content: e.target.value }))} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Date & heure de publication</label>
              <input type="datetime-local" className={inputClass} value={form.scheduledAt} onChange={(e) => setForm(f => ({ ...f, scheduledAt: e.target.value }))} />
            </div>
            <div>
              <label className={labelClass}>Statut</label>
              <select value={form.status} onChange={(e) => setForm(f => ({ ...f, status: e.target.value }))} className={inputClass}>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{POST_STATUSES[s].label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Client</label>
              <select value={form.clientId} onChange={(e) => setForm(f => ({ ...f, clientId: e.target.value }))} className={inputClass}>
                <option value="">— Aucun —</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Projet</label>
              <select value={form.projectId} onChange={(e) => setForm(f => ({ ...f, projectId: e.target.value }))} className={inputClass}>
                <option value="">— Aucun —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>Notes internes</label>
            <textarea rows={2} className={inputClass} value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </form>
      </Modal>
    </div>
  )
}
