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

    if (!form.name.trim()) {
      nextErrors.name = 'Name is required.'
    }

    if (!form.email.trim()) {
      nextErrors.email = 'Email is required.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      nextErrors.email = 'Please enter a valid email.'
    }

    if (!form.password) {
      nextErrors.password = 'Password is required.'
    } else if (form.password.length < 8) {
      nextErrors.password = 'Password must be at least 8 characters.'
    }

    if (!form.confirmPassword) {
      nextErrors.confirmPassword = 'Please confirm your password.'
    } else if (form.confirmPassword !== form.password) {
      nextErrors.confirmPassword = 'Passwords do not match.'
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
    setSuccessMessage('')

    try {
      await register({
        name: form.name,
        email: form.email,
        password: form.password,
      })
      setSuccessMessage('Registration successful. Redirecting to your workspace...')
      setTimeout(() => navigate('/dashboard', { replace: true }), 1000)
    } catch (error) {
      setSubmitError(error?.message || 'Unable to create your account. Please try again.')
    } finally {
      setLoading(false)
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
              <h2 className="text-3xl font-semibold text-white">Create your secure account</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Join a secure environment built for private file sharing, protected links, and trusted auditability.
              </p>
            </div>

            <div className="mt-10 rounded-2xl border border-slate-700 bg-slate-950/40 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Security-first</p>
              <ul className="mt-4 space-y-3 text-sm text-slate-300">
                <li>• Controlled access policies</li>
                <li>• Expiring share links</li>
                <li>• Integrity checks and audit logs</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="p-8 sm:p-10">
          <div className="mb-8">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-cyan-300">Start here</p>
            <h1 className="mt-3 text-3xl font-semibold text-white">Register</h1>
          </div>

          {submitError ? <Alert title="Registration failed" message={submitError} tone="danger" /> : null}
          {successMessage ? <Alert title="Success" message={successMessage} tone="success" /> : null}

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <Input id="name" label="Name" name="name" value={form.name} onChange={handleChange} placeholder="Full name" error={errors.name} />
            <Input id="email" label="Email" name="email" type="email" value={form.email} onChange={handleChange} placeholder="name@company.com" error={errors.email} />
            <Input id="password" label="Password" name="password" type="password" value={form.password} onChange={handleChange} placeholder="Create a password" error={errors.password} />
            <Input id="confirmPassword" label="Confirm password" name="confirmPassword" type="password" value={form.confirmPassword} onChange={handleChange} placeholder="Repeat your password" error={errors.confirmPassword} />

            <Button type="submit" fullWidth disabled={loading}>
              {loading ? 'Creating account...' : 'Create account'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-400">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-cyan-300 hover:text-cyan-200">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
