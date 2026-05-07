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

function StatusChip({ status }: { status?: string }) {
  if (!status) return <span className="text-xs text-ink-dim">—</span>
  const cfgMap: Record<string, { color: string; bg: string; border: string; Icon: React.ElementType }> = {
    success: { color: 'var(--sg)',  bg: 'var(--sg-bg)',  border: 'var(--sg-bd)',  Icon: CheckCircle2 },
    failed:  { color: 'var(--sr)',  bg: 'var(--sr-bg)',  border: 'var(--sr-bd)',  Icon: XCircle      },
    running: { color: 'var(--sy)',  bg: 'var(--sy-bg)',  border: 'var(--sy-bd)',  Icon: Loader       },
  }
  const cfg = cfgMap[status]
  if (!cfg) return <span className="text-xs text-ink-muted capitalize">{status}</span>
  const { color, bg, border, Icon } = cfg
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
      style={{ color, background: bg, border: `1px solid ${border}` }}
    >
      <Icon size={11} className={status === 'running' ? 'animate-spin' : ''} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
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

  const { data: crons = [], isLoading } = useQuery({
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
    onError: (e: any) => {
      const detail = e?.response?.data?.detail
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
    onError: (e: any) => {
      const detail = e?.response?.data?.detail
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
      createMutation.mutate(payload as any)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-ink-primary">
            {crons.length === 0 ? 'No scheduled syncs' : `${crons.length} cron job${crons.length !== 1 ? 's' : ''}`}
          </p>
          <p className="text-xs text-ink-muted mt-0.5">
            {crons.filter(c => c.is_active).length} active · runs are logged in Sync Logs
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus size={15} />
          Add Cron Job
        </button>
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <form
          onSubmit={submitForm}
          className="card-dark p-5 space-y-4 animate-slide-up"
        >
          <p className="text-xs font-semibold text-ink-secondary uppercase tracking-widest">
            {editing ? 'Edit Cron Job' : 'New Cron Job'}
          </p>

          <div className="grid grid-cols-2 gap-3">
            {/* Name */}
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium text-ink-secondary mb-1.5">
                Name <span className="text-status-red">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Hourly AWS sync"
                required
                className="input-dark"
              />
            </div>

            {/* Provider */}
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium text-ink-secondary mb-1.5">Provider</label>
              <select
                value={form.provider}
                onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}
                className="input-dark appearance-none"
              >
                <option value="">All Providers</option>
                {PROVIDERS.map(p => (
                  <option key={p} value={p}>{p.replace('_', ' ').toUpperCase()}</option>
                ))}
              </select>
            </div>

            {/* Cron expression */}
            <div className="col-span-2">
              <label className="block text-xs font-medium text-ink-secondary mb-1.5">
                Cron Expression <span className="text-status-red">*</span>
              </label>
              <input
                type="text"
                value={form.cron_expr}
                onChange={e => { setForm(f => ({ ...f, cron_expr: e.target.value })); setExprError('') }}
                placeholder="0 * * * *"
                required
                className={`input-dark font-mono ${exprError ? 'border-status-red focus:ring-status-red' : ''}`}
              />
              {exprError && (
                <p className="text-xs text-status-red mt-1 flex items-center gap-1">
                  <AlertCircle size={11} /> {exprError}
                </p>
              )}
              <p className="text-[11px] text-ink-muted mt-1 font-mono">
                Format: minute hour day month weekday  ·  UTC timezone
              </p>
            </div>

            {/* Presets */}
            <div className="col-span-2">
              <p className="text-[11px] text-ink-muted mb-2">Quick presets:</p>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map(p => (
                  <button
                    key={p.expr}
                    type="button"
                    title={p.desc}
                    onClick={() => { setForm(f => ({ ...f, cron_expr: p.expr })); setExprError('') }}
                    className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors ${
                      form.cron_expr === p.expr
                        ? 'border-accent text-accent'
                        : 'border-border text-ink-muted hover:border-accent hover:text-accent'
                    }`}
                    style={form.cron_expr === p.expr ? { background: 'var(--ac-bg)' } : {}}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Active */}
            <div className="col-span-2 flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div
                  className={`w-9 h-5 rounded-full relative transition-colors ${
                    form.is_active ? 'bg-accent' : 'bg-surface-3'
                  }`}
                  onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                  role="checkbox"
                  aria-checked={form.is_active}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      form.is_active ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
                  />
                </div>
                <span className="text-xs text-ink-secondary">
                  {form.is_active ? 'Enabled — will run on schedule' : 'Disabled — will not run'}
                </span>
              </label>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={cancelForm} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={isPending} className="btn-primary">
              {isPending ? 'Saving…' : editing ? 'Save Changes' : 'Create Job'}
            </button>
          </div>
        </form>
      )}

      {/* Empty state */}
      {!isLoading && crons.length === 0 && !showForm && (
        <div
          className="rounded-2xl p-16 text-center"
          style={{ border: '2px dashed var(--bd)' }}
        >
          <Clock size={36} className="text-ink-dim mx-auto mb-4" />
          <p className="text-ink-secondary text-sm font-medium">No scheduled syncs yet</p>
          <p className="text-ink-muted text-xs mt-1 mb-4">
            Add a cron job to automatically sync cloud providers on a schedule
          </p>
          <button onClick={openCreate} className="btn-primary mx-auto">
            <Plus size={14} />
            Add First Cron Job
          </button>
        </div>
      )}

      {/* Table */}
      {(isLoading || crons.length > 0) && (
        <div className="card-dark overflow-hidden">
          <table className="table-dark w-full" aria-label="Scheduled sync jobs">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Schedule</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-ink-muted uppercase tracking-wider hidden sm:table-cell">Provider</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-ink-muted uppercase tracking-wider hidden md:table-cell">Last Run</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-ink-muted uppercase tracking-wider hidden md:table-cell">Next Run</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-center text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Active</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i}>
                      {[...Array(8)].map((__, j) => (
                        <td key={j} className="px-4 py-4">
                          <div className="skeleton h-4 rounded" style={{ width: j === 0 ? 120 : j === 1 ? 90 : 60 }} />
                        </td>
                      ))}
                    </tr>
                  ))
                : crons.map(job => (
                    <tr key={job.id} className={!job.is_active ? 'opacity-55' : ''}>
                      {/* Name */}
                      <td className="px-4 py-3.5">
                        <button
                          className="text-sm font-medium text-ink-primary hover:text-accent transition-colors text-left"
                          onClick={() => openEdit(job)}
                        >
                          {job.name}
                        </button>
                      </td>

                      {/* Schedule */}
                      <td className="px-4 py-3.5">
                        <span
                          className="text-xs font-mono px-2 py-0.5 rounded"
                          style={{ background: 'var(--bg-s2)', border: '1px solid var(--bd)', color: 'var(--tx2)' }}
                        >
                          {job.cron_expr}
                        </span>
                      </td>

                      {/* Provider */}
                      <td className="px-4 py-3.5 hidden sm:table-cell">
                        {job.provider
                          ? <ProviderBadge provider={job.provider} />
                          : <span className="text-xs text-ink-muted italic">All providers</span>
                        }
                      </td>

                      {/* Last run */}
                      <td className="px-4 py-3.5 hidden md:table-cell">
                        <span className="text-xs text-ink-secondary tabular-nums">{fmt(job.last_run_at)}</span>
                      </td>

                      {/* Next run */}
                      <td className="px-4 py-3.5 hidden md:table-cell">
                        <span className="text-xs text-ink-secondary tabular-nums">
                          {job.is_active ? fmt(job.next_run_at) : '—'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <StatusChip status={job.last_run_status ?? undefined} />
                      </td>

                      {/* Active toggle */}
                      <td className="px-4 py-3.5">
                        <Toggle
                          checked={job.is_active}
                          onChange={() => toggleMutation.mutate(job.id)}
                          disabled={toggleMutation.isPending}
                          aria-label={job.is_active ? 'Disable' : 'Enable'}
                        />
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center gap-1.5 justify-end">
                          <button
                            onClick={() => runNowMutation.mutate(job.id)}
                            disabled={runNowMutation.isPending}
                            className="btn-ghost px-2.5 py-1.5 text-xs"
                            title="Run immediately"
                          >
                            <Play size={12} />
                            Run
                          </button>

                          {confirmId === job.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => deleteMutation.mutate(job.id)}
                                disabled={deleteMutation.isPending}
                                className="text-[11px] px-2 py-1 rounded-lg disabled:opacity-50"
                                style={{ background: 'var(--sr-bg)', color: 'var(--sr)', border: '1px solid var(--sr-bd)' }}
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setConfirmId(null)}
                                className="text-[11px] px-2 py-1 rounded-lg border border-border text-ink-muted hover:bg-surface-3 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmId(job.id)}
                              aria-label={`Delete ${job.name}`}
                              className="p-1.5 text-ink-muted hover:text-status-red rounded-lg transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      )}

      {/* Help text */}
      <div
        className="rounded-xl p-4 text-[11px] text-ink-muted font-mono space-y-1"
        style={{ background: 'var(--bg-s2)', border: '1px solid var(--bd)' }}
      >
        <p className="text-xs font-sans font-medium text-ink-secondary mb-2">Cron expression reference</p>
        <p>┌─── minute (0–59)</p>
        <p>│ ┌─── hour (0–23)</p>
        <p>│ │ ┌─── day of month (1–31)</p>
        <p>│ │ │ ┌─── month (1–12)</p>
        <p>│ │ │ │ ┌─── day of week (0–6, Sun=0)</p>
        <p>* * * * *   →  every minute</p>
        <p>Use <span className="text-accent">*/N</span> for "every N units"  ·  <span className="text-accent">1-5</span> for ranges  ·  <span className="text-accent">1,3,5</span> for lists</p>
      </div>
    </div>
  )
}
