import { describe, it, expect } from 'vitest'
import { formatBytes, formatDate, getSecurityTone } from './formatters.js'

describe('formatters', () => {
  describe('formatBytes', () => {
    it('formats bytes correctly', () => {
      expect(formatBytes(0)).toBe('0 B')
      expect(formatBytes(512)).toBe('512 B')
      expect(formatBytes(1024)).toBe('1.0 KB')
      expect(formatBytes(1536)).toBe('1.5 KB')
      expect(formatBytes(1024 * 1024)).toBe('1.0 MB')
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1.0 GB')
      expect(formatBytes(1024 * 1024 * 1024 * 1024)).toBe('1.0 TB')
    })

    it('handles invalid input', () => {
      expect(formatBytes(NaN)).toBe('0 B')
      expect(formatBytes(null)).toBe('0 B')
      expect(formatBytes(undefined)).toBe('0 B')
    })
  })

  describe('formatDate', () => {
    it('formats valid dates', () => {
      const date = new Date('2024-01-15T10:30:00Z')
      const result = formatDate(date.toISOString())
      expect(result).not.toBe('—')
      expect(result).toContain('2024')
    })

    it('handles invalid dates', () => {
      expect(formatDate(null)).toBe('—')
      expect(formatDate(undefined)).toBe('—')
      expect(formatDate('invalid')).toBe('—')
      expect(formatDate('')).toBe('—')
    })
  })

  describe('getSecurityTone', () => {
    it('returns success for secure states', () => {
      expect(getSecurityTone('encrypted')).toBe('success')
      expect(getSecurityTone('verified')).toBe('success')
      expect(getSecurityTone('secure')).toBe('success')
      expect(getSecurityTone('active')).toBe('success')
      expect(getSecurityTone('healthy')).toBe('success')
      expect(getSecurityTone('ENCRYPTED')).toBe('success')
    })

    it('returns danger for failed states', () => {
      expect(getSecurityTone('failed')).toBe('danger')
      expect(getSecurityTone('expired')).toBe('danger')
      expect(getSecurityTone('revoked')).toBe('danger')
      expect(getSecurityTone('warning')).toBe('danger')
      expect(getSecurityTone('blocked')).toBe('danger')
      expect(getSecurityTone('FAILED')).toBe('danger')
    })

    it('returns warning for unknown states', () => {
      expect(getSecurityTone('pending')).toBe('warning')
      expect(getSecurityTone('unknown')).toBe('warning')
      expect(getSecurityTone(null)).toBe('neutral')
      expect(getSecurityTone(undefined)).toBe('neutral')
    })
  })
})