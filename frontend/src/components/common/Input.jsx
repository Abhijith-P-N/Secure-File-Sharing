export default function Input({
  label,
  id,
  type = 'text',
  value,
  onChange,
  placeholder,
  error,
  helperText,
  required,
  rightAction,
  icon: Icon,
  className = '',
  ...props
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label ? (
        <div className="flex items-center justify-between">
          <label htmlFor={id} className="block text-[13px] font-medium text-ink">
            {label}
            {required ? <span className="ml-0.5 text-danger">*</span> : null}
          </label>
          {rightAction ? rightAction : null}
        </div>
      ) : null}

      <div className="relative">
        {Icon ? (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted">
            <Icon className="h-[18px] w-[18px]" />
          </div>
        ) : null}
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : helperText ? `${id}-helper` : undefined}
          className={`w-full rounded-[10px] border bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-muted-dim transition-colors duration-150 focus:outline-none focus:ring-0 ${
            error
              ? 'border-danger/50 focus:border-danger'
              : 'border-border focus:border-primary'
          } ${Icon ? 'pl-10' : ''}`}
          {...props}
        />
      </div>

      {helperText && !error ? (
        <p id={`${id}-helper`} className="text-[12px] text-muted">
          {helperText}
        </p>
      ) : null}

      {error ? (
        <p id={`${id}-error`} className="text-[12px] text-danger">{error}</p>
      ) : null}
    </div>
  )
}
