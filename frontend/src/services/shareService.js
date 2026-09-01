import api from './api'

export const createShare = async (payload) => {
  const response = await api.post('/api/shares', payload)
  return response.data
}

export const getShareByToken = async (token) => {
  const response = await api.get(`/api/shares/${token}`, { __skipAuth: true })
  return response.data?.share || response.data
}

export const listShares = async (fileId) => {
  const response = await api.get('/api/shares', { params: fileId ? { fileId } : undefined })
  return response.data?.shares || []
}

export const revokeShare = async (id) => {
  const response = await api.post(`/api/shares/${id}/revoke`)
  return response.data
}

export const deleteShare = async (id) => {
  const response = await api.delete(`/api/shares/${id}`)
  return response.data
}

export const requestAccess = async (token, email) => {
  const response = await api.post(`/api/shares/${token}/request-access`, { email }, { __skipAuth: true })
  return response.data
}

export const verifyAccess = async (token, email, code) => {
  const response = await api.post(`/api/shares/${token}/verify-access`, { email, code }, { __skipAuth: true })
  return response.data
}

export const downloadSharedFile = async (token, password, downloadToken) => {
  const url = `${api.defaults.baseURL || ''}/api/shares/${token}/download`

  const options = {
    method: password ? 'POST' : 'GET',
    credentials: 'include',
    headers: {},
  }

  const body = {}
  if (password) body.password = password
  if (downloadToken) body.downloadToken = downloadToken
  if (Object.keys(body).length) {
    options.method = 'POST'
    options.headers['Content-Type'] = 'application/json'
    options.body = JSON.stringify(body)
  }

  const response = await fetch(url, options)

  if (!response.ok) {
    let message = ''
    try {
      const body = await response.json()
      message = body.error || body.message || ''
    } catch {
      // response wasn't JSON
    }
    const error = new Error(message || `Request failed with status code ${response.status}`)
    error.status = response.status
    throw error
  }

  return response
}

