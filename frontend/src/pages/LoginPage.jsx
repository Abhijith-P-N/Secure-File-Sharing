import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { KeyRound, ShieldCheck } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { forgotPassword, resetPassword } from '../services/authService'
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

  const [isForgotOpen, setIsForgotOpen] = useState(false)
  const [forgotStep, setForgotStep] = useState('email')
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotForm, setForgotForm] = useState({ code: '', newPassword: '', confirmPassword: '' })
  const [forgotErrors, setForgotErrors] = useState({})
  const [forgotStatus, setForgotStatus] = useState({ error: '', success: '', loading: false })
  const [resendTimer, setResendTimer] = useState(0)

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => ({ ...prev, [name]: '' }))
    setSubmitError('')
    setSuccessNotice('')
  }

  const validate = () => {
    const nextErrors = {}
    if (!form.email.trim()) nextErrors.email = 'Email is required.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) nextErrors.email = 'Please enter a valid email.'
    if (!form.password) nextErrors.password = 'Password is required.'
    return nextErrors
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const nextErrors = validate()
    if (Object.keys(nextErrors).length) { setErrors(nextErrors); return }
    setLoading(true)
    setSubmitError('')
    setSuccessNotice('')
    try {
      await login({ email: form.email, password: form.password })
      navigate('/dashboard', { replace: true })
    } catch (error) {
      const errorMsg =
        error?.status === 401 || error?.status === 400
          ? 'Incorrect email or password. Please verify your credentials.'
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

  const openForgotModal = () => {
    setForgotEmail(form.email || '')
    setForgotForm({ code: '', newPassword: '', confirmPassword: '' })
    setForgotErrors({})
    setForgotStatus({ error: '', success: '', loading: false })
    setForgotStep('email')
    setIsForgotOpen(true)
  }

  const validateForgotEmail = () => {
    if (!forgotEmail.trim()) return { email: 'Email is required.' }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forgotEmail.trim())) return { email: 'Please enter a valid email.' }
    return {}
  }

  const validateOtp = () => {
    const nextErrors = {}
    if (!forgotForm.code.trim()) nextErrors.code = 'Please enter the code from your email.'
    else if (forgotForm.code.trim().length !== 6) nextErrors.code = 'The code must be 6 digits.'
    if (!forgotForm.newPassword) nextErrors.newPassword = 'New password is required.'
    else if (forgotForm.newPassword.length < 8) nextErrors.newPassword = 'Password must be at least 8 characters.'
    if (!forgotForm.confirmPassword) nextErrors.confirmPassword = 'Confirmation is required.'
    else if (forgotForm.confirmPassword !== forgotForm.newPassword) nextErrors.confirmPassword = 'Passwords do not match.'
    return nextErrors
  }

  // Step 1 — send the OTP to the provided email.
  const handleSendOtp = async (event) => {
    event.preventDefault()
    const nextErrors = validateForgotEmail()
    if (Object.keys(nextErrors).length) { setForgotErrors(nextErrors); return }
    setForgotStatus({ error: '', success: '', loading: true })
    try {
      await forgotPassword({ email: forgotEmail.trim() })
      setForgotStep('otp')
      setForgotStatus({ error: '', success: '', loading: false })
      startResendTimer()
    } catch (err) {
      setForgotStatus({ error: err?.message || 'Unable to send a reset code. Please try again.', success: '', loading: false })
    }
  }

  // Step 2 — verify the OTP and set the new password.
  const handleResetPassword = async (event) => {
    event.preventDefault()
    const nextErrors = validateOtp()
    if (Object.keys(nextErrors).length) { setForgotErrors(nextErrors); return }
    setForgotStatus({ error: '', success: '', loading: true })
    try {
      await resetPassword({
        email: forgotEmail.trim(),
        code: forgotForm.code.trim(),
        newPassword: forgotForm.newPassword,
      })
      setForgotStatus({ error: '', success: 'Password has been reset successfully!', loading: false })
      setForm({ email: forgotEmail.trim(), password: '' })
      setSuccessNotice('Password reset successfully! Please sign in with your new password.')
      setTimeout(() => {
        setIsForgotOpen(false)
        setForgotStep('email')
        setForgotForm({ code: '', newPassword: '', confirmPassword: '' })
      }, 1600)
    } catch (err) {
      setForgotStatus({ error: err?.message || 'Unable to reset your password. Please try again.', success: '', loading: false })
    }
  }

  // Resend the OTP with a short cooldown to avoid spamming the endpoint.
  const startResendTimer = () => {
    setResendTimer(45)
    const interval = setInterval(() => {
      setResendTimer((t) => {
        if (t <= 1) { clearInterval(interval); return 0 }
        return t - 1
      })
    }, 1000)
  }

  const handleResend = async () => {
    if (resendTimer > 0) return
    try {
      await forgotPassword({ email: forgotEmail.trim() })
      setForgotStatus({ error: '', success: '', loading: false })
      startResendTimer()
    } catch (err) {
      setForgotStatus({ error: err?.message || 'Unable to resend the code.', success: '', loading: false })
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-120px)] max-w-6xl items-center justify-center px-4 py-16 sm:px-6">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[14px] border border-border bg-surface shadow-[0_2px_8px_rgba(16,24,40,0.08)] lg:grid-cols-2">
        {/* Left panel */}
        <div className="bg-sidebar p-8 sm:p-10">
          <div className="flex h-full flex-col justify-between">
            <div>
              <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-[10px] bg-white/10">
                <ShieldCheck className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-[28px] font-semibold text-white leading-tight">Secure workspace access</h2>
              <p className="mt-3 text-[14px] leading-relaxed text-white/60">
                Protect your files with controlled access, encrypted sharing, and full audit visibility.
              </p>
            </div>
            <div className="mt-10 rounded-[10px] border border-white/10 bg-white/5 p-5">
              <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-white/50">Security status</p>
              <div className="mt-3 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-success/20 text-success">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[13px] font-medium text-white">Verified session protection</p>
                  <p className="text-[12px] text-white/50">Authentication managed by the backend.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right panel — form */}
        <div className="p-8 sm:p-10">
          <div className="mb-6">
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-primary">Welcome back</p>
            <h1 className="mt-2 text-[28px] font-semibold text-ink">Sign in</h1>
          </div>

          {submitError ? <Alert title="Login failed" message={submitError} tone="danger" /> : null}
          {successNotice ? <Alert title="Success" message={successNotice} tone="success" /> : null}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
                  onClick={openForgotModal}
                  className="text-[12px] font-medium text-primary hover:text-primary-hover"
                >
                  Forgot password?
                </button>
              }
            />
            <Button type="submit" fullWidth disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>

          <p className="mt-6 text-center text-[14px] text-muted">
            Need an account?{' '}
            <Link to="/register" className="font-medium text-primary hover:text-primary-hover">Create one</Link>
          </p>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <Modal open={isForgotOpen} title={forgotStep === 'otp' ? 'Enter Reset Code' : 'Reset Password'} onClose={() => setIsForgotOpen(false)}>
        <div className="space-y-4">
          {forgotStep === 'email' ? (
            <>
              <div className="flex items-start gap-3 rounded-[10px] border border-border bg-bg p-3.5 text-[13px] text-muted">
                <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p>Enter your account email and we'll send a one-time code to reset your password.</p>
              </div>

              {forgotStatus.error ? <Alert title="Reset error" message={forgotStatus.error} tone="danger" /> : null}
              {forgotStatus.success ? <Alert title="Success" message={forgotStatus.success} tone="success" /> : null}

              <form onSubmit={handleSendOtp} className="space-y-4">
                <Input
                  id="forgot-email"
                  label="Email address"
                  name="email"
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => { setForgotEmail(e.target.value); setForgotErrors((p) => ({ ...p, email: '' })); setForgotStatus({ error: '', success: '', loading: false }) }}
                  placeholder="name@company.com"
                  error={forgotErrors.email}
                  required
                />
                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="secondary" onClick={() => setIsForgotOpen(false)} disabled={forgotStatus.loading}>Cancel</Button>
                  <Button type="submit" disabled={forgotStatus.loading}>
                    {forgotStatus.loading ? 'Sending...' : 'Send Reset Code'}
                  </Button>
                </div>
              </form>
            </>
          ) : (
            <>
              <div className="flex items-start gap-3 rounded-[10px] border border-border bg-bg p-3.5 text-[13px] text-muted">
                <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p>
                  Enter the 6-digit code sent to <strong className="text-ink">{forgotEmail}</strong> and choose a new password.
                </p>
              </div>

              {forgotStatus.error ? <Alert title="Reset error" message={forgotStatus.error} tone="danger" /> : null}
              {forgotStatus.success ? <Alert title="Success" message={forgotStatus.success} tone="success" /> : null}

              <form onSubmit={handleResetPassword} className="space-y-4">
                <Input
                  id="forgot-code"
                  label="One-time code"
                  name="code"
                  inputMode="numeric"
                  maxLength={6}
                  value={forgotForm.code}
                  onChange={handleForgotChange}
                  placeholder="123456"
                  error={forgotErrors.code}
                  required
                  disabled={Boolean(forgotStatus.success)}
                />
                <Input id="forgot-newPassword" label="New Password" name="newPassword" type="password" value={forgotForm.newPassword} onChange={handleForgotChange} placeholder="Min. 8 characters" error={forgotErrors.newPassword} required disabled={Boolean(forgotStatus.success)} />
                <Input id="forgot-confirmPassword" label="Confirm Password" name="confirmPassword" type="password" value={forgotForm.confirmPassword} onChange={handleForgotChange} placeholder="Re-enter new password" error={forgotErrors.confirmPassword} required disabled={Boolean(forgotStatus.success)} />
                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => { setForgotStep('email'); setForgotErrors({}); setForgotStatus({ error: '', success: '', loading: false }) }}
                    className="text-[12px] font-medium text-muted hover:text-ink"
                    disabled={Boolean(forgotStatus.success)}
                  >
                    Change email
                  </button>
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendTimer > 0 || forgotStatus.loading || Boolean(forgotStatus.success)}
                    className="text-[12px] font-medium text-primary hover:text-primary-hover disabled:opacity-50"
                  >
                    {resendTimer > 0 ? `Resend code in ${resendTimer}s` : 'Resend code'}
                  </button>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="secondary" onClick={() => setIsForgotOpen(false)} disabled={forgotStatus.loading}>Cancel</Button>
                  <Button type="submit" disabled={forgotStatus.loading || Boolean(forgotStatus.success)}>
                    {forgotStatus.loading ? 'Resetting...' : 'Reset Password'}
                  </Button>
                </div>
              </form>
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}
