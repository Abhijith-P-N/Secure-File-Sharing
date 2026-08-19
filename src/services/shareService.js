import api from './api'

export const createShare = async (payload) => {
  const response = await api.post('/api/shares', payload)
  return response.data
}

export const getShareByToken = async (token) => {
  const response = await api.get(`/api/shares/${token}`)
  return response.data
}

export const revokeShare = async (id) => {
  const response = await api.post(`/api/shares/${id}/revoke`)
  return response.data
}

export const deleteShare = async (id) => {
  const response = await api.delete(`/api/shares/${id}`)
  return response.data
}

export const downloadSharedFile = async (token, password) => {
  const config = {
    responseType: 'blob',
    __skipAuth: true,
  }

  if (password) {
    const response = await api.post(`/api/shares/${token}/download`, { password }, config)
    return response
  }

  const response = await api.get(`/api/shares/${token}/download`, config)
  return response
}

