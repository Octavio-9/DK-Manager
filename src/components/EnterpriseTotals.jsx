import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  Wallet, FileText, Receipt, Hash, Eye,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../lib/format'
import Modal from './ui/Modal'
import { btnSecondary } from '../lib/ui'

/* ── Fetch (clés dédiées → toujours rafraîchi à l'ouverture) ──────── */

async function fetchAllTransactions() {
  const { data, error } = await supabase.from('Transaction').select('type, amount')
  if (error) throw error
  return data || []
}

async function fetchAllInvoices() {
  const { data, error } = await supabase.from('Invoice').select('total, status, documentType')
  if (error) throw error
  return data || []
}

/* ── Carte statistique ───────────────────────────────────────────── */

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <div className="rounded-xl border border-c-border bg-bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs text-text-muted">{label}</p>
        <Icon size={15} style={{ color }} />
      </div>
      <p className="text-lg font-bold" style={{ color }}>{value}</p>
    </div>
  )
}

/* ── Totaux entreprise (depuis le début) ─────────────────────────── */

export default function EnterpriseTotals() {
  const { data: transactions = [], isLoading: loadingTx } = useQuery({
    queryKey: ['enterprise-transactions'], queryFn: fetchAllTransactions,
  })
  const { data: invoices = [], isLoading: loadingInv } = useQuery({
    queryKey: ['enterprise-invoices'], queryFn: fetchAllInvoices,
  })

  if (loadingTx || loadingInv) {
    return <p className="text-sm text-text-secondary">Chargement…</p>
  }

  const totalRevenue  = transactions.filter(t => t.type === 'INCOME').reduce((s, t) => s + Number(t.amount || 0), 0)
  const totalExpenses = transactions.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + Number(t.amount || 0), 0)
  const netProfit     = totalRevenue - totalExpenses

  const factures      = invoices.filter(i => i.documentType === 'FACTURE')
  const totalInvoiced = factures.reduce((s, i) => s + Number(i.total || 0), 0)
  const totalPaid     = invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + Number(i.total || 0), 0)
  const totalPending  = invoices.filter(i => i.status === 'PENDING' || i.status === 'OVERDUE').reduce((s, i) => s + Number(i.total || 0), 0)

  return (
    <div className="space-y-6">
      {/* Finance */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Finance — depuis le début</h3>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <StatCard label="Chiffre d'affaires total" value={formatCurrency(totalRevenue)}  icon={TrendingUp}   color="#10b981" />
          <StatCard label="Dépenses totales"         value={formatCurrency(totalExpenses)} icon={TrendingDown} color="#ef4444" />
          <StatCard label="Bénéfice net total"       value={formatCurrency(netProfit)}     icon={netProfit >= 0 ? ArrowUpRight : ArrowDownRight} color={netProfit >= 0 ? '#10b981' : '#ef4444'} />
        </div>
      </div>

      {/* Facturation */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Facturation — depuis le début</h3>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <StatCard label="Facturé (factures)" value={formatCurrency(totalInvoiced)} icon={Wallet}   color="#9d3bf1" />
          <StatCard label="Encaissé"           value={formatCurrency(totalPaid)}     icon={FileText} color="#10b981" />
          <StatCard label="À encaisser"        value={formatCurrency(totalPending)}  icon={Receipt}  color="#f59e0b" />
        </div>
      </div>

      {/* Volumes */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Volumes</h3>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <StatCard label="Transactions (total)" value={transactions.length} icon={Hash} color="#22d3ee" />
          <StatCard label="Factures (total)"     value={factures.length}     icon={Hash} color="#9d3bf1" />
          <StatCard label="Documents (total)"    value={invoices.length}     icon={Hash} color="#6e6a75" />
        </div>
      </div>
    </div>
  )
}

/* ── Bouton masqué + modale (réservé à l'appelant qui le juge autorisé) ─ */

export function EnterpriseTotalsButton({ label = 'Total entreprise' }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={btnSecondary}>
        <Eye size={15} /> {label}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Total entreprise — depuis le début"
        maxWidth="max-w-3xl"
        footer={
          <>
            <div className="flex-1" />
            <button type="button" onClick={() => setOpen(false)} className={btnSecondary}>Fermer</button>
          </>
        }
      >
        <EnterpriseTotals />
      </Modal>
    </>
  )
}
