import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, KeyRound, ShieldCheck } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { resetPassword } from '../services/authService'

import Button from '../components/common/Button'
import Input from '../components/common/Input'
import Alert from '../components/common/Alert'
import Modal from '../components/common/Modal'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [successNotice, setSuccessNotice] = useState('')
  const [loading, setLoading] = useState(false)

  // Forgot password state
  const [isForgotOpen, setIsForgotOpen] = useState(false)
  const [forgotForm, setForgotForm] = useState({ email: '', newPassword: '', confirmPassword: '' })
  const [forgotErrors, setForgotErrors] = useState({})
  const [forgotStatus, setForgotStatus] = useState({ error: '', success: '', loading: false })

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => ({ ...prev, [name]: '' }))
    setSubmitError('')
    setSuccessNotice('')
  }

  const validate = () => {
    const nextErrors = {}

    if (!form.email.trim()) {
      nextErrors.email = 'Email is required.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      nextErrors.email = 'Please enter a valid email.'
    }

    if (!form.password) {
      nextErrors.password = 'Password is required.'
    }

    return nextErrors
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const nextErrors = validate()

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      return
    }

    setLoading(true)
    setSubmitError('')
    setSuccessNotice('')

    try {
      await login({ email: form.email, password: form.password })
      navigate('/dashboard', { replace: true })
    } catch (error) {
      const errorMsg =
        error?.status === 401 || error?.status === 400
          ? 'Incorrect email or password. Please verify your credentials or click "Forgotten password?".'
          : error?.message || 'Unable to log in. Please try again.'
      setSubmitError(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  const handleForgotChange = (event) => {
    const { name, value } = event.target
    setForgotForm((prev) => ({ ...prev, [name]: value }))
    setForgotErrors((prev) => ({ ...prev, [name]: '' }))
    setForgotStatus({ error: '', success: '', loading: false })
  }

  const validateForgot = () => {
    const nextErrors = {}

    if (!forgotForm.email.trim()) {
      nextErrors.email = 'Email is required.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forgotForm.email)) {
      nextErrors.email = 'Please enter a valid email.'
    }

    if (!forgotForm.newPassword) {
      nextErrors.newPassword = 'New password is required.'
    } else if (forgotForm.newPassword.length < 8) {
      nextErrors.newPassword = 'Password must be at least 8 characters.'
    }

    if (!forgotForm.confirmPassword) {
      nextErrors.confirmPassword = 'Confirmation is required.'
    } else if (forgotForm.confirmPassword !== forgotForm.newPassword) {
      nextErrors.confirmPassword = 'Incorrect password. Passwords do not match.'
    }

    return nextErrors
  }

  const handleForgotSubmit = async (event) => {
    event.preventDefault()
    const nextErrors = validateForgot()

    if (Object.keys(nextErrors).length) {
      setForgotErrors(nextErrors)
      return
    }

    setForgotStatus({ error: '', success: '', loading: true })

    try {
      await resetPassword({
        email: forgotForm.email,
        password: forgotForm.newPassword,
      })

      setForgotStatus({
        error: '',
        success: 'Password reset successfully! You can now sign in with your new password.',
        loading: false,
      })

      // Sync the new credentials to the main sign in form
      setForm({
        email: forgotForm.email,
        password: forgotForm.newPassword,
      })
      setSuccessNotice('Password reset successfully! Please sign in with your new password.')

      setTimeout(() => {
        setIsForgotOpen(false)
        setForgotForm({ email: '', newPassword: '', confirmPassword: '' })
      }, 1500)
    } catch (err) {
      setForgotStatus({
        error: err?.message || 'Incorrect information. Unable to reset password.',
        success: '',
        loading: false,
      })
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-80px)] max-w-6xl items-center justify-center px-4 py-16 sm:px-6">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[32px] border border-slate-800 bg-slate-900/70 shadow-2xl shadow-cyan-950/20 lg:grid-cols-2">
        <div className="bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.18),_transparent_30%),linear-gradient(180deg,_rgba(15,23,42,0.92),_rgba(2,6,23,1))] p-8 sm:p-10">
          <div className="flex h-full flex-col justify-between">
            <div>
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-500/30">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h2 className="text-3xl font-semibold text-white">Secure workspace access</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Protect your files with controlled access, encrypted sharing, and full audit visibility.
              </p>
            </div>

            <div className="mt-10 rounded-2xl border border-slate-700 bg-slate-950/40 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Security status</p>
              <div className="mt-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-300">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-white">Verified session protection</p>
                  <p className="text-sm text-slate-400">Authentication is managed by the backend.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-8 sm:p-10">
          <div className="mb-8">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-cyan-300">Welcome back</p>
            <h1 className="mt-3 text-3xl font-semibold text-white">Sign in</h1>
          </div>

          {submitError ? (
            <Alert title="Login failed" message={submitError} tone="danger" />
          ) : null}

          {successNotice ? (
            <Alert title="Success" message={successNotice} tone="success" />
          ) : null}

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <Input
              id="email"
              label="Email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder="name@company.com"
              error={errors.email}
              autoComplete="email"
            />

            <Input
              id="password"
              label="Password"
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Enter your password"
              error={errors.password}
              autoComplete="current-password"
              rightAction={
                <button
                  type="button"
                  onClick={() => {
                    setForgotForm({
                      email: form.email,
                      newPassword: '',
                      confirmPassword: '',
                    })
                    setForgotErrors({})
                    setForgotStatus({ error: '', success: '', loading: false })
                    setIsForgotOpen(true)
                  }}
                  className="text-xs font-medium text-cyan-400 transition hover:text-cyan-300 hover:underline"
                >
                  Forgotten password?
                </button>
              }
            />

            <div className="flex items-center justify-between text-sm text-slate-400">
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-300" /> Never share your password
              </span>
            </div>

            <Button type="submit" fullWidth disabled={loading} className="mt-4">
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-400">
            Need an account?{' '}
            <Link to="/register" className="font-medium text-cyan-300 hover:text-cyan-200">
              Create one
            </Link>
          </p>
        </div>
      </div>

      {/* Forgotten Password Modal */}
      <Modal
        open={isForgotOpen}
        title="Reset Forgotten Password"
        onClose={() => setIsForgotOpen(false)}
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-300">
            <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-cyan-400" />
            <p>
              Enter your account email and specify a new correct password to regain access to your secure workspace.
            </p>
          </div>

          {forgotStatus.error ? (
            <Alert title="Reset error" message={forgotStatus.error} tone="danger" />
          ) : null}

          {forgotStatus.success ? (
            <Alert title="Success" message={forgotStatus.success} tone="success" />
          ) : null}

          <form onSubmit={handleForgotSubmit} className="space-y-4 pt-1">
            <Input
              id="forgot-email"
              label="Email address"
              name="email"
              type="email"
              value={forgotForm.email}
              onChange={handleForgotChange}
              placeholder="name@company.com"
              error={forgotErrors.email}
              required
            />

            <Input
              id="forgot-newPassword"
              label="New Password"
              name="newPassword"
              type="password"
              value={forgotForm.newPassword}
              onChange={handleForgotChange}
              placeholder="Enter new password (min. 8 characters)"
              error={forgotErrors.newPassword}
              required
            />

            <Input
              id="forgot-confirmPassword"
              label="Confirm New Password"
              name="confirmPassword"
              type="password"
              value={forgotForm.confirmPassword}
              onChange={handleForgotChange}
              placeholder="Re-enter new password to verify"
              error={forgotErrors.confirmPassword}
              required
            />

            <div className="mt-6 flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsForgotOpen(false)}
                disabled={forgotStatus.loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={forgotStatus.loading}>
                {forgotStatus.loading ? 'Updating password...' : 'Reset Password'}
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  )
}

