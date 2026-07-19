export function formatCurrency(value) {
  const n = Number(value) || 0
  return new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 0,
  }).format(n) + ' GNF'
}

export function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d)
}

export function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export function formatTime(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export function getInitials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function formatLastSeen(value) {
  if (!value) return 'Jamais connecté'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  const sec = Math.floor((Date.now() - d.getTime()) / 1000)
  if (sec < 60) return "En ligne à l'instant"
  const min = Math.floor(sec / 60)
  if (min < 60) return `En ligne il y a ${min} min`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `En ligne il y a ${hr} h`
  const day = Math.floor(hr / 24)
  if (day === 1) return `En ligne hier à ${formatTime(value)}`
  if (day < 7) return `En ligne il y a ${day} j`
  return `En ligne le ${formatDate(value)}`
}

export function isOverdue(dateValue) {
  if (!dateValue) return false
  const d = new Date(dateValue)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return d < now
}
