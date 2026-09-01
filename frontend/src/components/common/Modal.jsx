import { X } from 'lucide-react'
import { useEffect } from 'react'

export default function Modal({ open, title, children, onClose, maxWidth = 'max-w-lg', fixedHeight = false }) {
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-ink/30 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`relative w-full ${maxWidth} ${
          fixedHeight
            ? 'flex h-[520px] max-h-[90vh] flex-col overflow-hidden'
            : 'max-h-[90vh] overflow-y-auto scrollable-modal'
        } rounded-[14px] border border-border bg-surface shadow-[0_8px_30px_rgba(16,24,40,0.12)] animate-[modalIn_180ms_ease-out]`}
      >
        {title ? (
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface px-6 py-4 shrink-0">
            <h3 className="text-[17px] font-semibold text-ink">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="rounded-lg p-1.5 text-muted hover:bg-surface-hover hover:text-ink transition-colors duration-150"
            >
              <X className="h-[18px] w-[18px]" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="absolute right-4 top-4 rounded-lg p-1.5 text-muted hover:bg-surface-hover hover:text-ink transition-colors duration-150 z-10"
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        )}
        <div
          className={
            fixedHeight
              ? 'flex-1 overflow-y-auto px-6 py-5 scrollable-modal'
              : 'px-6 py-5'
          }
        >
          {children}
        </div>
      </div>
    </div>
  )
}
