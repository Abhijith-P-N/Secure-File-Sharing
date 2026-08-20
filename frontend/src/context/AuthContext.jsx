import { useEffect, useMemo, useState } from 'react'
import { AuthContext } from './authContextInstance'
import { getCurrentUser, loginUser, logoutUser, registerUser } from '../services/authService'

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState('')

  const getCurrentSession = async () => {
    try {
      setLoading(true)
      const currentUser = await getCurrentUser()
      setUser(currentUser?.user || currentUser || null)
      setAuthError('')
    } catch (error) {
      setUser(null)
      if (error?.status !== 401 && error?.status !== 403) {
        setAuthError(error?.message || 'Unable to load your session.')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const token = localStorage.getItem('auth_token')

    if (token) {
      getCurrentSession()
      return
    }

    setLoading(false)
  }, [])

  const login = async (payload) => {
    const response = await loginUser(payload)
    await getCurrentSession()
    return response
  }

  const register = async (payload) => {
    const response = await registerUser(payload)
    try {
      await loginUser({ email: payload.email, password: payload.password })
    } catch {
      // If auto-login fails, keep the registered user state; the user can sign in again.
    }
    await getCurrentSession()
    return response
  }

  const logout = async () => {
    try {
      await logoutUser()
    } finally {
      setUser(null)
      setAuthError('')
    }
  }

  const value = useMemo(
    () => ({
      user,
      loading,
      authError,
      isAuthenticated: Boolean(user),
      login,
      register,
      logout,
      getCurrentUser: getCurrentSession,
      setAuthError,
      setUser,
    }),
    [user, loading, authError],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthProvider


