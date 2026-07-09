import { getInitials } from '../../lib/format'

const SIZES = {
  xs: 'w-5 h-5 text-[9px]',
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-14 h-14 text-lg',
}

export default function Avatar({ name, bg = '#9d3bf1', size = 'md', src }) {
  const cls = `flex items-center justify-center overflow-hidden rounded-full font-semibold text-white shrink-0 ${SIZES[size] || SIZES.md}`
  return (
    <div className={cls} style={{ backgroundColor: bg }}>
      {src ? (
        <img src={src} alt={name || 'avatar'} className="h-full w-full object-cover" />
      ) : (
        getInitials(name)
      )}
    </div>
  )
}
