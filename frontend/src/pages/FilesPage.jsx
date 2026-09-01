import { useEffect, useMemo, useState } from 'react'
import { Check, Download, Eye, FileText, Plus, Share2, Shield, Trash2, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { deleteFile, downloadFile, getFiles } from '../services/fileService'
import { createShare } from '../services/shareService'
import Loader from '../components/common/Loader'
import Alert from '../components/common/Alert'
import EmptyState from '../components/common/EmptyState'
import Button from '../components/common/Button'
import SearchInput from '../components/common/SearchInput'
import ShareModal from '../components/files/ShareModal'
import FilePreview from '../components/files/FilePreview'
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
  const [previewFile, setPreviewFile] = useState(null)

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
        (file.type || '').toLowerCase().includes(q)
    )
  }, [files, searchQuery])

  if (loading) return <Loader label="Loading files..." />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[28px] font-semibold text-ink tracking-tight">My Files</h1>
          <p className="mt-1 text-[14px] text-muted">Manage files stored securely in your vault.</p>
        </div>
        <Link to="/upload">
          <Button className="gap-1.5">
            <Plus className="h-4 w-4" />
            Upload File
          </Button>
        </Link>
      </div>

      {toast ? (
        <div className="flex items-center gap-2 rounded-[10px] border border-success/20 bg-success-bg px-4 py-3 text-[13px] text-success font-medium">
          <Check className="h-4 w-4 shrink-0" />
          {toast}
        </div>
      ) : null}

      {error ? <Alert title="File action failed" message={error} tone="danger" onDismiss={() => setError('')} /> : null}

      {/* Search */}
      {files.length > 0 ? (
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search files by name or format..."
          className="max-w-md"
        />
      ) : null}

      {/* File Table */}
      {filteredFiles.length ? (
        <div className="overflow-hidden rounded-[12px] border border-border bg-surface">
          <div className="hidden lg:grid grid-cols-[1.5fr_0.5fr_0.5fr_0.6fr_0.6fr_1.2fr] gap-4 border-b border-border px-5 py-3 text-[12px] font-medium uppercase tracking-wider text-muted">
            <span>Name</span>
            <span>Size</span>
            <span>Type</span>
            <span>Uploaded</span>
            <span>Security</span>
            <span className="text-right">Actions</span>
          </div>

          <div className="divide-y divide-border">
            {filteredFiles.map((file) => (
              <div
                key={file.id}
                className="group grid gap-3 px-5 py-4 text-[14px] lg:grid-cols-[1.5fr_0.5fr_0.5fr_0.6fr_0.6fr_1.2fr] lg:items-center hover:bg-surface-hover/50 transition-colors duration-100"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-primary-soft text-primary">
                    <FileText className="h-[18px] w-[18px]" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{file.name || file.filename}</p>
                    <p className="text-[12px] text-muted truncate">{file.owner || 'Private file'}</p>
                  </div>
                </div>

                <span className="text-[13px] text-muted">{formatBytes(file.size)}</span>
                <span className="text-[13px] text-muted truncate">{file.type || file.mimeType || 'Document'}</span>
                <span className="text-[13px] text-muted">{formatDate(file.uploadedAt || file.createdAt)}</span>
                <div className="flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-success shrink-0" />
                  <span className="text-[12px] text-muted">{file.integrityStatus || 'Verified'}</span>
                </div>

                <div className="flex items-center justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleDownload(file)}
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-medium text-ink hover:bg-surface-hover transition-colors duration-150"
                    aria-label="Download file"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span className="hidden xl:inline">Download</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSelectedFile(file); setShareModalOpen(true) }}
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-medium text-ink hover:bg-surface-hover transition-colors duration-150"
                    aria-label="Share file"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    <span className="hidden xl:inline">Share</span>
                  </button>
                  <Link
                    to={`/files/${file.id}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-medium text-ink hover:bg-surface-hover transition-colors duration-150"
                    aria-label="View file details"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span className="hidden xl:inline">Details</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => setFileToDelete(file)}
                    className="inline-flex items-center gap-1 rounded-lg border border-danger/20 bg-danger-bg px-2.5 py-1.5 text-[12px] font-medium text-danger hover:bg-danger/10 transition-colors duration-150"
                    aria-label="Delete file"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="hidden xl:inline">Delete</span>
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
            <Button variant="secondary" size="sm" onClick={() => setSearchQuery('')}>Clear search</Button>
          }
        />
      ) : (
        <EmptyState
          icon={FileText}
          title="No files uploaded yet"
          message="Upload your first file to securely store it in your vault."
          action={
            <Link to="/upload"><Button>Upload now</Button></Link>
          }
        />
      )}

      {/* Delete Confirmation Modal */}
      {fileToDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm" onClick={() => setFileToDelete(null)} />
          <div className="relative w-full max-w-md rounded-[14px] border border-border bg-surface p-6 shadow-[0_8px_30px_rgba(16,24,40,0.12)]">
            <div className="flex items-center justify-between">
              <h3 className="text-[17px] font-semibold text-ink">Confirm Deletion</h3>
              <button
                type="button"
                onClick={() => setFileToDelete(null)}
                className="rounded-lg p-1.5 text-muted hover:bg-surface-hover hover:text-ink"
              >
                <X className="h-[18px] w-[18px]" />
              </button>
            </div>
            <p className="mt-3 text-[14px] text-muted leading-relaxed">
              Are you sure you want to delete{' '}
              <strong className="text-ink">{fileToDelete.name || fileToDelete.filename}</strong>?
              This action cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setFileToDelete(null)}>Cancel</Button>
              <Button variant="danger" onClick={handleDelete} disabled={deletingId !== null}>
                {deletingId ? 'Deleting...' : 'Delete Permanently'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <ShareModal
        open={shareModalOpen}
        file={selectedFile}
        onClose={() => { setSelectedFile(null); setShareModalOpen(false) }}
        onCreateShare={handleShare}
      />

      <FilePreview
        file={previewFile}
        onClose={() => setPreviewFile(null)}
        onDownload={() => handleDownload(previewFile)}
      />
    </div>
  )
}
