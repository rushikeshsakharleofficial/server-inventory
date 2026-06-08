import React, { useState, useEffect, useMemo } from 'react'
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
  running:    { bg: 'rgba(34,197,94,0.10)',   text: '#22C55E', border: 'rgba(34,197,94,0.20)',   dot: 'running' },
  stopped:    { bg: 'rgba(245,158,11,0.10)',  text: '#F59E0B', border: 'rgba(245,158,11,0.20)',  dot: 'solid'   },
  pending:    { bg: 'rgba(245,158,11,0.10)',  text: '#F59E0B', border: 'rgba(245,158,11,0.20)',  dot: 'pulse'   },
  terminated: { bg: 'rgba(113,113,122,0.10)', text: '#71717A', border: 'rgba(113,113,122,0.20)', dot: 'solid'  },
  unknown:    { bg: 'rgba(113,113,122,0.10)', text: '#71717A', border: 'rgba(113,113,122,0.20)', dot: 'solid'  },
}

const PROVIDERS = ['aws','gcp','azure','linode','digitalocean','ovh','hivelocity','custom_dc']
const STATUSES: ServerStatus[] = ['running','stopped','pending','terminated','unknown']
const PAGE_SIZE = 20

type SortField = keyof Server
type SortDir   = 'asc' | 'desc'


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

  const RenderTH = ({ label, field, style, center = false }: { label: string; field?: SortField; style?: React.CSSProperties; center?: boolean }) => (
    <TH onClick={field ? () => toggleSort(field) : undefined} style={{ cursor: field ? 'pointer' : 'default', textAlign: center ? 'center' : 'left', ...style }}>
      <Flex align="center" gap={1} style={{ justifyContent: center ? 'center' : 'flex-start' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        {field && <SortIcon field={field} />}
      </Flex>
    </TH>
  )

  return (
    <>
    <style>{`
      .server-table-wrap thead { background-color: var(--bg-base) !important; border-bottom: 1px solid var(--bd); }
      .server-table-wrap thead th { padding: 0 16px; height: 40px; font-family: 'Geist','Inter',system-ui,sans-serif !important; }
      .server-table-wrap tbody tr { border-bottom: 1px solid var(--bd); transition: background-color 100ms ease; }
      .server-table-wrap tbody tr:hover { background-color: #0F0F11 !important; }
      .server-table-wrap tbody td { padding: 0 16px; height: 40px; }
    `}</style>
    <Card style={{ padding: 0, overflow: 'hidden' }} className="server-table-wrap">
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
      <TableContainer style={{ border: 'none', borderRadius: 0, boxShadow: 'none', overflowX: 'hidden' }}>
        <Table aria-label="Server inventory" style={{ tableLayout: 'fixed', width: '100%' }}>
          <THead>
            <tr>
              <RenderTH label="Name"      field="name"      style={{ width: '34%' }} />
              <RenderTH label="Provider"  field="provider"  style={{ width: '14%' }} />
              <RenderTH label="Status"    field="status"    style={{ width: '14%' }} />
              <RenderTH label="Public IP" field="public_ip" style={{ width: '23%' }} />
              <RenderTH label=""                            style={{ width: '15%' }} />
            </tr>
          </THead>
          <TBody>
            {isError && (
              <tr>
                <TD colSpan={5} style={{ padding: '64px 0', textAlign: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', maxWidth: '28rem', margin: '0 auto', padding: '1.5rem', background: 'var(--sr-bg)', border: '1px solid var(--sr-bd)', borderRadius: '10px' }}>
                    <span style={{ color: 'var(--sr)', marginBottom: '0.5rem', fontSize: '1.25rem' }}>⚠️</span>
                    <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--tx1)', marginBottom: '0.25rem', margin: '0 0 4px' }}>Failed to fetch servers</h3>
                    <p style={{ fontSize: '12px', color: 'var(--tx2)', marginBottom: '1rem', margin: '0 0 16px', textAlign: 'center' }}>
                      Check backend connectivity or console logs. Details: {error instanceof Error ? error.message : 'Offline'}
                    </p>
                    <button
                      type="button"
                      onClick={() => refetch()}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 16px', background: 'var(--bg-s2)', border: '1px solid var(--bd-strong)', fontSize: '12px', fontWeight: 600, color: 'var(--tx1)', borderRadius: '6px', cursor: 'pointer', transition: 'all 150ms ease' }}
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
                <TD colSpan={5} style={{ textAlign: 'center', padding: '64px 0' }}>
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
              return (
                <tr
                  key={server.id}
                  onClick={() => onServerClick?.(server)}
                  className={onServerClick ? 'cursor-pointer' : ''}
                >
                  {/* Name */}
                  <TD style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: 500, color: 'var(--tx1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={server.name}>{server.name}</p>
                    {server.hostname && (
                      <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: 'var(--tx3)', fontFamily: "'JetBrains Mono', monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={server.hostname}>{server.hostname}</p>
                    )}
                  </TD>

                  {/* Provider */}
                  <TD style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <ProviderBadge provider={server.provider} />
                  </TD>

                  {/* Status */}
                  <TD style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '3px 9px',
                        borderRadius: '99px',
                        fontSize: '11px',
                        fontWeight: 500,
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
                              style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--ac)', background: 'var(--ac-bg)', border: '1px solid var(--ac-bd)', borderRadius: '4px', padding: '0 4px', cursor: 'default', flexShrink: 0 }}
                            >
                              +{extra.length}
                            </span>
                          )}
                        </span>
                      )
                    })()}
                  </TD>

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
    </>
  )
}

