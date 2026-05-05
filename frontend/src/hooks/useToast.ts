import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  type: ToastType
  message: string
  exiting: boolean
}

interface ToastContextValue {
  toasts: Toast[]
  addToast: (message: string, type: ToastType) => void
  removeToast: (id: string) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.map(t => (t.id === id ? { ...t, exiting: true } : t)))
    const t = setTimeout(() => {
      setToasts(prev => prev.filter(x => x.id !== id))
      timers.current.delete(id)
    }, 220)
    timers.current.set(`exit-${id}`, t)
  }, [])

  const addToast = useCallback(
    (message: string, type: ToastType = 'info') => {
      const id = Math.random().toString(36).slice(2)
      setToasts(prev => [...prev, { id, type, message, exiting: false }])
      const t = setTimeout(() => removeToast(id), 4000)
      timers.current.set(id, t)
    },
    [removeToast],
  )

  return createElement(
    ToastContext.Provider,
    { value: { toasts, addToast, removeToast } },
    children,
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be inside <ToastProvider>')
  const { toasts, removeToast, addToast } = ctx
  return {
    toasts,
    removeToast,
    toast: {
      success: (msg: string) => addToast(msg, 'success'),
      error: (msg: string) => addToast(msg, 'error'),
      warning: (msg: string) => addToast(msg, 'warning'),
      info: (msg: string) => addToast(msg, 'info'),
    },
  }
}
