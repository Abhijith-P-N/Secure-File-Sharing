import { useState } from 'react'
import { Check, Copy, Link as LinkIcon, X } from 'lucide-react'
import Button from '../common/Button'

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

export default function ShareModal({ file, open, onClose, onCreateShare }) {
  const [passwordProtected, setPasswordProtected] = useState(false)
  const [password, setPassword] = useState('')
  const [expiration, setExpiration] = useState('24h')
  const [downloadLimit, setDownloadLimit] = useState(5)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [generatedLink, setGeneratedLink] = useState('')
  const [copied, setCopied] = useState(false)
  const [shareError, setShareError] = useState('')

  if (!open || !file) return null

  const handleClose = () => {
    setGeneratedLink('')
    setCopied(false)
    setShareError('')
    setPasswordProtected(false)
    setPassword('')
    onClose()
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setShareError('')
    try {
      const result = await onCreateShare({
        fileId: file.id,
        passwordProtected,
        password: passwordProtected ? password : undefined,
        expiration,
        maxDownloads: downloadLimit,
      })

      if (result) {
        const link =
          result.shareUrl ||
          (result.token ? `${window.location.origin}/share/${result.token}` : '')
        if (link) {
          setGeneratedLink(link)
        }
      }
    } catch (err) {
      setShareError(err?.message || 'Failed to create share link.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCopy = async () => {
    if (!generatedLink) return
    try {
      await navigator.clipboard.writeText(generatedLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Fallback
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl shadow-cyan-900/20">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Share file</p>
            <h3 className="mt-2 text-2xl font-semibold text-white">{file.name || file.filename}</h3>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full border border-slate-700 p-2 text-slate-300 hover:border-slate-500 hover:text-white"
            aria-label="Close share dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {generatedLink ? (
          <div className="space-y-6">
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
              <div className="flex items-center gap-2 text-emerald-300 font-medium text-sm">
                <LinkIcon className="h-4 w-4" />
                Share link generated successfully!
              </div>
              <p className="mt-2 text-xs text-slate-300">
                Anyone with this link {passwordProtected ? 'and the password' : ''} can access the file within the specified limits.
              </p>
              <div className="mt-4 flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={generatedLink}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs text-slate-200 select-all focus:outline-none"
                />
                <Button onClick={handleCopy} className="gap-1.5 shrink-0 px-3.5 py-2.5 text-xs">
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button onClick={handleClose}>Done</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {shareError ? (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
                {shareError}
              </div>
            ) : null}

            <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
              <div>
                <p className="text-sm text-slate-200 font-medium">Password protection</p>
                <p className="text-xs text-slate-400">Require recipients to enter a password</p>
              </div>
              <button
                type="button"
                onClick={() => setPasswordProtected((prev) => !prev)}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${passwordProtected ? 'bg-cyan-500' : 'bg-slate-700'}`}
                aria-pressed={passwordProtected}
              >
                <span className={`inline-block h-5 w-5 rounded-full bg-white transition ${passwordProtected ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            {passwordProtected ? (
              <div>
                <label htmlFor="share-password" className="mb-2 block text-sm font-medium text-slate-200">
                  Share password
                </label>
                <input
                  id="share-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter a secure password for this link"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                />
              </div>
            ) : null}

            <div>
              <p className="mb-3 text-sm font-medium text-slate-200">Expiration window</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {expirationOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setExpiration(option.value)}
                    className={`rounded-xl border px-3 py-2 text-sm transition ${expiration === option.value ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300 font-medium' : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500'}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-3 text-sm font-medium text-slate-200">Maximum downloads</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {downloadOptions.map((option) => (
                  <button
                    key={String(option.value)}
                    type="button"
                    onClick={() => setDownloadLimit(option.value)}
                    className={`rounded-xl border px-3 py-2 text-sm transition ${downloadLimit === option.value ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300 font-medium' : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500'}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || (passwordProtected && !password.trim())}
              >
                {isSubmitting ? 'Generating...' : 'Generate Share Link'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

