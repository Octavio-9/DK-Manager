import { getInitials } from '../../lib/format'

const SIZES = {
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-14 h-14 text-lg',
}

export default function Avatar({ name, bg = '#9d3bf1', size = 'md' }) {
  return (
    <div
      className={`flex items-center justify-center rounded-full font-semibold text-white shrink-0 ${SIZES[size] || SIZES.md}`}
      style={{ backgroundColor: bg }}
    >
      {getInitials(name)}
    </div>
  )
}
