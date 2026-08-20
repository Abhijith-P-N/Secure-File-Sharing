import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Download, ShieldAlert, ShieldCheck } from 'lucide-react'
import { downloadSharedFile, getShareByToken } from '../services/shareService'
import Button from '../components/common/Button'
import Alert from '../components/common/Alert'
import Loader from '../components/common/Loader'
import { formatBytes, formatDate } from '../utils/formatters'

export default function SharePage() {
  const { token } = useParams()
  const [share, setShare] = useState(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')
  const [downloadError, setDownloadError] = useState('')
  const [password, setPassword] = useState('')

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

    if (token) {
      fetchShare()
    }
  }, [token])

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
      const response = await downloadSharedFile(token, password.trim() || undefined)
      const blob = new Blob([response.data], {
        type: response.headers?.['content-type'] || 'application/octet-stream',
      })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download =
        share?.fileName ||
        share?.file?.name ||
        'downloaded-file'
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setDownloadError(err?.message || 'Failed to download shared file. Please check password.')
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

  const passwordProtected = share?.passwordProtected || share?.passwordRequired
  const fileName = share?.fileName || share?.file?.name || 'Protected file'
  const fileSizeValue = share?.fileSize ?? share?.file?.size
  const fileSize = fileSizeValue ? formatBytes(fileSizeValue) : '—'
  const downloads = share?.downloads ?? share?.downloadCount ?? 0

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">Shared file</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">{fileName}</h1>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-sm text-emerald-200">
            {passwordProtected ? 'Password protected' : 'Open share'}
          </div>
        </div>

        {downloadError ? (
          <div className="mt-6">
            <Alert title="Download failed" message={downloadError} tone="danger" />
          </div>
        ) : null}

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
            <InfoLine label="File size" value={fileSize} />
            <InfoLine label="Owner" value={share?.owner || share?.creator?.name || 'Shared sender'} />
            <InfoLine label="Expiration" value={share?.expiresAt ? formatDate(share.expiresAt) : share?.expiration || 'No expiration'} />
            <InfoLine label="Download limit" value={share?.maxDownloads ? `${downloads} / ${share.maxDownloads}` : 'Unlimited'} />
            <InfoLine label="Security" value={share?.integrityStatus || 'Integrity verified'} />
          </div>

          <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
            {passwordProtected ? (
              <div>
                <label htmlFor="share-password" className="mb-2 block text-sm font-medium text-slate-200">
                  Password required
                </label>
                <input
                  id="share-password"
                  type="password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value)
                    setDownloadError('')
                  }}
                  placeholder="Enter share password"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                />
              </div>
            ) : null}

            <Button
              onClick={handleDownload}
              disabled={downloading}
              className="w-full justify-center gap-2"
            >
              <Download className="h-4 w-4" />
              {downloading ? 'Downloading...' : 'Download file'}
            </Button>

            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-sm text-slate-300">
              <div className="flex items-center gap-3">
                {share?.integrityStatus === 'Failed' ? (
                  <ShieldAlert className="h-5 w-5 text-red-300" />
                ) : (
                  <ShieldCheck className="h-5 w-5 text-emerald-300" />
                )}
                <span>{share?.integrityStatus || 'Integrity verified & encrypted'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoLine({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3 text-sm last:border-b-0 last:pb-0">
      <span className="text-slate-400">{label}</span>
      <span className="text-slate-100">{value}</span>
    </div>
  )
}

