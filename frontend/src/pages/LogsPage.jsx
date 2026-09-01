import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react'
import { getLogs } from '../services/logService'
import Loader from '../components/common/Loader'
import Alert from '../components/common/Alert'
import EmptyState from '../components/common/EmptyState'
import Button from '../components/common/Button'
import SearchInput from '../components/common/SearchInput'
import Badge from '../components/common/Badge'
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
        (log.user || log.ip || '').toLowerCase().includes(q)
    )
  }, [logs, searchQuery])

  if (loading) return <Loader label="Loading access logs..." />

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[28px] font-semibold text-ink tracking-tight">Audit Logs</h1>
          <p className="mt-1 text-[14px] text-muted">Track security and account activity.</p>
        </div>
        <Button
          variant="secondary"
          onClick={() => fetchLogs(true)}
          disabled={refreshing}
          className="gap-1.5"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {error ? <Alert title="Logs unavailable" message={error} tone="danger" onDismiss={() => setError('')} /> : null}

      {logs.length > 0 ? (
        <>
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Filter logs by action, filename, or result..."
            className="max-w-md"
          />

          <div className="overflow-hidden rounded-[12px] border border-border bg-surface">
            <div className="hidden lg:grid grid-cols-5 gap-3 border-b border-border px-5 py-3 text-[12px] font-medium uppercase tracking-wider text-muted">
              <span>Event</span>
              <span>File / Target</span>
              <span>Status</span>
              <span>Security</span>
              <span className="text-right">Time</span>
            </div>

            <div className="divide-y divide-border">
              {filteredLogs.length === 0 ? (
                <div className="px-5 py-10 text-center text-[13px] text-muted">
                  No logs match your search.
                </div>
              ) : (
                filteredLogs.map((log, index) => {
                  const isFailed =
                    log.result?.toLowerCase().includes('failed') ||
                    log.status?.toLowerCase().includes('failed') ||
                    log.result?.toLowerCase().includes('error')

                  return (
                    <div
                      key={`${log.action || 'event'}-${log.id || index}`}
                      className="grid gap-2 px-5 py-3.5 text-[13px] lg:grid-cols-5 lg:items-center hover:bg-surface-hover/50 transition-colors duration-100"
                    >
                      <div className="flex items-center gap-2">
                        {isFailed ? (
                          <ShieldAlert className="h-4 w-4 shrink-0 text-danger" />
                        ) : (
                          <ShieldCheck className="h-4 w-4 shrink-0 text-success" />
                        )}
                        <span className="font-medium text-ink">{log.action || 'Access Event'}</span>
                      </div>
                      <span className="truncate text-muted">{log.file || log.fileName || log.target || '—'}</span>
                      <Badge tone={isFailed ? 'danger' : 'success'}>
                        {log.result || 'Success'}
                      </Badge>
                      <span className="text-[12px] text-muted">
                        {isFailed ? (log.securityEventType || 'Anomaly') : (log.securityEventType || 'Verified')}
                      </span>
                      <span className="text-[13px] text-muted text-right">
                        {formatDate(log.timestamp || log.date || log.createdAt)}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </>
      ) : (
        <EmptyState
          title="No access logs yet"
          message="File uploads, downloads, and share activities will appear here automatically."
        />
      )}
    </div>
  )
}
