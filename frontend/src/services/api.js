import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

const getStoredToken = () => {
  try {
    return localStorage.getItem('auth_token')
  } catch {
    return null
  }
}

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

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      try {
        localStorage.removeItem('auth_token')
      } catch {
        // Ignore storage errors
      }
    }
    const normalized = normalizeApiError(error)
    return Promise.reject(normalized)
  },
)

export default api

