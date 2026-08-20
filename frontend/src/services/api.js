import axios from 'axios'
import {
  getStoredToken,
  getStoredRefreshToken,
  setTokens,
  clearTokens,
  refreshSession,
} from './authService'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = getStoredToken()

  if (token && !config.__skipAuth) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`,
    }
  }

  return config
})

export const normalizeApiError = (error) => {
  const status = error?.response?.status
  const serverMessage = error?.response?.data?.message || error?.response?.data?.error || error?.message

  if (!error || !error.response) {
    return {
      status: 0,
      title: 'Server unavailable',
      message: serverMessage || 'The server is currently unavailable. Please try again later.',
    }
  }

  const defaultMessages = {
    400: 'Please check the submitted data and try again.',
    401: 'Session expired or invalid credentials. Please log in again.',
    403: 'You do not have permission to perform this action.',
    404: 'The requested resource could not be found.',
    429: 'Too many requests. Please wait a moment before trying again.',
    500: 'Something went wrong on the server. Please try again soon.',
  }

  const titles = {
    400: 'Request invalid',
    401: 'Unauthorized',
    403: 'Access denied',
    404: 'Resource not found',
    429: 'Too many requests',
    500: 'Server error',
  }

  return {
    status,
    title: titles[status] || 'Request failed',
    message: serverMessage || defaultMessages[status] || 'The request could not be completed.',
  }
}

// Single-flight refresh: parallel 401s share one refresh call.
let refreshPromise = null

async function tryRefreshAccessToken() {
  if (!getStoredRefreshToken()) return null

  if (!refreshPromise) {
    refreshPromise = refreshSession()
      .catch(() => null)
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error?.config
    const isAuthFailure = error?.response?.status === 401

    if (isAuthFailure && original && !original.__skipAuth && !original._retried) {
      const newToken = await tryRefreshAccessToken()

      if (newToken) {
        original._retried = true
        original.headers = {
          ...original.headers,
          Authorization: `Bearer ${newToken}`,
        }
        return api(original)
      }
    }

    if (isAuthFailure && !original?.__skipAuth) {
      clearTokens()
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login'
      }
    }

    const normalized = normalizeApiError(error)
    return Promise.reject(normalized)
  },
)

export { setTokens, clearTokens }
export default api