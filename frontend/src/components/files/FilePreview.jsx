import { useState, useRef } from 'react'
import { FileImage, FileVideo, FileAudio, FileCode, FileText, FileArchive, FileType, Maximize2, Minimize2, Download, X } from 'lucide-react'
import { formatBytes } from '../../utils/formatters'

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp']
const PDF_TYPES = ['application/pdf']
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime']
const AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/webm']
const TEXT_TYPES = ['text/plain', 'text/csv', 'text/html', 'text/css', 'text/javascript', 'application/json', 'application/xml']

export default function FilePreview({ file, onDownload, onClose }) {
  const [expanded, setExpanded] = useState(false)
  const [imageError, setImageError] = useState(false)
  const videoRef = useRef(null)
  const audioRef = useRef(null)

  if (!file) return null

  const isImage = IMAGE_TYPES.includes(file.mime_type)
  const isPdf = PDF_TYPES.includes(file.mime_type)
  const isVideo = VIDEO_TYPES.includes(file.mime_type)
  const isAudio = AUDIO_TYPES.includes(file.mime_type)
  const isText = TEXT_TYPES.includes(file.mime_type) || file.mime_type?.startsWith('text/')

  const getFileIcon = () => {
    if (isImage) return <FileImage className="h-8 w-8 text-success" />
    if (isPdf) return <FileType className="h-8 w-8 text-danger" />
    if (isVideo) return <FileVideo className="h-8 w-8 text-primary" />
    if (isAudio) return <FileAudio className="h-8 w-8 text-warning" />
    if (isText) return <FileCode className="h-8 w-8 text-info" />
    if (file.mime_type?.includes('zip') || file.mime_type?.includes('archive')) return <FileArchive className="h-8 w-8 text-warning" />
    return <FileText className="h-8 w-8 text-muted" />
  }

  const renderPreview = () => {
    if (isImage && !imageError) {
      return (
        <img src={`/api/files/${file.id}/download`} alt={file.original_name} className="max-h-[70vh] max-w-full object-contain" onError={() => setImageError(true)} />
      )
    }
    if (isPdf) {
      return (
        <div className="w-full h-[70vh]">
          <iframe src={`/api/files/${file.id}/download`} className="w-full h-full border-0 rounded-[8px]" title={file.original_name} />
        </div>
      )
    }
    if (isVideo) {
      return (
        <video ref={videoRef} controls className="max-h-[70vh] max-w-full" onError={() => setImageError(true)}>
          <source src={`/api/files/${file.id}/download`} type={file.mime_type} />
          Your browser does not support video playback.
        </video>
      )
    }
    if (isAudio) {
      return (
        <audio ref={audioRef} controls className="w-full max-w-md" onError={() => setImageError(true)}>
          <source src={`/api/files/${file.id}/download`} type={file.mime_type} />
          Your browser does not support audio playback.
        </audio>
      )
    }
    if (isText) {
      return (
        <div className="w-full h-[70vh] overflow-auto p-4 rounded-[10px] bg-bg border border-border text-[13px] text-muted text-center py-12">
          <p>Text preview not available in this view.</p>
          <a href={`/api/files/${file.id}/download`} className="mt-1 text-primary hover:underline" download>Download to view</a>
        </div>
      )
    }
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        {getFileIcon()}
        <p className="mt-4 text-[14px] text-muted">Preview not available for this file type</p>
        <p className="text-[12px] text-muted-dim mt-1">{file.mime_type || 'Unknown type'} · {formatBytes(file.size_bytes)}</p>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4" role="dialog" aria-modal="true" aria-labelledby="preview-title">
      <div className={`relative w-full max-w-4xl max-h-[90vh] bg-surface rounded-[14px] border border-border overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.3)] transition-all duration-200 ${expanded ? 'max-w-[95vw] max-h-[95vh]' : ''}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-surface sticky top-0">
          <div className="flex items-center gap-3 min-w-0">
            {getFileIcon()}
            <div className="min-w-0">
              <h2 id="preview-title" className="text-[15px] font-semibold text-ink truncate">{file.original_name}</h2>
              <p className="text-[12px] text-muted">{formatBytes(file.size_bytes)} · {file.mime_type || 'Unknown'}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setExpanded(!expanded)} className="rounded-lg p-2 text-muted hover:bg-surface-hover hover:text-ink transition-colors duration-150" aria-label={expanded ? 'Minimize' : 'Expand'}>
              {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
            <button onClick={onDownload} className="rounded-lg p-2 text-muted hover:bg-surface-hover hover:text-ink transition-colors duration-150" aria-label="Download">
              <Download className="h-4 w-4" />
            </button>
            <button onClick={onClose} className="rounded-lg p-2 text-muted hover:bg-danger-bg hover:text-danger transition-colors duration-150" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className={`overflow-auto max-h-[calc(90vh-60px)] ${expanded ? 'p-6' : 'p-4'}`}>
          {renderPreview()}
        </div>
      </div>
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden="true" />
    </div>
  )
}
