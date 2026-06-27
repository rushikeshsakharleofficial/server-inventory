import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Search, HardDrive, X, Server, Plus } from 'lucide-react'
import { blockStoragesApi, getErrorMessage } from '../api'
import { Pagination } from './Pagination'
import { useToast } from '../hooks/useToast'
import ProviderBadge from './ProviderBadge'
import { SkeletonTableRows } from './Skeleton'
import type { BlockStorage } from '../types'

function fmt(d?: string) {
  if (!d) return '—'
  return new Date(d).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
}

function fmtSize(gb?: number | null) {
  if (gb == null) return '—'
  if (gb >= 1024) return `${(gb / 1024).toFixed(2)} TB`
  return `${gb} GB`
}

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-base)',
  border: '1px solid var(--bd)',
  borderRadius: 12,
  boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
}

const thStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--tx3)',
  padding: '10px 16px',
  background: 'var(--bg-s1)',
  borderBottom: '1px solid var(--bd)',
  textAlign: 'left',
  whiteSpace: 'nowrap',
}

const tdStyle: React.CSSProperties = {
  padding: '11px 16px',
  fontSize: 13,
  color: 'var(--tx1)',
  borderBottom: '1px solid var(--bd)',
}

export default function BlockStoragePage() {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [provider, setProvider] = useState('')
  const [selectedVol, setSelectedVol] = useState<BlockStorage | null>(null)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 50

  const { data: bsPage, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['block-storages', provider, page],
    queryFn: () => blockStoragesApi.list({ provider: provider || undefined, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    refetchInterval: 60_000,
  })
  const volumes = bsPage?.items ?? []
  const bsTotal = bsPage?.total ?? 0

  useEffect(() => { setPage(1) }, [provider, search])

  const syncMutation = useMutation({
    mutationFn: () => blockStoragesApi.sync(provider || undefined),
    onSuccess: () => {
      toast.success('Block Storage sync started')
      setTimeout(() => qc.invalidateQueries({ queryKey: ['block-storages'] }), 4000)
    },
    onError: (err: unknown) => toast.error(`Sync failed: ${getErrorMessage(err)}`),
  })

  const filtered = volumes.filter(vol =>
    !search ||
    vol.name.toLowerCase().includes(search.toLowerCase()) ||
    vol.cloud_id?.toLowerCase().includes(search.toLowerCase()) ||
    vol.volume_type?.toLowerCase().includes(search.toLowerCase()) ||
    vol.attachment?.toLowerCase().includes(search.toLowerCase())
  )

  const totalCount    = bsTotal
  const totalCapacity = volumes.reduce((sum, v) => sum + (v.size_gb || 0), 0)
  const attachedCount = volumes.filter(v => v.attachment || v.status === 'in-use' || v.status === 'running').length

  const handleRowClick = (vol: BlockStorage) => {
    setSelectedVol(selectedVol?.id === vol.id ? null : vol)
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--tx1)', letterSpacing: '-0.02em', margin: 0, fontFamily: 'Inter,sans-serif' }}>
            Block Storage
          </h1>
          <p style={{ fontSize: 13, color: 'var(--tx3)', margin: '4px 0 0', fontFamily: 'Inter,sans-serif' }}>
            Multi-cloud block volumes and storage discs mapping.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 14px', background: 'var(--bg-base)', border: '1px solid var(--bd)', borderRadius: 10, cursor: 'pointer', fontSize: 13, color: 'var(--tx2)', fontFamily: 'Inter,sans-serif', fontWeight: 500, transition: 'all 120ms' }}
          >
            <RefreshCw size={14} className={syncMutation.isPending ? 'animate-spin' : ''} />
            Sync All
          </button>
          <button
            type="button"
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', background: 'var(--ac)', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 13, color: '#fff', fontFamily: 'Inter,sans-serif', fontWeight: 600, boxShadow: '0 3px 10px rgba(246,130,31,0.3)', transition: 'all 120ms' }}
          >
            <Plus size={14} />
            Add Volume
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
        {[
          { label: 'TOTAL VOLUMES',   value: String(totalCount),         accent: 'var(--ac)' },
          { label: 'TOTAL CAPACITY',  value: fmtSize(totalCapacity),     accent: '#10B981'   },
          { label: 'ATTACHED',        value: String(attachedCount),      accent: '#3B82F6'   },
        ].map(k => (
          <div key={k.label} style={{ ...cardStyle, padding: 0, position: 'relative' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: k.accent, borderRadius: '12px 12px 0 0' }} />
            <div style={{ padding: '18px 20px 14px' }}>
              <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--tx3)', fontFamily: 'Inter,sans-serif', marginBottom: 8 }}>
                {k.label}
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--tx1)', letterSpacing: '-0.02em', fontFamily: 'Inter,sans-serif', lineHeight: 1 }}>
                {k.value}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Content row ── */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

        {/* Table card */}
        <div style={{ ...cardStyle, flex: 1, minWidth: 0, overflow: 'hidden', padding: 0 }}>

          {/* Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'var(--bg-s1)', borderBottom: '1px solid var(--bd)', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx3)', pointerEvents: 'none' }} />
              <input
                type="text"
                placeholder="Search name, attachment, type…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: '100%', background: 'var(--bg-base)', border: '1px solid var(--bd)', borderRadius: 8, height: 34, padding: '0 10px 0 30px', fontSize: 13, color: 'var(--tx1)', outline: 'none', fontFamily: 'Inter,sans-serif', boxSizing: 'border-box' }}
              />
            </div>
            <select
              value={provider}
              onChange={e => { setProvider(e.target.value); setSearch('') }}
              style={{ background: 'var(--bg-base)', border: '1px solid var(--bd)', borderRadius: 8, height: 34, padding: '0 10px', fontSize: 13, color: 'var(--tx1)', outline: 'none', fontFamily: 'Inter,sans-serif', cursor: 'pointer' }}
            >
              <option value="">All Providers</option>
              {['aws', 'gcp', 'azure', 'linode', 'digitalocean', 'hivelocity'].map(p => (
                <option key={p} value={p}>{p.toUpperCase()}</option>
              ))}
            </select>
            <span style={{ fontSize: 12, color: 'var(--tx3)', fontFamily: 'Inter,sans-serif', marginLeft: 'auto' }}>
              <span style={{ color: 'var(--ac)', fontWeight: 700 }}>{filtered.length}</span>{' '}
              vol{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: selectedVol ? '38%' : '26%' }}>Name</th>
                  <th style={{ ...thStyle, width: selectedVol ? '20%' : '14%' }}>Provider</th>
                  <th style={{ ...thStyle, width: selectedVol ? '16%' : '10%', textAlign: 'right' }}>Size</th>
                  <th style={{ ...thStyle, width: selectedVol ? '26%' : '14%' }}>Status</th>
                  {!selectedVol && (
                    <>
                      <th style={{ ...thStyle, width: '20%' }}>Attachment</th>
                      <th style={{ ...thStyle, width: '9%' }}>Type</th>
                      <th style={{ ...thStyle, width: '7%' }}>Region</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {isError && (
                  <tr>
                    <td colSpan={selectedVol ? 4 : 7} style={{ padding: '60px 24px', textAlign: 'center' }}>
                      <HardDrive size={28} style={{ color: 'var(--tx3)', margin: '0 auto 10px', display: 'block', opacity: 0.4 }} />
                      <div style={{ fontWeight: 600, color: 'var(--tx1)', marginBottom: 6, fontFamily: 'Inter,sans-serif' }}>Failed to fetch volumes</div>
                      <div style={{ fontSize: 12, color: 'var(--tx3)', marginBottom: 12, fontFamily: 'Inter,sans-serif' }}>
                        {error instanceof Error ? error.message : 'Offline'}
                      </div>
                      <button
                        onClick={() => refetch()}
                        style={{ padding: '6px 14px', background: 'var(--bg-s1)', border: '1px solid var(--bd)', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: 'var(--tx2)', fontFamily: 'Inter,sans-serif' }}
                      >
                        Retry
                      </button>
                    </td>
                  </tr>
                )}

                {isLoading && !isError && <SkeletonTableRows count={8} />}

                {!isLoading && !isError && filtered.length === 0 && (
                  <tr>
                    <td colSpan={selectedVol ? 4 : 7} style={{ padding: '72px 24px', textAlign: 'center' }}>
                      <HardDrive size={32} style={{ color: 'var(--tx3)', margin: '0 auto 12px', display: 'block', opacity: 0.35 }} />
                      <div style={{ fontSize: 13, color: 'var(--tx3)', fontFamily: 'Inter,sans-serif' }}>
                        {bsTotal === 0
                          ? 'No volumes found. Click "Sync All" to fetch from providers.'
                          : 'No volumes match your filters.'}
                      </div>
                    </td>
                  </tr>
                )}

                {filtered.map(vol => {
                  const isSelected = selectedVol?.id === vol.id
                  const isAttached = !!vol.attachment || vol.status === 'in-use' || vol.status === 'running'
                  return (
                    <tr
                      key={vol.id}
                      onClick={() => handleRowClick(vol)}
                      style={{ borderBottom: '1px solid var(--bd)', cursor: 'pointer', background: isSelected ? 'color-mix(in srgb, var(--ac) 6%, transparent)' : 'transparent', transition: 'background 120ms' }}
                      onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg-s1)' }}
                      onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLTableRowElement).style.background = 'transparent' }}
                    >
                      <td style={{ ...tdStyle, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 600, color: isSelected ? 'var(--ac)' : 'var(--tx1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'Inter,sans-serif' }}>
                          {vol.name}
                        </div>
                        {vol.cloud_id && vol.cloud_id !== vol.name && (
                          <div style={{ fontSize: 11, color: 'var(--tx3)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                            {vol.cloud_id}
                          </div>
                        )}
                      </td>
                      <td style={tdStyle}>
                        <ProviderBadge provider={vol.provider} showLogo />
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, fontFamily: 'Inter,sans-serif' }}>
                        {fmtSize(vol.size_gb)}
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: isAttached ? '#10B981' : 'var(--tx3)', flexShrink: 0 }} />
                          <span style={{ fontSize: 12, color: 'var(--tx2)', fontFamily: 'Inter,sans-serif' }}>
                            {vol.status === 'in-use' ? 'attached' : vol.status}
                          </span>
                        </div>
                      </td>
                      {!selectedVol && (
                        <>
                          <td style={{ ...tdStyle, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {isAttached ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <Server size={12} style={{ color: 'var(--tx3)', flexShrink: 0 }} />
                                <span style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'Inter,sans-serif' }}>
                                  {vol.attachment || 'Attached'}
                                </span>
                              </div>
                            ) : (
                              <span style={{ color: 'var(--tx3)' }}>—</span>
                            )}
                          </td>
                          <td style={tdStyle}>
                            <span style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 700, fontFamily: 'monospace', opacity: 0.8 }}>
                              {vol.volume_type ?? 'std'}
                            </span>
                          </td>
                          <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 11, color: 'var(--tx3)' }}>
                            {vol.region ?? '—'}
                          </td>
                        </>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <Pagination page={page} total={bsTotal} pageSize={PAGE_SIZE} onPage={setPage} />
        </div>

        {/* ── Detail pane ── */}
        {selectedVol && (
          <div
            className="animate-fade-in"
            style={{ ...cardStyle, width: 380, flexShrink: 0, position: 'sticky', top: 0, height: 'calc(100vh - 102px)', overflow: 'hidden', padding: 0 }}
          >
            {/* Detail header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bd)', background: 'var(--bg-s1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <HardDrive size={16} style={{ color: 'var(--ac)' }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx1)', fontFamily: 'Inter,sans-serif' }}>Volume Details</div>
                  <div style={{ fontSize: 11, color: 'var(--tx3)', fontFamily: 'monospace' }}>ID: {selectedVol.id}</div>
                </div>
              </div>
              <button
                onClick={() => setSelectedVol(null)}
                style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-s1)', border: '1px solid var(--bd)', borderRadius: 8, cursor: 'pointer' }}
              >
                <X size={13} style={{ color: 'var(--tx3)' }} />
              </button>
            </div>

            {/* Detail body */}
            <div style={{ padding: 20, overflowY: 'auto', height: 'calc(100% - 57px)', display: 'flex', flexDirection: 'column', gap: 18 }}>

              {/* Name */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--tx3)', fontFamily: 'Inter,sans-serif', marginBottom: 4 }}>
                  Name
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--tx1)', wordBreak: 'break-all', fontFamily: 'Inter,sans-serif' }}>
                  {selectedVol.name}
                </div>
              </div>

              {/* Capacity bar */}
              <div style={{ background: 'var(--bg-s1)', border: '1px solid var(--bd)', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--tx3)', fontWeight: 500, fontFamily: 'Inter,sans-serif' }}>Capacity</span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--ac)', fontFamily: 'Inter,sans-serif' }}>{fmtSize(selectedVol.size_gb)}</span>
                </div>
                <div style={{ height: 5, background: 'var(--bd)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, (selectedVol.size_gb || 0) / 10)}%`, background: 'var(--ac)', borderRadius: 3 }} />
                </div>
              </div>

              {/* Properties */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--tx3)', fontFamily: 'Inter,sans-serif', marginBottom: 8 }}>
                  Properties
                </div>
                {([
                  { label: 'Provider',    node: <ProviderBadge provider={selectedVol.provider} showLogo /> },
                  { label: 'Status',      node: (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: (selectedVol.status === 'in-use' || selectedVol.status === 'running') ? '#10B981' : 'var(--tx3)' }} />
                      <span style={{ fontSize: 12, fontFamily: 'Inter,sans-serif' }}>{selectedVol.status}</span>
                    </div>
                  )},
                  { label: 'Volume Type', node: <span style={{ fontFamily: 'monospace', fontSize: 12, textTransform: 'uppercase' }}>{selectedVol.volume_type ?? 'standard'}</span> },
                  { label: 'Region',      node: <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{selectedVol.region ?? '—'}</span> },
                  { label: 'Cloud ID',    node: <span style={{ fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all', textAlign: 'right', maxWidth: 180, display: 'block' }}>{selectedVol.cloud_id ?? '—'}</span> },
                ] as { label: string; node: React.ReactNode }[]).map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--bd)' }}>
                    <span style={{ fontSize: 12, color: 'var(--tx3)', fontFamily: 'Inter,sans-serif' }}>{row.label}</span>
                    {row.node}
                  </div>
                ))}
              </div>

              {/* Attachment */}
              <div style={{ background: 'var(--bg-s1)', border: '1px solid var(--bd)', borderLeft: '3px solid var(--ac)', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--tx3)', fontFamily: 'Inter,sans-serif', marginBottom: 8 }}>
                  Attachment Status
                </div>
                {selectedVol.attachment ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <Server size={14} style={{ color: 'var(--ac)' }} />
                    <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--tx1)', fontFamily: 'Inter,sans-serif' }}>{selectedVol.attachment}</span>
                  </div>
                ) : (
                  <span style={{ fontSize: 13, color: 'var(--tx3)', fontWeight: 500, fontFamily: 'Inter,sans-serif' }}>Unattached / Available</span>
                )}
              </div>

              {/* Tags */}
              {selectedVol.tags && Object.keys(selectedVol.tags).length > 0 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--tx3)', fontFamily: 'Inter,sans-serif', marginBottom: 8 }}>
                    Labels / Tags
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {Object.entries(selectedVol.tags).map(([k, v]) => (
                      <span key={k} style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, background: 'var(--bg-s2)', border: '1px solid var(--bd)', color: 'var(--tx2)', fontFamily: 'Inter,sans-serif' }}>
                        {k === v ? k : `${k}: ${v}`}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Cloud metadata */}
              {selectedVol.extra && Object.keys(selectedVol.extra).length > 0 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--tx3)', fontFamily: 'Inter,sans-serif', marginBottom: 8 }}>
                    Cloud Metadata
                  </div>
                  {Object.entries(selectedVol.extra)
                    .filter(([, val]) => val !== null && val !== '')
                    .map(([k, val]) => (
                      <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid var(--bd)' }}>
                        <span style={{ fontSize: 12, color: 'var(--tx3)', fontFamily: 'Inter,sans-serif' }}>{k.replace(/_/g, ' ')}</span>
                        <span style={{ fontFamily: 'monospace', fontSize: 11, maxWidth: 180, wordBreak: 'break-all', textAlign: 'right' }}>
                          {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                        </span>
                      </div>
                    ))}
                </div>
              )}

              {/* Last synced */}
              <div style={{ marginTop: 'auto', textAlign: 'center', fontSize: 11, color: 'var(--tx3)', paddingTop: 12, fontFamily: 'Inter,sans-serif' }}>
                Last synced: {fmt(selectedVol.last_synced)}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
