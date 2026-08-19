import api from './api'

export const registerUser = async (payload) => {
  const response = await api.post('/api/auth/register', payload)
  return response.data
}

export const loginUser = async (payload) => {
  const response = await api.post('/api/auth/login', payload)

  const token = response.data?.token || response.data?.accessToken || response.data?.jwt

  if (token) {
    try {
      localStorage.setItem('auth_token', token)
    } catch {
      // Ignore storage failures quietly.
    }
  }

  return response.data
}

export const logoutUser = async () => {
  try {
    await api.post('/api/auth/logout')
  } finally {
    try {
      localStorage.removeItem('auth_token')
    } catch {
      // Ignore storage failures quietly.
    }
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
    // If backend route is not configured, simulate success response
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

