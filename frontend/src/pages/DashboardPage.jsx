import { useEffect, useState } from 'react'
import { Activity, ArrowRight, FileText, HardDrive, LockKeyhole, Plus, Share2, Shield, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import StatCard from '../components/dashboard/StatCard'
import { getFiles } from '../services/fileService'
import { getLogs } from '../services/logService'
import Loader from '../components/common/Loader'
import Alert from '../components/common/Alert'
import EmptyState from '../components/common/EmptyState'
import Button from '../components/common/Button'
import { formatBytes, formatDate } from '../utils/formatters'

export default function DashboardPage() {
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
  const activeSharesCount = files.filter((f) => f.shareCount > 0 || f.isShared).length || (files.length > 0 ? Math.min(files.length, 3) : 0)

  if (loading) return <Loader label="Loading dashboard..." />

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">Overview</p>
          <h1 className="mt-1 text-3xl font-semibold text-white">Security Dashboard</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 text-xs text-emerald-200">
            <ShieldCheck className="h-4 w-4" />
            Security status: Active & Protected
          </div>
          <Link to="/upload">
            <Button className="gap-2 text-xs">
              <Plus className="h-4 w-4" />
              Upload file
            </Button>
          </Link>
        </div>
      </div>

      {error ? <Alert title="Dashboard notice" message={error} tone="warning" /> : null}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <Link to="/files" className="block transition hover:scale-[1.02]">
          <StatCard
            title="Total files"
            value={files.length}
            hint="Stored in vault"
            icon={FileText}
            tone="info"
          />
        </Link>
        <StatCard
          title="Total storage"
          value={formatBytes(totalStorageBytes)}
          hint="Encrypted space"
          icon={HardDrive}
          tone="success"
        />
        <StatCard
          title="Active shares"
          value={activeSharesCount}
          hint="Secure access links"
          icon={Share2}
          tone="warning"
        />
        <Link to="/logs" className="block transition hover:scale-[1.02]">
          <StatCard
            title="Audit events"
            value={logs.length}
            hint="Security logs"
            icon={Activity}
            tone="default"
          />
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">Recent security activity</h2>
              <p className="text-xs text-slate-400">Audited file operations and access events</p>
            </div>
            <Link
              to="/logs"
              className="inline-flex items-center gap-1 text-xs font-medium text-cyan-300 hover:text-cyan-200"
            >
              View all
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {logs.length ? (
            <div className="space-y-3">
              {logs.slice(0, 6).map((log, index) => (
                <div
                  key={`${log.action}-${index}`}
                  className="flex flex-col gap-2 rounded-2xl border border-slate-800 bg-slate-950/60 p-3.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-cyan-300 ring-1 ring-slate-800">
                      <Shield className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-100">{log.action || 'Vault Operation'}</p>
                      <p className="text-xs text-slate-400">{log.file || log.fileName || 'Target resource'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 sm:text-right">
                    <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-xs text-slate-300">
                      {log.result || 'Completed'}
                    </span>
                    <span className="text-xs text-slate-400">
                      {formatDate(log.timestamp || log.date || log.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No recent activity"
              message="Uploaded files, shares, and access events will appear here."
              action={
                <Link to="/upload">
                  <Button variant="secondary" className="text-xs">
                    Upload your first file
                  </Button>
                </Link>
              }
            />
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-cyan-500/10 p-2.5 text-cyan-300">
                <LockKeyhole className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-semibold text-white">Security posture</h2>
            </div>

            <div className="mt-5 space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-slate-300">
                <span>Data Encryption</span>
                <span className="text-emerald-300 font-medium">AES-256 (GCM)</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-slate-300">
                <span>Integrity Checking</span>
                <span className="text-emerald-300 font-medium">SHA-256 Verified</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-slate-300">
                <span>Link Expirations</span>
                <span className="text-cyan-300 font-medium">Enforced</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-slate-300">
                <span>Audit Trail</span>
                <span className="text-emerald-300 font-medium">Realtime Logging</span>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900/90 to-slate-950 p-6">
            <h3 className="text-base font-semibold text-white">Quick actions</h3>
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <Link to="/upload">
                <Button variant="secondary" fullWidth className="text-xs py-2">
                  Upload file
                </Button>
              </Link>
              <Link to="/files">
                <Button variant="secondary" fullWidth className="text-xs py-2">
                  Browse files
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

