import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Search,
  Plus,
  Trash2,
  Pencil,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
} from 'lucide-react'
import { serversApi } from '../api'
import { useToast } from '../hooks/useToast'
import ProviderBadge from './ProviderBadge'
import { SkeletonTableRows } from './Skeleton'
import type { Server, ServerStatus } from '../types'

const STATUS_CFG: Record<
  ServerStatus,
  { bg: string; text: string; border: string; dot: 'pulse' | 'solid' | 'running' }
> = {
  running:    { bg: 'var(--sg-bg)',  text: 'var(--sg)',  border: 'var(--sg-bd)',  dot: 'running' },
  stopped:    { bg: 'var(--sr-bg)',  text: 'var(--sr)',  border: 'var(--sr-bd)',  dot: 'solid'   },
  pending:    { bg: 'var(--sy-bg)',  text: 'var(--sy)',  border: 'var(--sy-bd)',  dot: 'pulse'   },
  terminated: { bg: 'var(--sgr-bg)', text: 'var(--sgr)', border: 'var(--sgr-bd)', dot: 'solid'  },
  unknown:    { bg: 'var(--sgr-bg)', text: 'var(--sgr)', border: 'var(--sgr-bd)', dot: 'solid'  },
}

const PROVIDERS = ['aws','gcp','azure','linode','digitalocean','ovh','custom_dc']
const STATUSES: ServerStatus[] = ['running','stopped','pending','terminated','unknown']
const PAGE_SIZE = 20

type SortField = keyof Server
type SortDir   = 'asc' | 'desc'

function fmt(d?: string) {
  if (!d) return '—'
  return new Date(d).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
}

export default function ServerTable({
  onAddServer,
  onServerClick,
  onEditServer,
}: {
  onAddServer: () => void
  onServerClick?: (server: Server) => void
  onEditServer?: (server: Server) => void
}) {
  const [search, setSearch]         = useState('')
  const [debounced, setDebounced]   = useState('')
  const [provider, setProvider]     = useState('')
  const [status, setStatus]         = useState('')
  const [page, setPage]             = useState(1)
  const [sortField, setSortField]   = useState<SortField>('name')
  const [sortDir, setSortDir]       = useState<SortDir>('asc')
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const qc = useQueryClient()
  const { toast } = useToast()

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => { setPage(1) }, [debounced, provider, status])

  const { data: servers = [], isLoading } = useQuery({
    queryKey: ['servers', debounced, provider, status],
    queryFn: () =>
      serversApi.list({
        search:   debounced  || undefined,
        provider: provider   || undefined,
        status:   status     || undefined,
      }),
  })

  const deleteMutation = useMutation({
    mutationFn: serversApi.delete,
    onSuccess: () => {
      toast.success('Server removed from inventory')
      qc.invalidateQueries({ queryKey: ['servers'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      setDeletingId(null)
    },
    onError: () => toast.error('Failed to delete server'),
  })

  const sorted = [...servers].sort((a, b) => {
    const av = (a[sortField] as string | number | undefined) ?? ''
    const bv = (b[sortField] as string | number | undefined) ?? ''
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return sortDir === 'asc' ? cmp : -cmp
  })

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE)
  const rows       = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function toggleSort(f: SortField) {
    if (sortField === f) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortField(f); setSortDir('asc') }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ChevronsUpDown size={12} className="text-ink-dim" />
    return sortDir === 'asc'
      ? <ChevronUp   size={12} className="text-accent" />
      : <ChevronDown size={12} className="text-accent" />
  }

  const TH = ({
    label, field, center = false,
  }: { label: string; field?: SortField; center?: boolean }) => (
    <th
      onClick={field ? () => toggleSort(field) : undefined}
      className={`px-4 py-3 text-left text-[11px] font-semibold text-ink-muted uppercase tracking-wider whitespace-nowrap select-none ${
        field ? 'cursor-pointer hover:text-ink-secondary transition-colors' : ''
      } ${center ? 'text-center' : ''}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {field && <SortIcon field={field} />}
      </span>
    </th>
  )

  const selectClass =
    'bg-surface-2 border border-border text-ink-secondary text-sm rounded-lg px-3 py-2 ' +
    'focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-colors appearance-none pr-8 ' +
    'bg-[url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 16 16\'%3E%3Cpath fill=\'%234B4B72\' d=\'M8 10L3 5h10z\'/%3E%3C/svg%3E")] ' +
    'bg-no-repeat bg-[right_0.6rem_center] bg-[length:14px_14px]'

  return (
    <div className="card-dark overflow-hidden">
      {/* Toolbar */}
      <div className="p-4 border-b border-border flex flex-wrap gap-3 items-center bg-surface-1">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
          <input
            type="text"
            placeholder="Search name, IP, hostname…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-dark pl-9"
            aria-label="Search servers"
          />
        </div>

        <select
          value={provider}
          onChange={e => setProvider(e.target.value)}
          aria-label="Filter by provider"
          className={selectClass}
        >
          <option value="">All Providers</option>
          {PROVIDERS.map(p => (
            <option key={p} value={p}>
              {p.replace('_', ' ').toUpperCase()}
            </option>
          ))}
        </select>

        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          aria-label="Filter by status"
          className={selectClass}
        >
          <option value="">All Statuses</option>
          {STATUSES.map(s => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>

        {(search || provider || status) && (
          <button
            onClick={() => { setSearch(''); setProvider(''); setStatus('') }}
            className="text-xs text-ink-muted hover:text-ink-secondary border border-border
                       px-3 py-2 rounded-lg hover:bg-surface-3 transition-colors"
          >
            Clear
          </button>
        )}

        <span className="ml-auto text-xs text-ink-muted tabular-nums">
          {servers.length} server{servers.length !== 1 ? 's' : ''}
        </span>

        <button onClick={onAddServer} className="btn-primary">
          <Plus size={14} />
          Custom DC
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="table-dark min-w-[960px]" aria-label="Server inventory">
          <thead>
            <tr>
              <TH label="Name"        field="name" />
              <TH label="Provider"    field="provider" />
              <TH label="Region"      field="region" />
              <TH label="Type"        field="instance_type" />
              <TH label="Status"      field="status" />
              <TH label="Public IP"   field="public_ip" />
              <TH label="Private IP"  field="private_ip" />
              <TH label="vCPU"        field="vcpu"      center />
              <TH label="RAM (GB)"    field="memory_gb" center />
              <TH label="OS"          field="os" />
              <TH label="Last Synced" field="last_synced" />
              <TH label="" />
            </tr>
          </thead>
          <tbody>
            {isLoading && <SkeletonTableRows count={8} />}

            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={12} className="text-center py-16">
                  <p className="text-ink-muted text-sm">No servers found.</p>
                  {!search && !provider && !status && (
                    <button
                      onClick={onAddServer}
                      className="mt-2 text-accent text-sm hover:underline"
                    >
                      Add your first custom server →
                    </button>
                  )}
                </td>
              </tr>
            )}

            {rows.map(server => {
              const cfg = STATUS_CFG[server.status] ?? STATUS_CFG.unknown
              return (
                <tr
                  key={server.id}
                  onClick={() => onServerClick?.(server)}
                  className={onServerClick ? 'cursor-pointer' : ''}
                >
                  {/* Name */}
                  <td>
                    <p className="text-sm font-medium text-ink-primary">{server.name}</p>
                    {server.hostname && (
                      <p className="text-xs text-ink-muted font-mono">{server.hostname}</p>
                    )}
                  </td>

                  {/* Provider */}
                  <td>
                    <ProviderBadge provider={server.provider} />
                  </td>

                  {/* Region */}
                  <td>
                    <span className="text-sm text-ink-secondary">{server.region ?? '—'}</span>
                  </td>

                  {/* Type */}
                  <td>
                    <span className="text-xs font-mono text-ink-muted">{server.instance_type ?? '—'}</span>
                  </td>

                  {/* Status */}
                  <td>
                    <span
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium"
                      style={{ color: cfg.text, backgroundColor: cfg.bg, border: `1px solid ${cfg.border}` }}
                    >
                      {cfg.dot === 'running' ? (
                        <span className="status-dot-running" aria-hidden="true" />
                      ) : (
                        <span
                          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot === 'pulse' ? 'animate-pulse' : ''}`}
                          style={{ backgroundColor: cfg.text }}
                          aria-hidden="true"
                        />
                      )}
                      {server.status}
                    </span>
                  </td>

                  {/* Public IP */}
                  <td>
                    <span className="text-xs font-mono text-ink-secondary">
                      {server.public_ip ?? '—'}
                    </span>
                  </td>

                  {/* Private IP */}
                  <td>
                    <span className="text-xs font-mono text-ink-muted">
                      {server.private_ip ?? '—'}
                    </span>
                  </td>

                  {/* vCPU */}
                  <td className="text-center">
                    <span className="text-sm text-ink-secondary tabular-nums">
                      {server.vcpu ?? '—'}
                    </span>
                  </td>

                  {/* RAM */}
                  <td className="text-center">
                    <span className="text-sm text-ink-secondary tabular-nums">
                      {server.memory_gb ?? '—'}
                    </span>
                  </td>

                  {/* OS */}
                  <td>
                    <span className="text-xs text-ink-muted">{server.os ?? '—'}</span>
                  </td>

                  {/* Last Synced */}
                  <td>
                    <span className="text-xs text-ink-muted tabular-nums">{fmt(server.last_synced)}</span>
                  </td>

                  {/* Actions */}
                  <td onClick={e => e.stopPropagation()}>
                    {deletingId === server.id ? (
                      <div className="flex items-center gap-1 whitespace-nowrap">
                        <button
                          onClick={() => deleteMutation.mutate(server.id)}
                          disabled={deleteMutation.isPending}
                          className="text-[11px] px-2 py-1 rounded-lg transition-colors disabled:opacity-50"
                          style={{ background: 'var(--sr-bg)', color: 'var(--sr)', border: '1px solid var(--sr-bd)' }}
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setDeletingId(null)}
                          className="text-[11px] px-2 py-1 rounded-lg border border-border text-ink-muted hover:bg-surface-3 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        {onEditServer && server.provider === 'custom_dc' && (
                          <button
                            onClick={() => onEditServer(server)}
                            aria-label={`Edit ${server.name}`}
                            className="p-1.5 text-ink-dim hover:text-accent rounded-lg transition-colors hover:bg-surface-3"
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => setDeletingId(server.id)}
                          aria-label={`Delete ${server.name}`}
                          className="p-1.5 text-ink-dim hover:text-status-red rounded-lg transition-colors"
                          style={{ transition: 'color 150ms' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--sr-bg)')}
                          onMouseLeave={e => (e.currentTarget.style.background = '')}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-4 py-3 border-t border-border flex items-center justify-between bg-surface-1">
          <span className="text-xs text-ink-muted tabular-nums">
            Page {page} of {totalPages} · {servers.length} total
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-ghost px-3 py-1.5 text-xs"
            >
              Prev
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => {
              const p = i + 1
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                    page === p
                      ? 'bg-accent text-white'
                      : 'text-ink-muted hover:bg-surface-3 hover:text-ink-primary'
                  }`}
                >
                  {p}
                </button>
              )
            })}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="btn-ghost px-3 py-1.5 text-xs"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
