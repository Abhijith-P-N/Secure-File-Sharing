export default function Card({
  children,
  className = '',
  hover = false,
  as: Tag = 'div',
  ...props
}) {
  return (
    <Tag
      className={`rounded-[12px] border border-border bg-surface shadow-[0_1px_3px_rgba(16,24,40,0.06)] ${hover ? 'transition-shadow duration-150 hover:shadow-[0_2px_6px_rgba(16,24,40,0.08)]' : ''} ${className}`}
      {...props}
    >
      {children}
    </Tag>
  )
}

export function CardHeader({ title, subtitle, actions, className = '' }) {
  return (
    <div className={`mb-4 flex items-start justify-between gap-3 ${className}`}>
      <div>
        {title ? <h2 className="text-[17px] font-semibold text-ink">{title}</h2> : null}
        {subtitle ? <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  )
}