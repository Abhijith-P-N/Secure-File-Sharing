import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  FileText,
  Link2,
  ShieldCheck,
  Settings,
  LogOut,
  Menu,
  X,
  Upload,
  Sun,
  Moon,
  Search,
  ChevronDown,
  Users,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useTheme } from '../../context/ThemeContext.jsx'

const navItems = [
  { label: 'Dashboard', to: '/dashboard', icon: BarChart3 },
  { label: 'My Files', to: '/files', icon: FileText },
  { label: 'Shared Links', to: '/shares', icon: Link2 },
  { label: 'Audit Logs', to: '/logs', icon: ShieldCheck },
  { label: 'Settings', to: '/profile', icon: Settings },
]

const adminItem = { label: 'Admin', to: '/admin', icon: Users }

export default function DashboardLayout() {
  const { user, logout } = useAuth()
  const { darkMode, toggleDarkMode } = useTheme()
  const navigate = useNavigate()
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)

  const isAdmin = user?.role === 'admin'
  const allNavItems = isAdmin ? [...navItems, adminItem] : navItems

  const handleLogout = async () => {
    setUserDropdownOpen(false)
    await logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-bg text-ink flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-[208px] shrink-0 flex-col justify-between bg-sidebar border-r border-white/[0.06]">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="px-5 pt-6 pb-5">
            <Link to="/dashboard" className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary">
                <ShieldCheck className="h-[18px] w-[18px] text-white" />
              </div>
              <div className="min-w-0">
                <span className="block text-[15px] font-semibold text-white leading-tight">VaultGuard</span>
                <span className="block text-[11px] text-sidebar-ink leading-tight mt-px">Secure What Matters</span>
              </div>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 mt-1 space-y-0.5">
            {allNavItems.map(({ label, to, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-[14px] font-medium transition-colors duration-150 ${
                    isActive
                      ? 'bg-primary text-white'
                      : 'text-sidebar-ink hover:text-white hover:bg-white/[0.06]'
                  }`
                }
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Bottom security tagline */}
          <div className="px-5 pb-6">
            <div className="rounded-[10px] bg-white/[0.04] border border-white/[0.06] px-3.5 py-3">
              <p className="text-[13px] font-medium text-white/80 leading-snug">Stronger Security.<br />A Safer You.</p>
            </div>
            <p className="mt-3 text-[11px] text-sidebar-ink/60">VaultGuard v1.0.0</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-surface px-5 h-[60px] lg:px-8">
          {/* Left: mobile menu + logo + search */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface-hover lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link to="/dashboard" className="flex items-center gap-2 lg:hidden">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <ShieldCheck className="h-4 w-4 text-white" />
              </div>
              <span className="text-[15px] font-semibold text-ink">VaultGuard</span>
            </Link>

            {/* Search */}
            <div className="hidden sm:flex items-center max-w-md flex-1">
              <div className="relative w-full">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-muted" />
                <input
                  type="text"
                  placeholder="Search files, events, or metadata..."
                  className="w-full rounded-[10px] border border-border bg-bg py-2 pl-10 pr-4 text-[14px] text-ink placeholder:text-muted-dim transition-colors duration-150 focus:border-primary focus:outline-none focus:ring-0"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-border bg-surface px-1.5 py-0.5 text-[11px] font-medium text-muted">
                  Ctrl K
                </span>
              </div>
            </div>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-1.5">
            <Link
              to="/upload"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-[10px] bg-primary px-3.5 py-2 text-[13px] font-medium text-white hover:bg-primary-hover transition-colors duration-150"
            >
              <Upload className="h-4 w-4" />
              Upload
            </Link>

            <button
              type="button"
              onClick={toggleDarkMode}
              className="hidden sm:flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:text-ink hover:bg-surface-hover transition-colors duration-150"
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-pressed={darkMode}
            >
              {darkMode ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
            </button>

            {/* User dropdown */}
            <div className="relative ml-1">
              <button
                type="button"
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-surface-hover transition-colors duration-150"
                aria-label="User menu"
                aria-expanded={userDropdownOpen}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-[13px] font-semibold text-white uppercase">
                  {(user?.name || user?.email || 'U')[0]}
                </div>
                <span className="hidden md:block max-w-[120px] truncate text-[13px] font-medium text-ink">
                  {user?.name || 'User'}
                </span>
                <ChevronDown className="hidden md:block h-4 w-4 text-muted" />
              </button>

              {userDropdownOpen ? (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setUserDropdownOpen(false)} />
                  <div className="absolute right-0 top-full mt-1.5 z-50 w-56 rounded-[10px] border border-border bg-surface shadow-[0_4px_16px_rgba(16,24,40,0.12)] py-1.5">
                    <div className="px-3.5 py-2.5 border-b border-border">
                      <p className="text-[13px] font-medium text-ink truncate">{user?.name || 'User'}</p>
                      <p className="text-[12px] text-muted truncate">{user?.email}</p>
                    </div>
                    <Link
                      to="/profile"
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-ink hover:bg-surface-hover"
                    >
                      <Settings className="h-4 w-4 text-muted" />
                      Settings
                    </Link>
                    <button
                      type="button"
                      onClick={toggleDarkMode}
                      className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[13px] text-ink hover:bg-surface-hover"
                    >
                      {darkMode ? <Sun className="h-4 w-4 text-muted" /> : <Moon className="h-4 w-4 text-muted" />}
                      {darkMode ? 'Light mode' : 'Dark mode'}
                    </button>
                    <div className="my-1.5 border-t border-border" />
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[13px] text-danger hover:bg-danger-bg"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-5 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      {/* Mobile Drawer */}
      {mobileDrawerOpen ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-ink/30 backdrop-blur-sm"
            onClick={() => setMobileDrawerOpen(false)}
          />
          <div className="relative z-10 flex w-[260px] max-w-[85vw] flex-col bg-sidebar shadow-[4px_0_20px_rgba(0,0,0,0.15)]">
            <div className="flex items-center justify-between px-5 py-5">
              <Link to="/dashboard" className="flex items-center gap-2.5" onClick={() => setMobileDrawerOpen(false)}>
                <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary">
                  <ShieldCheck className="h-[18px] w-[18px] text-white" />
                </div>
                <div>
                  <span className="block text-[15px] font-semibold text-white leading-tight">VaultGuard</span>
                  <span className="block text-[11px] text-sidebar-ink leading-tight">Secure What Matters</span>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                className="rounded-lg p-1.5 text-sidebar-ink hover:text-white"
                aria-label="Close navigation"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 px-3 space-y-0.5">
              {allNavItems.map(({ label, to, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setMobileDrawerOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[14px] font-medium transition-colors duration-150 ${
                      isActive
                        ? 'bg-primary text-white'
                        : 'text-sidebar-ink hover:text-white hover:bg-white/[0.06]'
                    }`
                  }
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  {label}
                </NavLink>
              ))}
            </nav>

            <div className="px-3 pb-5 space-y-3">
              <div className="flex items-center gap-3 rounded-[10px] bg-white/[0.04] border border-white/[0.06] px-3.5 py-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-[13px] font-semibold text-white uppercase shrink-0">
                  {(user?.name || user?.email || 'U')[0]}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-white">{user?.name || user?.email || 'User'}</p>
                  <p className="truncate text-[11px] text-sidebar-ink">{user?.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center justify-center gap-2 rounded-[10px] border border-white/10 py-2.5 text-[13px] font-medium text-white/80 hover:bg-white/[0.06] transition-colors duration-150"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
