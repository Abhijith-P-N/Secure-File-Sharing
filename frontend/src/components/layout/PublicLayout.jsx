import { useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { ShieldCheck, Menu, X, Lock } from 'lucide-react'

export default function PublicLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-surface/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary">
              <ShieldCheck className="h-[18px] w-[18px] text-white" />
            </div>
            <span className="text-[15px] font-semibold text-ink">VaultGuard</span>
          </Link>

          <nav className="hidden items-center gap-8 text-[14px] text-muted md:flex">
            <Link to="/" className="hover:text-ink transition-colors duration-150">Home</Link>
            <Link to="/login" className="hover:text-ink transition-colors duration-150">Sign In</Link>
            <Link to="/register" className="hover:text-ink transition-colors duration-150">Register</Link>
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <span className="inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-surface px-3 py-1.5 text-[12px] font-medium text-muted">
              <Lock className="h-3.5 w-3.5 text-primary" />
              End-to-end protected
            </span>
            <Link
              to="/login"
              className="rounded-[10px] bg-primary px-4 py-2 text-[13px] font-medium text-white hover:bg-primary-hover transition-colors duration-150"
            >
              Sign in
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="rounded-lg border border-border p-2 text-muted hover:text-ink md:hidden"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileMenuOpen ? (
          <div className="border-t border-border bg-surface px-4 py-3 md:hidden space-y-1">
            <Link to="/" onClick={() => setMobileMenuOpen(false)} className="block rounded-[10px] px-3 py-2.5 text-[14px] text-muted hover:bg-surface-hover hover:text-ink">
              Home
            </Link>
            <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="block rounded-[10px] px-3 py-2.5 text-[14px] text-muted hover:bg-surface-hover hover:text-ink">
              Sign In
            </Link>
            <Link to="/register" onClick={() => setMobileMenuOpen(false)} className="block rounded-[10px] px-3 py-2.5 text-[14px] text-muted hover:bg-surface-hover hover:text-ink">
              Register
            </Link>
          </div>
        ) : null}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 flex items-center justify-between text-[12px] text-muted">
          <span>&copy; {new Date().getFullYear()} VaultGuard. All rights reserved.</span>
          <span className="flex items-center gap-1.5"><Lock className="h-3 w-3 text-primary" /> Secured with encryption</span>
        </div>
      </footer>
    </div>
  )
}
