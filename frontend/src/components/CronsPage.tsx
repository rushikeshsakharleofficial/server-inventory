import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Trash2, Play,
  Clock, CheckCircle2, XCircle, Loader, AlertCircle,
} from 'lucide-react'
import Toggle from './Toggle'
import { cronsApi } from '../api'
import { useToast } from '../hooks/useToast'
import ProviderBadge from './ProviderBadge'
import type { CronJob } from '../types'
import {
  Card,
  Flex,
  Grid,
  Heading,
  Text,
  Input,
  Select,
  Button,
  Badge,
  TableContainer,
  Table,
  THead,
  TBody,
  TH,
  TD,
} from './StitchUI'

const PROVIDERS = ['aws', 'gcp', 'azure', 'linode', 'digitalocean', 'ovh', 'custom_dc']

const PRESETS: { label: string; expr: string; desc: string }[] = [
  { label: 'Every hour',    expr: '0 * * * *',    desc: 'Runs at minute 0 of every hour'       },
  { label: 'Every 6h',     expr: '0 */6 * * *',   desc: 'Runs at midnight, 6am, noon, 6pm'     },
  { label: 'Every 12h',    expr: '0 */12 * * *',  desc: 'Runs at midnight and noon'            },
  { label: 'Daily 2am',    expr: '0 2 * * *',     desc: 'Runs once per day at 2:00 AM UTC'     },
  { label: 'Weekly Mon',   expr: '0 2 * * 1',     desc: 'Runs Monday at 2:00 AM UTC'           },
  { label: 'Every 30min',  expr: '*/30 * * * *',  desc: 'Runs every 30 minutes'                },
]

function fmt(d?: string) {
  if (!d) return '—'
  return new Date(d).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
}

const STATUS_CFG: Record<string, { label: string; status: 'green' | 'red' | 'yellow' | 'gray'; Icon: React.ElementType }> = {
  success: { label: 'Success', status: 'green',  Icon: CheckCircle2 },
  failed:  { label: 'Failed',  status: 'red',    Icon: XCircle      },
  running: { label: 'Running', status: 'yellow', Icon: Loader       },
}

function StatusChip({ status }: { status?: string }) {
  if (!status) return <Text variant="smallMuted">—</Text>
  const cfg = STATUS_CFG[status]
  if (!cfg) return <Badge status="gray">{status}</Badge>
  return (
    <Badge
      status={cfg.status}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
      }}
    >
      <cfg.Icon size={11} className={status === 'running' ? 'animate-spin' : ''} />
      {cfg.label}
    </Badge>
  )
}

interface FormState {
  name: string
  cron_expr: string
  provider: string
  is_active: boolean
}

const EMPTY_FORM: FormState = { name: '', cron_expr: '0 * * * *', provider: '', is_active: true }

export default function CronsPage() {
  const qc = useQueryClient()
  const { toast } = useToast()

  const [showForm, setShowForm]     = useState(false)
  const [editing, setEditing]       = useState<CronJob | null>(null)
  const [form, setForm]             = useState<FormState>(EMPTY_FORM)
  const [confirmId, setConfirmId]   = useState<number | null>(null)
  const [exprError, setExprError]   = useState('')

  const { data: crons = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['crons'],
    queryFn: cronsApi.list,
    refetchInterval: 15_000,
  })

  const createMutation = useMutation({
    mutationFn: cronsApi.create,
    onSuccess: () => {
      toast.success('Cron job created')
      qc.invalidateQueries({ queryKey: ['crons'] })
      setShowForm(false); setForm(EMPTY_FORM); setExprError('')
    },
    onError: (e: unknown) => {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      if (typeof detail === 'string' && detail.includes('cron')) setExprError(detail)
      else toast.error(detail ?? 'Failed to create cron job')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<FormState> }) =>
      cronsApi.update(id, data),
    onSuccess: () => {
      toast.success('Cron job updated')
      qc.invalidateQueries({ queryKey: ['crons'] })
      setEditing(null); setForm(EMPTY_FORM); setExprError('')
    },
    onError: (e: unknown) => {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      if (typeof detail === 'string') setExprError(detail)
      else toast.error('Failed to update cron job')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: cronsApi.delete,
    onSuccess: () => {
      toast.success('Cron job deleted')
      qc.invalidateQueries({ queryKey: ['crons'] })
      setConfirmId(null)
    },
    onError: () => toast.error('Failed to delete cron job'),
  })

  const toggleMutation = useMutation({
    mutationFn: cronsApi.toggle,
    onSuccess: (j) => {
      toast.info(`${j.name} ${j.is_active ? 'enabled' : 'disabled'}`)
      qc.invalidateQueries({ queryKey: ['crons'] })
    },
    onError: () => toast.error('Failed to toggle cron job'),
  })

  const runNowMutation = useMutation({
    mutationFn: cronsApi.runNow,
    onSuccess: (j) => {
      toast.success(`${j.name} started`)
      qc.invalidateQueries({ queryKey: ['crons'] })
    },
    onError: () => toast.error('Failed to trigger run'),
  })

  function openCreate() {
    setEditing(null); setForm(EMPTY_FORM); setExprError(''); setShowForm(true)
  }

  function openEdit(job: CronJob) {
    setEditing(job)
    setForm({ name: job.name, cron_expr: job.cron_expr, provider: job.provider ?? '', is_active: job.is_active })
    setExprError('')
    setShowForm(true)
  }

  function cancelForm() {
    setShowForm(false); setEditing(null); setForm(EMPTY_FORM); setExprError('')
  }

  function submitForm(e: React.FormEvent) {
    e.preventDefault()
    setExprError('')
    const payload = {
      name: form.name.trim(),
      cron_expr: form.cron_expr.trim(),
      provider: form.provider || undefined,
      is_active: form.is_active,
    }
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <Flex direction="column" gap={5} className="animate-fade-in">
      {/* Header */}
      <Flex justify="between" align="center">
        <div>
          <Heading level="h1">Cron Jobs</Heading>
          <Text variant="muted" style={{ marginTop: '4px' }}>
            {crons.length === 0 ? 'No scheduled syncs' : `${crons.length} cron job${crons.length !== 1 ? 's' : ''}`} (
            {crons.filter(c => c.is_active).length} active · runs are logged in Sync Logs)
          </Text>
        </div>
        <Button intent="primary" onClick={openCreate}>
          <Plus size={15} />
          Add Cron Job
        </Button>
      </Flex>

      {/* Add / Edit form */}
      {showForm && (
        <form onSubmit={submitForm}>
          <Card style={{ padding: '24px' }}>
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
              {editing ? 'Edit Cron Job' : 'New Cron Job'}
            </Heading>

            <Grid columns={{ '@initial': 1, '@md': 2 }} gap={4} style={{ marginBottom: '16px' }}>
              {/* Name */}
              <div>
                <Text variant="label" style={{ marginBottom: '6px', display: 'block' }}>
                  Name <span style={{ color: 'var(--sr)' }}>*</span>
                </Text>
                <Input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Hourly AWS sync"
                  required
                />
              </div>

              {/* Provider */}
              <div>
                <Text variant="label" style={{ marginBottom: '6px', display: 'block' }}>Provider</Text>
                <Select
                  value={form.provider}
                  onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}
                >
                  <option value="">All Providers</option>
                  {PROVIDERS.map(p => (
                    <option key={p} value={p}>{p.replace('_', ' ').toUpperCase()}</option>
                  ))}
                </Select>
              </div>
            </Grid>

            {/* Cron expression */}
            <div style={{ marginBottom: '16px' }}>
              <Text variant="label" style={{ marginBottom: '6px', display: 'block' }}>
                Cron Expression <span style={{ color: 'var(--sr)' }}>*</span>
              </Text>
              <Input
                type="text"
                value={form.cron_expr}
                onChange={e => { setForm(f => ({ ...f, cron_expr: e.target.value })); setExprError('') }}
                placeholder="0 * * * *"
                required
                style={{
                  fontFamily: 'monospace',
                  borderColor: exprError ? 'var(--sr)' : 'var(--bd)',
                }}
              />
              {exprError && (
                <Text style={{ color: 'var(--sr)', fontSize: '12px', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <AlertCircle size={11} /> {exprError}
                </Text>
              )}
              <Text variant="smallMuted" style={{ marginTop: '6px', fontFamily: 'monospace' }}>
                Format: minute hour day month weekday  ·  UTC timezone
              </Text>
            </div>

            {/* Presets */}
            <div style={{ marginBottom: '20px' }}>
              <Text variant="smallMuted" style={{ marginBottom: '8px', display: 'block' }}>Quick presets:</Text>
              <Flex wrap="true" gap={2}>
                {PRESETS.map(p => {
                  const active = form.cron_expr === p.expr
                  return (
                    <Button
                      key={p.expr}
                      type="button"
                      title={p.desc}
                      onClick={() => { setForm(f => ({ ...f, cron_expr: p.expr })); setExprError('') }}
                      style={{
                        fontSize: '11px',
                        padding: '4px 10px',
                        border: active ? '1px solid var(--ac)' : '1px solid var(--bd)',
                        backgroundColor: active ? 'var(--ac-bg)' : 'transparent',
                        color: active ? 'var(--ac)' : 'var(--tx2)',
                      }}
                    >
                      {p.label}
                    </Button>
                  )
                })}
              </Flex>
            </div>

            {/* Active Switch */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none' }}>
                <Toggle
                  checked={form.is_active}
                  onChange={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                />
                <Text variant="body" style={{ fontSize: '13px' }}>
                  {form.is_active ? 'Enabled — will run on schedule' : 'Disabled — will not run'}
                </Text>
              </label>
            </div>

            <Flex gap={3} style={{ borderTop: '1px solid var(--bd)', paddingTop: '16px' }}>
              <Button type="button" intent="ghost" onClick={cancelForm}>Cancel</Button>
              <Button type="submit" intent="primary" disabled={isPending}>
                {isPending ? 'Saving…' : editing ? 'Save Changes' : 'Create Job'}
              </Button>
            </Flex>
          </Card>
        </form>
      )}

      {/* Empty state */}
      {!isLoading && !isError && crons.length === 0 && !showForm && (
        <Card style={{ borderStyle: 'dashed', padding: '64px 24px', textAlign: 'center' }}>
          <Clock size={36} style={{ color: 'var(--tx3)', margin: '0 auto 16px auto', opacity: 0.5 }} />
          <Heading level="h3" style={{ marginBottom: '8px' }}>No scheduled syncs yet</Heading>
          <Text variant="muted" style={{ marginBottom: '24px' }}>
            Add a cron job to automatically sync cloud providers on a schedule
          </Text>
          <Button intent="primary" onClick={openCreate} style={{ margin: '0 auto' }}>
            <Plus size={14} />
            Add First Cron Job
          </Button>
        </Card>
      )}

      {/* Cron jobs Table list */}
      {(isLoading || isError || crons.length > 0) && (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <TableContainer style={{ border: 'none', borderRadius: 0, boxShadow: 'none' }}>
            <Table aria-label="Scheduled sync jobs">
              <THead>
                <tr>
                  <TH>Name</TH>
                  <TH>Schedule</TH>
                  <TH className="hidden-sm">Provider</TH>
                  <TH className="hidden-md">Last Run</TH>
                  <TH className="hidden-md">Next Run</TH>
                  <TH>Status</TH>
                  <TH style={{ textAlign: 'center' }}>Active</TH>
                  <TH style={{ textAlign: 'right', width: '150px' }}>Actions</TH>
                </tr>
              </THead>
              <TBody>
                {isError && (
                  <tr>
                    <td colSpan={8} style={{ padding: '64px 24px', textAlign: 'center' }}>
                      <Flex direction="column" align="center" gap={3} style={{ maxWidth: '400px', margin: '0 auto' }}>
                        <Text style={{ fontSize: '24px' }}>⚠️</Text>
                        <Heading level="h4">Failed to fetch cron jobs</Heading>
                        <Text variant="smallMuted">
                          Check backend connectivity or cron configurations. Details:{' '}
                          {error instanceof Error ? error.message : 'Offline'}
                        </Text>
                        <Button size="sm" onClick={() => refetch()}>
                          Retry Query
                        </Button>
                      </Flex>
                    </td>
                  </tr>
                )}

                {isLoading && !isError ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i}>
                      <TD><div className="skeleton h-5 rounded-sm w-32" /></TD>
                      <TD><div className="skeleton h-5 rounded-sm w-20" /></TD>
                      <TD className="hidden-sm"><div className="skeleton h-5 rounded-sm w-16" /></TD>
                      <TD className="hidden-md"><div className="skeleton h-5 rounded-sm w-24" /></TD>
                      <TD className="hidden-md"><div className="skeleton h-5 rounded-sm w-24" /></TD>
                      <TD><div className="skeleton h-5 rounded-sm w-16" /></TD>
                      <TD><div className="skeleton h-5 rounded-sm w-12 mx-auto" /></TD>
                      <TD><div className="skeleton h-5 rounded-sm w-20 ml-auto" /></TD>
                    </tr>
                  ))
                ) : (
                  crons.map(job => (
                    <tr key={job.id} style={{ opacity: job.is_active ? 1 : 0.55 }}>
                      {/* Name */}
                      <TD>
                        <button
                          onClick={() => openEdit(job)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 0,
                            textAlign: 'left',
                            outline: 'none',
                          }}
                        >
                          <Text style={{ fontWeight: 700, color: 'var(--tx1)' }}>{job.name}</Text>
                        </button>
                      </TD>

                      {/* Schedule */}
                      <TD>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '11px',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: 'var(--bg-s2)',
                            border: '1px solid var(--bd)',
                            color: 'var(--tx2)',
                          }}
                        >
                          {job.cron_expr}
                        </span>
                      </TD>

                      {/* Provider */}
                      <TD className="hidden-sm">
                        {job.provider ? (
                          <ProviderBadge provider={job.provider} />
                        ) : (
                          <Text variant="smallMuted" style={{ fontStyle: 'italic' }}>All providers</Text>
                        )}
                      </TD>

                      {/* Last run */}
                      <TD className="hidden-md">
                        <Text style={{ fontFamily: 'monospace', fontSize: '12px' }}>{fmt(job.last_run_at)}</Text>
                      </TD>

                      {/* Next run */}
                      <TD className="hidden-md">
                        <Text style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                          {job.is_active ? fmt(job.next_run_at) : '—'}
                        </Text>
                      </TD>

                      {/* Status */}
                      <TD>
                        <StatusChip status={job.last_run_status ?? undefined} />
                      </TD>

                      {/* Active toggle */}
                      <TD style={{ textAlign: 'center' }}>
                        <Flex justify="center">
                          <Toggle
                            checked={job.is_active}
                            onChange={() => toggleMutation.mutate(job.id)}
                            disabled={toggleMutation.isPending}
                          />
                        </Flex>
                      </TD>

                      {/* Actions */}
                      <TD>
                        <Flex align="center" justify="end" gap={2}>
                          <Button
                            size="sm"
                            onClick={() => runNowMutation.mutate(job.id)}
                            disabled={runNowMutation.isPending}
                            style={{ fontSize: '11px', padding: '4px 8px' }}
                          >
                            <Play size={11} style={{ marginRight: '4px' }} />
                            Run
                          </Button>

                          {confirmId === job.id ? (
                            <Flex align="center" gap={2}>
                              <Text style={{ fontSize: '11px', color: 'var(--sr)', fontWeight: 700 }}>Delete?</Text>
                              <Button
                                size="sm"
                                intent="danger"
                                onClick={() => deleteMutation.mutate(job.id)}
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
                            <Button
                              size="sm"
                              intent="ghost"
                              onClick={() => setConfirmId(job.id)}
                              style={{ padding: '6px' }}
                              title={`Delete ${job.name}`}
                            >
                              <Trash2 size={14} style={{ color: 'var(--sr)' }} />
                            </Button>
                          )}
                        </Flex>
                      </TD>
                    </tr>
                  ))
                )}
              </TBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {/* Help reference block */}
      <Card style={{ backgroundColor: 'var(--bg-s2)', padding: '16px' }}>
        <Text style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'monospace', marginBottom: '8px', color: 'var(--tx2)' }}>
          Cron expression reference
        </Text>
        <div style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--tx3)', lineHeight: '1.5' }}>
          <p>┌─── minute (0–59)</p>
          <p>│ ┌─── hour (0–23)</p>
          <p>│ │ ┌─── day of month (1–31)</p>
          <p>│ │ │ ┌─── month (1–12)</p>
          <p>│ │ │ │ ┌─── day of week (0–6, Sun=0)</p>
          <p>* * * * *   →  every minute</p>
          <p>Use <span style={{ color: 'var(--ac)' }}>*/N</span> for "every N units"  ·  <span style={{ color: 'var(--ac)' }}>1-5</span> for ranges  ·  <span style={{ color: 'var(--ac)' }}>1,3,5</span> for lists</p>
        </div>
      </Card>
    </Flex>
  )
}
