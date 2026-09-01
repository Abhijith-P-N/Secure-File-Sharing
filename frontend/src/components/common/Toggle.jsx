export default function Toggle({
  checked = false,
  onChange,
  label,
  description,
  disabled = false,
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[10px] border border-border bg-surface px-4 py-3">
      <div className="min-w-0 flex-1">
        {label ? <p className="text-[14px] font-medium text-ink">{label}</p> : null}
        {description ? <p className="mt-0.5 text-[12px] text-muted">{description}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange?.(!checked)}
        className={`relative inline-flex h-[22px] w-[40px] shrink-0 cursor-pointer items-center rounded-full transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-55 ${
          checked ? 'bg-primary' : 'bg-border-hover'
        }`}
      >
        <span
          className={`inline-block h-[16px] w-[16px] rounded-full bg-white shadow-sm transition-transform duration-150 ${
            checked ? 'translate-x-[20px]' : 'translate-x-[3px]'
          }`}
        />
      </button>
    </div>
  )
}
