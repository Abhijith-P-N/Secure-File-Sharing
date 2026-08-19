import { useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { LockKeyhole, Menu, ShieldCheck, X } from 'lucide-react'

export default function PublicLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="sticky top-0 z-40 border-b border-slate-800/90 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/30">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold tracking-[0.2em] text-cyan-300 uppercase">VaultGuard</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-8 text-sm text-slate-300 md:flex">
            <Link to="/" className="transition hover:text-white">Home</Link>
            <Link to="/login" className="transition hover:text-white">Sign In</Link>
            <Link to="/register" className="transition hover:text-white">Register</Link>
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <div className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/75 px-3 py-1.5 text-xs text-slate-300">
              <LockKeyhole className="h-3.5 w-3.5 text-cyan-300" />
              End-to-end protected
            </div>
            <Link to="/login" className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-400 transition">
              Sign in
            </Link>
          </div>

          <div className="flex md:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="rounded-xl border border-slate-800 bg-slate-900 p-2 text-slate-300 hover:text-white"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen ? (
          <div className="border-t border-slate-800 bg-slate-950/95 px-4 py-4 md:hidden space-y-3">
            <Link
              to="/"
              onClick={() => setMobileMenuOpen(false)}
              className="block rounded-xl px-3 py-2 text-sm text-slate-300 hover:bg-slate-900 hover:text-white"
            >
              Home
            </Link>
            <Link
              to="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="block rounded-xl px-3 py-2 text-sm text-slate-300 hover:bg-slate-900 hover:text-white"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              onClick={() => setMobileMenuOpen(false)}
              className="block rounded-xl px-3 py-2 text-sm text-slate-300 hover:bg-slate-900 hover:text-white"
            >
              Register
            </Link>
          </div>
        ) : null}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}

