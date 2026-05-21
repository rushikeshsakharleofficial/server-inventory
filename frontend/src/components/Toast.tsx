import { X, CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react'
import { useToast, type Toast } from '../hooks/useToast'

const CFG = {
  success: { Icon: CheckCircle2, border: 'border-l-status-green', icon: 'text-status-green' },
  error:   { Icon: XCircle,      border: 'border-l-status-red',   icon: 'text-status-red'   },
  warning: { Icon: AlertTriangle,border: 'border-l-status-yellow',icon: 'text-status-yellow'},
  info:    { Icon: Info,          border: 'border-l-accent',       icon: 'text-accent'       },
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const cfg = CFG[toast.type]
  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`
        flex items-start gap-3 w-80 p-4 rounded-xl
        bg-surface-1 border border-border border-l-4 ${cfg.border}
        shadow-glass
        ${toast.exiting ? 'animate-toast-out' : 'animate-toast-in'}
      `}
    >
      <cfg.Icon size={15} className={`${cfg.icon} mt-0.5 shrink-0`} aria-hidden="true" />
      <p className="flex-1 text-sm text-ink-primary leading-relaxed">{toast.message}</p>
      <button
        onClick={() => onRemove(toast.id)}
        aria-label="Dismiss notification"
        className="shrink-0 mt-0.5 text-ink-muted hover:text-ink-secondary transition-colors"
      >
        <X size={13} />
      </button>
    </div>
  )
}

export default function ToastContainer() {
  const { toasts, removeToast } = useToast()
  return (
    <div
      className="fixed bottom-5 right-5 z-100 flex flex-col gap-2 pointer-events-none"
      aria-label="Notifications"
    >
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} onRemove={removeToast} />
        </div>
      ))}
    </div>
  )
}
