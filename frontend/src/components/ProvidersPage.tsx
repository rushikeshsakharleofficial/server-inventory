import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Trash2, Plus, Cloud, ChevronDown, Eye, EyeOff } from 'lucide-react'
import Toggle from './Toggle'
import { credentialsApi, syncApi, getErrorMessage } from '../api'
import { Pagination } from './Pagination'
import { useToast } from '../hooks/useToast'
import ProviderBadge from './ProviderBadge'
import { ProviderLogo } from './ProviderBadge'
import type { Provider } from '../types'
import {
  Flex,
  Heading,
  Text,
} from './StitchUI'

interface FieldDef {
  key: string
  label: string
  type?: string
  hint?: string
  options?: { value: string; label: string }[]
}

const PROVIDER_DESC: Record<string, string> = {
  aws:          'Amazon EC2 — multi-region instance discovery',
  gcp:          'Google Compute Engine — all zones via service account',
  azure:        'Azure Virtual Machines — subscription-wide',
  linode:       'Akamai Cloud (Linode) — Nanode to Dedicated instances',
  digitalocean: 'DigitalOcean Droplets — all sizes and regions',
  ovh:          'OVH Cloud — bare metal, VPS and Public Cloud instances',
  hivelocity:   'Hivelocity — bare metal and VPS servers',
  custom_dc:    'Manually managed on-premise servers',
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
  hivelocity: [{ key: 'api_key', label: 'API Key', type: 'password', hint: '64-char hex key' }],
}

const PROVIDERS: Provider[] = ['aws', 'gcp', 'azure', 'linode', 'digitalocean', 'ovh', 'hivelocity']

const PROVIDER_LABEL: Record<string, string> = {
  aws: 'AWS', gcp: 'GCP', azure: 'Azure', linode: 'Linode',
  digitalocean: 'DigitalOcean', ovh: 'OVH', hivelocity: 'Hivelocity',
}

function ProviderSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = PROVIDERS.filter(p =>
    (PROVIDER_LABEL[p] ?? p).toLowerCase().includes(search.toLowerCase()) ||
    PROVIDER_DESC[p]?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setSearch('') }}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
          padding: '9px 12px', background: 'var(--bg-base)', border: '1px solid var(--bd)',
          borderRadius: '8px', cursor: 'pointer', textAlign: 'left',
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          outline: open ? '2px solid var(--ac)' : 'none',
          outlineOffset: '-1px',
          transition: 'box-shadow 150ms',
        }}
      >
        <ProviderLogo provider={value} size={22} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--tx1)', fontFamily: 'Inter,sans-serif' }}>{PROVIDER_LABEL[value] ?? value.toUpperCase()}</div>
          <div style={{ fontSize: '11px', color: 'var(--tx3)', fontFamily: 'Inter,sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{PROVIDER_DESC[value]}</div>
        </div>
        <ChevronDown size={14} style={{ flexShrink: 0, color: 'var(--tx3)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} />
      </button>

      {/* Panel */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50,
          background: 'var(--bg-base)', border: '1px solid var(--bd)', borderRadius: '10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.04)',
          overflow: 'hidden',
        }}>
          {/* Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'var(--bg-s1)', borderBottom: '1px solid var(--bd)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--tx3)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search provider…"
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: '12px', color: 'var(--tx1)', fontFamily: 'Inter,sans-serif' }}
            />
          </div>
          {/* Options */}
          <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
            {filtered.map(p => {
              const active = p === value
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => { onChange(p); setOpen(false) }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 12px', background: active ? 'rgba(246,130,31,0.08)' : 'transparent',
                    border: 'none', cursor: 'pointer', textAlign: 'left',
                    borderBottom: '1px solid var(--bd)',
                    transition: 'background 100ms',
                  }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-s1)' }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                >
                  <ProviderLogo provider={p} size={22} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: active ? 600 : 400, color: active ? 'var(--ac)' : 'var(--tx1)', fontFamily: 'Inter,sans-serif' }}>{PROVIDER_LABEL[p] ?? p.toUpperCase()}</div>
                    <div style={{ fontSize: '11px', color: 'var(--tx3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'Inter,sans-serif' }}>{PROVIDER_DESC[p]}</div>
                  </div>
                  {active && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ac)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
const SECRET_KEYS = new Set(['secret_access_key', 'client_secret', 'api_token', 'api_key', 'service_account_json', 'application_secret', 'consumer_key', 'private_key'])

export default function ProvidersPage() {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [expanded, setExpanded] = useState<number | null>(null)
  const [confirmId, setConfirmId] = useState<number | null>(null)

  // Creation State
  const [adding, setAdding]           = useState(false)
  const [selProvider, setSelProvider] = useState('aws')
  const [credName, setCredName]       = useState('')
  const [fields, setFields]           = useState<Record<string, string>>({})
  const [errors, setErrors]           = useState<string[]>([])
  const [visible, setVisible]         = useState<Set<string>>(new Set())
  const [page, setPage]               = useState(1)
  const PAGE_SIZE = 50

  const { data: credsPage, isLoading } = useQuery({
    queryKey: ['credentials', page],
    queryFn: () => credentialsApi.list({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
  })
  const creds = credsPage?.items ?? []
  const credsTotal = credsPage?.total ?? 0

  const createMutation = useMutation({
    mutationFn: credentialsApi.create,
    onSuccess: () => {
      toast.success('Credential saved')
      qc.invalidateQueries({ queryKey: ['credentials'] })
      setAdding(false)
      setCredName('')
      setFields({})
      setErrors([])
    },
    onError: (error: unknown) => toast.error(`Failed to save credential: ${getErrorMessage(error)}`),
  })

  const deleteMutation = useMutation({
    mutationFn: credentialsApi.delete,
    onSuccess: () => {
      toast.success('Credential removed')
      qc.invalidateQueries({ queryKey: ['credentials'] })
      setConfirmId(null)
    },
    onError: (error: unknown) => toast.error(`Failed to delete: ${getErrorMessage(error)}`),
  })

  const toggleMutation = useMutation({
    mutationFn: credentialsApi.toggle,
    onSuccess: updated => {
      toast.info(updated.is_active ? 'Credential enabled' : 'Credential disabled')
      qc.invalidateQueries({ queryKey: ['credentials'] })
    },
    onError: (error: unknown) => toast.error(`Failed to toggle: ${getErrorMessage(error)}`),
  })

  const syncMutation = useMutation({
    mutationFn: (provider: string) => syncApi.trigger(provider),
    onSuccess: (_, provider) => {
      toast.success(`${provider.toUpperCase()} sync started`)
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ['servers'] })
        qc.invalidateQueries({ queryKey: ['stats'] })
        qc.invalidateQueries({ queryKey: ['sync-logs'] })
      }, 3000)
    },
    onError: (error: unknown) => toast.error(`Sync failed: ${getErrorMessage(error)}`),
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
    createMutation.mutate({ name: credName.trim(), provider: selProvider as Provider, config })
  }

  const activeCount  = creds.filter(c => c.is_active).length
  const uniqueProvs  = new Set(creds.map(c => c.provider)).size

  const cardStyle: React.CSSProperties = {
    background: 'var(--bg-base)', border: '1px solid var(--bd)',
    borderRadius: '12px', boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: '9px', fontWeight: 600, letterSpacing: '0.06em',
    textTransform: 'uppercase', color: 'var(--tx3)', display: 'block', marginBottom: '6px',
  }
  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'var(--bg-s1)', border: '1px solid var(--bd)',
    borderRadius: '10px', height: '40px', padding: '0 14px', fontSize: '13px',
    color: 'var(--tx1)', outline: 'none', fontFamily: 'Inter,sans-serif',
    transition: 'border-color 150ms, box-shadow 150ms',
  }
  const iconBtnStyle = (danger = false): React.CSSProperties => ({
    width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: danger ? 'rgba(255,64,64,0.07)' : 'var(--bg-s1)',
    border: `1px solid ${danger ? 'rgba(255,64,64,0.25)' : 'var(--bd)'}`,
    borderRadius: '8px', cursor: 'pointer', flexShrink: 0, transition: 'all 120ms ease',
  })

  return (
    <Flex direction="column" gap={5} className="animate-fade-in">
      {/* ── Header ── */}
      <Flex justify="between" align="center">
        <div>
          <Heading as="h1" style={{ fontStyle: 'normal', fontSize: '22px', letterSpacing: '-0.02em', fontWeight: 700 }}>Cloud Providers</Heading>
          <Text variant="muted" style={{ marginTop: '4px', fontSize: '13px' }}>Manage credentials and sync settings</Text>
        </div>
        <Flex align="center" gap={2}>
          <button
            type="button"
            onClick={() => syncMutation.mutate('all')}
            disabled={syncMutation.isPending}
            style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 14px', background: 'var(--bg-base)', border: '1px solid var(--bd)', borderRadius: '10px', cursor: 'pointer', fontSize: '13px', color: 'var(--tx2)', fontFamily: 'Inter,sans-serif', fontWeight: 500, transition: 'all 120ms' }}
          >
            <RefreshCw size={14} className={syncMutation.isPending ? 'animate-spin' : ''} />
            Sync All
          </button>
          {!adding && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 16px', background: 'var(--ac)', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '13px', color: '#fff', fontFamily: 'Inter,sans-serif', fontWeight: 600, boxShadow: '0 3px 10px rgba(246,130,31,0.3)', transition: 'all 120ms' }}
            >
              <Plus size={14} />
              Add Credential
            </button>
          )}
        </Flex>
      </Flex>

      {/* ── Stats ── */}
      {!isLoading && credsTotal > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '16px' }}>
          {[
            { dot: '#00B520', value: String(activeCount),   label: 'Active Credentials'  },
            { dot: '#4285F4', value: String(uniqueProvs),   label: 'Providers Configured' },
            { dot: '#F6821F', value: String(credsTotal),    label: 'Total Credentials'    },
          ].map(({ dot, value, label }) => (
            <div key={label} style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: '14px', padding: '18px 20px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: dot, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--tx1)', lineHeight: 1.2 }}>{value}</div>
                <div style={{ fontSize: '11px', color: 'var(--tx3)', marginTop: '2px' }}>{label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Add Credential Form ── */}
      {adding && (
        <form onSubmit={submit} style={{ ...cardStyle, border: '2px solid rgba(246,130,31,0.25)', padding: '24px 28px 20px' }}>
          {/* Form header */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--tx1)', fontFamily: 'Inter,sans-serif' }}>Add Cloud Provider Credentials</span>
            <div style={{ flex: 1 }} />
            <button type="button" onClick={() => { setAdding(false); setErrors([]) }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', background: 'var(--bg-s1)', border: '1px solid var(--bd)', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', color: 'var(--tx2)', fontFamily: 'Inter,sans-serif' }}>
              ✕ Cancel
            </button>
          </div>
          <div style={{ borderTop: '1px solid var(--bd)', marginBottom: '20px' }} />

          {errors.map(e => (
            <div key={e} style={{ fontSize: '13px', padding: '10px 14px', borderRadius: '8px', background: 'var(--sr-bg)', color: 'var(--sr)', border: '1px solid var(--sr-bd)', marginBottom: '16px' }}>{e}</div>
          ))}

          {/* Provider (full width) */}
          <div style={{ marginBottom: '20px' }}>
            <span style={labelStyle}>Provider</span>
            <ProviderSelect value={selProvider} onChange={p => {
              setSelProvider(p)
              const defaults: Record<string, string> = {}
              for (const f of PROVIDER_FIELDS[p] ?? []) {
                if (f.type === 'select' && f.options?.[0]) defaults[f.key] = f.options[0].value
              }
              setFields(defaults)
            }} />
          </div>

          {/* Name (full width) */}
          <div style={{ marginBottom: '20px' }}>
            <span style={labelStyle}>Name <span style={{ color: 'var(--sr)' }}>*</span></span>
            <input style={inputStyle} type="text" value={credName}
              onChange={e => setCredName(e.target.value)}
              placeholder={`My ${(PROVIDER_LABEL[selProvider] ?? selProvider).toUpperCase()} Account`} />
          </div>

          {/* Provider-specific fields — 2-col grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 20px', marginBottom: '20px' }}>
            {(PROVIDER_FIELDS[selProvider] ?? []).map(f => (
              <div key={f.key}>
                <span style={labelStyle}>{f.label}</span>
                {f.type === 'select' && f.options ? (
                  <select value={fields[f.key] ?? f.options[0]?.value ?? ''} onChange={e => setFields(p => ({ ...p, [f.key]: e.target.value }))}
                    style={{ ...inputStyle, cursor: 'pointer' }}>
                    {f.options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                ) : f.type === 'textarea' ? (
                  <textarea value={fields[f.key] ?? ''} onChange={e => setFields(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.hint} rows={4}
                    style={{ ...inputStyle, height: 'auto', padding: '10px 14px', resize: 'none', fontFamily: 'monospace', fontSize: '12px' }} />
                ) : f.type === 'password' ? (
                  <div style={{ position: 'relative' }}>
                    <input type={visible.has(f.key) ? 'text' : 'password'} value={fields[f.key] ?? ''} onChange={e => setFields(p => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.hint} style={{ ...inputStyle, paddingRight: '40px' }} />
                    <button type="button" onClick={() => toggleVisible(f.key)} aria-label={visible.has(f.key) ? 'Hide' : 'Show'}
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'var(--tx3)', cursor: 'pointer' }}>
                      {visible.has(f.key) ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                ) : (
                  <input type="text" value={fields[f.key] ?? ''} onChange={e => setFields(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.hint} style={inputStyle} />
                )}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div style={{ borderTop: '1px solid var(--bd)', paddingTop: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '11px', color: 'var(--tx3)', flex: 1 }}>🔒 All credential data is encrypted at rest</span>
            <button type="button" onClick={() => { setAdding(false); setErrors([]) }}
              style={{ padding: '9px 20px', background: 'var(--bg-base)', border: '1px solid var(--bd)', borderRadius: '10px', cursor: 'pointer', fontSize: '13px', color: 'var(--tx2)', fontFamily: 'Inter,sans-serif', fontWeight: 500 }}>
              Cancel
            </button>
            <button type="submit" disabled={createMutation.isPending}
              style={{ padding: '9px 24px', background: 'var(--ac)', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '13px', color: '#fff', fontFamily: 'Inter,sans-serif', fontWeight: 600, boxShadow: '0 3px 10px rgba(246,130,31,0.3)', opacity: createMutation.isPending ? 0.7 : 1 }}>
              {createMutation.isPending ? 'Saving…' : '✓ Save Credential'}
            </button>
          </div>
        </form>
      )}

      {/* ── Empty state ── */}
      {!isLoading && credsTotal === 0 && !adding && (
        <div style={{ ...cardStyle, borderStyle: 'dashed', padding: '64px 24px', textAlign: 'center' }}>
          <Cloud size={36} style={{ color: 'var(--tx3)', margin: '0 auto 16px auto', opacity: 0.4 }} />
          <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--tx1)', marginBottom: '8px', fontFamily: 'Inter,sans-serif' }}>No cloud providers configured</div>
          <div style={{ fontSize: '13px', color: 'var(--tx3)', marginBottom: '24px' }}>Add credentials to start syncing servers from AWS, GCP, Azure, and more</div>
          <button onClick={() => setAdding(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '10px 20px', background: 'var(--ac)', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '13px', color: '#fff', fontFamily: 'Inter,sans-serif', fontWeight: 600 }}>
            <Plus size={14} /> Add First Provider
          </button>
        </div>
      )}

      {/* ── Credential Cards ── */}
      {(isLoading || credsTotal > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          {credsTotal > 0 && (
            <div style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--tx3)', marginBottom: '8px' }}>
              Configured Credentials
            </div>
          )}
          {isLoading ? Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{ ...cardStyle, height: '72px', marginBottom: '8px' }} className="skeleton" />
          )) : creds.map(cred => (
            <div key={cred.id} style={{ marginBottom: '8px' }}>
              {/* Main card row */}
              <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: '16px', padding: '0 20px', height: '72px', opacity: cred.is_active ? 1 : 0.65, cursor: 'pointer', transition: 'box-shadow 120ms' }}
                onClick={() => setExpanded(expanded === cred.id ? null : cred.id)}>
                {/* Provider badge */}
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: 'var(--bg-s1)', border: '1px solid var(--bd)' }}>
                  <ProviderLogo provider={cred.provider} size={22} />
                </div>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--tx1)', fontFamily: 'Inter,sans-serif' }}>{cred.name}</span>
                    <ProviderBadge provider={cred.provider} />
                    {!cred.is_active && <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--tx3)', background: 'var(--bg-s2)', border: '1px solid var(--bd)', borderRadius: '4px', padding: '2px 8px' }}>Disabled</span>}
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--tx3)' }}>{PROVIDER_DESC[cred.provider] ?? cred.provider}</span>
                </div>
                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={e => e.stopPropagation()}>
                  <button onClick={() => syncMutation.mutate(cred.provider)} disabled={syncMutation.isPending || !cred.is_active}
                    style={iconBtnStyle()} title="Sync" aria-label={`Sync ${cred.name}`}>
                    <RefreshCw size={13} style={{ color: 'var(--tx3)' }} className={syncMutation.isPending ? 'animate-spin' : ''} />
                  </button>
                  {confirmId === cred.id ? (
                    <Flex align="center" gap={1}>
                      <button onClick={() => deleteMutation.mutate(cred.id)} disabled={deleteMutation.isPending}
                        style={{ ...iconBtnStyle(true), width: 'auto', padding: '0 10px', fontSize: '11px', fontWeight: 600, color: 'var(--sr)', fontFamily: 'Inter,sans-serif' }}>
                        Confirm
                      </button>
                      <button onClick={() => setConfirmId(null)}
                        style={{ ...iconBtnStyle(), width: 'auto', padding: '0 10px', fontSize: '11px', color: 'var(--tx2)', fontFamily: 'Inter,sans-serif' }}>
                        Cancel
                      </button>
                    </Flex>
                  ) : (
                    <button onClick={() => setConfirmId(cred.id)} style={iconBtnStyle(true)} title="Delete" aria-label={`Delete ${cred.name}`}>
                      <Trash2 size={13} style={{ color: 'var(--sr)' }} />
                    </button>
                  )}
                  <Toggle checked={cred.is_active} onChange={() => toggleMutation.mutate(cred.id)} disabled={toggleMutation.isPending} />
                </div>
                <ChevronDown size={14} style={{ color: 'var(--tx3)', flexShrink: 0, transition: 'transform 150ms', transform: expanded === cred.id ? 'rotate(180deg)' : 'none' }} />
              </div>
              {/* Expanded config detail */}
              {expanded === cred.id && (
                <div style={{ background: 'var(--bg-s1)', border: '1px solid var(--bd)', borderTop: 'none', borderRadius: '0 0 12px 12px', padding: '14px 20px', display: 'flex', flexWrap: 'wrap', gap: '8px 24px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--tx3)', fontFamily: 'monospace', width: '100%', marginBottom: '4px' }}>Configuration:</span>
                  {Object.entries(cred.config ?? {}).filter(([k]) => !SECRET_KEYS.has(k)).map(([k, v]) => (
                    <span key={k} style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                      <span style={{ color: 'var(--tx3)' }}>{k}:</span>{' '}
                      <span style={{ color: 'var(--tx2)' }}>{Array.isArray(v) ? (v as string[]).join(', ') : String(v)}</span>
                    </span>
                  ))}
                  {Object.keys(cred.config ?? {}).some(k => SECRET_KEYS.has(k)) && (
                    <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--tx3)', fontStyle: 'italic' }}>• credentials contain secret fields</span>
                  )}
                </div>
              )}
            </div>
          ))}
          <Pagination page={page} total={credsTotal} pageSize={PAGE_SIZE} onPage={setPage} />
        </div>
      )}
    </Flex>
  )
}
