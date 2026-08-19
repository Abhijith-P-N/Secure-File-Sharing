export default function StatCard({ title, value, hint, icon: Icon, tone = 'default' }) {
  const tones = {
    default: 'border-slate-800 bg-slate-900/80 text-slate-100',
    success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100',
    warning: 'border-amber-500/30 bg-amber-500/10 text-amber-100',
    danger: 'border-red-500/30 bg-red-500/10 text-red-100',
    info: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-100',
  }

  return (
    <div className={`rounded-2xl border p-5 ${tones[tone] || tones.default}`}>
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-300">{title}</p>
        {Icon ? <Icon className="h-5 w-5 text-current opacity-80" /> : null}
      </div>

      <div className="mt-4 flex items-end justify-between gap-2">
        <p className="text-3xl font-semibold tracking-tight">{value}</p>
        {hint ? <span className="text-xs text-slate-400">{hint}</span> : null}
      </div>
    </div>
  )
}
