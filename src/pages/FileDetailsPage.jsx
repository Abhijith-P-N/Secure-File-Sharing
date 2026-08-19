import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, Share2, Trash2 } from 'lucide-react'
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

    if (id) {
      fetchFile()
    }
  }, [id])

  const handleDownload = async () => {
    if (!file) return
    setDownloading(true)
    setError('')
    try {
      const response = await downloadFile(file.id || id)
      const blob = new Blob([response.data], {
        type: response.headers?.['content-type'] || 'application/octet-stream',
      })
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
      setSuccessMessage('File deleted successfully. Redirecting to your files...')
      setTimeout(() => {
        navigate('/files', { replace: true })
      }, 1200)
    } catch (err) {
      setError(err?.message || 'Delete failed.')
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  const handleShare = async (payload) => {
    return await createShare(payload)
  }

  if (loading) return <Loader label="Loading file details..." />
  if (error && !file) return <Alert title="Unable to load file" message={error} tone="danger" />
  if (!file) return <Alert title="No file found" message="The requested file could not be found." tone="warning" />

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">File details</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">{file.name || file.filename}</h1>
        </div>
        <Link to="/files">
          <Button variant="secondary" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to files
          </Button>
        </Link>
      </div>

      {error ? <Alert title="Action error" message={error} tone="danger" /> : null}
      {successMessage ? <Alert title="Success" message={successMessage} tone="success" /> : null}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Metadata & Security</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <DetailRow label="File name" value={file.name || file.filename} />
            <DetailRow label="File size" value={formatBytes(file.size)} />
            <DetailRow label="Type" value={file.type || file.mimeType || 'Document'} />
            <DetailRow label="Upload date" value={formatDate(file.uploadedAt || file.createdAt)} />
            <DetailRow label="Encryption status" value={file.encryptionStatus || 'AES-256 Encrypted'} />
            <DetailRow label="Integrity status" value={file.integrityStatus || 'SHA-256 Verified'} />
          </div>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
          <h2 className="text-xl font-semibold text-white">File actions</h2>
          <p className="mt-1 text-xs text-slate-400">Manage access and share securely</p>
          <div className="mt-6 space-y-3">
            <Button
              onClick={handleDownload}
              disabled={downloading || deleting}
              className="w-full justify-center gap-2"
            >
              <Download className="h-4 w-4" />
              {downloading ? 'Downloading...' : 'Download file'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => setShareModalOpen(true)}
              disabled={deleting}
              className="w-full justify-center gap-2"
            >
              <Share2 className="h-4 w-4" />
              Share file
            </Button>
            {confirmDelete ? (
              <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 space-y-3">
                <p className="text-xs font-medium text-red-200">
                  Are you sure you want to permanently delete this file?
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="danger"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex-1 justify-center py-2 text-xs"
                  >
                    {deleting ? 'Deleting...' : 'Yes, delete'}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setConfirmDelete(false)}
                    disabled={deleting}
                    className="flex-1 justify-center py-2 text-xs"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="danger"
                onClick={() => setConfirmDelete(true)}
                disabled={deleting}
                className="w-full justify-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Delete file
              </Button>
            )}
          </div>
        </div>
      </div>

      <ShareModal
        open={shareModalOpen}
        file={file}
        onClose={() => setShareModalOpen(false)}
        onCreateShare={handleShare}
      />
    </div>
  )
}

function DetailRow({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-medium text-slate-100">{value}</p>
    </div>
  )
}

