import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Star, Trash2, Plus, KeyRound, Lock } from 'lucide-react'
import { useToast } from '../hooks/useToast'
import type { SSHCredential } from '../types'

// Typed shim — these endpoints are provided by the extended api surface
import { http } from '../api'

const sshCredentialsApi = {
  list: () => http.get<SSHCredential[]>('/api/ssh-credentials').then(r => r.data),
  create: (data: Omit<SSHCredential, 'id' | 'created_at'>) =>
    http.post<SSHCredential>('/api/ssh-credentials', data).then(r => r.data),
  update: (id: number, data: Partial<SSHCredential>) =>
    http.put<SSHCredential>(`/api/ssh-credentials/${id}`, data).then(r => r.data),
  delete: (id: number) => http.delete(`/api/ssh-credentials/${id}`),
  setDefault: (id: number) =>
    http.patch<SSHCredential>(`/api/ssh-credentials/${id}/set-default`).then(r => r.data),
}

type AuthMethod = 'password' | 'key'

interface FormState {
  name: string
  username: string
  port: string
  auth_method: AuthMethod
  password: string
  private_key: string
  is_default: boolean
}

const EMPTY_FORM: FormState = {
  name: '',
  username: '',
  port: '22',
  auth_method: 'password',
  password: '',
  private_key: '',
  is_default: false,
}

function AuthBadge({ method }: { method: AuthMethod }) {
  const isKey = method === 'key'
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md"
      style={
        isKey
          ? { background: 'var(--ac-bg)', color: 'var(--ac)', border: '1px solid var(--ac-bd)' }
          : { background: 'var(--sgr-bg)', color: 'var(--sgr)', border: '1px solid var(--sgr-bd)' }
      }
    >
      {isKey ? <KeyRound size={10} /> : <Lock size={10} />}
      {isKey ? 'Key' : 'Password'}
    </span>
  )
}

function DefaultBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md"
      style={{ background: 'var(--ac-bg)', color: 'var(--ac)', border: '1px solid var(--ac-bd)' }}
    >
      <Star size={10} fill="currentColor" />
      Default
    </span>
  )
}

export default function SSHPage() {
  const qc = useQueryClient()
  const { toast } = useToast()

  const [showForm, setShowForm]       = useState(false)
  const [form, setForm]               = useState<FormState>(EMPTY_FORM)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

  const { data: creds = [], isLoading } = useQuery({
    queryKey: ['ssh-credentials'],
    queryFn: sshCredentialsApi.list,
  })

  const createMutation = useMutation({
    mutationFn: sshCredentialsApi.create,
    onSuccess: () => {
      toast.success('SSH credential saved')
      qc.invalidateQueries({ queryKey: ['ssh-credentials'] })
      setForm(EMPTY_FORM)
      setShowForm(false)
    },
    onError: () => toast.error('Failed to save SSH credential'),
  })

  const deleteMutation = useMutation({
    mutationFn: sshCredentialsApi.delete,
    onSuccess: () => {
      toast.success('SSH credential deleted')
      qc.invalidateQueries({ queryKey: ['ssh-credentials'] })
      setConfirmDeleteId(null)
    },
    onError: () => toast.error('Failed to delete SSH credential'),
  })

  const setDefaultMutation = useMutation({
    mutationFn: sshCredentialsApi.setDefault,
    onSuccess: () => {
      toast.success('Default credential updated')
      qc.invalidateQueries({ queryKey: ['ssh-credentials'] })
    },
    onError: () => toast.error('Failed to set default'),
  })

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.username.trim()) {
      toast.error('Name and username are required')
      return
    }
    const port = parseInt(form.port, 10)
    if (isNaN(port) || port < 1 || port > 65535) {
      toast.error('Port must be between 1 and 65535')
      return
    }
    createMutation.mutate({
      name: form.name.trim(),
      username: form.username.trim(),
      port,
      auth_method: form.auth_method,
      password: form.auth_method === 'password' ? form.password : undefined,
      private_key: form.auth_method === 'key' ? form.private_key : undefined,
      is_default: form.is_default,
    })
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-ink-primary">SSH Credentials</h1>
          <p className="text-sm text-ink-muted mt-0.5">
            Shared credentials for Custom DC server SSH access
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary flex-shrink-0"
          >
            <Plus size={14} />
            Add Credential
          </button>
        )}
      </div>

      {/* Credentials table */}
      <div className="card-dark overflow-hidden">
        {isLoading ? (
          <div className="py-14 text-center text-ink-muted text-sm">Loading…</div>
        ) : creds.length === 0 && !showForm ? (
          <div
            className="mx-6 my-8 flex flex-col items-center justify-center py-12 rounded-xl text-center"
            style={{ border: '2px dashed var(--bd)' }}
          >
            <KeyRound size={28} className="text-ink-dim mb-3" />
            <p className="text-sm font-medium text-ink-secondary">No SSH credentials yet</p>
            <p className="text-xs text-ink-muted mt-1">
              Add a credential to enable SSH sync for Custom DC servers
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="btn-primary mt-4"
            >
              <Plus size={14} />
              Add Credential
            </button>
          </div>
        ) : creds.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="table-dark min-w-[680px]" aria-label="SSH credentials">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>User</th>
                  <th>Auth Method</th>
                  <th>Port</th>
                  <th>Default</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {creds.map(cred => (
                  <tr key={cred.id}>
                    <td>
                      <p className="text-sm font-medium text-ink-primary">{cred.name}</p>
                      {cred.created_at && (
                        <p className="text-[11px] text-ink-muted mt-0.5">
                          {new Date(cred.created_at).toLocaleDateString()}
                        </p>
                      )}
                    </td>
                    <td>
                      <span className="text-sm font-mono text-ink-secondary">{cred.username}</span>
                    </td>
                    <td>
                      <AuthBadge method={cred.auth_method} />
                    </td>
                    <td>
                      <span className="text-sm font-mono text-ink-secondary tabular-nums">
                        {cred.port}
                      </span>
                    </td>
                    <td>
                      {cred.is_default ? (
                        <DefaultBadge />
                      ) : (
                        <span className="text-ink-dim text-xs">—</span>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        {!cred.is_default && (
                          <button
                            onClick={() => setDefaultMutation.mutate(cred.id)}
                            disabled={setDefaultMutation.isPending}
                            aria-label={`Set ${cred.name} as default`}
                            title="Set as default"
                            className="p-1.5 text-ink-dim hover:text-accent rounded-lg transition-colors disabled:opacity-40"
                          >
                            <Star size={14} />
                          </button>
                        )}
                        {confirmDeleteId === cred.id ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-status-red whitespace-nowrap">Delete?</span>
                            <button
                              onClick={() => deleteMutation.mutate(cred.id)}
                              disabled={deleteMutation.isPending}
                              className="text-[11px] px-2 py-1 rounded-lg disabled:opacity-50 transition-colors"
                              style={{ background: 'var(--sr-bg)', color: 'var(--sr)', border: '1px solid var(--sr-bd)' }}
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-[11px] px-2 py-1 rounded-lg border border-border text-ink-muted hover:bg-surface-3 transition-colors"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(cred.id)}
                            aria-label={`Delete ${cred.name}`}
                            className="p-1.5 text-ink-dim hover:text-status-red rounded-lg transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {/* Add form */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="border-t border-border p-6 space-y-5"
          >
            <p className="text-[11px] font-semibold text-ink-secondary uppercase tracking-widest">
              New SSH Credential
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1.5">
                  Name <span className="text-status-red">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  placeholder="Production DC"
                  className="input-dark"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1.5">
                  Username <span className="text-status-red">*</span>
                </label>
                <input
                  type="text"
                  value={form.username}
                  onChange={e => set('username', e.target.value)}
                  placeholder="root"
                  className="input-dark"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1.5">Port</label>
                <input
                  type="number"
                  value={form.port}
                  onChange={e => set('port', e.target.value)}
                  min={1}
                  max={65535}
                  className="input-dark"
                />
              </div>
              <div className="flex flex-col justify-end pb-0.5">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.is_default}
                    onChange={e => set('is_default', e.target.checked)}
                    className="w-4 h-4 rounded accent-[color:var(--ac)] cursor-pointer"
                  />
                  <span className="text-sm text-ink-secondary">Set as default</span>
                </label>
              </div>
            </div>

            {/* Auth method */}
            <div>
              <p className="text-xs font-medium text-ink-secondary mb-2">Auth Method</p>
              <div className="flex items-center gap-4">
                {(['password', 'key'] as AuthMethod[]).map(method => (
                  <label key={method} className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="radio"
                      name="auth_method"
                      value={method}
                      checked={form.auth_method === method}
                      onChange={() => set('auth_method', method)}
                      className="accent-[color:var(--ac)] cursor-pointer"
                    />
                    <span className="text-sm text-ink-secondary capitalize">
                      {method === 'key' ? 'SSH Key' : 'Password'}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Conditional secret field */}
            {form.auth_method === 'password' ? (
              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1.5">Password</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => set('password', e.target.value)}
                  placeholder="Enter SSH password"
                  className="input-dark"
                  autoComplete="new-password"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1.5">
                  Private Key
                </label>
                <textarea
                  value={form.private_key}
                  onChange={e => set('private_key', e.target.value)}
                  rows={8}
                  placeholder={'-----BEGIN OPENSSH PRIVATE KEY-----\n…\n-----END OPENSSH PRIVATE KEY-----'}
                  className="input-dark resize-none font-mono text-xs leading-relaxed"
                  spellCheck={false}
                />
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => { setShowForm(false); setForm(EMPTY_FORM) }}
                className="btn-ghost"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="btn-primary"
              >
                {createMutation.isPending ? 'Saving…' : 'Save Credential'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
