export default function Badge({ children, tone = 'neutral', size = 'sm', className = '' }) {
  const tones = {
    neutral: 'bg-surface-hover text-muted border-border',
    success: 'bg-success-bg text-success border-success/20',
    danger: 'bg-danger-bg text-danger border-danger/20',
    warning: 'bg-warning-bg text-warning border-warning/20',
    info: 'bg-info-bg text-info border-info/20',
    primary: 'bg-primary-soft text-primary border-primary/20',
  }

  const sizes = {
    sm: 'px-2 py-0.5 text-[11px]',
    md: 'px-2.5 py-1 text-xs',
  }

  return (
    <span
      className={`inline-flex items-center rounded-[8px] border font-medium leading-none ${sizes[size]} ${tones[tone] || tones.neutral} ${className}`}
    >
      {children}
    </span>
  )
}