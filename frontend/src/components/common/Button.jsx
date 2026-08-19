export default function Button({
  children,
  type = 'button',
  variant = 'primary',
  fullWidth = false,
  disabled = false,
  className = '',
  ...props
}) {
  const baseClass = 'inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-cyan-500/70 disabled:cursor-not-allowed disabled:opacity-60'

  const variants = {
    primary: 'bg-cyan-500 text-slate-950 hover:bg-cyan-400 shadow-[0_0_30px_rgba(34,211,238,0.25)]',
    secondary: 'bg-slate-800 text-slate-100 hover:bg-slate-700 border border-slate-700',
    danger: 'bg-red-500/90 text-white hover:bg-red-400',
    ghost: 'bg-transparent text-slate-200 hover:bg-slate-800 border border-slate-700',
  }

  return (
    <button
      type={type}
      disabled={disabled}
      className={`${baseClass} ${variants[variant] || variants.primary} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
