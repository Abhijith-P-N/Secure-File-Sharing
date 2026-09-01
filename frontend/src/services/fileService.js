import api from './api'

const CHUNK_SIZE = 5 * 1024 * 1024 // 5MB

export const getFiles = async () => {
  const response = await api.get('/api/files')
  return response.data
}

export const searchFiles = async (query) => {
  const response = await api.get(`/api/files/search?q=${encodeURIComponent(query)}`)
  return response.data
}

export const getFileById = async (id) => {
  const response = await api.get(`/api/files/${id}`)
  return response.data
}

export const uploadFile = async (file, onUploadProgress) => {
  const formData = new FormData()
  formData.append('file', file)

  const response = await api.post('/api/files/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress,
  })

  return response.data
}

export const uploadFileChunked = async (file, onProgress) => {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE)
  
  // Create upload session
  const sessionRes = await api.post('/api/upload/session', {
    originalName: file.name,
    mimeType: file.type || 'application/octet-stream',
    totalSize: file.size,
    chunkSize: CHUNK_SIZE
  })
  
  const { sessionId, totalChunks: serverTotalChunks } = sessionRes.data
  
  // Calculate SHA256 for integrity
  const sha256 = await calculateSHA256(file)
  
  // Upload chunks
  for (let i = 0; i < serverTotalChunks; i++) {
    const start = i * CHUNK_SIZE
    const end = Math.min(start + CHUNK_SIZE, file.size)
    const chunk = file.slice(start, end)
    const chunkData = await readFileAsBase64(chunk)
    
    await api.post('/api/upload/chunk', {
      sessionId,
      chunkIndex: i,
      chunkData
    })
    
    if (onProgress) {
      const progress = Math.round(((i + 1) / serverTotalChunks) * 100)
      onProgress({ loaded: progress, total: 100 })
    }
  }
  
  // Complete upload
  const completeRes = await api.post('/api/upload/complete', {
    sessionId,
    expectedSha256: sha256
  })
  
  return completeRes.data
}

const readFileAsBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

const calculateSHA256 = async (file) => {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export const deleteFile = async (id) => {
  const response = await api.delete(`/api/files/${id}`)
  return response.data
}

export const downloadFile = async (id) => {
  const response = await api.get(`/api/files/${id}/download`, {
    responseType: 'blob',
  })
  return response
}
