import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import Button from '../components/common/Button'
import Input from '../components/common/Input'
import Alert from '../components/common/Alert'

export default function RegisterPage() {
  const navigate = useNavigate()
  const { register } = useAuth()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' })
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => ({ ...prev, [name]: '' }))
    setSubmitError('')
    setSuccessMessage('')
  }

  const validate = () => {
    const nextErrors = {}
    if (!form.name.trim()) nextErrors.name = 'Name is required.'
    if (!form.email.trim()) nextErrors.email = 'Email is required.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) nextErrors.email = 'Please enter a valid email.'
    if (!form.password) nextErrors.password = 'Password is required.'
    else if (form.password.length < 8) nextErrors.password = 'Password must be at least 8 characters.'
    if (!form.confirmPassword) nextErrors.confirmPassword = 'Please confirm your password.'
    else if (form.confirmPassword !== form.password) nextErrors.confirmPassword = 'Passwords do not match.'
    return nextErrors
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const nextErrors = validate()
    if (Object.keys(nextErrors).length) { setErrors(nextErrors); return }
    setLoading(true)
    setSubmitError('')
    setSuccessMessage('')
    try {
      await register({ name: form.name, email: form.email, password: form.password })
      setSuccessMessage('Registration successful. Redirecting...')
      setTimeout(() => navigate('/dashboard', { replace: true }), 1000)
    } catch (error) {
      setSubmitError(error?.message || 'Unable to create your account. Please try again.')
    } finally {
      setLoading(false)
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
              <h2 className="text-[28px] font-semibold text-white leading-tight">Create your secure account</h2>
              <p className="mt-3 text-[14px] leading-relaxed text-white/60">
                Join a secure environment built for private file sharing, protected links, and trusted auditability.
              </p>
            </div>
            <div className="mt-10 rounded-[10px] border border-white/10 bg-white/5 p-5">
              <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-white/50">Security-first</p>
              <ul className="mt-3 space-y-2 text-[13px] text-white/60">
                <li className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-success" /> Controlled access policies</li>
                <li className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-success" /> Expiring share links</li>
                <li className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-success" /> Integrity checks and audit logs</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Right panel — form */}
        <div className="p-8 sm:p-10">
          <div className="mb-6">
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-primary">Start here</p>
            <h1 className="mt-2 text-[28px] font-semibold text-ink">Register</h1>
          </div>

          {submitError ? <Alert title="Registration failed" message={submitError} tone="danger" /> : null}
          {successMessage ? <Alert title="Success" message={successMessage} tone="success" /> : null}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <Input id="name" label="Name" name="name" value={form.name} onChange={handleChange} placeholder="Full name" error={errors.name} />
            <Input id="email" label="Email" name="email" type="email" value={form.email} onChange={handleChange} placeholder="name@company.com" error={errors.email} />
            <Input id="password" label="Password" name="password" type="password" value={form.password} onChange={handleChange} placeholder="Create a password" error={errors.password} />
            <Input id="confirmPassword" label="Confirm password" name="confirmPassword" type="password" value={form.confirmPassword} onChange={handleChange} placeholder="Repeat your password" error={errors.confirmPassword} />
            <Button type="submit" fullWidth disabled={loading}>
              {loading ? 'Creating account...' : 'Create account'}
            </Button>
          </form>

          <p className="mt-6 text-center text-[14px] text-muted">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-primary hover:text-primary-hover">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
