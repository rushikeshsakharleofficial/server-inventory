import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Shield } from 'lucide-react'
import Toggle from './Toggle'
import { usersApi, type ApiUser } from '../api'
import { useToast } from '../hooks/useToast'
import {
  Card,
  Flex,
  Grid,
  Heading,
  Text,
  Input,
  Button,
  Badge,
  TableContainer,
  Table,
  THead,
  TBody,
  TH,
  TD,
} from './StitchUI'

type RoleCfg = { label: string; color: string; bg: string; border: string; status: 'primary' | 'green' | 'yellow' | 'gray' }

const ROLE_CFG = {
  admin: { label: 'Admin',  color: '#6366F1', bg: 'rgba(99,102,241,0.1)',  border: 'rgba(99,102,241,0.25)', status: 'primary' },
  write: { label: 'Write',  color: '#4285F4', bg: 'rgba(66,133,244,0.1)',  border: 'rgba(66,133,244,0.25)', status: 'primary' },
  read:  { label: 'Read',   color: '#8B8AAE', bg: 'rgba(139,138,174,0.1)', border: 'rgba(139,138,174,0.2)', status: 'gray' },
} satisfies Record<string, RoleCfg>

const DEFAULT_ROLE_CFG: RoleCfg = { label: 'Unknown', color: '#8B8AAE', bg: 'rgba(139,138,174,0.1)', border: 'rgba(139,138,174,0.2)', status: 'gray' }

function getRoleCfg(role: string): RoleCfg {
  return (ROLE_CFG as Record<string, RoleCfg | undefined>)[role] ?? DEFAULT_ROLE_CFG
}

function RoleBadge({ role }: { role: string }): React.ReactElement {
  const cfg = getRoleCfg(role)
  return (
    <Badge
      status={cfg.status}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        color: cfg.color,
        backgroundColor: cfg.bg,
        borderColor: cfg.border,
      }}
    >
      {role === 'admin' && <Shield size={10} aria-hidden="true" />}
      {cfg.label}
    </Badge>
  )
}

export default function UsersPage() {
  const qc = useQueryClient()
  const { toast } = useToast()

  const [adding, setAdding]           = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole]         = useState('read')
  const [errors, setErrors]           = useState<string[]>([])
  const [confirmId, setConfirmId]     = useState<number | null>(null)

  const { data: users = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.list,
  })

  const createMutation = useMutation({
    mutationFn: usersApi.create,
    onSuccess: () => {
      toast.success(`User "${newUsername}" created`)
      qc.invalidateQueries({ queryKey: ['users'] })
      setAdding(false)
      setNewUsername('')
      setNewPassword('')
      setNewRole('read')
      setErrors([])
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
    <Flex direction="column" gap={4} className="animate-fade-in">
      {/* Header */}
      <Flex justify="between" align="center">
        <div>
          <Heading as="h1">User Management</Heading>
          <Text variant="muted" style={{ marginTop: '4px' }}>
            Configure infrastructure access policies and team member roles.
          </Text>
        </div>
        {!adding && (
          <Button intent="primary" onClick={() => setAdding(true)}>
            <Plus size={15} />
            Add User
          </Button>
        )}
      </Flex>

      {/* Inline Creation Card */}
      {adding && (
        <form onSubmit={submitCreate}>
          <Card style={{ borderColor: 'var(--ac-bd)', padding: '24px' }}>
            <Flex justify="between" align="center" style={{ borderBottom: '1px solid var(--bd)', paddingBottom: '12px', marginBottom: '16px' }}>
              <Heading level="h3" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '12px' }}>
                Add New Infrastructure User
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
                <Text variant="label" style={{ marginBottom: '6px', display: 'block' }}>
                  Username <span style={{ color: 'var(--sr)' }}>*</span>
                </Text>
                <Input
                  type="text"
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value)}
                  placeholder="john.doe"
                  autoComplete="off"
                />
              </div>
              <div>
                <Text variant="label" style={{ marginBottom: '6px', display: 'block' }}>
                  Password <span style={{ color: 'var(--sr)' }}>*</span>
                </Text>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  autoComplete="new-password"
                />
              </div>
            </Grid>

            <div style={{ marginBottom: '24px' }}>
              <Text variant="label" style={{ marginBottom: '8px', display: 'block' }}>Assign Role Policy</Text>
              <Flex gap={3}>
                {(['read', 'write'] as const).map(role => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setNewRole(role)}
                    style={{
                      flex: 1,
                      padding: '12px 16px',
                      borderRadius: '12px',
                      border: newRole === role ? '1px solid var(--ac)' : '1px solid var(--bd)',
                      backgroundColor: newRole === role ? 'var(--ac-bg)' : 'transparent',
                      color: newRole === role ? 'var(--ac)' : 'var(--tx2)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 150ms ease',
                      outline: 'none',
                    }}
                  >
                    <span style={{ display: 'block', fontWeight: 700, textTransform: 'capitalize' }}>{role}</span>
                    <span style={{ display: 'block', fontSize: '11px', fontWeight: 400, marginTop: '2px', opacity: 0.7 }}>
                      {role === 'read' ? 'View only permissions' : 'Full read & edit permissions'}
                    </span>
                  </button>
                ))}
              </Flex>
            </div>

            <Flex gap={3} style={{ borderTop: '1px solid var(--bd)', paddingTop: '16px' }}>
              <Button type="button" intent="ghost" onClick={() => { setAdding(false); setErrors([]) }}>
                Cancel
              </Button>
              <Button type="submit" intent="primary" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating…' : 'Create User'}
              </Button>
            </Flex>
          </Card>
        </form>
      )}

      {/* Users Table */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <TableContainer style={{ border: 'none', borderRadius: 0, boxShadow: 'none' }}>
          <Table aria-label="Users">
            <THead>
              <tr>
                <TH>User</TH>
                <TH>Role</TH>
                <TH style={{ textAlign: 'center' }}>Status</TH>
                <TH style={{ textAlign: 'right', width: '160px' }}>Actions</TH>
              </tr>
            </THead>
            <TBody>
              {isError ? (
                <tr>
                  <TD colSpan={4} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--sr)' }}>
                    Failed to load users.{' '}
                    <button onClick={() => refetch()} style={{ color: 'var(--ac)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                      Retry
                    </button>
                  </TD>
                </tr>
              ) : isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    <TD>
                      <Flex align="center" gap={3}>
                        <div className="skeleton w-9 h-9 rounded-xl" />
                        <div>
                          <div className="skeleton h-4 rounded-sm w-24 mb-1.5" />
                          <div className="skeleton h-3 rounded-sm w-16" />
                        </div>
                      </Flex>
                    </TD>
                    <TD><div className="skeleton h-5 rounded-sm w-16" /></TD>
                    <TD><div className="skeleton h-5 rounded-sm w-16 mx-auto" /></TD>
                    <TD><div className="skeleton h-5 rounded-sm w-24 ml-auto" /></TD>
                  </tr>
                ))
              ) : users.map(user => {
                  const roleCfg = getRoleCfg(user.role)
                  return (
                    <tr key={user.id} style={{ opacity: user.is_active ? 1 : 0.6 }}>
                      {/* User */}
                      <TD>
                        <Flex align="center" gap={3}>
                          <div
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '12px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '14px',
                              fontWeight: 700,
                              backgroundColor: roleCfg.bg,
                              color: roleCfg.color,
                              border: `1px solid ${roleCfg.border}`,
                              flexShrink: 0,
                            }}
                          >
                            {user.username.slice(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <Text style={{ fontWeight: 700, fontFamily: 'monospace' }}>{user.username}</Text>
                            <Text variant="smallMuted" style={{ marginTop: '2px' }}>
                              {user.role === 'admin'
                                ? 'System Administrator'
                                : user.role in ROLE_CFG
                                  ? `${user.role.toUpperCase()} Policy`
                                  : 'Unknown Role'}
                            </Text>
                          </div>
                        </Flex>
                      </TD>
                      {/* Role */}
                      <TD>
                        <RoleBadge role={user.role} />
                      </TD>
                      {/* Status */}
                      <TD style={{ textAlign: 'center' }}>
                        <Text variant="smallMuted" style={{ fontSize: '12px' }}>
                          {user.is_active ? 'Enabled' : 'Disabled'}
                        </Text>
                      </TD>
                      {/* Actions */}
                      <TD>
                        <Flex align="center" justify="end" gap={2}>
                          {user.role === 'admin' ? (
                            <span
                              style={{
                                fontSize: '10px',
                                fontFamily: 'monospace',
                                color: 'var(--tx3)',
                                backgroundColor: 'rgba(255,255,255,0.05)',
                                padding: '2px 6px',
                                borderRadius: '4px',
                              }}
                            >
                              SYSTEM
                            </span>
                          ) : confirmId === user.id ? (
                            <Flex align="center" gap={2}>
                              <Text style={{ fontSize: '11px', color: 'var(--sr)', fontWeight: 700 }}>Delete?</Text>
                              <Button
                                size="sm"
                                intent="danger"
                                onClick={() => deleteMutation.mutate(user.id)}
                                disabled={deleteMutation.isPending}
                                style={{ padding: '2px 8px', fontSize: '10px' }}
                              >
                                Yes
                              </Button>
                              <Button
                                size="sm"
                                intent="ghost"
                                onClick={() => setConfirmId(null)}
                                style={{ padding: '2px 8px', fontSize: '10px' }}
                              >
                                No
                              </Button>
                            </Flex>
                          ) : (
                            <>
                              <Toggle
                                checked={user.is_active}
                                onChange={() => toggleMutation.mutate(user.id)}
                              />
                              <Button
                                size="sm"
                                intent="ghost"
                                onClick={() => setConfirmId(user.id)}
                                style={{ padding: '6px' }}
                                title={`Delete ${user.username}`}
                                aria-label={`Delete ${user.username}`}
                              >
                                <Trash2 size={13} style={{ color: 'var(--sr)' }} />
                              </Button>
                            </>
                          )}
                        </Flex>
                      </TD>
                    </tr>
                  )
                })
              }
            </TBody>
          </Table>
        </TableContainer>
      </Card>
    </Flex>
  )
}
