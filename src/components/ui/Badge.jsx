export default function Badge({ color = '#6e6a75', children }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap"
      style={{ backgroundColor: `${color}26`, color }}
    >
      {children}
    </span>
  )
}
