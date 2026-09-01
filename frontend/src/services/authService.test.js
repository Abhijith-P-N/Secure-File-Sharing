import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as authService from './authService.js'
import api from './api.js'

vi.mock('./api.js', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn()
  }
}))

describe('authService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  describe('getStoredToken', () => {
    it('returns token from localStorage', () => {
      localStorage.setItem('auth_token', 'test-token')
      expect(authService.getStoredToken()).toBe('test-token')
    })

    it('returns null when no token', () => {
      expect(authService.getStoredToken()).toBeNull()
    })
  })

  describe('setTokens', () => {
    it('stores access and refresh tokens', () => {
      authService.setTokens('access-token', 'refresh-token')
      expect(localStorage.getItem('auth_token')).toBe('access-token')
      expect(localStorage.getItem('refresh_token')).toBe('refresh-token')
    })

    it('handles missing tokens', () => {
      authService.setTokens(null, 'refresh-only')
      expect(localStorage.getItem('auth_token')).toBeNull()
      expect(localStorage.getItem('refresh_token')).toBe('refresh-only')
    })
  })

  describe('clearTokens', () => {
    it('removes both tokens', () => {
      localStorage.setItem('auth_token', 'access')
      localStorage.setItem('refresh_token', 'refresh')
      authService.clearTokens()
      expect(localStorage.getItem('auth_token')).toBeNull()
      expect(localStorage.getItem('refresh_token')).toBeNull()
    })
  })

  describe('loginUser', () => {
    it('calls API and stores tokens', async () => {
      api.post.mockResolvedValue({
        data: { accessToken: 'new-access', refreshToken: 'new-refresh', user: { id: '1' } }
      })

      const result = await authService.loginUser({ email: 'test@test.com', password: 'password' })

      expect(api.post).toHaveBeenCalledWith('/api/auth/login', { email: 'test@test.com', password: 'password' })
      expect(localStorage.getItem('auth_token')).toBe('new-access')
      expect(localStorage.getItem('refresh_token')).toBe('new-refresh')
      expect(result.accessToken).toBe('new-access')
    })

    it('handles login without tokens in response', async () => {
      api.post.mockResolvedValue({ data: { user: { id: '1' } } })
      const result = await authService.loginUser({ email: 'test@test.com', password: 'password' })
      expect(result.user).toEqual({ id: '1' })
    })
  })

  describe('refreshSession', () => {
    it('refreshes tokens successfully', async () => {
      localStorage.setItem('refresh_token', 'old-refresh')
      api.post.mockResolvedValue({ data: { accessToken: 'new-access', refreshToken: 'new-refresh' } })

      const token = await authService.refreshSession()

      expect(api.post).toHaveBeenCalledWith('/api/auth/refresh', { refreshToken: 'old-refresh' }, { __skipAuth: true, _retried: true })
      expect(token).toBe('new-access')
      expect(localStorage.getItem('auth_token')).toBe('new-access')
    })

    it('returns null when no refresh token', async () => {
      const token = await authService.refreshSession()
      expect(token).toBeNull()
    })
  })

  describe('logoutUser', () => {
    it('calls logout API and clears tokens', async () => {
      localStorage.setItem('refresh_token', 'refresh')
      api.post.mockResolvedValue({ data: {} })

      await authService.logoutUser()

      expect(api.post).toHaveBeenCalledWith('/api/auth/logout', { refreshToken: 'refresh' }, { __skipAuth: false })
      expect(localStorage.getItem('auth_token')).toBeNull()
    })

    it('clears tokens even if API fails', async () => {
      localStorage.setItem('auth_token', 'access')
      localStorage.setItem('refresh_token', 'refresh')
      api.post.mockRejectedValue(new Error('Network error'))

      await authService.logoutUser()

      expect(localStorage.getItem('auth_token')).toBeNull()
      expect(localStorage.getItem('refresh_token')).toBeNull()
    })
  })

  describe('getCurrentUser', () => {
    it('returns user data', async () => {
      api.get.mockResolvedValue({ data: { user: { id: '1', email: 'test@test.com' } } })
      const result = await authService.getCurrentUser()
      expect(result.user).toEqual({ id: '1', email: 'test@test.com' })
    })
  })
})