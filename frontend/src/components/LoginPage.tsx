import { useState } from 'react'
import { Server, Eye, EyeOff, RefreshCw } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { Input, Button, Flex, Text } from './StitchUI'

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
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg-base)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background radial gradients */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }} aria-hidden="true">
        <div style={{
          position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)',
          width: '800px', height: '500px',
          background: 'radial-gradient(ellipse, rgba(99,102,241,0.12) 0%, transparent 65%)',
        }} />
        <div style={{
          position: 'absolute', bottom: '-10%', right: '-10%',
          width: '400px', height: '400px',
          background: 'radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)',
        }} />
        <div style={{
          position: 'absolute', bottom: '-10%', left: '-5%',
          width: '300px', height: '300px',
          background: 'radial-gradient(circle, rgba(34,197,94,0.04) 0%, transparent 70%)',
        }} />
      </div>

      <div style={{ width: '100%', maxWidth: '380px', position: 'relative', zIndex: 10 }}>
        {/* Logo mark */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '52px', height: '52px', borderRadius: '14px',
            background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 4px 20px rgba(99,102,241,0.40)',
          }}>
            <Server size={24} color="#fff" />
          </div>
          <h1 style={{ margin: '0 0 6px', fontSize: '22px', fontWeight: 700, color: 'var(--tx1)', letterSpacing: '-0.025em' }}>
            ServerInventory
          </h1>
          <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--tx3)' }}>
            Sign in to your account
          </p>
        </div>

        {/* Card */}
        <div style={{
          backgroundColor: 'var(--bg-s1)',
          border: '1px solid var(--bd)',
          borderRadius: '16px',
          padding: '28px',
          boxShadow: 'var(--shadow-modal)',
        }}>
          <form onSubmit={submit}>
            <Flex direction="column" gap={4}>
              {/* Error */}
              {error && (
                <div
                  style={{
                    fontSize: '13px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    textAlign: 'center',
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
                <label htmlFor="username" style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--tx2)' }}>
                  Username
                </label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Enter username"
                  autoComplete="username"
                  autoFocus
                  aria-required="true"
                />
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--tx2)' }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <Input
                    id="password"
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter password"
                    autoComplete="current-password"
                    style={{ paddingRight: '40px' }}
                    aria-required="true"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(s => !s)}
                    aria-label={showPass ? 'Hide password' : 'Show password'}
                    style={{
                      position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', color: 'var(--tx3)',
                      padding: '2px', transition: 'color 150ms ease',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--tx2)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--tx3)')}
                  >
                    {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* Remember me */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none' }}>
                <div
                  style={{
                    width: '16px', height: '16px', borderRadius: '5px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, transition: 'all 150ms ease',
                    backgroundColor: rememberMe ? 'var(--ac)' : 'var(--bg-s2)',
                    border: rememberMe ? '1px solid var(--ac)' : '1px solid var(--bd)',
                  }}
                  role="checkbox"
                  tabIndex={0}
                  aria-checked={rememberMe}
                  onClick={() => setRememberMe(r => !r)}
                  onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') setRememberMe(r => !r) }}
                >
                  {rememberMe && (
                    <svg width="9" height="7" viewBox="0 0 10 8" fill="none" aria-hidden="true">
                      <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} className="sr-only" aria-label="Remember me for 90 days" />
                <Text variant="small" style={{ color: 'var(--tx2)' }}>
                  Stay signed in for 90 days
                </Text>
              </label>

              {/* Submit */}
              <Button
                type="submit"
                intent="primary"
                disabled={loading || !username.trim() || !password}
                style={{ width: '100%', padding: '11px', marginTop: '4px', fontSize: '14px', fontWeight: 600 }}
              >
                {loading ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" aria-hidden="true" />
                    Signing in…
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </Flex>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '12px', color: 'var(--tx3)' }}>
          Infrastructure management console
        </p>
      </div>
    </div>
  )
}
