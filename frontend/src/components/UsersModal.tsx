import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Plus, Trash2, ToggleLeft, ToggleRight, Shield } from 'lucide-react'
import { usersApi, type ApiUser } from '../api'
import { useToast } from '../hooks/useToast'

interface Props { onClose: () => void }

const ROLE_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  admin: { label: 'Admin',  color: '#6366F1', bg: 'rgba(99,102,241,0.1)',  border: 'rgba(99,102,241,0.25)' },
  write: { label: 'Write',  color: '#4285F4', bg: 'rgba(66,133,244,0.1)',  border: 'rgba(66,133,244,0.25)' },
  read:  { label: 'Read',   color: '#8B8AAE', bg: 'rgba(139,138,174,0.1)', border: 'rgba(139,138,174,0.2)' },
}

function RoleBadge({ role }: { role: string }) {
  const cfg = ROLE_CFG[role] ?? ROLE_CFG.read
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
      style={{ color: cfg.color, backgroundColor: cfg.bg, border: `1px solid ${cfg.border}` }}
    >
      {role === 'admin' && <Shield size={10} aria-hidden="true" />}
      {cfg.label}
    </span>
  )
}

export default function UsersModal({ onClose }: Props) {
  const qc = useQueryClient()
  const { toast } = useToast()

  const [adding, setAdding]           = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole]         = useState('read')
  const [errors, setErrors]           = useState<string[]>([])
  const [confirmId, setConfirmId]     = useState<number | null>(null)

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.list,
  })

  const createMutation = useMutation({
    mutationFn: usersApi.create,
    onSuccess: () => {
      toast.success(`User "${newUsername}" created`)
      qc.invalidateQueries({ queryKey: ['users'] })
      setAdding(false)
      setNewUsername(''); setNewPassword(''); setNewRole('read'); setErrors([])
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(detail ?? 'Failed to create user')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: usersApi.delete,
    onSuccess: (_, id) => {
      const u = users.find(x => x.id === id)
      toast.success(`User "${u?.username}" deleted`)
      qc.invalidateQueries({ queryKey: ['users'] })
      setConfirmId(null)
    },
    onError: () => toast.error('Failed to delete user'),
  })

  const toggleMutation = useMutation({
    mutationFn: usersApi.toggle,
    onSuccess: (updated: ApiUser) => {
      toast.info(`${updated.username} ${updated.is_active ? 'enabled' : 'disabled'}`)
      qc.invalidateQueries({ queryKey: ['users'] })
    },
    onError: () => toast.error('Failed to toggle user'),
  })

  function submitCreate(e: React.FormEvent) {
    e.preventDefault()
    const errs: string[] = []
    if (!newUsername.trim())  errs.push('Username is required')
    if (newPassword.length < 6) errs.push('Password must be at least 6 characters')
    if (errs.length) { setErrors(errs); return }
    setErrors([])
    createMutation.mutate({ username: newUsername.trim(), password: newPassword, role: newRole })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Manage users"
    >
      <div className="glass-modal w-full max-w-xl max-h-[88vh] rounded-2xl flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07]">
          <div>
            <h2 className="text-base font-semibold text-ink-primary">User Management</h2>
            <p className="text-xs text-ink-muted mt-0.5">
              {users.length} user{users.length !== 1 ? 's' : ''} · admin credentials managed via ENV
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 text-ink-muted hover:text-ink-primary hover:bg-surface-3 rounded-lg transition-colors">
            <X size={17} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {/* User list */}
          {users.map(user => (
            <div
              key={user.id}
              className={`flex items-center justify-between p-3.5 rounded-xl border transition-opacity ${
                user.is_active ? 'bg-surface-2/50 border-border' : 'bg-surface-2/20 border-border/40 opacity-55'
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{
                    background: (ROLE_CFG[user.role] ?? ROLE_CFG.read).bg,
                    color: (ROLE_CFG[user.role] ?? ROLE_CFG.read).color,
                  }}
                >
                  {user.username.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-ink-primary">{user.username}</p>
                  {!user.is_active && (
                    <p className="text-[11px] text-ink-muted italic">Disabled</p>
                  )}
                </div>
                <RoleBadge role={user.role} />
              </div>

              {/* Actions — admin user is read-only */}
              <div className="flex items-center gap-1">
                {user.role === 'admin' ? (
                  <span className="text-xs text-ink-dim italic px-2">System</span>
                ) : confirmId === user.id ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-status-red">Delete?</span>
                    <button
                      onClick={() => deleteMutation.mutate(user.id)}
                      disabled={deleteMutation.isPending}
                      className="text-[11px] px-2 py-1 rounded-lg disabled:opacity-50"
                      style={{ background: 'var(--sr-bg)', color: 'var(--sr)', border: '1px solid var(--sr-bd)' }}
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setConfirmId(null)}
                      className="text-[11px] px-2 py-1 rounded-lg border border-border text-ink-muted hover:bg-surface-3"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => toggleMutation.mutate(user.id)}
                      aria-label={user.is_active ? 'Disable user' : 'Enable user'}
                      className="p-1.5 rounded-lg hover:bg-surface-3 transition-colors"
                    >
                      {user.is_active
                        ? <ToggleRight size={19} className="text-status-green" />
                        : <ToggleLeft  size={19} className="text-ink-muted"    />
                      }
                    </button>
                    <button
                      onClick={() => setConfirmId(user.id)}
                      aria-label={`Delete ${user.username}`}
                      className="p-1.5 text-ink-muted hover:text-status-red rounded-lg transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}

          {/* Add user form toggle */}
          {!adding ? (
            <button
              onClick={() => setAdding(true)}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm text-ink-muted transition-all"
              style={{ border: '2px dashed var(--bd)' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--ac-bd)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--bd)')}
            >
              <Plus size={15} />
              Add New User
            </button>
          ) : (
            <form
              onSubmit={submitCreate}
              className="rounded-xl border border-border bg-surface-2/40 p-5 space-y-4"
            >
              <p className="text-xs font-semibold text-ink-secondary uppercase tracking-widest">
                New User
              </p>

              {errors.map(e => (
                <div
                  key={e}
                  className="text-sm px-3 py-2 rounded-lg"
                  style={{ background: 'var(--sr-bg)', color: 'var(--sr)', border: '1px solid var(--sr-bd)' }}
                >
                  {e}
                </div>
              ))}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink-secondary mb-1.5">
                    Username <span className="text-status-red">*</span>
                  </label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={e => setNewUsername(e.target.value)}
                    placeholder="john.doe"
                    autoComplete="off"
                    className="input-dark"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-secondary mb-1.5">
                    Password <span className="text-status-red">*</span>
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    autoComplete="new-password"
                    className="input-dark"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-2">Role</label>
                <div className="flex gap-2">
                  {(['read', 'write'] as const).map(role => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setNewRole(role)}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
                        newRole === role
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-border text-ink-muted hover:bg-surface-3 hover:text-ink-secondary'
                      }`}
                    >
                      <span className="block font-semibold capitalize">{role}</span>
                      <span className="block text-[11px] font-normal mt-0.5 opacity-70">
                        {role === 'read' ? 'View only' : 'View + edit'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setAdding(false); setErrors([]) }}
                  className="btn-ghost"
                >
                  Cancel
                </button>
                <button type="submit" disabled={createMutation.isPending} className="btn-primary">
                  {createMutation.isPending ? 'Creating…' : 'Create User'}
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="flex justify-end px-6 py-4 border-t border-white/[0.07]">
          <button onClick={onClose} className="btn-ghost">Close</button>
        </div>
      </div>
    </div>
  )
}
