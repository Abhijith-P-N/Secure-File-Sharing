import api from './api'

export const getStats = async () => {
  const response = await api.get('/api/admin/stats')
  return response.data?.stats || response.data
}

export const getSecurityEvents = async () => {
  const response = await api.get('/api/admin/security-events')
  return response.data?.events || []
}

export const getUsers = async () => {
  const response = await api.get('/api/admin/users')
  return response.data?.users || []
}

export const getAllFiles = async () => {
  const response = await api.get('/api/admin/files')
  return response.data?.files || []
}