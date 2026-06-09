import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Star, Trash2, Plus, KeyRound, Lock } from 'lucide-react'
import { useToast } from '../hooks/useToast'
import type { SSHCredential } from '../types'
import { http, getErrorMessage } from '../api'
import {
  Card,
  Flex,
  Grid,
  Heading,
  Text,
  Input,
  Textarea,
  Button,
  Badge,
  TableContainer,
  Table,
  THead,
  TBody,
  TH,
  TD,
} from './StitchUI'

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
  proxy_host: string
  proxy_port: string
  proxy_username: string
  proxy_auth_method: 'password' | 'key'
  proxy_password: string
  proxy_private_key: string
}

const EMPTY_FORM: FormState = {
  name: '',
  username: '',
  port: '22',
  auth_method: 'password',
  password: '',
  private_key: '',
  is_default: false,
  proxy_host: '',
  proxy_port: '22',
  proxy_username: '',
  proxy_auth_method: 'password',
  proxy_password: '',
  proxy_private_key: '',
}

function AuthBadge({ method }: { method: AuthMethod }) {
  const isKey = method === 'key'
  return (
    <Badge
      status={isKey ? 'primary' : 'gray'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '11px',
      }}
    >
      {isKey ? <KeyRound size={10} /> : <Lock size={10} />}
      {isKey ? 'Key' : 'Password'}
    </Badge>
  )
}

function DefaultBadge() {
  return (
    <Badge
      status="primary"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '11px',
      }}
    >
      <Star size={10} fill="currentColor" />
      Default
    </Badge>
  )
}

export default function SSHPage() {
  const qc = useQueryClient()
  const { toast } = useToast()

  const [showForm, setShowForm]       = useState(false)
  const [form, setForm]               = useState<FormState>(EMPTY_FORM)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

  const { data: creds = [], isLoading, isError, error, refetch } = useQuery({
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
    onError: (error: unknown) => toast.error(`Failed to save SSH credential: ${getErrorMessage(error)}`),
  })

  const deleteMutation = useMutation({
    mutationFn: sshCredentialsApi.delete,
    onSuccess: () => {
      toast.success('SSH credential deleted')
      qc.invalidateQueries({ queryKey: ['ssh-credentials'] })
      setConfirmDeleteId(null)
    },
    onError: (error: unknown) => toast.error(`Failed to delete SSH credential: ${getErrorMessage(error)}`),
  })

  const setDefaultMutation = useMutation({
    mutationFn: sshCredentialsApi.setDefault,
    onSuccess: () => {
      toast.success('Default credential updated')
      qc.invalidateQueries({ queryKey: ['ssh-credentials'] })
    },
    onError: (error: unknown) => toast.error(`Failed to set default: ${getErrorMessage(error)}`),
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
      ...(form.proxy_host ? {
        proxy_host:        form.proxy_host,
        proxy_port:        parseInt(form.proxy_port) || 22,
        proxy_username:    form.proxy_username || undefined,
        proxy_auth_method: form.proxy_auth_method,
        proxy_password:    form.proxy_auth_method === 'password' ? form.proxy_password || undefined : undefined,
        proxy_private_key: form.proxy_auth_method === 'key'      ? form.proxy_private_key || undefined : undefined,
      } : {}),
    })
  }

  return (
    <Flex direction="column" gap={5} className="animate-fade-in">
      {/* Page header */}
      <Flex justify="between" align="center">
        <div>
          <Heading as="h1">SSH Credentials</Heading>
          <Text variant="muted" style={{ marginTop: '4px' }}>
            Shared credentials for Custom DC server SSH access
          </Text>
        </div>
        {!showForm && (
          <Button intent="primary" onClick={() => setShowForm(true)}>
            <Plus size={14} />
            Add Credential
          </Button>
        )}
      </Flex>

      {/* Credentials table or form container */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {isError ? (
          <div style={{ padding: '64px 24px', textAlign: 'center' }}>
            <Flex direction="column" align="center" gap={3} style={{ maxWidth: '400px', margin: '0 auto' }}>
              <Text style={{ fontSize: '24px' }}>⚠️</Text>
              <Heading level="h4">Failed to fetch SSH credentials</Heading>
              <Text variant="smallMuted">
                Check backend connectivity or console logs. Details:{' '}
                {error instanceof Error ? error.message : 'Offline'}
              </Text>
              <Button size="sm" onClick={() => refetch()}>
                Retry Query
              </Button>
            </Flex>
          </div>
        ) : isLoading ? (
          <div style={{ padding: '56px 24px', textAlign: 'center' }}>
            <Text variant="muted">Loading SSH Credentials…</Text>
          </div>
        ) : creds.length === 0 && !showForm ? (
          <div style={{ padding: '64px 24px', textAlign: 'center' }}>
            <KeyRound size={28} style={{ color: 'var(--tx3)', margin: '0 auto 12px auto', opacity: 0.5 }} />
            <Heading level="h3" style={{ marginBottom: '8px' }}>No SSH credentials yet</Heading>
            <Text variant="muted" style={{ marginBottom: '24px' }}>
              Add a credential to enable SSH sync for Custom DC servers
            </Text>
            <Button intent="primary" onClick={() => setShowForm(true)} style={{ margin: '0 auto' }}>
              <Plus size={14} />
              Add Credential
            </Button>
          </div>
        ) : creds.length > 0 && !showForm ? (
          <TableContainer style={{ border: 'none', borderRadius: 0, boxShadow: 'none' }}>
            <Table aria-label="SSH credentials">
              <THead>
                <tr>
                  <TH>Name</TH>
                  <TH>User</TH>
                  <TH>Auth Method</TH>
                  <TH>Port</TH>
                  <TH>Default</TH>
                  <TH style={{ width: '120px', textAlign: 'right' }}>Actions</TH>
                </tr>
              </THead>
              <TBody>
                {creds.map(cred => (
                  <tr key={cred.id}>
                    <TD>
                      <Text style={{ fontWeight: 700 }}>{cred.name}</Text>
                      {cred.created_at && (
                        <Text variant="smallMuted" style={{ marginTop: '2px' }}>
                          {new Date(cred.created_at).toLocaleDateString()}
                        </Text>
                      )}
                    </TD>
                    <TD>
                      <Text style={{ fontFamily: 'monospace', fontSize: '12px' }}>{cred.username}</Text>
                    </TD>
                    <TD>
                      <AuthBadge method={cred.auth_method} />
                    </TD>
                    <TD>
                      <Text style={{ fontFamily: 'monospace', fontSize: '12px' }}>{cred.port}</Text>
                    </TD>
                    <TD>
                      {cred.is_default ? <DefaultBadge /> : <Text variant="smallMuted">—</Text>}
                    </TD>
                    <TD>
                      <Flex align="center" justify="end" gap={2}>
                        {!cred.is_default && (
                          <Button
                            size="sm"
                            intent="ghost"
                            onClick={() => setDefaultMutation.mutate(cred.id)}
                            disabled={setDefaultMutation.isPending}
                            style={{ padding: '6px' }}
                            title="Set as default"
                            aria-label={`Set ${cred.name} as default`}
                          >
                            <Star size={14} />
                          </Button>
                        )}

                        {confirmDeleteId === cred.id ? (
                          <Flex align="center" gap={2}>
                            <Text style={{ fontSize: '11px', color: 'var(--sr)', fontWeight: 700 }}>Delete?</Text>
                            <Button
                              size="sm"
                              intent="danger"
                              onClick={() => deleteMutation.mutate(cred.id)}
                              disabled={deleteMutation.isPending}
                              style={{ padding: '2px 8px', fontSize: '10px' }}
                            >
                              Yes
                            </Button>
                            <Button
                              size="sm"
                              intent="ghost"
                              onClick={() => setConfirmDeleteId(null)}
                              style={{ padding: '2px 8px', fontSize: '10px' }}
                            >
                              No
                            </Button>
                          </Flex>
                        ) : (
                          <Button
                            size="sm"
                            intent="ghost"
                            onClick={() => setConfirmDeleteId(cred.id)}
                            style={{ padding: '6px' }}
                            title={`Delete ${cred.name}`}
                            aria-label={`Delete ${cred.name}`}
                          >
                            <Trash2 size={14} style={{ color: 'var(--sr)' }} />
                          </Button>
                        )}
                      </Flex>
                    </TD>
                  </tr>
                ))}
              </TBody>
            </Table>
          </TableContainer>
        ) : null}

        {/* Add form */}
        {showForm && (
          <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
            <Heading
              level="h3"
              style={{
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontSize: '12px',
                borderBottom: '1px solid var(--bd)',
                paddingBottom: '12px',
                marginBottom: '20px',
              }}
            >
              New SSH Credential
            </Heading>

            <Grid columns={{ '@initial': 1, '@md': 2 }} gap={4} style={{ marginBottom: '16px' }}>
              <div>
                <Text variant="label" style={{ marginBottom: '6px', display: 'block' }}>
                  Name <span style={{ color: 'var(--sr)' }}>*</span>
                </Text>
                <Input
                  type="text"
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  placeholder="Production DC"
                  autoFocus
                />
              </div>
              <div>
                <Text variant="label" style={{ marginBottom: '6px', display: 'block' }}>
                  Username <span style={{ color: 'var(--sr)' }}>*</span>
                </Text>
                <Input
                  type="text"
                  value={form.username}
                  onChange={e => set('username', e.target.value)}
                  placeholder="root"
                />
              </div>
            </Grid>

            <Grid columns={{ '@initial': 1, '@md': 2 }} gap={4} style={{ marginBottom: '20px' }}>
              <div>
                <Text variant="label" style={{ marginBottom: '6px', display: 'block' }}>Port</Text>
                <Input
                  type="number"
                  value={form.port}
                  onChange={e => set('port', e.target.value)}
                  min={1}
                  max={65535}
                />
              </div>
              <Flex align="center" style={{ height: '100%', paddingTop: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={form.is_default}
                    onChange={e => set('is_default', e.target.checked)}
                    style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '4px',
                      accentColor: 'var(--ac)',
                      cursor: 'pointer',
                    }}
                  />
                  <Text variant="body" style={{ fontSize: '13px' }}>Set as default SSH credential</Text>
                </label>
              </Flex>
            </Grid>

            {/* Auth method selection */}
            <div style={{ marginBottom: '20px' }}>
              <Text variant="label" style={{ marginBottom: '8px', display: 'block' }}>Auth Method</Text>
              <Flex gap={4}>
                {(['password', 'key'] as AuthMethod[]).map(method => (
                  <label key={method} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
                    <input
                      type="radio"
                      name="auth_method"
                      value={method}
                      checked={form.auth_method === method}
                      onChange={() => set('auth_method', method)}
                      style={{
                        accentColor: 'var(--ac)',
                        cursor: 'pointer',
                      }}
                    />
                    <Text variant="body" style={{ textTransform: 'capitalize', fontSize: '13px' }}>
                      {method === 'key' ? 'SSH Private Key' : 'Password Auth'}
                    </Text>
                  </label>
                ))}
              </Flex>
            </div>

            {/* Conditional secret fields */}
            {form.auth_method === 'password' ? (
              <div style={{ marginBottom: '24px' }}>
                <Text variant="label" style={{ marginBottom: '6px', display: 'block' }}>Password</Text>
                <Input
                  type="password"
                  value={form.password}
                  onChange={e => set('password', e.target.value)}
                  placeholder="Enter SSH password"
                  autoComplete="new-password"
                />
              </div>
            ) : (
              <div style={{ marginBottom: '24px' }}>
                <Text variant="label" style={{ marginBottom: '6px', display: 'block' }}>Private Key</Text>
                <Textarea
                  value={form.private_key}
                  onChange={e => set('private_key', e.target.value)}
                  rows={8}
                  placeholder={'-----BEGIN OPENSSH PRIVATE KEY-----\n…\n-----END OPENSSH PRIVATE KEY-----'}
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    lineHeight: '1.5',
                    resize: 'none',
                  }}
                  spellCheck={false}
                />
              </div>
            )}

            {/* Jump / Proxy Server */}
            <div style={{ marginBottom: '20px', padding: '16px', borderRadius: '4px', border: '1px solid var(--bd)', background: 'var(--bg-s2)' }}>
              <Text variant="label" style={{ marginBottom: '12px', display: 'block' }}>Jump Server (optional)</Text>
              <Grid columns={{ '@initial': 1, '@md': 2 }} gap={3} style={{ marginBottom: '12px' }}>
                <div>
                  <Text variant="label" style={{ marginBottom: '6px', display: 'block', fontSize: '11px' }}>Host</Text>
                  <Input
                    type="text"
                    value={form.proxy_host}
                    onChange={e => set('proxy_host', e.target.value)}
                    placeholder="89.167.44.42"
                  />
                </div>
                <div>
                  <Text variant="label" style={{ marginBottom: '6px', display: 'block', fontSize: '11px' }}>Port</Text>
                  <Input
                    type="number"
                    value={form.proxy_port}
                    onChange={e => set('proxy_port', e.target.value)}
                    min={1}
                    max={65535}
                  />
                </div>
              </Grid>
              <div style={{ marginBottom: '12px' }}>
                <Text variant="label" style={{ marginBottom: '6px', display: 'block', fontSize: '11px' }}>Username</Text>
                <Input
                  type="text"
                  value={form.proxy_username}
                  onChange={e => set('proxy_username', e.target.value)}
                  placeholder="root"
                />
              </div>
              <Flex gap={4} style={{ marginBottom: '12px' }}>
                {(['password', 'key'] as const).map(method => (
                  <label key={method} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
                    <input
                      type="radio"
                      name="proxy_auth_method"
                      value={method}
                      checked={form.proxy_auth_method === method}
                      onChange={() => set('proxy_auth_method', method)}
                      style={{ accentColor: 'var(--ac)', cursor: 'pointer' }}
                    />
                    <Text variant="body" style={{ fontSize: '13px' }}>
                      {method === 'key' ? 'SSH Key' : 'Password'}
                    </Text>
                  </label>
                ))}
              </Flex>
              {form.proxy_auth_method === 'password' ? (
                <div>
                  <Text variant="label" style={{ marginBottom: '6px', display: 'block', fontSize: '11px' }}>Password</Text>
                  <Input
                    type="password"
                    value={form.proxy_password}
                    onChange={e => set('proxy_password', e.target.value)}
                    placeholder="Jump server password"
                    autoComplete="new-password"
                  />
                </div>
              ) : (
                <div>
                  <Text variant="label" style={{ marginBottom: '6px', display: 'block', fontSize: '11px' }}>Private Key</Text>
                  <Textarea
                    value={form.proxy_private_key}
                    onChange={e => set('proxy_private_key', e.target.value)}
                    rows={6}
                    placeholder={'-----BEGIN OPENSSH PRIVATE KEY-----\n…\n-----END OPENSSH PRIVATE KEY-----'}
                    style={{ fontFamily: 'monospace', fontSize: '12px', lineHeight: '1.5', resize: 'none' }}
                    spellCheck={false}
                  />
                </div>
              )}
            </div>

            <Flex gap={3} style={{ borderTop: '1px solid var(--bd)', paddingTop: '16px' }}>
              <Button type="button" intent="ghost" onClick={() => { setShowForm(false); setForm(EMPTY_FORM) }}>
                Cancel
              </Button>
              <Button type="submit" intent="primary" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Saving…' : 'Save SSH Credential'}
              </Button>
            </Flex>
          </form>
        )}
      </Card>
    </Flex>
  )
}
