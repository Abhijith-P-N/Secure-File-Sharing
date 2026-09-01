import { useState } from 'react'
import { LogOut, ShieldCheck, User, Lock, Bell, HardDrive, Palette } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../context/ThemeContext'
import Button from '../components/common/Button'
import Toggle from '../components/common/Toggle'
import { useNavigate } from 'react-router-dom'

export default function ProfilePage() {
  const { user, logout } = useAuth()
  const { darkMode, toggleDarkMode } = useTheme()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('profile')

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'preferences', label: 'Preferences', icon: Palette },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-semibold text-ink tracking-tight">Settings</h1>
        <p className="mt-1 text-[14px] text-muted">Manage your account and application preferences.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        {/* Sidebar tabs */}
        <div className="rounded-[12px] border border-border bg-surface p-2">
          <nav className="space-y-0.5">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[14px] font-medium transition-colors duration-150 text-left ${
                  activeTab === id
                    ? 'bg-primary-soft text-primary'
                    : 'text-muted hover:bg-surface-hover hover:text-ink'
                }`}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab content */}
        <div className="space-y-6">
          {activeTab === 'profile' && (
            <>
              <div className="rounded-[12px] border border-border bg-surface p-6">
                <div className="flex items-center gap-5">
                  <div className="flex h-16 w-16 items-center justify-center rounded-[12px] bg-primary-soft text-primary">
                    <User className="h-8 w-8" />
                  </div>
                  <div>
                    <p className="text-[20px] font-semibold text-ink">{user?.name || 'User'}</p>
                    <p className="text-[14px] text-muted">{user?.email || 'user@example.com'}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[12px] border border-border bg-surface p-6">
                <h2 className="text-[17px] font-semibold text-ink mb-4">Account Details</h2>
                <div className="space-y-4 rounded-[10px] border border-border bg-bg p-4">
                  <div className="flex items-center justify-between text-[14px]">
                    <span className="text-muted">Status</span>
                    <span className="flex items-center gap-1.5 text-success font-medium">
                      <ShieldCheck className="h-4 w-4" />
                      Authenticated
                    </span>
                  </div>
                  <div className="border-t border-border" />
                  <div className="flex items-center justify-between text-[14px]">
                    <span className="text-muted">Name</span>
                    <span className="text-ink">{user?.name || '—'}</span>
                  </div>
                  <div className="border-t border-border" />
                  <div className="flex items-center justify-between text-[14px]">
                    <span className="text-muted">Email</span>
                    <span className="text-ink">{user?.email || '—'}</span>
                  </div>
                  <div className="border-t border-border" />
                  <div className="flex items-center justify-between text-[14px]">
                    <span className="text-muted">Role</span>
                    <span className="text-ink capitalize">{user?.role || 'User'}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="danger" onClick={handleLogout} className="gap-1.5">
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </Button>
              </div>
            </>
          )}

          {activeTab === 'security' && (
            <>
              <div className="rounded-[12px] border border-border bg-surface p-6">
                <h2 className="text-[17px] font-semibold text-ink">Security Settings</h2>
                <p className="mt-1 text-[13px] text-muted">Manage password, authentication, and session controls.</p>
                <div className="mt-5 space-y-3">
                  <Toggle label="Two-factor authentication" description="Add an extra layer of security to your account" checked={false} onChange={() => {}} />
                  <div className="rounded-[10px] border border-border bg-bg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[14px] font-medium text-ink">Password</p>
                        <p className="text-[12px] text-muted">Last changed: Unknown</p>
                      </div>
                      <Button variant="ghost" size="sm">Change password</Button>
                    </div>
                  </div>
                  <div className="rounded-[10px] border border-border bg-bg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[14px] font-medium text-ink">Active Sessions</p>
                        <p className="text-[12px] text-muted">Manage your active login sessions</p>
                      </div>
                      <Button variant="ghost" size="sm">View sessions</Button>
                    </div>
                  </div>
                  <Toggle label="Login alerts" description="Receive alerts for new sign-ins to your account" checked={true} onChange={() => {}} />
                </div>
              </div>
            </>
          )}

          {activeTab === 'notifications' && (
            <div className="rounded-[12px] border border-border bg-surface p-6">
              <h2 className="text-[17px] font-semibold text-ink">Notification Preferences</h2>
              <p className="mt-1 text-[13px] text-muted">Choose what notifications you receive.</p>
              <div className="mt-5 space-y-3">
                <Toggle label="File upload notifications" description="Get notified when files are uploaded" checked={true} onChange={() => {}} />
                <Toggle label="Share link activity" description="Notifications for share link usage" checked={true} onChange={() => {}} />
                <Toggle label="Security alerts" description="Critical security event notifications" checked={true} onChange={() => {}} />
                <Toggle label="Weekly activity digest" description="Summary of your weekly vault activity" checked={false} onChange={() => {}} />
              </div>
            </div>
          )}

          {activeTab === 'preferences' && (
            <div className="rounded-[12px] border border-border bg-surface p-6">
              <h2 className="text-[17px] font-semibold text-ink">Preferences</h2>
              <p className="mt-1 text-[13px] text-muted">Customize your VaultGuard experience.</p>
              <div className="mt-5 space-y-3">
                <Toggle label="Dark mode" description="Use dark theme across the application" checked={darkMode} onChange={toggleDarkMode} />
                <div className="rounded-[10px] border border-border bg-bg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[14px] font-medium text-ink">Storage</p>
                      <p className="text-[12px] text-muted">VaultGuard v1.0.0</p>
                    </div>
                    <HardDrive className="h-5 w-5 text-muted" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
