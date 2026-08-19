import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  FileText,
  LogOut,
  Menu,
  Shield,
  UploadCloud,
  UserCircle2,
  Users,
  X,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import Button from '../common/Button'

const navItems = [
  { label: 'Dashboard', to: '/dashboard', icon: BarChart3 },
  { label: 'Files', to: '/files', icon: FileText },
  { label: 'Upload', to: '/upload', icon: UploadCloud },
  { label: 'Security Logs', to: '/logs', icon: Shield },
  { label: 'Profile', to: '/profile', icon: UserCircle2 },
  { label: 'Admin', to: '/admin', icon: Users },
]

export default function DashboardLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        {/* Desktop Sidebar */}
        <aside className="hidden w-72 flex-col justify-between border-r border-slate-800 bg-slate-950/90 p-5 lg:flex">
          <div>
            <Link to="/dashboard" className="flex items-center gap-3 p-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/30">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-300 font-bold">VaultGuard</p>
                <p className="text-sm font-medium text-slate-200">Security Control</p>
              </div>
            </Link>

            <nav className="mt-8 space-y-1.5">
              {navItems.map(({ label, to, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-medium transition ${
                      isActive
                        ? 'bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-500/30'
                        : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'
                    }`
                  }
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-500/20 text-xs font-bold text-cyan-300 uppercase">
                {(user?.name || user?.email || 'U')[0]}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs uppercase tracking-[0.18em] text-slate-400">Signed in</p>
                <p className="truncate text-sm font-medium text-slate-100">{user?.name || user?.email || 'Secure User'}</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl">
            <div className="flex items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMobileDrawerOpen(true)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 ring-1 ring-slate-700 text-slate-300 hover:text-white lg:hidden"
                  aria-label="Open sidebar navigation"
                >
                  <Menu className="h-5 w-5" />
                </button>
                <Link to="/dashboard" className="flex items-center gap-2 lg:hidden">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/30">
                    <Shield className="h-4 w-4" />
                  </div>
                  <span className="font-semibold text-white">VaultGuard</span>
                </Link>
                <div className="hidden lg:block">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Workspace</p>
                  <h1 className="text-base font-semibold text-white">Encrypted File Sharing & Vault</h1>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Link
                  to="/upload"
                  className="hidden rounded-full border border-slate-700 bg-slate-900/60 px-3.5 py-1.5 text-xs text-slate-200 hover:border-slate-500 hover:text-white sm:block"
                >
                  Upload File
                </Link>
                <Link
                  to="/files"
                  className="hidden rounded-full border border-slate-700 bg-slate-900/60 px-3.5 py-1.5 text-xs text-slate-200 hover:border-slate-500 hover:text-white sm:block"
                >
                  My files
                </Link>
                <Button variant="secondary" onClick={handleLogout} className="gap-2 text-xs py-1.5">
                  <LogOut className="h-3.5 w-3.5" />
                  Logout
                </Button>
              </div>
            </div>
          </header>

          <main className="p-4 sm:p-6 lg:p-8 flex-1">
            <Outlet />
          </main>
        </div>
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileDrawerOpen ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
            onClick={() => setMobileDrawerOpen(false)}
          />
          <div className="relative z-10 flex w-72 max-w-[85vw] flex-col justify-between bg-slate-950 border-r border-slate-800 p-5 shadow-2xl">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/30">
                    <Shield className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-cyan-300 font-bold">VaultGuard</p>
                    <p className="text-xs text-slate-400">Security Control</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="rounded-lg border border-slate-800 p-1.5 text-slate-400 hover:text-white"
                  aria-label="Close navigation drawer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <nav className="mt-8 space-y-1.5">
                {navItems.map(({ label, to, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={() => setMobileDrawerOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-medium transition ${
                        isActive
                          ? 'bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-500/30'
                          : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'
                      }`
                    }
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </NavLink>
                ))}
              </nav>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500/20 text-xs font-bold text-cyan-300 uppercase">
                    {(user?.name || user?.email || 'U')[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-slate-100">{user?.name || user?.email || 'User'}</p>
                    <p className="truncate text-[10px] text-slate-400">{user?.email}</p>
                  </div>
                </div>
              </div>

              <Button
                variant="secondary"
                fullWidth
                onClick={handleLogout}
                className="justify-center gap-2 text-xs"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

