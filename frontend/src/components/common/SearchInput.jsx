import { Search, X } from 'lucide-react'

export default function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  className = '',
}) {
  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute inset-y-0 left-3 my-auto h-[18px] w-[18px] text-muted" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-[10px] border border-border bg-surface py-2 pl-10 pr-9 text-sm text-ink placeholder:text-muted-dim transition-colors duration-150 focus:border-primary focus:outline-none focus:ring-0"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted hover:text-ink"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  )
}
