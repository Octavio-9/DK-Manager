import { X } from 'lucide-react'

export default function Modal({ open, onClose, title, children, footer, maxWidth = 'max-w-lg' }) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className={`h-full w-full sm:h-auto ${maxWidth} max-h-screen overflow-y-auto rounded-none border-0 border-c-border bg-bg-card p-4 shadow-2xl sm:max-h-[90vh] sm:rounded-xl sm:border sm:p-6`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-text-muted transition-colors hover:bg-bg-hover hover:text-text-primary"
          >
            <X size={20} />
          </button>
        </div>
        <div>{children}</div>
        {footer && <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">{footer}</div>}
      </div>
    </div>
  )
}
