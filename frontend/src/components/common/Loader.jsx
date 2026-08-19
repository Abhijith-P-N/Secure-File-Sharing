export default function Loader({ label = 'Loading...', size = 'md' }) {
  const sizes = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-10 w-10',
  }

  return (
    <div className="flex items-center justify-center gap-3 py-4 text-slate-300" role="status" aria-live="polite">
      <span className={`inline-block animate-spin rounded-full border-2 border-slate-600 border-t-cyan-400 ${sizes[size] || sizes.md}`} />
      <span className="text-sm">{label}</span>
    </div>
  )
}
