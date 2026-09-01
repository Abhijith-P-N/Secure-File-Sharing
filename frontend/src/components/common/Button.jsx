export default function Button({
  children,
  type = 'button',
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  className = '',
  ariaLabel,
  ariaPressed,
  ariaExpanded,
  ariaControls,
  ...props
}) {
  const baseClass =
    'inline-flex items-center justify-center rounded-[10px] font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-55'

  const variants = {
    primary: 'bg-primary text-white hover:bg-primary-hover shadow-[0_1px_2px_rgba(16,24,40,0.08)]',
    secondary:
      'bg-surface text-ink border border-border hover:bg-surface-hover hover:border-border-hover',
    danger: 'bg-danger text-white hover:bg-danger/90',
    'danger-soft':
      'bg-danger-bg text-danger border border-danger/20 hover:bg-danger/10',
    ghost: 'bg-transparent text-ink hover:bg-surface-hover',
    'primary-soft': 'bg-primary-soft text-primary hover:bg-primary/10',
  }

  const sizes = {
    sm: 'px-3 py-1.5 text-xs rounded-lg',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-5 py-3 text-sm',
  }

  return (
    <button
      type={type}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      aria-expanded={ariaExpanded}
      aria-controls={ariaControls}
      className={`${baseClass} ${sizes[size] || sizes.md} ${variants[variant] || variants.primary} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
