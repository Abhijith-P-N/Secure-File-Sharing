export default function Alert({ title, message, tone = 'info' }) {
  const tones = {
    info: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-100',
    success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100',
    danger: 'border-red-500/30 bg-red-500/10 text-red-100',
    warning: 'border-amber-500/30 bg-amber-500/10 text-amber-50',
  }

  return (
    <div className={`rounded-2xl border p-4 ${tones[tone] || tones.info}`} role="alert">
      {title ? <p className="mb-1 text-sm font-semibold">{title}</p> : null}
      {message ? <p className="text-sm opacity-90">{message}</p> : null}
    </div>
  )
}
