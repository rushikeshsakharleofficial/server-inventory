import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
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
import { Pagination } from './Pagination'
import type { Server, ServerStatus } from '../types'
import { Combobox, ComboboxTrigger, ComboboxContent, ComboboxInput, ComboboxList, ComboboxEmpty, ComboboxGroup, ComboboxItem } from './ui/combobox'
import {
  Card,
  Flex,
  Input,
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
const PROVIDER_DATA = [{ label: 'All Providers', value: '' }, ...PROVIDERS.map(p => ({ label: p.replace('_',' ').toUpperCase(), value: p }))]
const STATUS_DATA   = [{ label: 'All Statuses',  value: '' }, ...STATUSES.map(s => ({ label: s.charAt(0).toUpperCase() + s.slice(1), value: s }))]
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

  useEffect(() => { setPage(1) }, [debounced, provider, status, sortField, sortDir])

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['servers', debounced, provider, status, page, sortField, sortDir],
    queryFn: () =>
      serversApi.list({
        search:   debounced  || undefined,
        provider: provider   || undefined,
        status:   status     || undefined,
        sort:     sortField,
        order:    sortDir,
        limit:    PAGE_SIZE,
        offset:   (page - 1) * PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  })

  const rows  = data?.items ?? []
  const total = data?.total ?? 0

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
        fontFamily: "'JetBrains Mono', monospace",
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

        <Combobox data={PROVIDER_DATA} type="provider" value={provider} onValueChange={v => { setProvider(v); setPage(1) }}>
          <ComboboxTrigger className="min-w-[150px] h-8 text-xs" />
          <ComboboxContent>
            <ComboboxInput />
            <ComboboxList>
              <ComboboxEmpty />
              <ComboboxGroup>
                {PROVIDER_DATA.map(p => <ComboboxItem key={p.value} value={p.value}>{p.label}</ComboboxItem>)}
              </ComboboxGroup>
            </ComboboxList>
          </ComboboxContent>
        </Combobox>

        <Combobox data={STATUS_DATA} type="status" value={status} onValueChange={v => { setStatus(v); setPage(1) }}>
          <ComboboxTrigger className="min-w-[150px] h-8 text-xs" />
          <ComboboxContent>
            <ComboboxInput />
            <ComboboxList>
              <ComboboxEmpty />
              <ComboboxGroup>
                {STATUS_DATA.map(s => <ComboboxItem key={s.value} value={s.value}>{s.label}</ComboboxItem>)}
              </ComboboxGroup>
            </ComboboxList>
          </ComboboxContent>
        </Combobox>

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
            <span style={{ color: 'var(--ac)', fontWeight: 700 }}>{total}</span> server{total !== 1 ? 's' : ''} found
          </Text>
        </div>

        <Button intent="primary" onClick={onAddServer}>
          <Plus size={14} />
          Custom DC
        </Button>
      </Flex>

      {/* Manifest header */}
      <div style={{ padding: '8px 24px', borderBottom: '1px solid var(--bd)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-s2)' }}>
        <span style={{ fontSize: '9px', fontFamily: "'JetBrains Mono', monospace", color: 'var(--tx3)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Infrastructure Manifest</span>
        <span style={{ fontSize: '9px', fontFamily: "'JetBrains Mono', monospace", color: 'var(--tx3)', letterSpacing: '0.1em' }}>{total} NODES</span>
      </div>

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
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: '400px', margin: '0 auto', padding: '24px', background: 'var(--sr-bg)', border: '1px solid var(--sr-bd)', borderRadius: '4px' }}>
                    <span style={{ color: 'var(--sr)', marginBottom: '8px', fontSize: '20px' }}>⚠</span>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--tx1)', margin: '0 0 4px' }}>Failed to fetch servers</p>
                    <p style={{ fontSize: '12px', color: 'var(--tx3)', margin: '0 0 16px', textAlign: 'center' }}>
                      {error instanceof Error ? error.message : 'Backend offline'}
                    </p>
                    <button
                      type="button"
                      onClick={() => refetch()}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 16px', background: 'var(--bg-s2)', border: '1px solid var(--bd)', borderRadius: '2px', fontSize: '12px', fontWeight: 600, color: 'var(--tx1)', cursor: 'pointer', transition: 'all 150ms ease' }}
                    >
                      Retry
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
                    backgroundColor: isSelected ? 'var(--ac-bg)' : undefined,
                    borderLeft: isSelected ? '2px solid var(--ac)' : undefined,
                  }}
                >
                  {/* Name */}
                  <TD style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <p style={{ margin: 0, fontSize: '12px', fontFamily: "'JetBrains Mono', monospace", color: 'var(--ac)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={server.name}>{server.name}</p>
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
                      <span style={{ fontSize: '12px', color: 'var(--tx2)', fontFamily: "'JetBrains Mono', monospace" }}>{server.region ?? '—'}</span>
                    </TD>
                  )}

                  {/* Type */}
                  {!compact && (
                    <TD>
                      <span style={{ fontSize: '12px', fontFamily: "'JetBrains Mono', monospace", color: 'var(--tx3)' }}>{server.instance_type ?? '—'}</span>
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
                      <span style={{ fontSize: '12px', color: 'var(--tx2)', fontFamily: "'JetBrains Mono', monospace" }}>
                        {server.vcpu ?? '—'}
                      </span>
                    </TD>
                  )}

                  {/* RAM */}
                  {!compact && (
                    <TD style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: '12px', color: 'var(--tx2)', fontFamily: "'JetBrains Mono', monospace" }}>
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
                              e.currentTarget.style.backgroundColor = 'var(--bg-s3)';
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
                            borderRadius: '4px',
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

      <Pagination page={page} total={total} pageSize={PAGE_SIZE} onPage={setPage} />
    </Card>
  )
}

