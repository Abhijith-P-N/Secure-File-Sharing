import { Download, FileText, HardDrive, ShieldAlert, Users } from 'lucide-react'
import StatCard from '../components/dashboard/StatCard'

const mockStats = [
  { title: 'Total users', value: '128', hint: 'Live', icon: Users, tone: 'info' },
  { title: 'Total files', value: '2,481', hint: 'Stored', icon: FileText, tone: 'success' },
  { title: 'Total storage', value: '82 GB', hint: 'Used', icon: HardDrive, tone: 'warning' },
  { title: 'Downloads', value: '1,942', hint: 'This month', icon: Download, tone: 'default' },
  { title: 'Active shares', value: '39', hint: 'Live', icon: ShieldAlert, tone: 'danger' },
  { title: 'Security events', value: '14', hint: 'Last 24h', icon: ShieldAlert, tone: 'info' },
]

export default function AdminPage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">Admin dashboard</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Platform overview</h1>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {mockStats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
        <h2 className="text-xl font-semibold text-white">Design note</h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          This admin UI is designed for an admin API that is not yet part of the provided backend contract. Values are clearly marked as mock design data pending backend support.
        </p>
      </div>
    </div>
  )
}
