import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Headphones, Lock, Settings, Shield, User, BarChart3, Zap } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const ROLES = [
  { value: 'employee', label: 'Employee', buttonLabel: 'employee', icon: User },
  { value: 'agent', label: 'IT agent', buttonLabel: 'IT agent', icon: Headphones },
  { value: 'admin', label: 'IT admin', buttonLabel: 'IT admin', icon: Settings },
  { value: 'management', label: 'Management', buttonLabel: 'management', icon: BarChart3 },
]

const FEATURES = [
  { icon: Zap, text: 'Raise a ticket in a few clicks' },
  { icon: Eye, text: 'Track status in real time' },
  { icon: Shield, text: 'Your data stays secure' },
]

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [role, setRole] = useState('employee')
  const [employeeId, setEmployeeId] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showForgot, setShowForgot] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await login(employeeId.trim(), password, role)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  const roleLabel = ROLES.find((r) => r.value === role)?.buttonLabel || 'employee'

  return (
    <div className="flex min-h-full">
      <div className="hidden w-[42%] flex-col justify-between bg-ink-900 px-10 py-12 text-white lg:flex">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-sm font-bold">
              H
            </div>
            <span className="text-sm font-semibold">IT Helpdesk</span>
          </div>

          <h1 className="mt-16 text-3xl font-bold leading-tight">Get IT help in under a minute</h1>
          <p className="mt-3 text-sm text-white/60">
            Report an issue and follow it until it's fixed.
          </p>

          <div className="mt-10 space-y-4">
            {FEATURES.map((f) => (
              <div key={f.text} className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <f.icon size={16} />
                </div>
                <span className="text-sm text-white/80">{f.text}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-white/40">Confidential, internal use</p>
      </div>

      <div className="flex flex-1 items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
          <p className="mt-1 text-sm text-gray-500">Choose your role and sign in.</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="field-label">Sign in as</label>
              <div className="grid grid-cols-4 gap-2">
                {ROLES.map((r) => (
                  <button
                    type="button"
                    key={r.value}
                    onClick={() => setRole(r.value)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border px-1 py-2.5 text-[11px] font-semibold transition ${
                      role === r.value
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    <r.icon size={17} />
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="field-label">Employee ID</label>
              <div className="relative">
                <User size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  className="input pl-9"
                  placeholder="e.g. E1001"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  autoComplete="username"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck="false"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="field-label">Password</label>
                <button
                  type="button"
                  onClick={() => setShowForgot((v) => !v)}
                  className="mb-1 text-xs font-medium text-brand-600 hover:text-brand-700"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input px-9"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {showForgot && (
                <p className="mt-1.5 text-xs text-gray-500">
                  Contact your IT administrator to reset your password.
                </p>
              )}
            </div>

            {error && <p className="text-sm font-medium text-rose-600">{error}</p>}

            <button type="submit" disabled={busy} className="btn btn-primary w-full">
              {busy ? 'Signing in...' : `Sign in as ${roleLabel}`}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-gray-500">
            Can't sign in?{' '}
            <a href="mailto:it-helpdesk@example.com" className="font-medium text-brand-600 hover:text-brand-700">
              Contact the IT helpdesk
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
