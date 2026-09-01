import { useEffect, useState } from 'react'
import { Check, Copy, Link as LinkIcon, RotateCcw, ShieldOff } from 'lucide-react'
import { listShares, revokeShare } from '../../services/shareService'
import Button from '../common/Button'
import Modal from '../common/Modal'

const expirationOptions = [
  { label: '1 hour', value: '1h' },
  { label: '6 hours', value: '6h' },
  { label: '24 hours', value: '24h' },
  { label: '7 days', value: '7d' },
]

const downloadOptions = [
  { label: '1', value: 1 },
  { label: '5', value: 5 },
  { label: '10', value: 10 },
  { label: 'Unlimited', value: 'unlimited' },
]

function shareUrlFor(id) {
  return id ? `${window.location.origin}/share/${id}` : ''
}

export default function ShareModal({ file, open, onClose, onCreateShare }) {
  const [passwordProtected, setPasswordProtected] = useState(false)
  const [password, setPassword] = useState('')
  const [emailRestricted, setEmailRestricted] = useState(false)
  const [allowedEmails, setAllowedEmails] = useState('')
  const [expiration, setExpiration] = useState('24h')
  const [downloadLimit, setDownloadLimit] = useState(5)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [generatedShare, setGeneratedShare] = useState(null)
  const [copied, setCopied] = useState(false)
  const [shareError, setShareError] = useState('')
  const [shares, setShares] = useState([])
  const [revokingId, setRevokingId] = useState(null)

  const loadShares = async () => {
    if (!file?.id) return
    try {
      setShares(await listShares(file.id))
    } catch {
      setShares([])
    }
  }

  useEffect(() => {
    if (open && file?.id) loadShares()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, file?.id])

  if (!open || !file) return null

  const handleClose = () => {
    setGeneratedShare(null)
    setCopied(false)
    setShareError('')
    setPasswordProtected(false)
    setPassword('')
    setEmailRestricted(false)
    setAllowedEmails('')
    onClose()
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setShareError('')
    try {
      const result = await onCreateShare({
        fileId: file.id,
        password: passwordProtected ? password : undefined,
        expiration,
        maxDownloads: downloadLimit,
        allowedEmail: emailRestricted && allowedEmails.trim() ? allowedEmails.trim() : undefined,
      })
      if (result) {
        const share = result?.share || result
        const shareId = share?.id || result?.id
        const newShare = { ...share, url: shareUrlFor(shareId) }
        if (shareId) setGeneratedShare(newShare)
        else setShareError('Share created but the link could not be generated. Please try again.')
      }
      await loadShares()
    } catch (err) {
      setShareError(err?.message || 'Failed to create share link.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRevoke = async (id) => {
    setRevokingId(id)
    try {
      await revokeShare(id)
      if (generatedShare?.id === id) setGeneratedShare(null)
      setShareError('')
      await loadShares()
    } catch (err) {
      setShareError(err?.message || 'Failed to revoke share link.')
    } finally {
      setRevokingId(null)
    }
  }

  const handleCopy = async (value) => {
    if (!value) return
    try { await navigator.clipboard.writeText(value) } catch {
      const textarea = document.createElement('textarea')
      textarea.value = value
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <Modal open={open} title={generatedShare ? 'Share Link Created' : 'Create Share Link'} onClose={handleClose} maxWidth="max-w-xl" fixedHeight>
      {generatedShare ? (
        <div className="space-y-5">
          <div className="rounded-[12px] border border-success/20 bg-success-bg p-5">
            <div className="flex items-center gap-2 text-[14px] font-medium text-success">
              <LinkIcon className="h-4 w-4" />
              Share link generated successfully!
            </div>
            <p className="mt-2 text-[12px] text-muted leading-relaxed">
              {generatedShare.allowedEmail
                ? `Only ${generatedShare.allowedEmail.split(',').length > 1 ? 'the listed emails' : generatedShare.allowedEmail} can access this file.`
                : `Anyone with this link ${passwordProtected || generatedShare.passwordProtected ? 'and the password' : ''} can access the file within the specified limits.`}
            </p>
            <div className="mt-4 flex items-center gap-2">
              <input type="text" readOnly value={generatedShare.url} className="w-full rounded-[10px] border border-border bg-bg px-3.5 py-2.5 text-[13px] text-ink select-all focus:outline-none" />
              <Button onClick={() => handleCopy(generatedShare.url)} className="gap-1.5 shrink-0 px-3.5 py-2.5 text-[13px]">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <div className="mt-4 flex justify-end">
              <Button variant="danger-soft" onClick={() => handleRevoke(generatedShare.id)} disabled={revokingId === generatedShare.id} className="gap-1.5 px-3.5 py-2 text-[12px]">
                <ShieldOff className="h-3.5 w-3.5" />
                {revokingId === generatedShare.id ? 'Revoking...' : 'Revoke this link'}
              </Button>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleClose}>Done</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {shareError ? (
            <div className="rounded-[10px] border border-danger/20 bg-danger-bg p-3 text-[13px] text-danger font-medium">{shareError}</div>
          ) : null}

          {/* Password protection */}
          <div className="flex items-center justify-between rounded-[10px] border border-border bg-bg p-4">
            <div>
              <p className="text-[14px] font-medium text-ink">Password Protection</p>
              <p className="text-[12px] text-muted">Require recipients to enter a password</p>
            </div>
            <button
              type="button"
              onClick={() => setPasswordProtected((prev) => !prev)}
              className={`relative inline-flex h-[22px] w-[40px] shrink-0 items-center rounded-full transition-colors duration-150 ${passwordProtected ? 'bg-primary' : 'bg-border-hover'}`}
              aria-pressed={passwordProtected}
            >
              <span className={`inline-block h-[16px] w-[16px] rounded-full bg-white shadow-sm transition-transform duration-150 ${passwordProtected ? 'translate-x-[20px]' : 'translate-x-[3px]'}`} />
            </button>
          </div>

          {passwordProtected ? (
            <div>
              <label htmlFor="share-password" className="mb-1.5 block text-[13px] font-medium text-ink">Share Password</label>
              <input id="share-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter a secure password" className="w-full rounded-[10px] border border-border bg-bg px-3.5 py-2.5 text-[14px] text-ink placeholder:text-muted-dim focus:border-primary focus:outline-none" />
            </div>
          ) : null}

          {/* Email restriction */}
          <div className="flex items-center justify-between rounded-[10px] border border-border bg-bg p-4">
            <div>
              <p className="text-[14px] font-medium text-ink">Email Restriction</p>
              <p className="text-[12px] text-muted">Only a specific email can request the access code</p>
            </div>
            <button
              type="button"
              onClick={() => setEmailRestricted((prev) => !prev)}
              className={`relative inline-flex h-[22px] w-[40px] shrink-0 items-center rounded-full transition-colors duration-150 ${emailRestricted ? 'bg-primary' : 'bg-border-hover'}`}
              aria-pressed={emailRestricted}
            >
              <span className={`inline-block h-[16px] w-[16px] rounded-full bg-white shadow-sm transition-transform duration-150 ${emailRestricted ? 'translate-x-[20px]' : 'translate-x-[3px]'}`} />
            </button>
          </div>

          {emailRestricted ? (
            <div>
              <label htmlFor="share-allowed-emails" className="mb-1.5 block text-[13px] font-medium text-ink">Allowed Emails</label>
              <input id="share-allowed-emails" type="text" value={allowedEmails} onChange={(e) => setAllowedEmails(e.target.value)} placeholder="alice@acme.com, bob@acme.com" className="w-full rounded-[10px] border border-border bg-bg px-3.5 py-2.5 text-[14px] text-ink placeholder:text-muted-dim focus:border-primary focus:outline-none" />
              {allowedEmails.trim() ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {allowedEmails.split(',').map(e => e.trim()).filter(Boolean).map((email, i) => {
                    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
                    return <span key={i} className={`inline-flex items-center rounded-[8px] px-2 py-0.5 text-[11px] font-medium ${valid ? 'border border-success/20 bg-success-bg text-success' : 'border border-danger/20 bg-danger-bg text-danger'}`}>{email}</span>
                  })}
                </div>
              ) : null}
              <p className="mt-1.5 text-[12px] text-muted">Separate multiple emails with commas.</p>
            </div>
          ) : null}

          {/* Expiration */}
          <div>
            <p className="mb-2.5 text-[14px] font-medium text-ink">Expiration Window</p>
            <div className="grid grid-cols-4 gap-2">
              {expirationOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setExpiration(option.value)}
                  className={`rounded-[10px] border px-3 py-2 text-[13px] font-medium transition-colors duration-150 ${expiration === option.value ? 'border-primary bg-primary-soft text-primary' : 'border-border bg-bg text-muted hover:border-border-hover'}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Download limit */}
          <div>
            <p className="mb-2.5 text-[14px] font-medium text-ink">Maximum Downloads</p>
            <div className="grid grid-cols-4 gap-2">
              {downloadOptions.map((option) => (
                <button
                  key={String(option.value)}
                  type="button"
                  onClick={() => setDownloadLimit(option.value)}
                  className={`rounded-[10px] border px-3 py-2 text-[13px] font-medium transition-colors duration-150 ${downloadLimit === option.value ? 'border-primary bg-primary-soft text-primary' : 'border-border bg-bg text-muted hover:border-border-hover'}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={handleClose}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting || (passwordProtected && !password.trim()) || (emailRestricted && !allowedEmails.trim())}>
              {isSubmitting ? 'Generating...' : 'Generate Share Link'}
            </Button>
          </div>

          {/* Active shares */}
          {shares.length ? (
            <div>
              <div className="mb-2.5 flex items-center justify-between">
                <p className="text-[14px] font-medium text-ink">
                  Active links <span className="text-muted font-normal">({shares.length})</span>
                </p>
                <button type="button" onClick={loadShares} className="inline-flex items-center gap-1 text-[12px] text-muted hover:text-ink">
                  <RotateCcw className="h-3 w-3" /> Refresh
                </button>
              </div>
              <div className="space-y-2">
                {shares.map((share) => {
                  const url = shareUrlFor(share.id)
                  const isRevoked = Boolean(share.revokedAt || share.revoked_at)
                  return (
                    <div key={share.id} className={`flex items-center gap-2 rounded-[10px] border px-3 py-2.5 text-[12px] ${isRevoked ? 'border-danger/20 bg-danger-bg/50' : 'border-border bg-bg'}`}>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-ink">
                          {share.maxDownloads ? `${share.downloads}/${share.maxDownloads} downloads` : `${share.downloads} downloads`}
                          {share.passwordProtected ? ' · password' : ''}
                          {share.allowedEmail ? ` · ${share.allowedEmail.split(',').length > 1 ? `${share.allowedEmail.split(',').length} emails` : share.allowedEmail}` : ''}
                          {share.expiresAt ? ` · expires ${new Date(share.expiresAt).toLocaleDateString()}` : ''}
                        </p>
                      </div>
                      {isRevoked ? null : (
                        <>
                          <button type="button" onClick={() => handleCopy(url)} className="rounded-lg border border-border p-1.5 text-muted hover:bg-surface-hover" aria-label="Copy share link">
                            {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                          <button type="button" onClick={() => handleRevoke(share.id)} disabled={revokingId === share.id} className="rounded-lg border border-danger/20 p-1.5 text-danger hover:bg-danger-bg" aria-label="Revoke share link">
                            <ShieldOff className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </Modal>
  )
}
