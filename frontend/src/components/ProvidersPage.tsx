import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Trash2, Plus, Cloud, ChevronDown, ChevronRight, Eye, EyeOff } from 'lucide-react'
import Toggle from './Toggle'
import { credentialsApi, syncApi, getErrorMessage } from '../api'
import { useToast } from '../hooks/useToast'
import ProviderBadge from './ProviderBadge'
import ProviderLogo from './ProviderLogo'
import type { Provider } from '../types'
import {
  Card,
  Flex,
  Grid,
  Heading,
  Text,
  Input,
  Select,
  Textarea,
  Button,
  Badge,
  TableContainer,
  Table,
  THead,
  TBody,
  TH,
  TD as Td,
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

  const { data: creds = [], isLoading } = useQuery({
    queryKey: ['credentials'],
    queryFn: credentialsApi.list,
  })

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

  return (
    <Flex direction="column" gap={4} className="animate-fade-in">
      {/* Header */}
      <Flex justify="between" align="center">
        <div>
          <Heading as="h1">Cloud Credentials</Heading>
          <Text variant="muted" style={{ marginTop: '4px' }}>
            {creds.length === 0 ? 'No credentials configured' : `${creds.length} credential${creds.length !== 1 ? 's' : ''}`} (
            {creds.filter(c => c.is_active).length} active · {creds.filter(c => !c.is_active).length} disabled)
          </Text>
        </div>
        {!adding && (
          <Button intent="primary" onClick={() => setAdding(true)}>
            <Plus size={15} />
            Add Credential
          </Button>
        )}
      </Flex>

      {/* Inline Creation Card */}
      {adding && (
        <form onSubmit={submit}>
          <Card style={{ borderColor: 'var(--ac-bd)', padding: '24px' }}>
            <Flex justify="between" align="center" style={{ borderBottom: '1px solid var(--bd)', paddingBottom: '12px', marginBottom: '16px' }}>
              <Heading level="h3" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '12px' }}>
                Add Cloud Provider Credentials
              </Heading>
              <Button size="sm" intent="ghost" type="button" onClick={() => { setAdding(false); setErrors([]) }}>
                Cancel
              </Button>
            </Flex>

            {errors.map(e => (
              <div
                key={e}
                style={{
                  fontSize: '13px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: 'var(--sr-bg)',
                  color: 'var(--sr)',
                  border: '1px solid var(--sr-bd)',
                  marginBottom: '16px',
                }}
              >
                {e}
              </div>
            ))}

            <Grid columns={{ '@initial': 1, '@md': 2 }} gap={4} style={{ marginBottom: '16px' }}>
              <div>
                <Text variant="label" style={{ marginBottom: '6px', display: 'block' }}>Provider</Text>
                <Select
                  value={selProvider}
                  onChange={e => {
                    const p = e.target.value
                    setSelProvider(p)
                    const defaults: Record<string, string> = {}
                    for (const f of PROVIDER_FIELDS[p] ?? []) {
                      if (f.type === 'select' && f.options?.[0]) {
                        defaults[f.key] = f.options[0].value
                      }
                    }
                    setFields(defaults)
                  }}
                >
                  {PROVIDERS.map(p => (
                    <option key={p} value={p}>{p.toUpperCase().replace('_', ' ')}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Text variant="label" style={{ marginBottom: '6px', display: 'block' }}>
                  Name <span style={{ color: 'var(--sr)' }}>*</span>
                </Text>
                <Input
                  type="text"
                  value={credName}
                  onChange={e => setCredName(e.target.value)}
                  placeholder={`My ${selProvider.toUpperCase()} Account`}
                />
              </div>
            </Grid>

            <Flex direction="column" gap={4} style={{ marginBottom: '24px' }}>
              {(PROVIDER_FIELDS[selProvider] ?? []).map(f => (
                <div key={f.key}>
                  <Text variant="label" style={{ marginBottom: '6px', display: 'block' }}>{f.label}</Text>
                  {f.type === 'select' && f.options ? (
                    <Select
                      value={fields[f.key] ?? f.options[0]?.value ?? ''}
                      onChange={e => setFields(p => ({ ...p, [f.key]: e.target.value }))}
                    >
                      {f.options.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </Select>
                  ) : f.type === 'textarea' ? (
                    <Textarea
                      value={fields[f.key] ?? ''}
                      onChange={e => setFields(p => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.hint}
                      rows={4}
                      style={{ resize: 'none', fontFamily: 'monospace', fontSize: '12px' }}
                    />
                  ) : f.type === 'password' ? (
                    <div style={{ position: 'relative' }}>
                      <Input
                        type={visible.has(f.key) ? 'text' : 'password'}
                        value={fields[f.key] ?? ''}
                        onChange={e => setFields(p => ({ ...p, [f.key]: e.target.value }))}
                        placeholder={f.hint}
                        style={{ paddingRight: '40px' }}
                      />
                      <button
                        type="button"
                        onClick={() => toggleVisible(f.key)}
                        aria-label={visible.has(f.key) ? 'Hide' : 'Show'}
                        style={{
                          position: 'absolute',
                          right: '12px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--tx3)',
                          cursor: 'pointer',
                        }}
                      >
                        {visible.has(f.key) ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  ) : (
                    <Input
                      type="text"
                      value={fields[f.key] ?? ''}
                      onChange={e => setFields(p => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.hint}
                    />
                  )}
                </div>
              ))}
            </Flex>

            <Flex gap={3} style={{ borderTop: '1px solid var(--bd)', paddingTop: '16px' }}>
              <Button type="button" intent="ghost" onClick={() => { setAdding(false); setErrors([]) }}>
                Cancel
              </Button>
              <Button type="submit" intent="primary" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Saving…' : 'Save Credential'}
              </Button>
            </Flex>
          </Card>
        </form>
      )}

      {/* Empty state */}
      {!isLoading && creds.length === 0 && !adding && (
        <Card style={{ borderStyle: 'dashed', padding: '64px 24px', textAlign: 'center' }}>
          <Cloud size={36} style={{ color: 'var(--tx3)', margin: '0 auto 16px auto', opacity: 0.5 }} />
          <Heading level="h3" style={{ marginBottom: '8px' }}>No cloud providers configured</Heading>
          <Text variant="muted" style={{ marginBottom: '24px' }}>
            Add credentials to start syncing servers from AWS, GCP, Azure, and more
          </Text>
          <Button intent="primary" onClick={() => setAdding(true)} style={{ margin: '0 auto' }}>
            <Plus size={14} />
            Add First Provider
          </Button>
        </Card>
      )}

      {/* Credentials list table */}
      {(isLoading || creds.length > 0) && (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <TableContainer style={{ border: 'none', borderRadius: 0, boxShadow: 'none' }}>
            <Table aria-label="Cloud provider credentials">
              <THead>
                <tr>
                  <TH style={{ width: '32px' }} />
                  <TH>Provider</TH>
                  <TH>Name</TH>
                  <TH className="hidden-sm">Description</TH>
                  <TH style={{ textAlign: 'center' }}>Status</TH>
                  <TH style={{ textAlign: 'right' }}>Actions</TH>
                </tr>
              </THead>
              <TBody>
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i}>
                      <Td />
                      <Td><div className="skeleton h-5 rounded-sm w-20" /></Td>
                      <Td><div className="skeleton h-5 rounded-sm w-32" /></Td>
                      <Td className="hidden-sm"><div className="skeleton h-4 rounded-sm w-48" /></Td>
                      <Td><div className="skeleton h-5 rounded-sm w-16 mx-auto" /></Td>
                      <Td><div className="skeleton h-5 rounded-sm w-24 ml-auto" /></Td>
                    </tr>
                  ))
                ) : (
                  creds.map(cred => (
                    <tr key={cred.id} style={{ display: 'table-row' }}>
                      <td colSpan={6} style={{ padding: 0 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <tbody>
                            <tr
                              style={{
                                borderBottom: '1px solid var(--bd)',
                                opacity: cred.is_active ? 1 : 0.6,
                                cursor: 'pointer',
                                transition: 'background-color 150ms ease',
                              }}
                              onClick={() => setExpanded(expanded === cred.id ? null : cred.id)}
                            >
                              {/* Toggle expand */}
                              <Td style={{ width: '32px', color: 'var(--tx3)' }}>
                                {expanded === cred.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              </Td>

                              {/* Provider */}
                              <Td style={{ width: '150px' }}>
                                <Flex align="center" gap={2}>
                                  <div
                                    style={{
                                      width: '28px',
                                      height: '28px',
                                      borderRadius: '8px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      backgroundColor: 'var(--bg-s2)',
                                      border: '1px solid var(--bd)',
                                      flexShrink: 0,
                                    }}
                                  >
                                    <ProviderLogo provider={cred.provider} size={16} />
                                  </div>
                                  <ProviderBadge provider={cred.provider} />
                                </Flex>
                              </Td>

                              {/* Name */}
                              <Td style={{ width: '180px' }}>
                                <Text style={{ fontWeight: 700 }}>{cred.name}</Text>
                              </Td>

                              {/* Description */}
                              <Td className="hidden-sm">
                                <Text variant="smallMuted">
                                  {PROVIDER_DESC[cred.provider] ?? cred.provider}
                                </Text>
                              </Td>

                              {/* Status Toggle */}
                              <Td style={{ width: '120px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                                <Flex align="center" justify="center" gap={2}>
                                  <Toggle
                                    checked={cred.is_active}
                                    onChange={() => toggleMutation.mutate(cred.id)}
                                    disabled={toggleMutation.isPending}
                                  />
                                  <Badge status={cred.is_active ? 'green' : 'gray'}>
                                    {cred.is_active ? 'Active' : 'Off'}
                                  </Badge>
                                </Flex>
                              </Td>

                              {/* Actions */}
                              <Td style={{ width: '180px', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                                <Flex align="center" justify="end" gap={2}>
                                  <Button
                                    size="sm"
                                    onClick={() => syncMutation.mutate(cred.provider)}
                                    disabled={syncMutation.isPending || !cred.is_active}
                                    style={{ fontSize: '11px', padding: '4px 8px' }}
                                  >
                                    <RefreshCw size={11} className={syncMutation.isPending ? 'animate-spin' : ''} />
                                    Sync
                                  </Button>

                                  {confirmId === cred.id ? (
                                    <Flex align="center" gap={1}>
                                      <Button
                                        size="sm"
                                        intent="danger"
                                        onClick={() => deleteMutation.mutate(cred.id)}
                                        disabled={deleteMutation.isPending}
                                        style={{ fontSize: '11px', padding: '4px 8px' }}
                                      >
                                        Confirm
                                      </Button>
                                      <Button
                                        size="sm"
                                        intent="ghost"
                                        onClick={() => setConfirmId(null)}
                                        style={{ fontSize: '11px', padding: '4px 8px' }}
                                      >
                                        Cancel
                                      </Button>
                                    </Flex>
                                  ) : (
                                    <Button
                                      size="sm"
                                      intent="ghost"
                                      onClick={() => setConfirmId(cred.id)}
                                      style={{ padding: '6px' }}
                                      title="Delete credentials"
                                      aria-label={`Delete ${cred.name} credentials`}
                                    >
                                      <Trash2 size={14} style={{ color: 'var(--sr)' }} />
                                    </Button>
                                  )}
                                </Flex>
                              </Td>
                            </tr>

                            {/* Config Detail Expanded */}
                            {expanded === cred.id && (
                              <tr style={{ backgroundColor: 'rgba(255,255,255,0.01)' }}>
                                <Td />
                                <Td colSpan={5} style={{ padding: '0 16px 16px 16px' }}>
                                  <div
                                    style={{
                                      backgroundColor: 'var(--bg-s2)',
                                      border: '1px solid var(--bd)',
                                      borderRadius: '8px',
                                      padding: '12px 16px',
                                      display: 'flex',
                                      flexWrap: 'wrap',
                                      columnGap: '24px',
                                      rowGap: '6px',
                                    }}
                                  >
                                    <Text variant="smallMuted" style={{ width: '100%', fontFamily: 'monospace', marginBottom: '4px' }}>
                                      Configuration parameters:
                                    </Text>
                                    {Object.entries(cred.config ?? {})
                                      .filter(([k]) => !SECRET_KEYS.has(k))
                                      .map(([k, v]) => (
                                        <span key={k} style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                                          <span style={{ color: 'var(--tx3)' }}>{k}:</span>{' '}
                                          <span style={{ color: 'var(--tx2)' }}>
                                            {Array.isArray(v) ? (v as string[]).join(', ') : String(v)}
                                          </span>
                                        </span>
                                      ))}
                                    {Object.keys(cred.config ?? {}).some(k => SECRET_KEYS.has(k)) && (
                                      <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--tx3)', fontStyle: 'italic' }}>
                                        • credentials contain active secret fields
                                      </span>
                                    )}
                                  </div>
                                </Td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  ))
                )}
              </TBody>
            </Table>
          </TableContainer>
        </Card>
      )}
    </Flex>
  )
}
