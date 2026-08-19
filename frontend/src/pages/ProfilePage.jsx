import { LogOut, ShieldCheck, UserCircle2 } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

import Button from '../components/common/Button'

export default function ProfilePage() {
  const { user, logout } = useAuth()

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">Profile</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Account details</h1>
      </div>

      <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-500/30">
            <UserCircle2 className="h-8 w-8" />
          </div>
          <div>
            <p className="text-2xl font-semibold text-white">{user?.name || 'Secure User'}</p>
            <p className="text-sm text-slate-400">{user?.email || 'user@secure-share.local'}</p>
          </div>
        </div>

        <div className="mt-6 space-y-4 rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Status</span>
            <span className="inline-flex items-center gap-2 text-emerald-300">
              <ShieldCheck className="h-4 w-4" />
              Authenticated
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Role</span>
            <span className="text-slate-200">User</span>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <Button variant="secondary" className="gap-2">
            Edit profile
          </Button>
          <Button variant="danger" onClick={logout} className="gap-2">
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>
    </div>
  )
}
