import { useRef, useState } from 'react'
import { CheckCircle2, FileText, UploadCloud, X, Settings, RotateCcw, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { uploadFile, uploadFileChunked } from '../services/fileService'
import Button from '../components/common/Button'
import Alert from '../components/common/Alert'
import { formatBytes } from '../utils/formatters'

const CHUNK_SIZE = 5 * 1024 * 1024

export default function UploadPage() {
  const inputRef = useRef(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const [useChunked, setUseChunked] = useState(false)
  const [uploadStage, setUploadStage] = useState('idle')

  const handleFileChoose = (file) => {
    if (!file) return
    if (file.size > 2 * 1024 * 1024 * 1024) {
      setError('File too large. Maximum supported size is 2GB.')
      return
    }
    setSelectedFile(file)
    setError('')
    setSuccess('')
    setProgress(0)
    setUploadStage('idle')
  }

  const handleClear = () => {
    setSelectedFile(null)
    setProgress(0)
    setError('')
    setSuccess('')
    setUploadStage('idle')
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please choose a file to upload.')
      return
    }
    setUploading(true)
    setError('')
    setSuccess('')
    setProgress(0)
    try {
      if (useChunked && selectedFile.size > CHUNK_SIZE) {
        setUploadStage('creating')
        await uploadFileChunked(selectedFile, (event) => {
          if (event.total) {
            setProgress(Math.round((event.loaded * 100) / event.total))
            setUploadStage('uploading')
          }
        })
        setUploadStage('completing')
      } else {
        await uploadFile(selectedFile, (event) => {
          if (event.total) {
            setProgress(Math.round((event.loaded * 100) / event.total))
          }
        })
      }
      setSuccess(`"${selectedFile.name}" has been securely uploaded and encrypted.`)
      setSelectedFile(null)
      setProgress(0)
      setUploadStage('idle')
      if (inputRef.current) inputRef.current.value = ''
    } catch (err) {
      setError(err?.message || 'Upload failed. Please try again.')
      setUploadStage('idle')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-[28px] font-semibold text-ink tracking-tight">Secure File Upload</h1>
        <p className="mt-1 text-[14px] text-muted">Upload files to your encrypted vault.</p>
      </div>

      {error ? <Alert title="Upload failed" message={error} tone="danger" onDismiss={() => setError('')} /> : null}
      {success ? (
        <div className="space-y-4">
          <Alert title="Upload complete" message={success} tone="success" />
          <Link to="/files">
            <Button variant="secondary" size="sm" className="gap-1.5">
              <FileText className="h-4 w-4" /> View in My Files
            </Button>
          </Link>
        </div>
      ) : null}

      {/* Dropzone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => { e.preventDefault(); setDragActive(false); handleFileChoose(e.dataTransfer.files?.[0]) }}
        className={`rounded-[14px] border-2 border-dashed p-10 text-center transition-colors duration-150 cursor-pointer ${
          dragActive
            ? 'border-primary bg-primary-soft'
            : 'border-border bg-surface hover:border-border-hover'
        }`}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click() }}
        aria-label="Upload zone"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[12px] bg-primary-soft text-primary">
          <UploadCloud className="h-7 w-7" />
        </div>
        <h2 className="mt-5 text-[18px] font-semibold text-ink">Drop your file here</h2>
        <p className="mt-1.5 text-[14px] text-muted">or click to browse. Supports files up to 2GB.</p>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => handleFileChoose(e.target.files?.[0])}
        />
      </div>

      {/* Selected File Card */}
      {selectedFile ? (
        <div className="rounded-[12px] border border-border bg-surface p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-success-bg text-success">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[12px] text-muted">Selected file ready for upload</p>
                <p className="truncate text-[15px] font-semibold text-ink">{selectedFile.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="rounded-lg border border-border bg-bg px-2.5 py-1 text-[12px] text-muted">{formatBytes(selectedFile.size)}</span>
              <button
                type="button"
                onClick={handleClear}
                disabled={uploading}
                className="rounded-lg p-1.5 text-muted hover:bg-surface-hover hover:text-ink disabled:opacity-55"
                aria-label="Remove selected file"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {selectedFile.size > CHUNK_SIZE && !uploading && (
            <div className="mt-4 flex items-center gap-3 rounded-[10px] border border-border bg-bg p-3">
              <Settings className="h-4 w-4 text-muted shrink-0" />
              <label className="flex items-center gap-2 cursor-pointer text-[13px] text-muted">
                <input
                  type="checkbox"
                  checked={useChunked}
                  onChange={(e) => setUseChunked(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                Use chunked upload (recommended for files &gt; 5MB)
              </label>
            </div>
          )}

          {uploading ? (
            <div className="mt-5 space-y-2.5">
              <div className="flex items-center justify-between text-[13px] text-muted">
                <span className="flex items-center gap-1.5">
                  {(uploadStage === 'creating') && <RotateCcw className="h-3.5 w-3.5 animate-spin" />}
                  {uploadStage === 'creating' && 'Creating upload session...'}
                  {uploadStage === 'uploading' && 'Uploading chunks...'}
                  {uploadStage === 'completing' && 'Finalizing and verifying...'}
                  {(!uploadStage || uploadStage === 'idle') && 'Encrypting and uploading...'}
                </span>
                <span className="font-semibold text-primary">{progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-hover">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : null}

          <div className="mt-5 flex justify-end gap-3">
            <Button variant="secondary" onClick={handleClear} disabled={uploading}>Cancel</Button>
            <Button onClick={handleUpload} disabled={uploading} className="gap-1.5">
              {uploading ? `Uploading (${progress}%)...` : 'Upload File'}
              {!uploading && <ArrowRight className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-[10px] border border-border bg-surface p-4 text-[13px] text-muted text-center">
          No file selected. Files are encrypted and protected upon upload.
        </div>
      )}
    </div>
  )
}
