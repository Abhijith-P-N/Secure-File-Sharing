import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Download, Mail, ShieldAlert, ShieldCheck, KeyRound } from 'lucide-react'
import { downloadSharedFile, getShareByToken, requestAccess, verifyAccess } from '../services/shareService'
import Button from '../components/common/Button'
import Alert from '../components/common/Alert'
import Loader from '../components/common/Loader'
import Badge from '../components/common/Badge'
import { formatBytes, formatDate } from '../utils/formatters'

export default function SharePage() {
  const { token } = useParams()
  const [share, setShare] = useState(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')
  const [downloadError, setDownloadError] = useState('')
  const [password, setPassword] = useState('')

  const [accessEmail, setAccessEmail] = useState('')
  const [accessCode, setAccessCode] = useState('')
  const [downloadToken, setDownloadToken] = useState('')
  const [requestingCode, setRequestingCode] = useState(false)
  const [verifyingCode, setVerifyingCode] = useState(false)
  const [codeSent, setCodeSent] = useState(false)
  const [codeMessage, setCodeMessage] = useState('')

  useEffect(() => {
    const fetchShare = async () => {
      try {
        setLoading(true)
        const result = await getShareByToken(token)
        setShare(result)
      } catch (err) {
        setError(err?.message || 'This share link is invalid, expired, or unavailable.')
      } finally {
        setLoading(false)
      }
    }
    if (token) fetchShare()
  }, [token])

  const handleRequestCode = async (e) => {
    e?.preventDefault()
    if (!accessEmail.trim()) return
    setRequestingCode(true)
    setCodeMessage('')
    setDownloadError('')
    try {
      const result = await requestAccess(token, accessEmail.trim())
      setCodeMessage(result?.message || 'Code sent! Check your inbox.')
      setCodeSent(true)
    } catch (err) {
      const status = err?.response?.status
      const message = err?.response?.data?.message || err?.message || ''
      if (status === 403 && message.includes('not authorized')) setDownloadError('This email is not authorized to access this file.')
      else if (status === 410) setDownloadError('This share link is no longer available.')
      else setDownloadError(message || 'Failed to request access code.')
    } finally {
      setRequestingCode(false)
    }
  }

  const handleVerifyCode = async (e) => {
    e?.preventDefault()
    if (!accessCode.trim()) return
    setVerifyingCode(true)
    setDownloadError('')
    try {
      const result = await verifyAccess(token, accessEmail.trim(), accessCode.trim())
      setDownloadToken(result?.downloadToken || '')
      setCodeMessage(result?.message || 'Email verified! You can now download.')
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || ''
      setDownloadError(message || 'Invalid or expired code.')
    } finally {
      setVerifyingCode(false)
    }
  }

  const handleDownload = async (e) => {
    e?.preventDefault()
    const passwordRequired = share?.passwordProtected || share?.passwordRequired
    if (passwordRequired && !password.trim()) {
      setDownloadError('Please enter the password to download this file.')
      return
    }
    setDownloading(true)
    setDownloadError('')
    try {
      const response = await downloadSharedFile(token, password.trim() || undefined, downloadToken || undefined)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = share?.fileName || share?.file?.name || share?.originalName || 'downloaded-file'
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(url)
    } catch (err) {
      const status = err?.status || err?.response?.status
      const message = err?.message || ''
      if (status === 404) setDownloadError('This share link does not exist or has been removed.')
      else if (status === 410 && message?.includes('limit')) setDownloadError('Download limit reached.')
      else if (status === 410 && message?.includes('expired')) setDownloadError('This share link has expired.')
      else if (status === 410 && message?.includes('revoked')) setDownloadError('This share link has been revoked by the owner.')
      else if (status === 410) setDownloadError('This share link is no longer available.')
      else if (status === 401 || message?.includes('password')) setDownloadError('Incorrect password. Please try again.')
      else if (status === 403 && message?.includes('Email verification')) setDownloadError('Please verify your email before downloading.')
      else if (status === 403) setDownloadError('You do not have permission to download this file.')
      else setDownloadError(message || 'Failed to download. Please try again later.')
    } finally {
      setDownloading(false)
    }
  }

  if (loading) return <Loader label="Loading shared file..." />
  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20">
        <Alert title="Share unavailable" message={error} tone="danger" />
      </div>
    )
  }

  const emailProtected = share?.emailProtected
  const passwordProtected = share?.passwordProtected || share?.passwordRequired
  const fileName = share?.fileName || share?.file?.name || 'Protected file'
  const fileSizeValue = share?.fileSize ?? share?.file?.size
  const fileSize = fileSizeValue ? formatBytes(fileSizeValue) : '—'
  const downloads = share?.downloads ?? share?.downloadCount ?? 0
  const emailVerified = Boolean(downloadToken)
  const canDownload = !emailProtected || emailVerified

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <div className="rounded-[14px] border border-border bg-surface p-6 sm:p-8 shadow-[0_2px_8px_rgba(16,24,40,0.08)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-primary">Shared File</p>
            <h1 className="mt-2 text-[28px] font-semibold text-ink tracking-tight">{fileName}</h1>
          </div>
          <Badge tone={emailProtected ? 'info' : passwordProtected ? 'warning' : 'success'} size="md">
            {emailProtected ? 'Email Verified' : passwordProtected ? 'Password Protected' : 'Open Share'}
          </Badge>
        </div>

        {downloadError ? (
          <div className="mt-6"><Alert title="Download failed" message={downloadError} tone="danger" /></div>
        ) : null}

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          {/* Info */}
          <div className="rounded-[12px] border border-border bg-bg p-5 space-y-0">
            {[
              { label: 'File size', value: fileSize },
              { label: 'Owner', value: share?.owner || share?.creator?.name || 'Shared sender' },
              { label: 'Expiration', value: share?.expiresAt ? formatDate(share.expiresAt) : share?.expiration || 'No expiration' },
              { label: 'Download limit', value: share?.maxDownloads ? `${downloads} / ${share.maxDownloads}` : 'Unlimited' },
              { label: 'Security', value: share?.integrityStatus || 'Integrity verified' },
            ].map((item, i, arr) => (
              <div key={item.label} className={`flex items-center justify-between gap-3 py-3 text-[14px] ${i < arr.length - 1 ? 'border-b border-border' : ''}`}>
                <span className="text-muted">{item.label}</span>
                <span className="font-medium text-ink">{item.value}</span>
              </div>
            ))}
          </div>

          {/* Download panel */}
          <div className="space-y-4 rounded-[12px] border border-border bg-bg p-5">
            {emailProtected && !emailVerified ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-[13px] text-muted">
                  <Mail className="h-4 w-4 text-primary" />
                  <span>Verify your email to access this file</span>
                </div>
                {!codeSent ? (
                  <form onSubmit={handleRequestCode} className="space-y-3">
                    <div>
                      <label htmlFor="access-email" className="mb-1.5 block text-[13px] font-medium text-ink">Email address</label>
                      <input id="access-email" type="email" value={accessEmail} onChange={(e) => { setAccessEmail(e.target.value); setDownloadError('') }} placeholder="Authorized email" className="w-full rounded-[10px] border border-border bg-surface px-3.5 py-2.5 text-[14px] text-ink placeholder:text-muted-dim focus:border-primary focus:outline-none" required />
                    </div>
                    <Button type="submit" fullWidth disabled={requestingCode || !accessEmail.trim()}>
                      <Mail className="mr-1.5 h-4 w-4" />
                      {requestingCode ? 'Sending...' : 'Request Access Code'}
                    </Button>
                  </form>
                ) : (
                  <div className="space-y-3">
                    {codeMessage && !downloadToken ? (
                      <div className="rounded-[10px] border border-success/20 bg-success-bg p-3 text-[13px] text-success font-medium">{codeMessage}</div>
                    ) : null}
                    <form onSubmit={handleVerifyCode} className="space-y-3">
                      <div>
                        <label htmlFor="access-code" className="mb-1.5 block text-[13px] font-medium text-ink">Verification code</label>
                        <input id="access-code" type="text" value={accessCode} onChange={(e) => { setAccessCode(e.target.value); setDownloadError('') }} placeholder="6-digit code" maxLength={6} className="w-full rounded-[10px] border border-border bg-surface px-3.5 py-2.5 text-[14px] text-ink placeholder:text-muted-dim focus:border-primary focus:outline-none" required />
                      </div>
                      <Button type="submit" fullWidth disabled={verifyingCode || accessCode.trim().length !== 6}>
                        <KeyRound className="mr-1.5 h-4 w-4" />
                        {verifyingCode ? 'Verifying...' : 'Verify Code'}
                      </Button>
                    </form>
                    <button type="button" onClick={() => { setCodeSent(false); setAccessCode(''); setCodeMessage('') }} className="text-[12px] text-muted hover:text-ink">Use a different email</button>
                  </div>
                )}
              </div>
            ) : null}

            {emailVerified ? (
              <div className="rounded-[10px] border border-success/20 bg-success-bg p-3 text-[13px] text-success font-medium">Email verified for {accessEmail}</div>
            ) : null}

            {canDownload && passwordProtected ? (
              <div>
                <label htmlFor="share-password" className="mb-1.5 block text-[13px] font-medium text-ink">Password required</label>
                <input id="share-password" type="password" value={password} onChange={(e) => { setPassword(e.target.value); setDownloadError('') }} placeholder="Enter share password" className="w-full rounded-[10px] border border-border bg-surface px-3.5 py-2.5 text-[14px] text-ink placeholder:text-muted-dim focus:border-primary focus:outline-none" />
              </div>
            ) : null}

            <Button onClick={handleDownload} disabled={downloading || !canDownload} className="w-full justify-center gap-1.5">
              <Download className="h-4 w-4" />
              {downloading ? 'Downloading...' : 'Download File'}
            </Button>

            <div className="flex items-center gap-3 rounded-[10px] border border-border bg-surface p-3.5 text-[13px] text-muted">
              {share?.integrityStatus === 'Failed' ? (
                <ShieldAlert className="h-5 w-5 text-danger shrink-0" />
              ) : (
                <ShieldCheck className="h-5 w-5 text-success shrink-0" />
              )}
              <span>{share?.integrityStatus || 'Integrity verified & encrypted'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
