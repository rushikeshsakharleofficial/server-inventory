import { useState } from 'react'
import { Server, Eye, EyeOff, RefreshCw } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

const font = "'Geist', 'Inter', system-ui, sans-serif"

const styles = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#09090B',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
    fontFamily: font,
  } as React.CSSProperties,

  center: {
    width: '100%',
    maxWidth: '400px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  } as React.CSSProperties,

  logoWrap: {
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as React.CSSProperties,

  heading: {
    margin: '16px 0 0',
    fontSize: '20px',
    fontWeight: 600,
    color: '#FAFAFA',
    textAlign: 'center',
    fontFamily: font,
  } as React.CSSProperties,

  subheading: {
    margin: '4px 0 0',
    fontSize: '12px',
    color: '#71717A',
    textAlign: 'center',
    fontFamily: font,
  } as React.CSSProperties,

  card: {
    width: '100%',
    marginTop: '24px',
    backgroundColor: '#18181B',
    border: '1px solid #27272A',
    borderRadius: '8px',
    padding: '32px',
    boxSizing: 'border-box',
  } as React.CSSProperties,

  label: {
    display: 'block',
    fontSize: '11px',
    fontWeight: 500,
    color: '#A1A1AA',
    marginBottom: '6px',
    fontFamily: font,
  } as React.CSSProperties,

  labelRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '6px',
  } as React.CSSProperties,

  forgotLink: {
    fontSize: '11px',
    color: '#6366F1',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    fontFamily: font,
    textDecoration: 'none',
  } as React.CSSProperties,

  input: {
    width: '100%',
    height: '36px',
    backgroundColor: '#27272A',
    border: '1px solid #27272A',
    borderRadius: '6px',
    padding: '0 12px',
    fontSize: '13px',
    color: '#FAFAFA',
    fontFamily: font,
    boxSizing: 'border-box',
    outline: 'none',
    transition: 'border-color 150ms ease, box-shadow 150ms ease',
  } as React.CSSProperties,

  inputWrap: {
    position: 'relative',
  } as React.CSSProperties,

  eyeBtn: {
    position: 'absolute',
    right: '10px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    color: '#71717A',
    padding: '2px',
  } as React.CSSProperties,

  submitBtn: {
    width: '100%',
    height: '36px',
    backgroundColor: '#6366F1',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 500,
    fontFamily: font,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    transition: 'background-color 150ms ease',
    marginTop: '20px',
  } as React.CSSProperties,

  submitBtnDisabled: {
    backgroundColor: '#3730A3',
    cursor: 'not-allowed',
    opacity: 0.7,
  } as React.CSSProperties,

  errorBox: {
    fontSize: '12px',
    padding: '10px 14px',
    borderRadius: '6px',
    textAlign: 'center',
    backgroundColor: 'rgba(239,68,68,0.08)',
    color: '#FCA5A5',
    border: '1px solid rgba(239,68,68,0.20)',
    marginBottom: '16px',
    fontFamily: font,
  } as React.CSSProperties,

  footer: {
    marginTop: '24px',
    fontSize: '10px',
    color: '#3F3F46',
    textAlign: 'center',
    fontFamily: font,
  } as React.CSSProperties,
}

export default function LoginPage() {
  const { login } = useAuth()
  const [username, setUsername]     = useState('')
  const [password, setPassword]     = useState('')
  const [showPass, setShowPass]     = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError]           = useState('')
  const [loading, setLoading]       = useState(false)

  // input focus state
  const [usernameFocused, setUsernameFocused] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [btnHovered, setBtnHovered]           = useState(false)

  const isDisabled = loading || !username.trim() || !password

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

  function inputStyle(focused: boolean, extraRight?: string): React.CSSProperties {
    return {
      ...styles.input,
      ...(extraRight ? { paddingRight: extraRight } : {}),
      borderColor: focused ? '#6366F1' : '#27272A',
      boxShadow: focused ? '0 0 0 3px rgba(99,102,241,0.20)' : 'none',
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.center}>
        {/* Logo */}
        <div style={styles.logoWrap}>
          <Server size={20} color="#ffffff" />
        </div>

        {/* Heading */}
        <h1 style={styles.heading}>Sign in</h1>
        <p style={styles.subheading}>ServerInventory · Infrastructure Console</p>

        {/* Card */}
        <div style={styles.card}>
          <form onSubmit={submit} noValidate>
            {/* Error */}
            {error && (
              <div style={styles.errorBox} role="alert">
                {error}
              </div>
            )}

            {/* Username */}
            <div>
              <label htmlFor="username" style={styles.label}>
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
                aria-required="true"
                style={inputStyle(usernameFocused)}
                onFocus={() => setUsernameFocused(true)}
                onBlur={() => setUsernameFocused(false)}
              />
            </div>

            {/* Password */}
            <div style={{ marginTop: '16px' }}>
              <div style={styles.labelRow}>
                <label htmlFor="password" style={{ ...styles.label, marginBottom: 0 }}>
                  Password
                </label>
                <button
                  type="button"
                  style={styles.forgotLink}
                  tabIndex={-1}
                >
                  Forgot password?
                </button>
              </div>
              <div style={styles.inputWrap}>
                <input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter password"
                  autoComplete="current-password"
                  aria-required="true"
                  style={inputStyle(passwordFocused, '36px')}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(s => !s)}
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                  style={styles.eyeBtn}
                >
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Remember me */}
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                userSelect: 'none',
                marginTop: '14px',
              }}
            >
              <div
                role="checkbox"
                tabIndex={0}
                aria-checked={rememberMe}
                onClick={() => setRememberMe(r => !r)}
                onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') setRememberMe(r => !r) }}
                style={{
                  width: '14px',
                  height: '14px',
                  borderRadius: '4px',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: rememberMe ? '#6366F1' : '#27272A',
                  border: `1px solid ${rememberMe ? '#6366F1' : '#3F3F46'}`,
                  transition: 'all 150ms ease',
                }}
              >
                {rememberMe && (
                  <svg width="8" height="6" viewBox="0 0 10 8" fill="none" aria-hidden="true">
                    <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                aria-label="Remember me for 90 days"
                style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
              />
              <span style={{ fontSize: '12px', color: '#A1A1AA', fontFamily: font }}>
                Stay signed in for 90 days
              </span>
            </label>

            {/* Submit */}
            <button
              type="submit"
              disabled={isDisabled}
              style={{
                ...styles.submitBtn,
                ...(isDisabled ? styles.submitBtnDisabled : {}),
                ...(btnHovered && !isDisabled ? { backgroundColor: '#4F46E5' } : {}),
              }}
              onMouseEnter={() => setBtnHovered(true)}
              onMouseLeave={() => setBtnHovered(false)}
            >
              {loading ? (
                <>
                  <RefreshCw size={13} aria-hidden="true" style={{ animation: 'spin 1s linear infinite' }} />
                  Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p style={styles.footer}>Secured by JWT · Zero trust</p>
      </div>

      {/* Spin keyframe */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
