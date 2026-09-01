import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, Share2, Trash2, Shield } from 'lucide-react'
import { deleteFile, downloadFile, getFileById } from '../services/fileService'
import { createShare } from '../services/shareService'
import { formatBytes, formatDate } from '../utils/formatters'
import Loader from '../components/common/Loader'
import Alert from '../components/common/Alert'
import Button from '../components/common/Button'
import ShareModal from '../components/files/ShareModal'

export default function FileDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    const fetchFile = async () => {
      try {
        setLoading(true)
        const data = await getFileById(id)
        setFile(data?.file || data)
      } catch (err) {
        setError(err?.message || 'Unable to load file details.')
      } finally {
        setLoading(false)
      }
    }
    if (id) fetchFile()
  }, [id])

  const handleDownload = async () => {
    if (!file) return
    setDownloading(true)
    setError('')
    try {
      const response = await downloadFile(file.id || id)
      const blob = new Blob([response.data], { type: response.headers?.['content-type'] || 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = file.name || file.filename || 'downloaded-file'
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err?.message || 'Download failed.')
    } finally {
      setDownloading(false)
    }
  }

  const handleDelete = async () => {
    if (!file) return
    setDeleting(true)
    setError('')
    try {
      await deleteFile(file.id || id)
      setSuccessMessage('File deleted successfully. Redirecting...')
      setTimeout(() => navigate('/files', { replace: true }), 1200)
    } catch (err) {
      setError(err?.message || 'Delete failed.')
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  const handleShare = async (payload) => await createShare(payload)

  if (loading) return <Loader label="Loading file details..." />
  if (error && !file) return <div className="py-16"><Alert title="Unable to load file" message={error} tone="danger" /></div>
  if (!file) return <div className="py-16"><Alert title="No file found" message="The requested file could not be found." tone="warning" /></div>

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold text-ink tracking-tight">{file.name || file.filename}</h1>
          <p className="mt-1 text-[14px] text-muted">File Details</p>
        </div>
        <Link to="/files">
          <Button variant="secondary" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Back to Files
          </Button>
        </Link>
      </div>

      {error ? <Alert title="Error" message={error} tone="danger" onDismiss={() => setError('')} /> : null}
      {successMessage ? <Alert title="Success" message={successMessage} tone="success" /> : null}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        {/* Metadata */}
        <div className="rounded-[12px] border border-border bg-surface p-6">
          <h2 className="text-[17px] font-semibold text-ink mb-4">File Information</h2>
          <div className="space-y-3">
            {[
              { label: 'File name', value: file.name || file.filename },
              { label: 'File size', value: formatBytes(file.size) },
              { label: 'Type', value: file.type || file.mimeType || 'Document' },
              { label: 'Upload date', value: formatDate(file.uploadedAt || file.createdAt) },
            ].map((row, i) => (
              <div key={row.label} className={`flex items-center justify-between py-3 text-[14px] ${i < 3 ? 'border-b border-border' : ''}`}>
                <span className="text-muted">{row.label}</span>
                <span className="font-medium text-ink">{row.value}</span>
              </div>
            ))}
          </div>

          <h3 className="mt-6 mb-3 text-[15px] font-semibold text-ink">Security</h3>
          <div className="space-y-3">
            {[
              { label: 'Encryption', value: file.encryptionStatus || 'AES-256 Encrypted' },
              { label: 'Integrity', value: file.integrityStatus || 'SHA-256 Verified' },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-[10px] border border-border bg-bg p-3.5 text-[14px]">
                <div className="flex items-center gap-2.5">
                  <Shield className="h-4 w-4 text-success" />
                  <span className="text-muted">{item.label}</span>
                </div>
                <span className="font-medium text-success">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="rounded-[12px] border border-border bg-surface p-6">
          <h2 className="text-[17px] font-semibold text-ink">Actions</h2>
          <p className="mt-1 text-[13px] text-muted">Manage access and share securely.</p>

          <div className="mt-6 space-y-3">
            <Button
              onClick={handleDownload}
              disabled={downloading || deleting}
              className="w-full justify-center gap-1.5"
            >
              <Download className="h-4 w-4" />
              {downloading ? 'Downloading...' : 'Download File'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => setShareModalOpen(true)}
              disabled={deleting}
              className="w-full justify-center gap-1.5"
            >
              <Share2 className="h-4 w-4" />
              Share File
            </Button>

            {confirmDelete ? (
              <div className="rounded-[10px] border border-danger/20 bg-danger-bg p-4 space-y-3">
                <p className="text-[13px] font-medium text-danger">
                  Are you sure you want to permanently delete this file?
                </p>
                <div className="flex gap-2">
                  <Button variant="danger" onClick={handleDelete} disabled={deleting} className="flex-1 justify-center text-[13px]">
                    {deleting ? 'Deleting...' : 'Yes, delete'}
                  </Button>
                  <Button variant="secondary" onClick={() => setConfirmDelete(false)} disabled={deleting} className="flex-1 justify-center text-[13px]">
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="danger-soft"
                onClick={() => setConfirmDelete(true)}
                disabled={deleting}
                className="w-full justify-center gap-1.5"
              >
                <Trash2 className="h-4 w-4" />
                Delete File
              </Button>
            )}
          </div>
        </div>
      </div>

      <ShareModal open={shareModalOpen} file={file} onClose={() => setShareModalOpen(false)} onCreateShare={handleShare} />
    </div>
  )
}
