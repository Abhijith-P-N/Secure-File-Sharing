export default function IconButton({
  icon: Icon,
  label,
  onClick,
  size = 'md',
  variant = 'ghost',
  disabled = false,
  className = '',
  ...props
}) {
  const sizes = {
    sm: 'h-8 w-8',
    md: 'h-9 w-9',
    lg: 'h-10 w-10',
  }

  const iconSizes = {
    sm: 'h-[18px] w-[18px]',
    md: 'h-5 w-5',
    lg: 'h-5 w-5',
  }

  const variants = {
    ghost: 'text-muted hover:text-ink hover:bg-surface-hover',
    secondary: 'text-ink bg-surface border border-border hover:bg-surface-hover',
    danger: 'text-danger hover:bg-danger-bg',
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center rounded-lg transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-55 ${sizes[size]} ${variants[variant]} ${className}`}
      {...props}
    >
      <Icon className={iconSizes[size]} />
    </button>
  )
}