import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ChevronLeft, ChevronRight, Pencil, Plus, Trash2, Save, X, ArrowUp, ArrowDown,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import DKLogo from './DKLogo'
import { btnPrimary, btnSecondary, inputClass } from '../lib/ui'
import { fetchUserIdsByRole, notifyUsers } from '../lib/notifications'

const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

// Modèle par défaut si aucun mois précédent à copier
const DEFAULT_TEMPLATE = {
  metrics: [
    {
      key: 'views', title: 'VUES CUMULÉES PAR RÉSEAU', rowHeader: 'Réseau',
      currentLabel: 'Vues cumulées actuelles', targetLabel: 'Objectif',
      rows: ['Facebook', 'Instagram', 'TikTok', 'YouTube'].map((label) => ({ label, current: 0, target: 0 })),
    },
    {
      key: 'subscribers', title: "NOMBRE D'ABONNÉS PAR RÉSEAU", rowHeader: 'Réseau',
      currentLabel: "Nombre d'abonnés actuel", targetLabel: 'Objectif',
      rows: ['Facebook', 'Instagram', 'TikTok', 'YouTube'].map((label) => ({ label, current: 0, target: 0 })),
    },
  ],
  generalObjectives: [],
}

const fmt = (n) => new Intl.NumberFormat('fr-FR').format(Number(n) || 0)

function result(current, target) {
  const t = Number(target) || 0
  if (t <= 0) return { text: '—', color: '#6e6a75' }
  const pct = Math.round(((Number(current) || 0) / t) * 100)
  const color = pct >= 100 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444'
  return { text: `${pct} %`, color }
}

// % d'atteinte brut (null si aucune cible définie)
function pctValue(current, target) {
  const t = Number(target) || 0
  if (t <= 0) return null
  return ((Number(current) || 0) / t) * 100
}

// Détecte les lignes qui viennent de franchir 100 % entre l'ancien et le nouveau tableau
function computeAchievements(prev, next) {
  const prevRows = new Map()
  for (const sec of prev?.metrics || []) {
    for (const row of sec.rows || []) {
      prevRows.set(`${sec.key || sec.title}::${row.label}`, row)
    }
  }
  const achievements = []
  for (const sec of next?.metrics || []) {
    for (const row of sec.rows || []) {
      const nowPct = pctValue(row.current, row.target)
      if (nowPct == null || nowPct < 100) continue
      const prevRow = prevRows.get(`${sec.key || sec.title}::${row.label}`)
      const prevPct = prevRow ? pctValue(prevRow.current, prevRow.target) : 0
      if (prevPct == null || prevPct < 100) {
        achievements.push({ section: sec.title, label: row.label, target: row.target })
      }
    }
  }
  return achievements
}

async function fetchBoard(year, month) {
  const { data, error } = await supabase
    .from('MonthlyBoard')
    .select('*')
    .eq('year', year)
    .eq('month', month)
    .maybeSingle()
  if (error) throw error
  return data
}

export default function MonthlyObjectivesBoard() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const role = user?.roleRel?.name || user?.role
  const isManager = role === 'Administrateur' || role === 'Manager'

  const now = new Date()
  const [period, setPeriod] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 })
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(null)

  const { year, month } = period

  const { data: board, isLoading } = useQuery({
    queryKey: ['monthly-board', year, month],
    queryFn: () => fetchBoard(year, month),
    onError: (err) => toast.error(err.message),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['monthly-board', year, month] })
  }

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (board?.id) {
        const { error } = await supabase.from('MonthlyBoard').update({ data }).eq('id', board.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('MonthlyBoard')
          .insert({ month, year, data, createdBy: user?.id || null })
        if (error) throw error
      }
      // Notification : objectifs venant d'être atteints (franchissement de 100 %)
      const achievements = computeAchievements(board?.data, data)
      if (achievements.length > 0) {
        try {
          const recipients = await fetchUserIdsByRole(['Administrateur', 'Manager'])
          for (const a of achievements) {
            await notifyUsers(
              recipients,
              {
                message: `🎯 Objectif atteint : ${a.label} — ${a.section} (${fmt(a.target)})`,
                type: 'objective',
                link: '/dashboard',
              },
              { exclude: user?.id },
            )
          }
        } catch (err) {
          console.error('Notification error:', err)
        }
      }
    },
    onSuccess: () => {
      invalidate()
      setEditing(false)
      setDraft(null)
      toast.success('Tableau enregistré')
    },
    onError: (err) => toast.error(err.message),
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      // Copie le tableau du mois le plus récent antérieur, sinon modèle par défaut
      const { data: prev } = await supabase
        .from('MonthlyBoard')
        .select('data')
        .or(`year.lt.${year},and(year.eq.${year},month.lt.${month})`)
        .order('year', { ascending: false })
        .order('month', { ascending: false })
        .limit(1)
        .maybeSingle()
      const base = prev?.data || DEFAULT_TEMPLATE
      const { error } = await supabase
        .from('MonthlyBoard')
        .insert({ month, year, data: structuredClone(base), createdBy: user?.id || null })
      if (error) throw error
    },
    onSuccess: () => {
      invalidate()
      toast.success('Tableau du mois créé')
    },
    onError: (err) => toast.error(err.message),
  })

  const go = (dir) => {
    setEditing(false)
    setDraft(null)
    setPeriod((p) => {
      let m = p.month + dir
      let y = p.year
      if (m < 1) { m = 12; y -= 1 }
      if (m > 12) { m = 1; y += 1 }
      return { year: y, month: m }
    })
  }

  const startEdit = () => {
    setDraft(structuredClone(board?.data || DEFAULT_TEMPLATE))
    setEditing(true)
  }

  const cancelEdit = () => {
    setEditing(false)
    setDraft(null)
  }

  // Mutations immuables sur le brouillon
  const edit = (fn) => setDraft((d) => { const c = structuredClone(d); fn(c); return c })

  const data = editing ? draft : board?.data
  const title = `OBJECTIFS DU MOIS DE ${MONTHS[month - 1].toUpperCase()} ${year}`

  return (
    <div className="rounded-xl border border-c-border bg-bg-card p-4 sm:p-6">
      {/* En-tête */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <DKLogo className="h-11 w-auto shrink-0" />
          <h2 className="text-sm font-bold uppercase tracking-wide text-text-primary sm:text-base">{title}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => go(-1)} className="rounded-lg border border-c-border p-1.5 text-text-secondary hover:bg-bg-hover" title="Mois précédent">
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => go(1)} className="rounded-lg border border-c-border p-1.5 text-text-secondary hover:bg-bg-hover" title="Mois suivant">
            <ChevronRight size={16} />
          </button>
          {isManager && board && !editing && (
            <button onClick={startEdit} className={`${btnSecondary} px-3 py-1.5 text-xs`}>
              <Pencil size={14} /> Modifier
            </button>
          )}
          {isManager && editing && (
            <>
              <button onClick={cancelEdit} className={`${btnSecondary} px-3 py-1.5 text-xs`}>
                <X size={14} /> Annuler
              </button>
              <button onClick={() => saveMutation.mutate(draft)} disabled={saveMutation.isPending} className={`${btnPrimary} px-3 py-1.5 text-xs`}>
                <Save size={14} /> Enregistrer
              </button>
            </>
          )}
        </div>
      </div>

      {/* Contenu */}
      {isLoading ? (
        <p className="text-sm text-text-muted">Chargement…</p>
      ) : !data ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-sm text-text-muted">Aucun tableau d'objectifs pour ce mois.</p>
          {isManager && (
            <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} className={btnPrimary}>
              <Plus size={15} /> Créer le tableau de ce mois
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {data.metrics.map((section, si) => (
            <MetricSection
              key={section.key || si}
              section={section} si={si} editing={editing} edit={edit}
            />
          ))}

          {editing && (
            <button
              onClick={() => edit((c) => c.metrics.push({
                key: crypto.randomUUID().slice(0, 8),
                title: 'NOUVELLE SECTION', rowHeader: 'Réseau',
                currentLabel: 'Actuel', targetLabel: 'Objectif',
                rows: [{ label: '', current: 0, target: 0 }],
              }))}
              className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-c-border py-2 text-xs text-text-muted hover:border-accent-purple hover:text-accent-purple"
            >
              <Plus size={14} /> Ajouter une section
            </button>
          )}

          {/* Objectifs généraux */}
          <div>
            <div className="rounded-t-lg bg-bg-dark px-3 py-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-text-primary">Objectifs généraux du mois</h3>
            </div>
            <div className="rounded-b-lg border border-t-0 border-c-border">
              {(data.generalObjectives || []).length === 0 && !editing && (
                <p className="px-3 py-3 text-xs text-text-muted">Aucun objectif général.</p>
              )}
              {(data.generalObjectives || []).map((obj, i) => (
                <div key={i} className="flex items-center gap-2 border-b border-c-border/60 px-3 py-2 last:border-0">
                  <span className="text-sm font-bold text-accent-purple">{i + 1}.</span>
                  {editing ? (
                    <>
                      <input
                        value={obj}
                        onChange={(e) => edit((c) => { c.generalObjectives[i] = e.target.value })}
                        className={`${inputClass} py-1`}
                        placeholder="Objectif…"
                      />
                      <button onClick={() => edit((c) => { if (i > 0) { const [x] = c.generalObjectives.splice(i, 1); c.generalObjectives.splice(i - 1, 0, x) } })} className="rounded p-1 text-text-muted hover:text-text-primary disabled:opacity-30" disabled={i === 0} title="Monter">
                        <ArrowUp size={13} />
                      </button>
                      <button onClick={() => edit((c) => { if (i < c.generalObjectives.length - 1) { const [x] = c.generalObjectives.splice(i, 1); c.generalObjectives.splice(i + 1, 0, x) } })} className="rounded p-1 text-text-muted hover:text-text-primary disabled:opacity-30" disabled={i === (data.generalObjectives.length - 1)} title="Descendre">
                        <ArrowDown size={13} />
                      </button>
                      <button onClick={() => edit((c) => c.generalObjectives.splice(i, 1))} className="rounded p-1 text-text-muted hover:text-c-danger" title="Supprimer">
                        <Trash2 size={13} />
                      </button>
                    </>
                  ) : (
                    <span className="text-sm text-text-secondary">{obj}</span>
                  )}
                </div>
              ))}
              {editing && (
                <button
                  onClick={() => edit((c) => { c.generalObjectives = c.generalObjectives || []; c.generalObjectives.push('') })}
                  className="flex w-full items-center justify-center gap-1 py-2 text-xs text-text-muted hover:text-accent-purple"
                >
                  <Plus size={13} /> Ajouter un objectif
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Section de métriques ─────────────────────────────────────────── */
function MetricSection({ section, si, editing, edit }) {
  return (
    <div>
      {/* Bandeau titre */}
      <div className="flex items-center gap-2 rounded-t-lg bg-bg-dark px-3 py-2">
        {editing ? (
          <>
            <input
              value={section.title}
              onChange={(e) => edit((c) => { c.metrics[si].title = e.target.value })}
              className={`${inputClass} py-1 font-bold uppercase`}
            />
            <button onClick={() => edit((c) => c.metrics.splice(si, 1))} className="rounded p-1 text-text-muted hover:text-c-danger shrink-0" title="Supprimer la section">
              <Trash2 size={14} />
            </button>
          </>
        ) : (
          <h3 className="text-xs font-bold uppercase tracking-wide text-text-primary">{section.title}</h3>
        )}
      </div>

      <div className="overflow-x-auto rounded-b-lg border border-t-0 border-c-border">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-c-border bg-bg-hover text-xs uppercase text-text-muted">
              <th className="p-2 text-left font-medium">
                {editing ? (
                  <input value={section.rowHeader} onChange={(e) => edit((c) => { c.metrics[si].rowHeader = e.target.value })} className={`${inputClass} py-1`} />
                ) : section.rowHeader}
              </th>
              <th className="p-2 text-right font-medium">
                {editing ? (
                  <input value={section.currentLabel} onChange={(e) => edit((c) => { c.metrics[si].currentLabel = e.target.value })} className={`${inputClass} py-1`} />
                ) : section.currentLabel}
              </th>
              <th className="p-2 text-right font-medium">
                {editing ? (
                  <input value={section.targetLabel} onChange={(e) => edit((c) => { c.metrics[si].targetLabel = e.target.value })} className={`${inputClass} py-1`} />
                ) : section.targetLabel}
              </th>
              <th className="p-2 text-right font-medium w-24">Résultat</th>
              {editing && <th className="w-8" />}
            </tr>
          </thead>
          <tbody>
            {section.rows.map((row, ri) => {
              const r = result(row.current, row.target)
              return (
                <tr key={ri} className="border-b border-c-border/60 last:border-0">
                  <td className="p-2">
                    {editing ? (
                      <input value={row.label} onChange={(e) => edit((c) => { c.metrics[si].rows[ri].label = e.target.value })} className={`${inputClass} py-1`} placeholder="Nom…" />
                    ) : (
                      <span className="font-medium text-text-primary">{row.label}</span>
                    )}
                  </td>
                  <td className="p-2 text-right">
                    {editing ? (
                      <input type="number" value={row.current} onChange={(e) => edit((c) => { c.metrics[si].rows[ri].current = e.target.value === '' ? 0 : Number(e.target.value) })} className={`${inputClass} py-1 text-right`} />
                    ) : (
                      <span className="text-text-secondary">{fmt(row.current)}</span>
                    )}
                  </td>
                  <td className="p-2 text-right">
                    {editing ? (
                      <input type="number" value={row.target} onChange={(e) => edit((c) => { c.metrics[si].rows[ri].target = e.target.value === '' ? 0 : Number(e.target.value) })} className={`${inputClass} py-1 text-right`} />
                    ) : (
                      <span className="text-text-secondary">{fmt(row.target)}</span>
                    )}
                  </td>
                  <td className="p-2 text-right">
                    <span className="font-semibold" style={{ color: r.color }}>{r.text}</span>
                  </td>
                  {editing && (
                    <td className="p-1 text-center">
                      <button onClick={() => edit((c) => c.metrics[si].rows.splice(ri, 1))} className="rounded p-1 text-text-muted hover:text-c-danger" title="Supprimer la ligne">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
        {editing && (
          <button
            onClick={() => edit((c) => c.metrics[si].rows.push({ label: '', current: 0, target: 0 }))}
            className="flex w-full items-center justify-center gap-1 py-2 text-xs text-text-muted hover:text-accent-purple"
          >
            <Plus size={13} /> Ajouter une ligne
          </button>
        )}
      </div>
    </div>
  )
}
