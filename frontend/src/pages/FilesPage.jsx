import { useEffect, useMemo, useState } from 'react'
import { Check, Download, Eye, FileText, Plus, Search, Share2, Shield, Trash2, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { deleteFile, downloadFile, getFiles } from '../services/fileService'
import { createShare } from '../services/shareService'
import Loader from '../components/common/Loader'
import Alert from '../components/common/Alert'
import EmptyState from '../components/common/EmptyState'
import Button from '../components/common/Button'
import ShareModal from '../components/files/ShareModal'
import { formatBytes, formatDate } from '../utils/formatters'

export default function FilesPage() {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [fileToDelete, setFileToDelete] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  const fetchFiles = async () => {
    try {
      setLoading(true)
      const response = await getFiles()
      setFiles(Array.isArray(response) ? response : response?.files || [])
    } catch (err) {
      setError(err?.message || 'Unable to load files.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFiles()
  }, [])

  const showToast = (message) => {
    setToast(message)
    setTimeout(() => setToast(''), 3000)
  }

  const handleDelete = async () => {
    if (!fileToDelete) return
    const id = fileToDelete.id
    setDeletingId(id)
    setError('')
    try {
      await deleteFile(id)
      setFiles((prev) => prev.filter((file) => file.id !== id))
      setFileToDelete(null)
      showToast('File deleted successfully.')
    } catch (err) {
      setError(err?.message || 'Unable to delete file.')
    } finally {
      setDeletingId(null)
    }
  }

  const handleDownload = async (file) => {
    try {
      const response = await downloadFile(file.id)
      const blob = new Blob([response.data], {
        type: response.headers?.['content-type'] || 'application/octet-stream',
      })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = file.name || file.filename || 'downloaded-file'
      anchor.click()
      URL.revokeObjectURL(url)
      showToast(`Downloading "${file.name || file.filename}"...`)
    } catch (err) {
      setError(err?.message || 'Download failed.')
    }
  }

  const handleShare = async (payload) => {
    return await createShare(payload)
  }

  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return files
    const q = searchQuery.toLowerCase()
    return files.filter(
      (file) =>
        (file.name || file.filename || '').toLowerCase().includes(q) ||
        (file.type || '').toLowerCase().includes(q),
    )
  }, [files, searchQuery])

  if (loading) return <Loader label="Loading files..." />

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">Files</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Your files</h1>
        </div>
        <Link to="/upload">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Upload file
          </Button>
        </Link>
      </div>

      {toast ? (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-sm text-emerald-200">
          <Check className="h-4 w-4 shrink-0 text-emerald-400" />
          {toast}
        </div>
      ) : null}

      {error ? <Alert title="File action failed" message={error} tone="danger" /> : null}

      {files.length > 0 ? (
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
            <Search className="h-4 w-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files by name or format..."
            className="w-full rounded-2xl border border-slate-800 bg-slate-900/80 py-2.5 pl-10 pr-4 text-sm text-slate-200 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
          />
        </div>
      ) : null}

      {filteredFiles.length ? (
        <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/80">
          <div className="hidden grid-cols-[1.3fr_0.6fr_0.6fr_0.7fr_0.7fr_1.1fr] gap-4 border-b border-slate-800 px-5 py-3 text-xs uppercase tracking-[0.18em] text-slate-400 md:grid">
            <span>File</span>
            <span>Size</span>
            <span>Type</span>
            <span>Upload date</span>
            <span>Status</span>
            <span>Actions</span>
          </div>

          <div className="divide-y divide-slate-800">
            {filteredFiles.map((file) => (
              <div
                key={file.id}
                className="grid gap-3 px-5 py-4 md:grid-cols-[1.3fr_0.6fr_0.6fr_0.7fr_0.7fr_1.1fr] md:items-center"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-500/20">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-white">{file.name || file.filename}</p>
                    <p className="text-xs text-slate-400">{file.owner || 'Private file'}</p>
                  </div>
                </div>

                <p className="text-sm text-slate-300">{formatBytes(file.size)}</p>
                <p className="text-sm text-slate-300">{file.type || file.mimeType || 'Document'}</p>
                <p className="text-sm text-slate-300">{formatDate(file.uploadedAt || file.createdAt)}</p>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <Shield className="h-3.5 w-3.5 text-emerald-300" />
                  <span>{file.integrityStatus || 'Verified'}</span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleDownload(file)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-2.5 py-1.5 text-xs text-slate-200 hover:border-slate-500 hover:bg-slate-700"
                    aria-label="Download file"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(file)
                      setShareModalOpen(true)
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-2.5 py-1.5 text-xs text-slate-200 hover:border-slate-500 hover:bg-slate-700"
                    aria-label="Share file"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    Share
                  </button>
                  <Link
                    to={`/files/${file.id}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-2.5 py-1.5 text-xs text-slate-200 hover:border-slate-500 hover:bg-slate-700"
                    aria-label="View file details"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Details
                  </Link>
                  <button
                    type="button"
                    onClick={() => setFileToDelete(file)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-xs text-red-200 hover:border-red-500 hover:bg-red-500/20"
                    aria-label="Delete file"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : files.length > 0 ? (
        <EmptyState
          title="No matching files"
          message={`No files found matching "${searchQuery}".`}
          action={
            <Button variant="secondary" onClick={() => setSearchQuery('')}>
              Clear search
            </Button>
          }
        />
      ) : (
        <EmptyState
          title="No files uploaded yet"
          message="Upload a file to begin securing and sharing it with your team."
          action={
            <Link to="/upload">
              <Button>Upload now</Button>
            </Link>
          }
        />
      )}

      {/* Delete Confirmation Modal */}
      {fileToDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Confirm Deletion</h3>
              <button
                type="button"
                onClick={() => setFileToDelete(null)}
                className="rounded-full border border-slate-700 p-1.5 text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-3 text-sm text-slate-300">
              Are you sure you want to delete{' '}
              <strong className="text-white">{fileToDelete.name || fileToDelete.filename}</strong>? This action cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setFileToDelete(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleDelete}
                disabled={deletingId !== null}
              >
                {deletingId ? 'Deleting...' : 'Delete Permanently'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <ShareModal
        open={shareModalOpen}
        file={selectedFile}
        onClose={() => {
          setSelectedFile(null)
          setShareModalOpen(false)
        }}
        onCreateShare={handleShare}
      />
    </div>
  )
}

