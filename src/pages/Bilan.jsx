import { Lock } from 'lucide-react'
import EnterpriseTotals from '../components/EnterpriseTotals'

export default function Bilan() {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-xl border border-c-border bg-bg-card p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-purple/15">
          <Lock size={18} className="text-accent-purple" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Bilan global de l'entreprise</h2>
          <p className="mt-0.5 text-sm text-text-secondary">
            Chiffre d'affaires, dépenses et facturation cumulés depuis le début.
            Ces totaux ne sont visibles que sur cette page (réservée à l'administrateur) — les pages
            Finance et Facturation restent, elles, en vue mensuelle.
          </p>
        </div>
      </div>

      <EnterpriseTotals />
    </div>
  )
}
