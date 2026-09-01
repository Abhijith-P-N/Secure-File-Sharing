import { useEffect, useMemo, useState } from 'react'
import { Link2, ShieldOff, Copy, Check } from 'lucide-react'
import { listShares, revokeShare, deleteShare } from '../services/shareService'
import Loader from '../components/common/Loader'
import Alert from '../components/common/Alert'
import EmptyState from '../components/common/EmptyState'
import Button from '../components/common/Button'
import Badge from '../components/common/Badge'
import SearchInput from '../components/common/SearchInput'
import { formatDate } from '../utils/formatters'

function shareUrlFor(id) {
  return id ? `${window.location.origin}/share/${id}` : ''
}

export default function SharedLinksPage() {
  const [shares, setShares] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [toast, setToast] = useState('')
  const [actionLoading, setActionLoading] = useState(null)
  const [copiedId, setCopiedId] = useState(null)

  const fetchShares = async () => {
    try {
      setLoading(true)
      setError('')
      const data = await listShares()
      setShares(Array.isArray(data) ? data : data?.shares || [])
    } catch (err) {
      setError(err?.message || 'Unable to load shared links.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchShares()
  }, [])

  const showToast = (message) => {
    setToast(message)
    setTimeout(() => setToast(''), 3000)
  }

  const handleRevoke = async (id) => {
    setActionLoading(id)
    try {
      await revokeShare(id)
      setShares((prev) =>
        prev.map((s) => (s.id === id ? { ...s, revokedAt: new Date().toISOString() } : s))
      )
      showToast('Share link revoked.')
    } catch (err) {
      setError(err?.message || 'Failed to revoke share link.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (id) => {
    setActionLoading(id)
    try {
      await deleteShare(id)
      setShares((prev) => prev.filter((s) => s.id !== id))
      showToast('Share link deleted.')
    } catch (err) {
      setError(err?.message || 'Failed to delete share link.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleCopy = async (url, id) => {
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = url
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const getShareStatus = (share) => {
    if (share.revokedAt || share.revoked_at) return 'revoked'
    if (share.expiresAt && new Date(share.expiresAt) < new Date()) return 'expired'
    return 'active'
  }

  const statusBadge = (status) => {
    const map = {
      active: { tone: 'success', label: 'Active' },
      expired: { tone: 'warning', label: 'Expired' },
      revoked: { tone: 'danger', label: 'Revoked' },
    }
    const s = map[status] || map.active
    return <Badge tone={s.tone}>{s.label}</Badge>
  }

  const filteredShares = useMemo(() => {
    if (!searchQuery.trim()) return shares
    const q = searchQuery.toLowerCase()
    return shares.filter((s) => {
      const name = s.fileName || s.file?.name || s.originalName || ''
      return (
        name.toLowerCase().includes(q) ||
        (s.allowedEmail || '').toLowerCase().includes(q) ||
        getShareStatus(s).includes(q)
      )
    })
  }, [shares, searchQuery])

  if (loading) return <Loader label="Loading shared links..." />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[28px] font-semibold text-ink tracking-tight">Shared Links</h1>
          <p className="mt-1 text-[14px] text-muted">Manage secure links you've created.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[13px] text-muted">{shares.length} link{shares.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {error ? <Alert title="Notice" message={error} tone="danger" onDismiss={() => setError('')} /> : null}

      {toast ? (
        <div className="flex items-center gap-2 rounded-[10px] border border-success/20 bg-success-bg px-4 py-3 text-[13px] text-success font-medium">
          <Check className="h-4 w-4 shrink-0" />
          {toast}
        </div>
      ) : null}

      {shares.length > 0 ? (
        <>
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by filename, email, or status..."
            className="max-w-md"
          />

          <div className="overflow-hidden rounded-[12px] border border-border bg-surface">
            {/* Table header */}
            <div className="hidden lg:grid grid-cols-[1.4fr_0.6fr_0.5fr_0.5fr_0.5fr_0.8fr] gap-4 border-b border-border px-5 py-3 text-[12px] font-medium uppercase tracking-wider text-muted">
              <span>File</span>
              <span>Created</span>
              <span>Expires</span>
              <span>Downloads</span>
              <span>Status</span>
              <span className="text-right">Actions</span>
            </div>

            {/* Rows */}
            <div className="divide-y divide-border">
              {filteredShares.length === 0 ? (
                <div className="px-5 py-10 text-center text-[13px] text-muted">
                  No shares match your search.
                </div>
              ) : (
                filteredShares.map((share) => {
                  const status = getShareStatus(share)
                  const url = shareUrlFor(share.id)
                  const fileName = share.fileName || share.file?.name || share.originalName || 'Shared file'
                  const downloads = share.downloads ?? share.downloadCount ?? 0
                  const maxDownloads = share.maxDownloads
                  const isRevoked = status === 'revoked'

                  return (
                    <div
                      key={share.id}
                      className="grid gap-3 px-5 py-4 text-[14px] lg:grid-cols-[1.4fr_0.6fr_0.5fr_0.5fr_0.5fr_0.8fr] lg:items-center"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Link2 className="h-4 w-4 shrink-0 text-primary" />
                          <span className="truncate font-medium text-ink">{fileName}</span>
                        </div>
                        {share.allowedEmail ? (
                          <p className="mt-0.5 text-[12px] text-muted truncate">To: {share.allowedEmail}</p>
                        ) : null}
                        {share.passwordProtected ? (
                          <p className="mt-0.5 text-[12px] text-muted">Password protected</p>
                        ) : null}
                      </div>

                      <span className="text-[13px] text-muted">
                        {share.createdAt ? formatDate(share.createdAt) : '—'}
                      </span>
                      <span className="text-[13px] text-muted">
                        {share.expiresAt ? formatDate(share.expiresAt) : 'No limit'}
                      </span>
                      <span className="text-[13px] text-muted">
                        {maxDownloads ? `${downloads}/${maxDownloads}` : `${downloads}`}
                      </span>
                      <div>{statusBadge(status)}</div>

                      <div className="flex items-center justify-end gap-1.5">
                        {!isRevoked ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleCopy(url, share.id)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-medium text-ink hover:bg-surface-hover transition-colors duration-150"
                              aria-label="Copy link"
                            >
                              {copiedId === share.id ? (
                                <><Check className="h-3.5 w-3.5 text-success" /> Copied</>
                              ) : (
                                <><Copy className="h-3.5 w-3.5" /> Copy</>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRevoke(share.id)}
                              disabled={actionLoading === share.id}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-danger/20 bg-danger-bg px-2.5 py-1.5 text-[12px] font-medium text-danger hover:bg-danger/10 transition-colors duration-150 disabled:opacity-55"
                              aria-label="Revoke link"
                            >
                              <ShieldOff className="h-3.5 w-3.5" />
                              Revoke
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleDelete(share.id)}
                            disabled={actionLoading === share.id}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-medium text-muted hover:bg-surface-hover transition-colors duration-150 disabled:opacity-55"
                            aria-label="Delete link"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </>
      ) : (
        <EmptyState
          icon={Link2}
          title="No shared links yet"
          message="Create a share link from the Files page to securely share a file with others."
          action={
            <Button onClick={() => window.location.href = '/files'} variant="secondary">
              Go to My Files
            </Button>
          }
        />
      )}
    </div>
  )
}
