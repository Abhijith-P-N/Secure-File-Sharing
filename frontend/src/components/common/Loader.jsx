export default function Loader({ label = 'Loading...', size = 'md' }) {
  const sizes = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-8 w-8',
  }

  return (
    <div className="flex items-center justify-center gap-3 py-16 text-muted" role="status" aria-live="polite">
      <span
        className={`inline-block animate-spin rounded-full border-2 border-border border-t-primary ${sizes[size] || sizes.md}`}
      />
      <span className="text-sm">{label}</span>
    </div>
  )
}
