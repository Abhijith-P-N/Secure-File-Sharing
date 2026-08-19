import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, Search, ShieldAlert, ShieldCheck } from 'lucide-react'
import { getLogs } from '../services/logService'
import Loader from '../components/common/Loader'
import Alert from '../components/common/Alert'
import EmptyState from '../components/common/EmptyState'
import Button from '../components/common/Button'
import { formatDate } from '../utils/formatters'

export default function LogsPage() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const fetchLogs = async (isManual = false) => {
    if (isManual) setRefreshing(true)
    else setLoading(true)
    setError('')

    try {
      const response = await getLogs()
      setLogs(Array.isArray(response) ? response : response?.logs || [])
    } catch (err) {
      setError(err?.message || 'Unable to load access logs.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [])

  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) return logs
    const q = searchQuery.toLowerCase()
    return logs.filter(
      (log) =>
        (log.action || '').toLowerCase().includes(q) ||
        (log.file || '').toLowerCase().includes(q) ||
        (log.result || '').toLowerCase().includes(q) ||
        (log.user || log.ip || '').toLowerCase().includes(q),
    )
  }, [logs, searchQuery])

  if (loading) return <Loader label="Loading access logs..." />

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">Access logs</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Security activity & Audit</h1>
        </div>
        <Button
          variant="secondary"
          onClick={() => fetchLogs(true)}
          disabled={refreshing}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh logs'}
        </Button>
      </div>

      {error ? <Alert title="Logs unavailable" message={error} tone="danger" /> : null}

      {logs.length > 0 ? (
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
            <Search className="h-4 w-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter logs by action, filename, or result..."
            className="w-full rounded-2xl border border-slate-800 bg-slate-900/80 py-2.5 pl-10 pr-4 text-sm text-slate-200 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
          />
        </div>
      ) : null}

      {filteredLogs.length ? (
        <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/80">
          <div className="hidden grid-cols-5 gap-3 border-b border-slate-800 px-5 py-3 text-xs uppercase tracking-[0.18em] text-slate-400 md:grid">
            <span>Action</span>
            <span>File / Target</span>
            <span>Timestamp</span>
            <span>Result</span>
            <span>Security Status</span>
          </div>

          <div className="divide-y divide-slate-800">
            {filteredLogs.map((log, index) => {
              const isFailed =
                log.result?.toLowerCase().includes('failed') ||
                log.status?.toLowerCase().includes('failed') ||
                log.result?.toLowerCase().includes('error')

              return (
                <div
                  key={`${log.action || 'event'}-${log.id || index}`}
                  className="grid gap-2 px-5 py-4 text-sm text-slate-200 md:grid-cols-5 md:items-center"
                >
                  <span className="font-medium text-white">{log.action || 'Access Event'}</span>
                  <span className="truncate text-slate-300">{log.file || log.fileName || log.target || '—'}</span>
                  <span className="text-xs text-slate-400">
                    {formatDate(log.timestamp || log.date || log.createdAt)}
                  </span>
                  <div>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        isFailed
                          ? 'border border-red-500/30 bg-red-500/10 text-red-300'
                          : 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                      }`}
                    >
                      {log.result || 'Success'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {isFailed ? (
                      <span className="flex items-center gap-1.5 text-red-300">
                        <ShieldAlert className="h-4 w-4 shrink-0" />
                        {log.securityEventType || 'Anomaly / Check Failed'}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-emerald-300">
                        <ShieldCheck className="h-4 w-4 shrink-0" />
                        {log.securityEventType || 'Verified Event'}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : logs.length > 0 ? (
        <EmptyState
          title="No matching logs"
          message={`No log events matching "${searchQuery}".`}
          action={
            <Button variant="secondary" onClick={() => setSearchQuery('')}>
              Clear search
            </Button>
          }
        />
      ) : (
        <EmptyState
          title="No access logs yet"
          message="File uploads, downloads, and share activities will appear here automatically."
        />
      )}
    </div>
  )
}
