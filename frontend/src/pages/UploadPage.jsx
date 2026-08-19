import { useRef, useState } from 'react'
import { CheckCircle2, FileText, FileUp, UploadCloud, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { uploadFile } from '../services/fileService'
import Button from '../components/common/Button'
import Alert from '../components/common/Alert'
import { formatBytes } from '../utils/formatters'

export default function UploadPage() {
  const inputRef = useRef(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [dragActive, setDragActive] = useState(false)

  const handleFileChoose = (file) => {
    if (!file) return

    if (file.size > 100 * 1024 * 1024) {
      setError('File too large. Maximum supported size is 100MB.')
      return
    }

    setSelectedFile(file)
    setError('')
    setSuccess('')
    setProgress(0)
  }

  const handleClear = () => {
    setSelectedFile(null)
    setProgress(0)
    setError('')
    setSuccess('')
    if (inputRef.current) {
      inputRef.current.value = ''
    }
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
      await uploadFile(selectedFile, (event) => {
        if (event.total) {
          const value = Math.round((event.loaded * 100) / event.total)
          setProgress(value)
        }
      })

      setSuccess(`"${selectedFile.name}" has been securely uploaded and encrypted.`)
      setSelectedFile(null)
      setProgress(0)
      if (inputRef.current) {
        inputRef.current.value = ''
      }
    } catch (err) {
      setError(err?.message || 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">Upload</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Secure file upload</h1>
      </div>

      {error ? <Alert title="Upload failed" message={error} tone="danger" /> : null}
      {success ? (
        <div className="mb-6 space-y-4">
          <Alert title="Upload complete" message={success} tone="success" />
          <div className="flex gap-3">
            <Link to="/files">
              <Button variant="secondary" className="gap-2">
                <FileText className="h-4 w-4" />
                View in My Files
              </Button>
            </Link>
          </div>
        </div>
      ) : null}

      <div
        onDragOver={(event) => {
          event.preventDefault()
          setDragActive(true)
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragActive(false)
          const file = event.dataTransfer.files?.[0]
          handleFileChoose(file)
        }}
        className={`mt-6 rounded-3xl border-2 border-dashed p-8 text-center transition ${
          dragActive
            ? 'border-cyan-400 bg-cyan-500/10 scale-[1.01]'
            : 'border-slate-700 bg-slate-900/60 hover:border-slate-600'
        }`}
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-500/20">
          <UploadCloud className="h-7 w-7" />
        </div>

        <h2 className="mt-5 text-2xl font-semibold text-white">Drag and drop your file</h2>
        <p className="mt-2 text-sm text-slate-400">
          Upload documents, spreadsheets, archives, or media up to 100MB
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button onClick={() => inputRef.current?.click()} variant="secondary">
            <FileUp className="mr-2 h-4 w-4" />
            Choose file from device
          </Button>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(event) => handleFileChoose(event.target.files?.[0])}
          />
        </div>
      </div>

      {selectedFile ? (
        <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-900/80 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-300">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-400">Selected file ready for upload</p>
                <h3 className="truncate font-semibold text-white">{selectedFile.name}</h3>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-300">
                {formatBytes(selectedFile.size)}
              </span>
              <button
                type="button"
                onClick={handleClear}
                disabled={uploading}
                className="rounded-full border border-slate-700 p-1.5 text-slate-400 hover:text-white"
                aria-label="Remove selected file"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {uploading ? (
            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between text-sm text-slate-300">
                <span>Encrypting and uploading...</span>
                <span className="font-semibold text-cyan-300">{progress}%</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : null}

          <div className="mt-6 flex justify-end gap-3">
            <Button variant="secondary" onClick={handleClear} disabled={uploading}>
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={uploading}>
              {uploading ? `Uploading (${progress}%)...` : 'Upload file'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/50 p-5 text-sm text-slate-400">
          No file selected. Files are encrypted and protected upon upload.
        </div>
      )}
    </div>
  )
}

