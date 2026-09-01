import { AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react'

const icons = {
  info: Info,
  success: CheckCircle,
  danger: XCircle,
  warning: AlertTriangle,
}

export default function Alert({ title, message, tone = 'info', onDismiss }) {
  const tones = {
    info: { bg: 'bg-info-bg', border: 'border-info/15', icon: 'text-info', text: 'text-ink' },
    success: { bg: 'bg-success-bg', border: 'border-success/15', icon: 'text-success', text: 'text-ink' },
    danger: { bg: 'bg-danger-bg', border: 'border-danger/15', icon: 'text-danger', text: 'text-ink' },
    warning: { bg: 'bg-warning-bg', border: 'border-warning/15', icon: 'text-warning', text: 'text-ink' },
  }

  const t = tones[tone] || tones.info
  const Icon = icons[tone] || icons.info

  return (
    <div
      className={`flex items-start gap-3 rounded-[10px] border px-4 py-3.5 ${t.bg} ${t.border}`}
      role="alert"
    >
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${t.icon}`} />
      <div className="flex-1 min-w-0">
        {title ? <p className={`text-sm font-semibold ${t.text}`}>{title}</p> : null}
        {message ? <p className={`mt-0.5 text-[13px] leading-relaxed text-muted`}>{message}</p> : null}
      </div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss alert"
          className="mt-0.5 shrink-0 text-muted hover:text-ink"
        >
          <XCircle className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  )
}
