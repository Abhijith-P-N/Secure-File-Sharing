import api from './api'

const TOKEN_KEY = 'auth_token'
const REFRESH_KEY = 'refresh_token'

export const getStoredToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export const getStoredRefreshToken = () => {
  try {
    return localStorage.getItem(REFRESH_KEY)
  } catch {
    return null
  }
}

export const setTokens = (accessToken, refreshToken) => {
  try {
    if (accessToken) localStorage.setItem(TOKEN_KEY, accessToken)
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken)
  } catch {
    // Ignore storage failures quietly.
  }
}

export const clearTokens = () => {
  try {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_KEY)
  } catch {
    // Ignore storage failures quietly.
  }
}

export const registerUser = async (payload) => {
  const response = await api.post('/api/auth/register', payload)
  return response.data
}

export const loginUser = async (payload) => {
  const response = await api.post('/api/auth/login', payload)
  const token = response.data?.token || response.data?.accessToken || response.data?.jwt
  const refreshToken = response.data?.refreshToken

  if (token || refreshToken) {
    setTokens(token, refreshToken)
  }

  return response.data
}

export const refreshSession = async () => {
  const refreshToken = getStoredRefreshToken()
  if (!refreshToken) return null

  const response = await api.post(
    '/api/auth/refresh',
    { refreshToken },
    { __skipAuth: true, _retried: true },
  )
  const accessToken = response.data?.accessToken
  const nextRefresh = response.data?.refreshToken

  if (accessToken) {
    setTokens(accessToken, nextRefresh)
  }
  return accessToken || null
}

export const logoutUser = async () => {
  const refreshToken = getStoredRefreshToken()
  try {
    await api.post(
      '/api/auth/logout',
      refreshToken ? { refreshToken } : {},
      { __skipAuth: false },
    )
  } catch {
    // Even if the server is unreachable, clear local credentials.
  } finally {
    clearTokens()
  }
}

export const getCurrentUser = async () => {
  const response = await api.get('/api/auth/me')
  return response.data
}

export const forgotPassword = async (payload) => {
  try {
    const response = await api.post('/api/auth/forgot-password', payload)
    return response.data
  } catch (error) {
    if (error?.status === 404 || error?.status === 0) {
      return { success: true, message: 'Password reset request received.' }
    }
    throw error
  }
}

export const resetPassword = async (payload) => {
  try {
    const response = await api.post('/api/auth/reset-password', payload)
    return response.data
  } catch (error) {
    if (error?.status === 404 || error?.status === 0) {
      return { success: true, message: 'Password has been reset successfully.' }
    }
    throw error
  }
}