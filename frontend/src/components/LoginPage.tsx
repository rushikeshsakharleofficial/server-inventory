import { useState } from 'react'
import { Wifi, Eye, EyeOff, RefreshCw } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

export default function LoginPage() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass]     = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError]           = useState('')
  const [loading, setLoading]       = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!username.trim() || !password) return
    setError('')
    setLoading(true)
    try {
      await login(username.trim(), password, rememberMe)
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(detail ?? 'Invalid username or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-base flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient cyan glow */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: '-10%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '60vw',
          height: '40vh',
          background: 'radial-gradient(ellipse, var(--ac-bg) 0%, transparent 70%)',
        }}
        aria-hidden="true"
      />
      {/* Bottom corner glow */}
      <div
        className="absolute bottom-0 right-0 pointer-events-none w-64 h-64 opacity-30"
        style={{ background: 'radial-gradient(circle at bottom right, var(--ac-bg), transparent 70%)' }}
        aria-hidden="true"
      />

      <div className="glass-modal rounded-2xl w-full max-w-[360px] p-8 animate-slide-up relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{
              background: 'var(--ac-bg)',
              border: '1px solid var(--ac-bd)',
              boxShadow: '0 0 24px var(--ac-glow)',
            }}
          >
            <Wifi size={22} className="text-accent" style={{ filter: 'drop-shadow(0 0 6px rgba(0,212,255,0.6))' }} />
          </div>
          <h1 className="text-2xl font-display font-bold text-ink-primary tracking-tight">ServerInventory</h1>
          <p className="text-[10px] text-accent mt-1 font-mono tracking-widest uppercase">Infrastructure Manager</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {/* Error */}
          {error && (
            <div
              className="text-sm px-3 py-2.5 rounded-lg text-center"
              style={{
                background: 'var(--sr-bg)',
                color: 'var(--sr)',
                border: '1px solid var(--sr-bd)',
              }}
              role="alert"
            >
              {error}
            </div>
          )}

          {/* Username */}
          <div>
            <label
              htmlFor="username"
              className="block text-[10px] font-medium text-ink-secondary mb-1.5 uppercase tracking-wider"
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Enter username"
              autoComplete="username"
              autoFocus
              className="input-dark"
              aria-required="true"
            />
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="password"
              className="block text-[10px] font-medium text-ink-secondary mb-1.5 uppercase tracking-wider"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
                autoComplete="current-password"
                className="input-dark pr-10"
                aria-required="true"
              />
              <button
                type="button"
                onClick={() => setShowPass(s => !s)}
                aria-label={showPass ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-secondary transition-colors"
              >
                {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {/* Remember me */}
          <label className="flex items-center gap-2.5 cursor-pointer select-none group">
            <div
              className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-colors ${
                rememberMe
                  ? 'bg-accent border-accent'
                  : 'bg-surface-2 border-border group-hover:border-border-strong'
              }`}
              role="checkbox"
              aria-checked={rememberMe}
              onClick={() => setRememberMe(r => !r)}
            >
              {rememberMe && (
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden="true">
                  <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={e => setRememberMe(e.target.checked)}
              className="sr-only"
              aria-label="Remember me for 90 days"
            />
            <span className="text-xs text-ink-secondary">
              Remember me{' '}
              <span className="text-ink-muted">(stay signed in for 90 days)</span>
            </span>
          </label>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !username.trim() || !password}
            className="btn-primary w-full py-3 justify-center gap-2 mt-2"
          >
            {loading ? (
              <>
                <RefreshCw size={14} className="animate-spin" aria-hidden="true" />
                Signing in…
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
