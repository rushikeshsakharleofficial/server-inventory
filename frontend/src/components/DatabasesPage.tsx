import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Search, Database, Map } from 'lucide-react'
import { databasesApi, getErrorMessage } from '../api'
import { Pagination } from './Pagination'
import { useToast } from '../hooks/useToast'
import ProviderBadge from './ProviderBadge'
import ResourceMapModal from './ResourceMapModal'
import { SkeletonTableRows } from './Skeleton'
import type { DatabaseInstance } from '../types'

const ENGINE_COLORS: Record<string, string> = {
  postgres:   '#336791',
  postgresql: '#336791',
  mysql:      '#4479A1',
  mariadb:    '#003545',
  redis:      '#DC382D',
  mongodb:    '#47A248',
  sqlserver:  '#CC2927',
  aurora:     '#FF9900',
}

function fmt(d?: string) {
  if (!d) return '—'
  return new Date(d).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
}

const cardSt: React.CSSProperties = {
  background: 'var(--bg-base)',
  border: '1px solid var(--bd)',
  borderRadius: 12,
  boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
  overflow: 'hidden',
}

const thSt: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--tx3)',
  padding: '10px 16px',
  background: 'var(--bg-s1)',
  borderBottom: '1px solid var(--bd)',
  textAlign: 'left',
  fontFamily: 'Inter,sans-serif',
  whiteSpace: 'nowrap',
}

const tdSt: React.CSSProperties = {
  padding: '10px 16px',
  borderBottom: '1px solid var(--bd)',
  fontSize: 13,
  color: 'var(--tx1)',
  fontFamily: 'Inter,sans-serif',
  verticalAlign: 'middle',
}

const iconBtnSt: React.CSSProperties = {
  width: 30,
  height: 30,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--bg-s1)',
  border: '1px solid var(--bd)',
  borderRadius: 8,
  cursor: 'pointer',
  flexShrink: 0,
}

function EngineChip({ engine }: { engine?: string }) {
  if (!engine) return <span style={{ color: 'var(--tx3)' }}>—</span>
  const color = ENGINE_COLORS[engine.toLowerCase()] ?? '#8B8AB0'
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 6px',
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.02em',
        color,
        background: color + '12',
        border: `1px solid ${color}30`,
      }}
    >
      {engine}
    </span>
  )
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === 'running' || status === 'active'
      ? '#00B520'
      : status === 'stopped' || status === 'failed'
      ? '#FF4040'
      : status === 'pending'
      ? '#F6821F'
      : 'var(--tx3)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 12, color: 'var(--tx2)', fontFamily: 'Inter,sans-serif' }}>{status}</span>
    </div>
  )
}

export default function DatabasesPage() {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [provider, setProvider] = useState('')
  const [mapTarget, setMapTarget] = useState<DatabaseInstance | null>(null)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 50

  const { data: dbPage, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['databases', provider, page],
    queryFn: () => databasesApi.list({ provider: provider || undefined, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    refetchInterval: 60_000,
  })
  const databases = dbPage?.items ?? []
  const dbTotal   = dbPage?.total ?? 0

  useEffect(() => { setPage(1) }, [provider, search])

  const syncMutation = useMutation({
    mutationFn: () => databasesApi.sync(provider || undefined),
    onSuccess: () => {
      toast.success('Database sync started')
      setTimeout(() => qc.invalidateQueries({ queryKey: ['databases'] }), 4000)
    },
    onError: (error: unknown) => toast.error(`Sync failed: ${getErrorMessage(error)}`),
  })

  const filtered = databases.filter(db =>
    !search ||
    db.name.toLowerCase().includes(search.toLowerCase()) ||
    db.endpoint?.toLowerCase().includes(search.toLowerCase()) ||
    db.engine?.toLowerCase().includes(search.toLowerCase())
  )

  const activeCount = databases.filter(db => db.status === 'running' || db.status === 'active').length
  const engineCount = new Set(databases.map(d => d.engine).filter(Boolean)).size

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--tx1)', letterSpacing: '-0.02em', margin: 0, fontFamily: 'Inter,sans-serif' }}>Databases</h1>
          <p style={{ fontSize: 13, color: 'var(--tx3)', margin: '4px 0 0', fontFamily: 'Inter,sans-serif' }}>Managed database instances across all cloud providers.</p>
        </div>
        <button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          style={{ background: 'var(--ac)', color: 'white', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Inter,sans-serif', opacity: syncMutation.isPending ? 0.7 : 1 }}
        >
          <RefreshCw size={14} className={syncMutation.isPending ? 'animate-spin' : ''} />
          {syncMutation.isPending ? 'Syncing…' : 'Sync All'}
        </button>
      </div>

      {/* ── Stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
        {[
          { label: 'Total Databases',  value: dbTotal,      accent: 'var(--ac)'            },
          { label: 'Active Instances', value: activeCount,  accent: 'var(--sg, #00B520)'   },
          { label: 'Engine Types',     value: engineCount,  accent: 'var(--sy, #F6821F)'   },
        ].map(({ label, value, accent }) => (
          <div key={label} style={{ ...cardSt, padding: 0, position: 'relative' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accent, borderRadius: '12px 12px 0 0' }} />
            <div style={{ padding: '16px 20px 14px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--tx3)', fontFamily: 'Inter,sans-serif', marginBottom: 10 }}>{label}</div>
              {isLoading
                ? <div className="skeleton" style={{ width: 60, height: 28, borderRadius: 6 }} />
                : <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--tx1)', letterSpacing: '-0.02em', fontFamily: 'Inter,sans-serif', lineHeight: 1 }}>{value.toLocaleString()}</div>
              }
            </div>
          </div>
        ))}
      </div>

      {/* ── Main table card ── */}
      <div style={{ ...cardSt, padding: 0 }}>

        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '16px 24px', borderBottom: '1px solid var(--bd)', background: 'var(--bg-s1)' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx3)', pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder="Search name, endpoint, engine…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-base)', border: '1px solid var(--bd)', borderRadius: 8, height: 36, padding: '0 12px 0 36px', fontSize: 13, color: 'var(--tx1)', outline: 'none', fontFamily: 'Inter,sans-serif' }}
            />
          </div>
          <select
            value={provider}
            onChange={e => { setProvider(e.target.value); setSearch('') }}
            style={{ height: 36, padding: '0 12px', background: 'var(--bg-base)', border: '1px solid var(--bd)', borderRadius: 8, fontSize: 13, color: 'var(--tx1)', outline: 'none', cursor: 'pointer', fontFamily: 'Inter,sans-serif', minWidth: 160 }}
          >
            <option value="">All Providers</option>
            {['aws', 'gcp', 'azure', 'linode', 'digitalocean', 'hivelocity'].map(p => (
              <option key={p} value={p}>{p.toUpperCase()}</option>
            ))}
          </select>
          <span style={{ fontSize: 12, color: 'var(--tx3)', fontFamily: 'monospace', marginLeft: 'auto' }}>
            <span style={{ color: 'var(--ac)', fontWeight: 700 }}>{filtered.length}</span>{' '}
            instance{filtered.length !== 1 ? 's' : ''} found
          </span>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thSt}>Name</th>
                <th style={thSt}>Provider</th>
                <th style={thSt}>Engine</th>
                <th style={thSt}>Version</th>
                <th style={thSt}>Status</th>
                <th style={thSt}>Endpoint</th>
                <th style={{ ...thSt, textAlign: 'center' }}>Port</th>
                <th style={{ ...thSt, textAlign: 'center' }}>Storage</th>
                <th style={thSt}>Type</th>
                <th style={thSt}>Last Synced</th>
                <th style={{ ...thSt, width: 48 }}></th>
              </tr>
            </thead>
            <tbody>
              {isError && (
                <tr>
                  <td colSpan={11} style={{ padding: '64px 24px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, maxWidth: 400, margin: '0 auto' }}>
                      <span style={{ fontSize: 24 }}>⚠️</span>
                      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--tx1)', fontFamily: 'Inter,sans-serif' }}>Failed to fetch databases</div>
                      <div style={{ fontSize: 13, color: 'var(--tx3)', fontFamily: 'Inter,sans-serif' }}>
                        Check backend connectivity or cloud credentials.{' '}
                        {error instanceof Error ? error.message : 'Offline'}
                      </div>
                      <button
                        onClick={() => refetch()}
                        style={{ background: 'transparent', border: '1px solid var(--bd)', borderRadius: 8, color: 'var(--tx2)', padding: '8px 16px', fontSize: 14, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}
                      >
                        Retry Query
                      </button>
                    </div>
                  </td>
                </tr>
              )}

              {isLoading && !isError && <SkeletonTableRows count={6} />}

              {!isLoading && !isError && filtered.length === 0 && (
                <tr>
                  <td colSpan={11} style={{ padding: '80px 24px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                      <Database size={32} style={{ color: 'var(--tx3)', opacity: 0.4 }} />
                      <span style={{ fontSize: 14, color: 'var(--tx3)', fontFamily: 'Inter,sans-serif' }}>
                        {dbTotal === 0
                          ? 'No databases found. Click "Sync All" to fetch from cloud providers.'
                          : 'No databases match your filters.'}
                      </span>
                    </div>
                  </td>
                </tr>
              )}

              {filtered.map(db => (
                <tr
                  key={db.id}
                  style={{ borderBottom: '1px solid var(--bd)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg-s1)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = '' }}
                >
                  <td style={tdSt}>
                    <div style={{ fontWeight: 700 }}>{db.name}</div>
                    {db.cloud_id && db.cloud_id !== db.name && (
                      <div style={{ fontSize: 11, color: 'var(--tx3)', fontFamily: 'monospace', marginTop: 2 }}>{db.cloud_id}</div>
                    )}
                  </td>
                  <td style={tdSt}><ProviderBadge provider={db.provider} showLogo /></td>
                  <td style={tdSt}><EngineChip engine={db.engine} /></td>
                  <td style={tdSt}><span style={{ fontFamily: 'monospace', fontSize: 12 }}>{db.engine_version ?? '—'}</span></td>
                  <td style={tdSt}><StatusDot status={db.status} /></td>
                  <td style={tdSt}><span style={{ fontFamily: 'monospace', fontSize: 12 }}>{db.endpoint ?? '—'}</span></td>
                  <td style={{ ...tdSt, textAlign: 'center' }}><span style={{ fontFamily: 'monospace', fontSize: 12 }}>{db.port ?? '—'}</span></td>
                  <td style={{ ...tdSt, textAlign: 'center' }}><span style={{ fontFamily: 'monospace', fontSize: 12 }}>{db.storage_gb != null ? `${db.storage_gb} GB` : '—'}</span></td>
                  <td style={tdSt}><span style={{ fontSize: 12, color: 'var(--tx3)', fontFamily: 'monospace' }}>{db.instance_type ?? '—'}</span></td>
                  <td style={tdSt}><span style={{ fontSize: 12, color: 'var(--tx3)', fontFamily: 'monospace' }}>{fmt(db.last_synced)}</span></td>
                  <td style={{ ...tdSt, textAlign: 'center' }}>
                    <button
                      onClick={() => setMapTarget(db)}
                      style={iconBtnSt}
                      title="Resource Map"
                    >
                      <Map size={14} style={{ color: 'var(--tx3)' }} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pagination page={page} total={dbTotal} pageSize={PAGE_SIZE} onPage={setPage} />
      </div>

      {mapTarget && (
        <ResourceMapModal
          resourceId={mapTarget.id}
          resourceType="database"
          resourceName={mapTarget.name}
          provider={mapTarget.provider}
          region={mapTarget.region}
          onClose={() => setMapTarget(null)}
        />
      )}
    </div>
  )
}
