import { useState, useEffect, useMemo } from 'react'
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
import {
  Card,
  Flex,
  Input,
  Select,
  Button,
  TableContainer,
  Table,
  THead,
  TH,
  TBody,
  TD,
  Text,
} from './StitchUI'

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

const PROVIDERS = ['aws','gcp','azure','linode','digitalocean','ovh','hivelocity','custom_dc']
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
  compact = false,
  selectedServerId,
}: {
  onAddServer: () => void
  onServerClick?: (server: Server) => void
  onEditServer?: (server: Server) => void
  compact?: boolean
  selectedServerId?: number
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

  const { data: servers = [], isLoading, isError, error, refetch } = useQuery({
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

  const sorted = useMemo(
    () =>
      [...servers].sort((a, b) => {
        const av = (a[sortField] as string | number | undefined) ?? ''
        const bv = (b[sortField] as string | number | undefined) ?? ''
        const cmp = av < bv ? -1 : av > bv ? 1 : 0
        return sortDir === 'asc' ? cmp : -cmp
      }),
    [servers, sortField, sortDir],
  )

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE)
  const rows = useMemo(
    () => sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [sorted, page],
  )

  function toggleSort(f: SortField) {
    if (sortField === f) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortField(f); setSortDir('asc') }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ChevronsUpDown size={12} style={{ color: 'var(--tx3)' }} />
    return sortDir === 'asc'
      ? <ChevronUp   size={12} style={{ color: 'var(--ac)' }} />
      : <ChevronDown size={12} style={{ color: 'var(--ac)' }} />
  }

  const RenderTH = ({
    label, field, center = false, width,
  }: { label: string; field?: SortField; center?: boolean; width?: string }) => (
    <TH
      onClick={field ? () => toggleSort(field) : undefined}
      style={{
        cursor: field ? 'pointer' : 'default',
        textAlign: center ? 'center' : 'left',
        width: compact ? width : undefined,
      }}
    >
      <Flex align="center" gap={1} style={{ justifyContent: center ? 'center' : 'flex-start' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        {field && <SortIcon field={field} />}
      </Flex>
    </TH>
  )

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      {/* Toolbar */}
      <Flex
        align="center"
        wrap="true"
        gap={3}
        style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--bd)',
          backgroundColor: 'var(--bg-s1)',
        }}
      >
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--tx3)' }} aria-hidden="true" />
          <Input
            type="text"
            placeholder="Search name, IP, hostname…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: '36px' }}
            aria-label="Search servers"
          />
        </div>

        <Select
          value={provider}
          onChange={e => setProvider(e.target.value)}
          aria-label="Filter by provider"
          style={{ width: 'auto', minWidth: '150px' }}
        >
          <option value="">All Providers</option>
          {PROVIDERS.map(p => (
            <option key={p} value={p}>
              {p.replace('_', ' ').toUpperCase()}
            </option>
          ))}
        </Select>

        <Select
          value={status}
          onChange={e => setStatus(e.target.value)}
          aria-label="Filter by status"
          style={{ width: 'auto', minWidth: '150px' }}
        >
          <option value="">All Statuses</option>
          {STATUSES.map(s => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </Select>

        {(search || provider || status) && (
          <Button
            intent="ghost"
            onClick={() => { setSearch(''); setProvider(''); setStatus('') }}
            size="sm"
          >
            Clear
          </Button>
        )}

        <div style={{ marginLeft: 'auto' }}>
          <Text variant="small" style={{ fontFamily: 'monospace' }}>
            <span style={{ color: 'var(--ac)', fontWeight: 700 }}>{servers.length}</span> server{servers.length !== 1 ? 's' : ''} found
          </Text>
        </div>

        <Button intent="primary" onClick={onAddServer}>
          <Plus size={14} />
          Custom DC
        </Button>
      </Flex>

      {/* Table */}
      <TableContainer style={{ border: 'none', borderRadius: 0, boxShadow: 'none', overflowX: compact ? 'hidden' : 'auto' }}>
        <Table aria-label="Server inventory" style={{ tableLayout: compact ? 'fixed' : 'auto', width: '100%' }}>
          <THead>
            <tr>
              <RenderTH label="Name"        field="name" width="35%" />
              <RenderTH label="Provider"    field="provider" width="15%" />
              {!compact && <RenderTH label="Region"      field="region" />}
              {!compact && <RenderTH label="Type"        field="instance_type" />}
              <RenderTH label="Status"      field="status" width="15%" />
              <RenderTH label="Public IP"   field="public_ip" width="20%" />
              {!compact && <RenderTH label="Private IP"  field="private_ip" />}
              {!compact && <RenderTH label="vCPU"        field="vcpu"      center />}
              {!compact && <RenderTH label="RAM (GB)"    field="memory_gb" center />}
              {!compact && <RenderTH label="OS"          field="os" />}
              {!compact && <RenderTH label="Last Synced" field="last_synced" />}
              <RenderTH label="" width="15%" />
            </tr>
          </THead>
          <TBody>
            {isError && (
              <tr>
                <TD colSpan={compact ? 5 : 12} style={{ padding: '64px 0', textAlign: 'center' }}>
                  <div className="flex flex-col items-center justify-center max-w-md mx-auto p-6 bg-[#EF4444]/5 border border-[#EF4444]/15 rounded-xl">
                    <span className="text-[#EF4444] mb-2 text-xl">⚠️</span>
                    <h3 className="text-sm font-bold text-[#F4F4FF] mb-1">Failed to fetch servers</h3>
                    <p className="text-xs text-[#8B8AB0] mb-4">
                      Check backend connectivity or console logs. Details: {error instanceof Error ? error.message : 'Offline'}
                    </p>
                    <button
                      type="button"
                      onClick={() => refetch()}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#101018] hover:bg-[#18181F] border border-[#252540] hover:border-[#00D4FF]/30 text-xs font-semibold text-[#F4F4FF] rounded-lg transition-all cursor-pointer"
                    >
                      Retry Query
                    </button>
                  </div>
                </TD>
              </tr>
            )}

            {isLoading && !isError && <SkeletonTableRows count={8} />}

            {!isLoading && !isError && rows.length === 0 && (
              <tr>
                <TD colSpan={compact ? 5 : 12} style={{ textAlign: 'center', padding: '64px 0' }}>
                  <Text variant="muted">No servers found.</Text>
                  {!search && !provider && !status && (
                    <button
                      onClick={onAddServer}
                      style={{ marginTop: '8px', color: 'var(--ac)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '14px' }}
                      onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                      onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                    >
                      Add your first custom server →
                    </button>
                  )}
                </TD>
              </tr>
            )}

            {rows.map(server => {
              const cfg = STATUS_CFG[server.status] ?? STATUS_CFG.unknown
              const isSelected = selectedServerId === server.id
              return (
                <tr
                  key={server.id}
                  onClick={() => onServerClick?.(server)}
                  className={onServerClick ? 'cursor-pointer' : ''}
                  style={{
                    backgroundColor: isSelected ? 'rgba(0, 212, 255, 0.05)' : undefined,
                    borderLeft: isSelected ? '3px solid var(--ac)' : undefined,
                  }}
                >
                  {/* Name */}
                  <TD style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--tx1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={server.name}>{server.name}</p>
                    {server.hostname && (
                      <p style={{ margin: '2px 0 0 0', fontSize: '10px', color: 'var(--tx3)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={server.hostname}>{server.hostname}</p>
                    )}
                  </TD>

                  {/* Provider */}
                  <TD style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <ProviderBadge provider={server.provider} />
                  </TD>

                  {/* Region */}
                  {!compact && (
                    <TD>
                      <span style={{ fontSize: '14px', color: 'var(--tx2)' }}>{server.region ?? '—'}</span>
                    </TD>
                  )}

                  {/* Type */}
                  {!compact && (
                    <TD>
                      <span style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--tx3)' }}>{server.instance_type ?? '—'}</span>
                    </TD>
                  )}

                  {/* Status */}
                  <TD style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        color: cfg.text,
                        backgroundColor: cfg.bg,
                        border: `1px solid ${cfg.border}`,
                        width: 'fit-content',
                      }}
                    >
                      {cfg.dot === 'running' ? (
                        <span
                          style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--sg)',
                            boxShadow: '0 0 0 0 rgba(34, 197, 94, 0.4)',
                            animation: 'pulse-ring 2s ease-in-out infinite'
                          }}
                          aria-hidden="true"
                        />
                      ) : (
                        <span
                          className={`${cfg.dot === 'pulse' ? 'animate-pulse' : ''}`}
                          style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            flexShrink: 0,
                            backgroundColor: cfg.text
                          }}
                          aria-hidden="true"
                        />
                      )}
                      {server.status}
                    </span>
                  </TD>

                  {/* Public IP */}
                  <TD style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {(() => {
                      const sshAllIps = Array.isArray((server.ssh_info as Record<string,unknown>)?.all_ips)
                        ? (server.ssh_info as Record<string,unknown>).all_ips as string[]
                        : null
                      const primary = server.public_ip ?? (sshAllIps?.[0]) ?? null
                      const extra = sshAllIps ? sshAllIps.filter(ip => ip !== primary) : []
                      return (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'nowrap' }}>
                          <span style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--tx2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {primary ?? '—'}
                          </span>
                          {extra.length > 0 && (
                            <span
                              title={extra.join('\n')}
                              style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--ac)', background: 'var(--ac)14', border: '1px solid var(--ac)30', borderRadius: '4px', padding: '0 4px', cursor: 'default', flexShrink: 0 }}
                            >
                              +{extra.length}
                            </span>
                          )}
                        </span>
                      )
                    })()}
                  </TD>

                  {/* Private IP */}
                  {!compact && (
                    <TD>
                      <span style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--tx3)' }}>
                        {server.private_ip ?? '—'}
                      </span>
                    </TD>
                  )}

                  {/* vCPU */}
                  {!compact && (
                    <TD style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: '14px', color: 'var(--tx2)', fontFamily: 'monospace' }}>
                        {server.vcpu ?? '—'}
                      </span>
                    </TD>
                  )}

                  {/* RAM */}
                  {!compact && (
                    <TD style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: '14px', color: 'var(--tx2)', fontFamily: 'monospace' }}>
                        {server.memory_gb ?? '—'}
                      </span>
                    </TD>
                  )}

                  {/* OS */}
                  {!compact && (
                    <TD>
                      <span style={{ fontSize: '12px', color: 'var(--tx3)' }}>{server.os ?? '—'}</span>
                    </TD>
                  )}

                  {/* Last Synced */}
                  {!compact && (
                    <TD>
                      <span style={{ fontSize: '12px', color: 'var(--tx3)', fontFamily: 'monospace' }}>{fmt(server.last_synced)}</span>
                    </TD>
                  )}

                  {/* Actions */}
                  <TD onClick={e => e.stopPropagation()} style={{ overflow: 'hidden' }}>
                    {deletingId === server.id ? (
                      <Flex align="center" gap={1} style={{ whiteSpace: 'nowrap' }}>
                        <Button
                          onClick={() => deleteMutation.mutate(server.id)}
                          disabled={deleteMutation.isPending}
                          intent="danger"
                          size="sm"
                          style={{ padding: '4px 8px', fontSize: '11px' }}
                        >
                          Confirm
                        </Button>
                        <Button
                          onClick={() => setDeletingId(null)}
                          intent="ghost"
                          size="sm"
                          style={{ padding: '4px 8px', fontSize: '11px' }}
                        >
                          Cancel
                        </Button>
                      </Flex>
                    ) : (
                      <Flex align="center" justify="end" gap={1}>
                        {onEditServer && server.provider === 'custom_dc' && (
                          <button
                            onClick={() => onEditServer(server)}
                            aria-label={`Edit ${server.name}`}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '6px',
                              borderRadius: '8px',
                              display: 'flex',
                              alignItems: 'center',
                              color: 'var(--tx3)',
                              transition: 'all 150ms ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)';
                              e.currentTarget.style.color = 'var(--ac)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                              e.currentTarget.style.color = 'var(--tx3)';
                            }}
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => setDeletingId(server.id)}
                          aria-label={`Delete ${server.name}`}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '6px',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            color: 'var(--tx3)',
                            transition: 'all 150ms ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--sr-bg)';
                            e.currentTarget.style.color = 'var(--sr)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.color = 'var(--tx3)';
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </Flex>
                    )}
                  </TD>
                </tr>
              )
            })}
          </TBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      {totalPages > 1 && (
        <Flex
          align="center"
          justify="between"
          style={{
            padding: '12px 24px',
            borderTop: '1px solid var(--bd)',
            backgroundColor: 'var(--bg-s1)',
          }}
        >
          <Text variant="small" style={{ fontFamily: 'monospace' }}>
            Page {page} of {totalPages} · {servers.length} total
          </Text>
          <Flex align="center" gap={1}>
            <Button
              intent="ghost"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              size="sm"
              style={{ padding: '6px 12px' }}
            >
              Prev
            </Button>
            {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => {
              const p = i + 1
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 600,
                    transition: 'all 150ms ease',
                    backgroundColor: page === p ? 'var(--ac)' : 'transparent',
                    color: page === p ? 'var(--btn-primary-fg)' : 'var(--tx2)',
                  }}
                  onMouseEnter={e => {
                    if (page !== p) {
                      e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)';
                      e.currentTarget.style.color = 'var(--tx1)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (page !== p) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = 'var(--tx2)';
                    }
                  }}
                >
                  {p}
                </button>
              )
            })}
            <Button
              intent="ghost"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              size="sm"
              style={{ padding: '6px 12px' }}
            >
              Next
            </Button>
          </Flex>
        </Flex>
      )}
    </Card>
  )
}

