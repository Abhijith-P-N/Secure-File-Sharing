export default function StatCard({ title, value, hint, icon: Icon, tone = 'default', className = '' }) {
  const iconBg = {
    default: 'bg-surface-hover text-muted',
    info: 'bg-info-bg text-info',
    success: 'bg-success-bg text-success',
    warning: 'bg-warning-bg text-warning',
    danger: 'bg-danger-bg text-danger',
  }

  return (
    <div className={`rounded-[12px] border border-border bg-surface p-5 shadow-[0_1px_3px_rgba(16,24,40,0.06)] transition-shadow duration-150 hover:shadow-[0_2px_6px_rgba(16,24,40,0.08)] ${className}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[13px] font-medium text-muted">{title}</p>
          <p className="mt-2.5 text-[28px] font-semibold leading-none tracking-tight text-ink">{value}</p>
          {hint ? <p className="mt-1.5 text-[12px] text-muted">{hint}</p> : null}
        </div>
        {Icon ? (
          <div className={`flex h-10 w-10 items-center justify-center rounded-[10px] ${iconBg[tone] || iconBg.default}`}>
            <Icon className="h-5 w-5" />
          </div>
        ) : null}
      </div>
    </div>
  )
}
