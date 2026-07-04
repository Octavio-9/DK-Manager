export default function StatCard({ icon: Icon, label, value, color = '#9d3bf1' }) {
  return (
    <div className="rounded-xl border border-c-border bg-bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-text-secondary">{label}</p>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${color}22` }}
        >
          <Icon size={18} style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-bold text-text-primary">{value}</p>
    </div>
  )
}
