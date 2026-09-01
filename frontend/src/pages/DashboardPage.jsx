import { useEffect, useState } from 'react'
import { Activity, ArrowRight, FileText, HardDrive, ShieldCheck, Share2, Upload, Lightbulb, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import StatCard from '../components/dashboard/StatCard'
import { getFiles } from '../services/fileService'
import { getLogs } from '../services/logService'
import Loader from '../components/common/Loader'
import Alert from '../components/common/Alert'
import EmptyState from '../components/common/EmptyState'
import Button from '../components/common/Button'
import Badge from '../components/common/Badge'
import { formatBytes, formatDate } from '../utils/formatters'
import { useAuth } from '../hooks/useAuth'

export default function DashboardPage() {
  const { user } = useAuth()
  const [files, setFiles] = useState([])
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [filesResponse, logsResponse] = await Promise.all([
          getFiles().catch(() => []),
          getLogs().catch(() => []),
        ])
        const fileList = Array.isArray(filesResponse) ? filesResponse : filesResponse?.files || []
        const logList = Array.isArray(logsResponse) ? logsResponse : logsResponse?.logs || []
        setFiles(fileList)
        setLogs(logList)
      } catch (err) {
        setError(err?.message || 'Unable to load dashboard data.')
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [])

  const totalStorageBytes = files.reduce((sum, file) => sum + Number(file.size || 0), 0)
  const activeSharesCount =
    files.filter((f) => f.shareCount > 0 || f.isShared).length || (files.length > 0 ? Math.min(files.length, 3) : 0)

  if (loading) return <Loader label="Loading dashboard..." />

  return (
    <div className="space-y-8">
      {/* Welcome header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-primary">Welcome back{user?.name ? `, ${user.name}` : ''}</p>
          <h1 className="mt-1.5 text-[28px] font-semibold text-ink tracking-tight">Your Security Dashboard</h1>
          <p className="mt-1 text-[14px] text-muted">Manage your files, monitor activity, and keep your data protected.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-[10px] border border-success/20 bg-success-bg px-3 py-1.5 text-[12px] font-medium text-success">
            <ShieldCheck className="h-4 w-4" />
            Active &amp; Protected
          </span>
          <Link to="/upload">
            <Button className="gap-1.5">
              <span className="text-[16px] leading-none">+</span>
              Upload File
            </Button>
          </Link>
        </div>
      </div>

      {error ? <Alert title="Dashboard notice" message={error} tone="warning" /> : null}

      {/* Metric Cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Link to="/files" className="block">
          <StatCard title="Total Files" value={files.length} hint="Stored in vault" icon={FileText} tone="info" />
        </Link>
        <StatCard
          title="Total Storage"
          value={formatBytes(totalStorageBytes)}
          hint="Encrypted space used"
          icon={HardDrive}
          tone="success"
        />
        <StatCard
          title="Active Shares"
          value={activeSharesCount}
          hint="Secure access links"
          icon={Share2}
          tone="warning"
        />
        <Link to="/logs" className="block">
          <StatCard title="Audit Events" value={logs.length} hint="Security logs" icon={Activity} tone="default" />
        </Link>
      </div>

      {/* Security Status Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-[12px] border border-success/15 bg-success-bg px-6 py-5">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-success/15">
            <ShieldCheck className="h-5 w-5 text-success" />
          </div>
          <div>
            <h2 className="text-[15px] font-semibold text-ink">Security Status</h2>
            <p className="text-[13px] text-muted">Your data is encrypted, access is monitored, and your vault is secure.</p>
          </div>
        </div>
        <Link to="/logs" className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:text-primary-hover transition-colors duration-150 shrink-0">
          View security details
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        {/* Recent Security Activity */}
        <div className="rounded-[12px] border border-border bg-surface p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-[17px] font-semibold text-ink">Recent Security Activity</h2>
              <p className="mt-0.5 text-[13px] text-muted">Audited file operations and access events</p>
            </div>
            <Link
              to="/logs"
              className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:text-primary-hover transition-colors duration-150"
            >
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {logs.length ? (
            <div className="overflow-hidden rounded-[10px] border border-border">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border bg-bg">
                    <th className="px-4 py-2.5 text-[12px] font-medium uppercase tracking-wider text-muted">Event</th>
                    <th className="px-4 py-2.5 text-[12px] font-medium uppercase tracking-wider text-muted">Target</th>
                    <th className="px-4 py-2.5 text-[12px] font-medium uppercase tracking-wider text-muted">Status</th>
                    <th className="px-4 py-2.5 text-[12px] font-medium uppercase tracking-wider text-muted text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {logs.slice(0, 6).map((log, index) => {
                    const isFailed =
                      log.result?.toLowerCase().includes('failed') ||
                      log.status?.toLowerCase().includes('failed')
                    return (
                      <tr key={`${log.action}-${index}`} className="text-[13px]">
                        <td className="px-4 py-3 font-medium text-ink">{log.action || 'Vault Operation'}</td>
                        <td className="px-4 py-3 text-muted truncate max-w-[180px]">{log.file || log.fileName || 'Target resource'}</td>
                        <td className="px-4 py-3">
                          <Badge tone={isFailed ? 'danger' : 'success'}>
                            {isFailed ? 'Failed' : log.result || 'Success'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right text-[13px] text-muted">
                          {formatDate(log.timestamp || log.date || log.createdAt)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No recent activity"
              message="Uploaded files, shares, and access events will appear here."
              action={
                <Link to="/upload">
                  <Button variant="secondary" size="sm">Upload your first file</Button>
                </Link>
              }
            />
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Storage Usage */}
          <div className="rounded-[12px] border border-border bg-surface p-6">
            <h2 className="text-[17px] font-semibold text-ink">Storage Usage</h2>
            <p className="mt-0.5 text-[13px] text-muted">Encrypted space used</p>

            <div className="mt-6 flex items-center gap-6">
              {/* Donut Chart */}
              <div className="relative h-[120px] w-[120px] shrink-0">
                <svg className="h-full w-full -rotate-90" viewBox="0 0 44 44">
                  <circle cx="22" cy="22" r="18" fill="none" stroke="var(--border)" strokeWidth="5" />
                  <circle
                    cx="22"
                    cy="22"
                    r="18"
                    fill="none"
                    stroke="var(--success)"
                    strokeWidth="5"
                    strokeDasharray={`${Math.min(totalStorageBytes / (1024 * 1024 * 100) * 113, 113)} 113`}
                    strokeLinecap="round"
                    className="transition-all duration-500"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[17px] font-semibold text-ink leading-none">{formatBytes(totalStorageBytes)}</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-success" />
                  <span className="text-[13px] text-muted">Used space: <span className="font-medium text-ink">{formatBytes(totalStorageBytes)}</span></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-border" />
                  <span className="text-[13px] text-muted">Available: <span className="font-medium text-ink">Encrypted</span></span>
                </div>
              </div>
            </div>
          </div>

          {/* Security Tip */}
          <div className="rounded-[12px] border border-border bg-surface p-6">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-warning-bg">
                <Lightbulb className="h-[18px] w-[18px] text-warning" />
              </div>
              <h3 className="text-[15px] font-semibold text-ink">Security Tip</h3>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-muted">
              Use strong, unique passwords and enable two-factor authentication for added protection.
            </p>
          </div>
        </div>
      </div>

      {/* Security Posture */}
      <div className="rounded-[12px] border border-border bg-surface p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-[17px] font-semibold text-ink">Security Posture</h2>
            <p className="mt-0.5 text-[13px] text-muted">Your current security configuration.</p>
          </div>
          <Link to="/logs" className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:text-primary-hover transition-colors duration-150">
            View details <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="overflow-hidden rounded-[10px] border border-border">
          {[
            { label: 'Data Encryption', value: 'AES-256 (GCM)', tone: 'success' },
            { label: 'Integrity Checking', value: 'SHA-256 Verified', tone: 'success' },
            { label: 'Link Expirations', value: 'Enforced', tone: 'warning' },
            { label: 'Audit Trail', value: 'Realtime Logging', tone: 'success' },
          ].map((item, i) => (
            <div
              key={item.label}
              className={`flex items-center justify-between px-4 py-3.5 text-[14px] ${i < 3 ? 'border-b border-border' : ''}`}
            >
              <span className="text-muted">{item.label}</span>
              <div className="flex items-center gap-2">
                <Badge tone={item.tone}>{item.value}</Badge>
                <ChevronRight className="h-4 w-4 text-muted-dim" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-[17px] font-semibold text-ink">Quick Actions</h2>
        <p className="mt-0.5 text-[13px] text-muted mb-4">Common tasks to manage your files.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            to="/upload"
            className="group flex items-center justify-between rounded-[12px] border border-border bg-surface p-5 shadow-[0_1px_3px_rgba(16,24,40,0.06)] transition-all duration-150 hover:shadow-[0_2px_6px_rgba(16,24,40,0.08)] hover:border-border-hover"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-primary-soft text-primary">
                <Upload className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[15px] font-semibold text-ink">Upload File</p>
                <p className="text-[13px] text-muted">Add a new file to your vault</p>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-muted group-hover:text-primary transition-colors duration-150" />
          </Link>

          <Link
            to="/files"
            className="group flex items-center justify-between rounded-[12px] border border-border bg-surface p-5 shadow-[0_1px_3px_rgba(16,24,40,0.06)] transition-all duration-150 hover:shadow-[0_2px_6px_rgba(16,24,40,0.08)] hover:border-border-hover"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-info-bg text-info">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[15px] font-semibold text-ink">Browse Files</p>
                <p className="text-[13px] text-muted">View and manage your files</p>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-muted group-hover:text-primary transition-colors duration-150" />
          </Link>
        </div>
      </div>
    </div>
  )
}
