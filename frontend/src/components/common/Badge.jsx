export default function Badge({ children, tone = 'neutral', className = '' }) {
  const tones = {
    neutral: 'bg-slate-800 text-slate-200 border-slate-700',
    success: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    danger: 'bg-red-500/10 text-red-300 border-red-500/30',
    warning: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    info: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
  }

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${tones[tone] || tones.neutral} ${className}`}>
      {children}
    </span>
  )
}
