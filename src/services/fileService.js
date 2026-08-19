import api from './api'

export const getFiles = async () => {
  const response = await api.get('/api/files')
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
