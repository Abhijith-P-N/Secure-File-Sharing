import { useEffect, useState } from 'react'
import { FileText, HardDrive, ShieldAlert, Users } from 'lucide-react'
import StatCard from '../components/dashboard/StatCard'
import Loader from '../components/common/Loader'
import Alert from '../components/common/Alert'
import EmptyState from '../components/common/EmptyState'
import Badge from '../components/common/Badge'
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
    return <div className="py-16"><Alert title="Admin data unavailable" message={error || 'No statistics returned.'} tone="danger" /></div>
  }

  const cards = [
    { title: 'Total Users', value: stats.users, hint: 'Registered', icon: Users, tone: 'info' },
    { title: 'Total Files', value: stats.files, hint: 'Stored encrypted', icon: FileText, tone: 'success' },
    { title: 'Total Storage', value: formatBytes(stats.bytes), hint: 'Encrypted space', icon: HardDrive, tone: 'warning' },
    { title: 'Active Shares', value: stats.activeShares, hint: 'Live', icon: ShieldAlert, tone: 'info' },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[28px] font-semibold text-ink tracking-tight">Admin Dashboard</h1>
        <p className="mt-1 text-[14px] text-muted">Platform overview and security events.</p>
      </div>

      {error ? <Alert title="Notice" message={error} tone="warning" /> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      <div className="rounded-[12px] border border-border bg-surface p-6">
        <div className="mb-5">
          <h2 className="text-[17px] font-semibold text-ink">Security Events</h2>
          <p className="mt-0.5 text-[13px] text-muted">Failed logins, unauthorized access, and revoked link usage.</p>
        </div>

        {events.length ? (
          <div className="overflow-hidden rounded-[10px] border border-border">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-border bg-bg text-[12px] font-medium uppercase tracking-wider text-muted">
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Target</th>
                  <th className="px-4 py-3">Result</th>
                  <th className="px-4 py-3">IP</th>
                  <th className="px-4 py-3">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {events.slice(0, 20).map((event) => (
                  <tr key={event.id} className="hover:bg-surface-hover/50 transition-colors duration-100">
                    <td className="px-4 py-3 font-medium text-ink">{event.action}</td>
                    <td className="px-4 py-3 text-muted">{event.file || event.resourceType || '—'}</td>
                    <td className="px-4 py-3">
                      <Badge tone="danger">{event.result}</Badge>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-muted">{event.ip || '—'}</td>
                    <td className="px-4 py-3 text-[12px] text-muted">{formatDate(event.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No security events"
            message="Failed logins and revoked link usage will appear here."
          />
        )}
      </div>
    </div>
  )
}
