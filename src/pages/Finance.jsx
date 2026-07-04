import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AreaChart, Area, PieChart, Pie, Cell, Tooltip, Legend,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import toast from 'react-hot-toast'
import {
  Wallet, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  Plus, Trash2, BarChart3, List, ListChecks,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatCurrency, isOverdue } from '../lib/format'
import {
  TRANSACTION_TYPE_LABELS, TRANSACTION_TYPE_COLORS, TRANSACTION_TYPE_OPTIONS,
} from '../lib/constants'
import Badge from '../components/ui/Badge'
import StatCard from '../components/ui/StatCard'
import Modal from '../components/ui/Modal'
import ObligationsTab from '../components/ObligationsTab'
import { inputClass, labelClass, btnPrimary, btnSecondary, btnDanger } from '../lib/ui'

/* ── Fetch helpers ──────────────────────────────────────────────── */

async function fetchProjects() {
  const { data, error } = await supabase
    .from('Project')
    .select('*, clientRel:Client(id, name), typeRel:ProjectType(id, name, color)')
    .order('deadline', { ascending: true, nullsFirst: false })
  if (error) throw error
  return data || []
}

async function fetchInvoices() {
  const { data, error } = await supabase
    .from('Invoice')
    .select('*, clientRel:Client(id, name)')
    .order('createdAt', { ascending: false })
  if (error) throw error
  return data || []
}

async function fetchTransactions() {
  const { data, error } = await supabase
    .from('Transaction')
    .select('*, categoryRel:FinanceCategory(id, name, color, type)')
    .order('date', { ascending: false })
  if (error) throw error
  return data || []
}

async function fetchCategories() {
  const { data, error } = await supabase.from('FinanceCategory').select('*').order('name')
  if (error) throw error
  return data || []
}

/* ── Utils ──────────────────────────────────────────────────────── */

function getPaymentStatus(project) {
  const budget = Number(project.budget) || 0
  const paid = Number(project.amountPaid) || 0
  if (budget > 0 && paid >= budget) return { label: 'Payé', color: '#10b981' }
  if (project.deadline && isOverdue(project.deadline) && paid < budget) {
    return { label: 'En retard', color: '#ef4444' }
  }
  return { label: 'En attente', color: '#f59e0b' }
}

const FALLBACK_COLORS = ['#9d3bf1', '#22d3ee', '#10b981', '#f59e0b', '#ef4444', '#6e6a75']
const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']

const TABS = [
  { key: 'overview', label: 'Vue d\'ensemble', icon: BarChart3 },
  { key: 'transactions', label: 'Transactions', icon: List },
  { key: 'obligations', label: 'Dépenses obligatoires', icon: ListChecks },
  { key: 'projects', label: 'Projets', icon: Wallet },
]

const EMPTY_TX = { type: 'INCOME', amount: '', categoryId: '', description: '', date: new Date().toISOString().slice(0, 10) }

/* ── Custom tooltip ─────────────────────────────────────────────── */

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-c-border bg-bg-card px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 font-semibold text-text-primary">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  )
}

/* ── Main Page ───────────────────────────────────────────────────── */

export default function Finance() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('overview')
  const [txModalOpen, setTxModalOpen] = useState(false)
  const [editingTx, setEditingTx] = useState(null)
  const [txForm, setTxForm] = useState(EMPTY_TX)

  const { data: projects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ['finance-projects'], queryFn: fetchProjects, onError: (e) => toast.error(e.message),
  })
  const { data: invoices = [] } = useQuery({ queryKey: ['invoices'], queryFn: fetchInvoices })
  const { data: transactions = [], isLoading: loadingTx } = useQuery({
    queryKey: ['transactions'], queryFn: fetchTransactions, onError: (e) => toast.error(e.message),
  })
  const { data: categories = [] } = useQuery({ queryKey: ['finance-categories'], queryFn: fetchCategories })

  /* ── KPIs ── */
  const totalRevenue  = transactions.filter(t => t.type === 'INCOME').reduce((s, t) => s + Number(t.amount || 0), 0)
  const totalExpenses = transactions.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + Number(t.amount || 0), 0)
  const netProfit     = totalRevenue - totalExpenses
  const totalPending  = projects.reduce((s, p) => s + Math.max(0, (Number(p.budget) || 0) - (Number(p.amountPaid) || 0)), 0)
  const totalInvoiced = invoices.reduce((s, i) => s + Number(i.total || 0), 0)
  const invoicesPaid  = invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + Number(i.total || 0), 0)

  /* ── Chart: monthly revenue vs expenses ── */
  const monthlyData = useMemo(() => {
    const map = {}
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`
      map[key] = { name: MONTHS[d.getMonth()], revenus: 0, dépenses: 0 }
    }
    transactions.forEach((t) => {
      if (!t.date) return
      const d = new Date(t.date)
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`
      if (!map[key]) return
      if (t.type === 'INCOME') map[key].revenus += Number(t.amount || 0)
      else map[key].dépenses += Number(t.amount || 0)
    })
    return Object.values(map)
  }, [transactions])

  /* ── Chart: expenses by category ── */
  const categoryData = useMemo(() => {
    const map = {}
    transactions.filter(t => t.type === 'EXPENSE').forEach((t) => {
      const name = t.categoryRel?.name || 'Autre'
      const color = t.categoryRel?.color || '#6e6a75'
      map[name] = map[name] || { name, value: 0, color }
      map[name].value += Number(t.amount || 0)
    })
    return Object.values(map).filter(e => e.value > 0)
  }, [transactions])

  /* ── Mutations ── */
  const saveTxMutation = useMutation({
    mutationFn: async (payload) => {
      if (editingTx) {
        const { error } = await supabase.from('Transaction').update(payload).eq('id', editingTx.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('Transaction').insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      toast.success(editingTx ? 'Transaction mise à jour' : 'Transaction ajoutée')
      closeTxModal()
    },
    onError: (e) => toast.error(e.message),
  })

  const deleteTxMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('Transaction').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      toast.success('Transaction supprimée')
      closeTxModal()
    },
    onError: (e) => toast.error(e.message),
  })

  const openCreateTx = () => {
    setEditingTx(null)
    setTxForm({ ...EMPTY_TX, date: new Date().toISOString().slice(0, 10) })
    setTxModalOpen(true)
  }
  const openEditTx = (tx) => {
    setEditingTx(tx)
    setTxForm({ type: tx.type, amount: tx.amount, categoryId: tx.categoryId || '', description: tx.description || '', date: tx.date?.slice(0, 10) || '' })
    setTxModalOpen(true)
  }
  const closeTxModal = () => { setTxModalOpen(false); setEditingTx(null); setTxForm(EMPTY_TX) }

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {[
          { label: 'Revenus',      value: formatCurrency(totalRevenue),  icon: TrendingUp,   color: '#10b981' },
          { label: 'Dépenses',     value: formatCurrency(totalExpenses), icon: TrendingDown, color: '#ef4444' },
          { label: 'Bénéfice net', value: formatCurrency(netProfit),     icon: netProfit >= 0 ? ArrowUpRight : ArrowDownRight, color: netProfit >= 0 ? '#10b981' : '#ef4444' },
          { label: 'Facturé',      value: formatCurrency(totalInvoiced), icon: Wallet,       color: '#9d3bf1' },
          { label: 'À encaisser',  value: formatCurrency(totalPending),  icon: Wallet,       color: '#f59e0b' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-c-border bg-bg-card p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs text-text-muted">{s.label}</p>
              <s.icon size={15} style={{ color: s.color }} />
            </div>
            <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
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

      {/* ── Tab: Overview ── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Area chart */}
          <div className="lg:col-span-2 rounded-xl border border-c-border bg-bg-card p-5">
            <h3 className="mb-4 text-sm font-semibold text-text-primary">Revenus vs Dépenses (6 mois)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={monthlyData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gradRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradExp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2e2b3d" />
                <XAxis dataKey="name" tick={{ fill: '#b8b4c8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#b8b4c8', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#b8b4c8', paddingTop: 8 }} />
                <Area type="monotone" dataKey="revenus"  stroke="#10b981" fill="url(#gradRev)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="dépenses" stroke="#ef4444" fill="url(#gradExp)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Donut chart */}
          <div className="rounded-xl border border-c-border bg-bg-card p-5">
            <h3 className="mb-4 text-sm font-semibold text-text-primary">Dépenses par catégorie</h3>
            {categoryData.length === 0 ? (
              <p className="text-sm text-text-muted">Aucune dépense enregistrée.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                    {categoryData.map((e, i) => (
                      <Cell key={e.name} fill={e.color || FALLBACK_COLORS[i % FALLBACK_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v) => formatCurrency(v)}
                    contentStyle={{ background: '#1f1d2b', border: '1px solid #2e2b3d', borderRadius: 8 }}
                    labelStyle={{ color: '#f0eef8' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#b8b4c8' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Transactions ── */}
      {activeTab === 'transactions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">{transactions.length} transaction{transactions.length !== 1 ? 's' : ''}</h3>
            <button onClick={openCreateTx} className={btnPrimary}>
              <Plus size={15} /> Ajouter
            </button>
          </div>
          {loadingTx ? (
            <p className="text-text-secondary">Chargement…</p>
          ) : transactions.length === 0 ? (
            <p className="text-sm text-text-muted">Aucune transaction.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-c-border bg-bg-card">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[500px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-c-border text-xs uppercase text-text-muted">
                      <th className="p-4 font-medium">Date</th>
                      <th className="p-4 font-medium">Description</th>
                      <th className="p-4 font-medium">Catégorie</th>
                      <th className="p-4 font-medium">Type</th>
                      <th className="p-4 text-right font-medium">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => {
                      const typeColor = TRANSACTION_TYPE_COLORS[tx.type] || '#6e6a75'
                      return (
                        <tr
                          key={tx.id}
                          onClick={() => openEditTx(tx)}
                          className="cursor-pointer border-b border-c-border last:border-0 hover:bg-bg-hover/30 transition-colors"
                        >
                          <td className="p-4 text-text-muted text-xs whitespace-nowrap">
                            {tx.date ? new Date(tx.date).toLocaleDateString('fr-FR') : '—'}
                          </td>
                          <td className="p-4 text-text-secondary">{tx.description || '—'}</td>
                          <td className="p-4">
                            {tx.categoryRel ? (
                              <Badge color={tx.categoryRel.color || '#6e6a75'}>{tx.categoryRel.name}</Badge>
                            ) : '—'}
                          </td>
                          <td className="p-4">
                            <Badge color={typeColor}>{TRANSACTION_TYPE_LABELS[tx.type]}</Badge>
                          </td>
                          <td className="p-4 text-right font-semibold" style={{ color: typeColor }}>
                            {tx.type === 'EXPENSE' ? '- ' : '+ '}{formatCurrency(tx.amount)}
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

      {/* ── Tab: Dépenses obligatoires ── */}
      {activeTab === 'obligations' && <ObligationsTab categories={categories} />}

      {/* ── Tab: Projects ── */}
      {activeTab === 'projects' && (
        <div className="rounded-xl border border-c-border bg-bg-card">
          {loadingProjects ? (
            <p className="p-6 text-text-secondary">Chargement…</p>
          ) : projects.length === 0 ? (
            <p className="p-6 text-text-secondary">Aucun projet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-c-border text-xs uppercase text-text-muted">
                    <th className="p-4 font-medium">Projet</th>
                    <th className="p-4 font-medium">Budget</th>
                    <th className="p-4 font-medium">Encaissé</th>
                    <th className="p-4 font-medium">Solde</th>
                    <th className="p-4 font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p) => {
                    const balance = (Number(p.budget) || 0) - (Number(p.amountPaid) || 0)
                    const status = getPaymentStatus(p)
                    const pct = p.budget > 0 ? Math.min(100, Math.round((p.amountPaid / p.budget) * 100)) : 0
                    return (
                      <tr key={p.id} className="border-b border-c-border last:border-0">
                        <td className="p-4">
                          <p className="font-medium text-text-primary">{p.name}</p>
                          <p className="text-xs text-text-muted">{p.clientRel?.name || '—'}</p>
                          {/* mini progress bar */}
                          <div className="mt-1.5 h-1 w-32 overflow-hidden rounded-full bg-bg-hover">
                            <div className="h-full rounded-full bg-accent-purple" style={{ width: `${pct}%` }} />
                          </div>
                        </td>
                        <td className="p-4 text-text-secondary">{formatCurrency(p.budget)}</td>
                        <td className="p-4 text-c-success font-medium">{formatCurrency(p.amountPaid)}</td>
                        <td className="p-4 text-text-secondary">{formatCurrency(balance)}</td>
                        <td className="p-4"><Badge color={status.color}>{status.label}</Badge></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Transaction Modal */}
      <Modal
        open={txModalOpen}
        onClose={closeTxModal}
        title={editingTx ? 'Modifier la transaction' : 'Nouvelle transaction'}
        footer={
          <>
            {editingTx && (
              <button type="button" onClick={() => deleteTxMutation.mutate(editingTx.id)} disabled={deleteTxMutation.isPending} className={btnDanger}>
                <Trash2 size={15} /> Supprimer
              </button>
            )}
            <div className="flex-1" />
            <button type="button" onClick={closeTxModal} className={btnSecondary}>Annuler</button>
            <button type="submit" form="tx-form" disabled={saveTxMutation.isPending} className={btnPrimary}>Enregistrer</button>
          </>
        }
      >
        <form
          id="tx-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (!txForm.amount || isNaN(Number(txForm.amount))) { toast.error('Montant invalide'); return }
            saveTxMutation.mutate({
              type: txForm.type,
              amount: Number(txForm.amount),
              categoryId: txForm.categoryId || null,
              description: txForm.description || null,
              date: txForm.date || null,
            })
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Type</label>
              <select value={txForm.type} onChange={(e) => setTxForm(f => ({ ...f, type: e.target.value }))} className={inputClass}>
                {TRANSACTION_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>{TRANSACTION_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Montant (€) *</label>
              <input type="number" min="0" step="0.01" required value={txForm.amount} onChange={(e) => setTxForm(f => ({ ...f, amount: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Date</label>
              <input type="date" value={txForm.date} onChange={(e) => setTxForm(f => ({ ...f, date: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Catégorie</label>
              <select value={txForm.categoryId} onChange={(e) => setTxForm(f => ({ ...f, categoryId: e.target.value }))} className={inputClass}>
                <option value="">— Aucune —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <input value={txForm.description} onChange={(e) => setTxForm(f => ({ ...f, description: e.target.value }))} className={inputClass} />
          </div>
        </form>
      </Modal>
    </div>
  )
}
