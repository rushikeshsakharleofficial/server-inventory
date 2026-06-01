import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { http } from '../api'

export type UserRole = 'admin' | 'write' | 'read'

export interface AuthUser {
  username: string
  role: UserRole
}

export interface MfaChallenge {
  mfa_token: string
  username: string
}

interface AuthContextValue {
  user: AuthUser | null
  mfaChallenge: MfaChallenge | null
  login: (username: string, password: string, rememberMe?: boolean) => Promise<void>
  completeMfa: (code: string) => Promise<void>
  cancelMfa: () => void
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

function decodeJwtPayload(token: string): { sub?: string; role?: string; exp?: number } | null {
  try {
    const b64 = token.split('.')[1]
    if (!b64) return null
    const json = atob(b64.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(json) as { sub?: string; role?: string; exp?: number }
  } catch {
    return null
  }
}

function loadStored(): { user: AuthUser | null; token: string | null } {
  try {
    const token = localStorage.getItem('si_token')
    if (!token) return { token: null, user: null }
    const payload = decodeJwtPayload(token)
    if (!payload?.sub || !payload?.role) return { token, user: null }
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      localStorage.removeItem('si_token')
      localStorage.removeItem('si_user')
      return { token: null, user: null }
    }
    const user: AuthUser = { username: payload.sub, role: payload.role as UserRole }
    return { token, user }
  } catch {
    return { token: null, user: null }
  }
}

function setAxiosToken(token: string | null) {
  if (token) {
    http.defaults.headers.common['Authorization'] = `Bearer ${token}`
  } else {
    delete http.defaults.headers.common['Authorization']
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const stored = loadStored()
  const [user, setUser] = useState<AuthUser | null>(stored.user)
  const [mfaChallenge, setMfaChallenge] = useState<MfaChallenge | null>(null)

  useEffect(() => {
    setAxiosToken(stored.token)
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = () => { setUser(null) }
    window.addEventListener('auth:expired', handler)
    return () => window.removeEventListener('auth:expired', handler)
  }, [])

  const login = useCallback(async (username: string, password: string, rememberMe = false) => {
    const params = new URLSearchParams({ username, password })
    params.append('remember_me', rememberMe ? 'true' : 'false')
    const res = await http.post('/api/auth/login', params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    const data = res.data as {
      access_token?: string
      role?: string
      mfa_required?: boolean
      mfa_token?: string
    }

    if (data.mfa_required && data.mfa_token) {
      setMfaChallenge({ mfa_token: data.mfa_token, username })
      return
    }

    const { access_token } = data as { access_token: string }
    localStorage.setItem('si_token', access_token)
    setAxiosToken(access_token)
    const payload = decodeJwtPayload(access_token)
    const authUser: AuthUser = {
      username: payload?.sub ?? username,
      role: (payload?.role ?? 'read') as UserRole,
    }
    setUser(authUser)
  }, [])

  const completeMfa = useCallback(async (code: string) => {
    if (!mfaChallenge) throw new Error('No MFA challenge in progress')
    const res = await http.post<{
      access_token: string
    }>('/api/auth/mfa/verify', {
      mfa_token: mfaChallenge.mfa_token,
      code,
    })
    const { access_token } = res.data
    localStorage.setItem('si_token', access_token)
    setAxiosToken(access_token)
    const payload = decodeJwtPayload(access_token)
    const authUser: AuthUser = {
      username: payload?.sub ?? mfaChallenge.username,
      role: (payload?.role ?? 'read') as UserRole,
    }
    setMfaChallenge(null)
    setUser(authUser)
  }, [mfaChallenge])

  const cancelMfa = useCallback(() => {
    setMfaChallenge(null)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('si_token')
    localStorage.removeItem('si_user')
    setAxiosToken(null)
    setUser(null)
    setMfaChallenge(null)
  }, [])

  return createElement(
    AuthContext.Provider,
    { value: { user, mfaChallenge, login, completeMfa, cancelMfa, logout } },
    children,
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside <AuthProvider>')
  return ctx
}
