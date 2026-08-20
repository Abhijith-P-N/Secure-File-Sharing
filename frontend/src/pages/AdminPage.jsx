import { useEffect, useState } from 'react'
import { Download, FileText, HardDrive, ShieldAlert, Users } from 'lucide-react'
import StatCard from '../components/dashboard/StatCard'
import Loader from '../components/common/Loader'
import Alert from '../components/common/Alert'
import EmptyState from '../components/common/EmptyState'
import { formatBytes, formatDate } from '../utils/formatters'
import { getSecurityEvents, getStats } from '../services/adminService'

export default function AdminPage() {
  const [stats, setStats] = useState(null)
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const [statsData, eventsData] = await Promise.all([
          getStats(),
          getSecurityEvents().catch(() => []),
        ])
        setStats(statsData)
        setEvents(eventsData)
      } catch (err) {
        setError(err?.message || 'Unable to load admin data.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return <Loader label="Loading admin dashboard..." />

  if (!stats) {
    return <Alert title="Admin data unavailable" message={error || 'No statistics returned.'} tone="danger" />
  }

  const cards = [
    { title: 'Total users', value: stats.users, hint: 'Registered', icon: Users, tone: 'info' },
    { title: 'Total files', value: stats.files, hint: 'Stored encrypted', icon: FileText, tone: 'success' },
    { title: 'Total storage', value: formatBytes(stats.bytes), hint: 'Encrypted space', icon: HardDrive, tone: 'warning' },
    { title: 'Total downloads', value: stats.downloads, hint: 'All time', icon: Download, tone: 'default' },
    { title: 'Active shares', value: stats.activeShares, hint: 'Live', icon: ShieldAlert, tone: 'danger' },
    { title: 'Expired shares', value: stats.expiredShares, hint: 'Expired', icon: ShieldAlert, tone: 'warning' },
    { title: 'Security events', value: stats.failedSecurityEvents, hint: 'Failed / denied', icon: ShieldAlert, tone: 'info' },
  ]

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">Admin dashboard</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Platform overview</h1>
      </div>

      {error ? <Alert title="Admin notice" message={error} tone="warning" /> : null}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Security events</h2>
            <p className="text-xs text-slate-400">Failed logins, unauthorized access, expired and revoked link usage</p>
          </div>
        </div>

        {events.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs uppercase tracking-[0.18em] text-slate-400">
                  <th className="px-3 py-2.5">Action</th>
                  <th className="px-3 py-2.5">Target</th>
                  <th className="px-3 py-2.5">Result</th>
                  <th className="px-3 py-2.5">IP</th>
                  <th className="px-3 py-2.5">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {events.slice(0, 20).map((event) => (
                  <tr key={event.id} className="text-slate-300">
                    <td className="px-3 py-3 font-medium text-slate-100">{event.action}</td>
                    <td className="px-3 py-3 text-slate-400">{event.file || event.resourceType || '—'}</td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-300">
                        {event.result}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-400">{event.ip || '—'}</td>
                    <td className="px-3 py-3 text-xs text-slate-400">{formatDate(event.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No security events"
            message="Failed logins, unauthorized accesses, and revoked link usage will appear here."
          />
        )}
      </div>
    </div>
  )
}