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

interface AuthContextValue {
  user: AuthUser | null
  login: (username: string, password: string, rememberMe?: boolean) => Promise<void>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

function loadStored(): { user: AuthUser | null; token: string | null } {
  try {
    const token = localStorage.getItem('si_token')
    const raw = localStorage.getItem('si_user')
    const user = raw ? (JSON.parse(raw) as AuthUser) : null
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

  // Apply stored token to axios on mount
  useEffect(() => {
    setAxiosToken(stored.token)
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for token-expiry events fired by the axios interceptor
  useEffect(() => {
    const handler = () => {
      setUser(null)
    }
    window.addEventListener('auth:expired', handler)
    return () => window.removeEventListener('auth:expired', handler)
  }, [])

  const login = useCallback(async (username: string, password: string, rememberMe = false) => {
    const params = new URLSearchParams({ username, password })
    params.append('remember_me', rememberMe ? 'true' : 'false')
    const res = await http.post('/api/auth/login', params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    const { access_token, role } = res.data as { access_token: string; role: UserRole }
    const authUser: AuthUser = { username, role }
    localStorage.setItem('si_token', access_token)
    localStorage.setItem('si_user', JSON.stringify(authUser))
    setAxiosToken(access_token)
    setUser(authUser)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('si_token')
    localStorage.removeItem('si_user')
    setAxiosToken(null)
    setUser(null)
  }, [])

  return createElement(AuthContext.Provider, { value: { user, login, logout } }, children)
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside <AuthProvider>')
  return ctx
}
