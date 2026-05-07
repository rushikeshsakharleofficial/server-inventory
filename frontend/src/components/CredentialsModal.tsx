import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Trash2, Plus, Eye, EyeOff } from 'lucide-react'
import Toggle from './Toggle'
import { credentialsApi } from '../api'
import { useToast } from '../hooks/useToast'
import ProviderBadge from './ProviderBadge'
import type { Provider } from '../types'

interface Props { onClose: () => void }

type FieldDef = {
  key: string
  label: string
  type?: string
  hint?: string
  options?: { value: string; label: string }[]
}

const PROVIDER_FIELDS: Record<string, FieldDef[]> = {
  aws: [
    { key: 'access_key_id',    label: 'Access Key ID',             hint: 'AKIA…'              },
    { key: 'secret_access_key',label: 'Secret Access Key',         type: 'password'           },
    { key: 'regions',          label: 'Regions (comma-separated)', hint: 'us-east-1,us-west-2'},
  ],
  gcp: [
    { key: 'project_id',           label: 'Project ID',           hint: 'my-gcp-project' },
    { key: 'service_account_json', label: 'Service Account JSON', type: 'textarea',
      hint: 'Paste JSON key file content' },
  ],
  azure: [
    { key: 'subscription_id', label: 'Subscription ID' },
    { key: 'tenant_id',       label: 'Tenant ID'       },
    { key: 'client_id',       label: 'Client ID (App)' },
    { key: 'client_secret',   label: 'Client Secret',  type: 'password' },
  ],
  linode:       [{ key: 'api_token', label: 'API Token', type: 'password' }],
  digitalocean: [{ key: 'api_token', label: 'API Token', type: 'password' }],
  ovh: [
    {
      key: 'endpoint',
      label: 'API Endpoint',
      type: 'select',
      options: [
        { value: 'ovh-eu', label: 'OVH Europe  (ovh-eu)' },
        { value: 'ovh-us', label: 'OVH US      (ovh-us)' },
        { value: 'ovh-ca', label: 'OVH Canada  (ovh-ca)' },
      ],
    },
    { key: 'application_key',    label: 'Application Key'                      },
    { key: 'application_secret', label: 'Application Secret', type: 'password' },
    { key: 'consumer_key',       label: 'Consumer Key',       type: 'password' },
  ],
}

const PROVIDERS: Provider[] = ['aws', 'gcp', 'azure', 'linode', 'digitalocean', 'ovh']
const SECRET_KEYS = new Set(['secret_access_key', 'client_secret', 'api_token', 'service_account_json'])

export default function CredentialsModal({ onClose }: Props) {
  const qc = useQueryClient()
  const { toast } = useToast()

  const [adding, setAdding]           = useState(false)
  const [selProvider, setSelProvider] = useState('aws')
  const [credName, setCredName]       = useState('')
  const [fields, setFields]           = useState<Record<string, string>>({})
  const [errors, setErrors]           = useState<string[]>([])
  const [visible, setVisible]         = useState<Set<string>>(new Set())
  const [confirmId, setConfirmId]     = useState<number | null>(null)

  const { data: creds = [] } = useQuery({
    queryKey: ['credentials'],
    queryFn: credentialsApi.list,
  })

  const createMutation = useMutation({
    mutationFn: credentialsApi.create,
    onSuccess: () => {
      toast.success('Credential saved')
      qc.invalidateQueries({ queryKey: ['credentials'] })
      setAdding(false); setCredName(''); setFields({}); setErrors([])
    },
    onError: () => toast.error('Failed to save credential'),
  })

  const deleteMutation = useMutation({
    mutationFn: credentialsApi.delete,
    onSuccess: () => {
      toast.success('Credential deleted')
      qc.invalidateQueries({ queryKey: ['credentials'] })
      setConfirmId(null)
    },
    onError: () => toast.error('Failed to delete credential'),
  })

  const toggleMutation = useMutation({
    mutationFn: credentialsApi.toggle,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['credentials'] }),
    onError: () => toast.error('Failed to toggle credential'),
  })

  function toggleVisible(key: string) {
    setVisible(prev => {
      const s = new Set(prev)
      s.has(key) ? s.delete(key) : s.add(key)
      return s
    })
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const errs: string[] = []
    if (!credName.trim()) errs.push('Credential name is required')
    if (errs.length) { setErrors(errs); return }
    setErrors([])

    const config: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(fields)) {
      if (k === 'service_account_json') {
        try { config[k] = JSON.parse(v) } catch { config[k] = v }
      } else if (k === 'regions') {
        config[k] = v.split(',').map(r => r.trim()).filter(Boolean)
      } else {
        config[k] = v
      }
    }
    createMutation.mutate({ name: credName.trim(), provider: selProvider, config })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Manage cloud credentials"
    >
      <div className="glass-modal w-full max-w-2xl max-h-[90vh] rounded-2xl flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07]">
          <div>
            <h2 className="text-base font-semibold text-ink-primary">Cloud Credentials</h2>
            <p className="text-xs text-ink-muted mt-0.5">
              {creds.length} credential{creds.length !== 1 ? 's' : ''} configured
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 text-ink-muted hover:text-ink-primary hover:bg-surface-3 rounded-lg transition-colors">
            <X size={17} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {/* Existing credentials */}
          {creds.map(cred => (
            <div
              key={cred.id}
              className={`rounded-xl border p-4 transition-opacity ${
                cred.is_active ? 'border-border bg-surface-2/50' : 'border-border/50 bg-surface-2/20 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ProviderBadge provider={cred.provider} />
                  <div>
                    <p className="text-sm font-medium text-ink-primary">{cred.name}</p>
                    {!cred.is_active && (
                      <p className="text-[11px] text-ink-muted italic">Inactive</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {confirmId === cred.id ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-status-red">Delete?</span>
                      <button
                        onClick={() => deleteMutation.mutate(cred.id)}
                        disabled={deleteMutation.isPending}
                        className="text-[11px] px-2 py-1 rounded-lg disabled:opacity-50"
                        style={{ background: 'var(--sr-bg)', color: 'var(--sr)', border: '1px solid var(--sr-bd)' }}
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setConfirmId(null)}
                        className="text-[11px] px-2 py-1 rounded-lg border border-border text-ink-muted hover:bg-surface-3 transition-colors"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <>
                      <Toggle
                        checked={cred.is_active}
                        onChange={() => toggleMutation.mutate(cred.id)}
                        aria-label={cred.is_active ? 'Disable credential' : 'Enable credential'}
                      />
                      <button
                        onClick={() => setConfirmId(cred.id)}
                        aria-label={`Delete ${cred.name}`}
                        className="p-1.5 text-ink-muted hover:text-status-red rounded-lg transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Config preview */}
              <div className="mt-3 pt-3 border-t border-border/60 flex flex-wrap gap-x-5 gap-y-1">
                {Object.entries(cred.config ?? {})
                  .filter(([k]) => !SECRET_KEYS.has(k))
                  .map(([k, v]) => (
                    <span key={k} className="text-[11px] text-ink-muted font-mono">
                      <span className="text-ink-dim">{k}:</span>{' '}
                      {Array.isArray(v) ? (v as string[]).join(', ') : String(v)}
                    </span>
                  ))}
                {Object.keys(cred.config ?? {}).some(k => SECRET_KEYS.has(k)) && (
                  <span className="text-[11px] text-ink-dim italic">• secret fields hidden</span>
                )}
              </div>
            </div>
          ))}

          {/* Add new */}
          {!adding ? (
            <button
              onClick={() => setAdding(true)}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-xl text-sm text-ink-muted
                         transition-all duration-150 hover:text-accent"
              style={{ border: '2px dashed var(--bd)' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--ac-bd)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--bd)')}
            >
              <Plus size={16} />
              Add Cloud Provider Credentials
            </button>
          ) : (
            <form
              onSubmit={submit}
              className="rounded-xl border border-border bg-surface-2/40 p-5 space-y-4"
            >
              <p className="text-xs font-semibold text-ink-secondary uppercase tracking-widest">
                New Credential
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
                  <label className="block text-xs font-medium text-ink-secondary mb-1.5">Provider</label>
                  <select
                    value={selProvider}
                    onChange={e => {
                      const p = e.target.value
                      setSelProvider(p)
                      // Pre-populate select fields with their first option
                      const defaults: Record<string, string> = {}
                      for (const f of PROVIDER_FIELDS[p] ?? []) {
                        if (f.type === 'select' && f.options?.[0]) {
                          defaults[f.key] = f.options[0].value
                        }
                      }
                      setFields(defaults)
                    }}
                    className="input-dark"
                  >
                    {PROVIDERS.map(p => (
                      <option key={p} value={p}>{p.toUpperCase().replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-secondary mb-1.5">
                    Name <span className="text-status-red">*</span>
                  </label>
                  <input
                    type="text"
                    value={credName}
                    onChange={e => setCredName(e.target.value)}
                    placeholder={`My ${selProvider.toUpperCase()} Account`}
                    className="input-dark"
                  />
                </div>
              </div>

              {(PROVIDER_FIELDS[selProvider] ?? []).map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-ink-secondary mb-1.5">{f.label}</label>
                  {f.type === 'select' && f.options ? (
                    <select
                      value={fields[f.key] ?? f.options[0].value}
                      onChange={e => setFields(p => ({ ...p, [f.key]: e.target.value }))}
                      className="input-dark appearance-none cursor-pointer"
                    >
                      {f.options.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : f.type === 'textarea' ? (
                    <textarea
                      value={fields[f.key] ?? ''}
                      onChange={e => setFields(p => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.hint}
                      rows={5}
                      className="input-dark resize-none font-mono text-xs"
                    />
                  ) : f.type === 'password' ? (
                    <div className="relative">
                      <input
                        type={visible.has(f.key) ? 'text' : 'password'}
                        value={fields[f.key] ?? ''}
                        onChange={e => setFields(p => ({ ...p, [f.key]: e.target.value }))}
                        placeholder={f.hint}
                        className="input-dark pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => toggleVisible(f.key)}
                        aria-label={visible.has(f.key) ? 'Hide' : 'Show'}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-secondary transition-colors"
                      >
                        {visible.has(f.key) ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={fields[f.key] ?? ''}
                      onChange={e => setFields(p => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.hint}
                      className="input-dark"
                    />
                  )}
                </div>
              ))}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setAdding(false); setErrors([]) }}
                  className="btn-ghost"
                >
                  Cancel
                </button>
                <button type="submit" disabled={createMutation.isPending} className="btn-primary">
                  {createMutation.isPending ? 'Saving…' : 'Save Credential'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-4 border-t border-white/[0.07]">
          <button onClick={onClose} className="btn-ghost">Close</button>
        </div>
      </div>
    </div>
  )
}
