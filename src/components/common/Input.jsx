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
  ...props
}) {
  return (
    <div className="space-y-2">
      {label ? (
        <div className="flex items-center justify-between">
          <label htmlFor={id} className="block text-sm font-medium text-slate-200">
            {label}
            {required ? <span className="ml-1 text-cyan-400">*</span> : null}
          </label>
          {rightAction ? rightAction : null}
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
        className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
        {...props}
      />

      {helperText && !error ? (
        <p id={`${id}-helper`} className="text-xs text-slate-400">
          {helperText}
        </p>
      ) : null}

      {error ? (
        <p id={`${id}-error`} className="text-xs text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  )
}
