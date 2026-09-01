export default function EmptyState({ icon: Icon, title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[12px] border border-dashed border-border bg-surface px-6 py-12 text-center">
      {Icon ? (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-surface-hover text-muted">
          <Icon className="h-6 w-6" />
        </div>
      ) : null}
      {title ? <h3 className="text-[15px] font-semibold text-ink">{title}</h3> : null}
      {message ? <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-muted">{message}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}
