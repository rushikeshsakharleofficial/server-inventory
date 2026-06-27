import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Search, Box, Cpu, Map } from 'lucide-react'
import { kubernetesApi, getErrorMessage } from '../api'
import { Pagination } from './Pagination'
import { useToast } from '../hooks/useToast'
import ProviderBadge from './ProviderBadge'
import ResourceMapModal from './ResourceMapModal'
import { SkeletonTableRows } from './Skeleton'
import type { KubernetesCluster } from '../types'

const STATUS_COLOR: Record<string, string> = {
  running:    '#00B520',
  active:     '#00B520',
  stopped:    '#FF4040',
  failed:     '#FF4040',
  error:      '#FF4040',
  pending:    'var(--sy)',
  terminated: 'var(--tx3)',
  unknown:    'var(--tx3)',
}

function fmt(d?: string) {
  if (!d) return '—'
  return new Date(d).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
}

const cardSt: React.CSSProperties = {
  background: 'var(--bg-base)',
  border: '1px solid var(--bd)',
  borderRadius: '12px',
  boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
}

const iconBtnSt = (danger = false): React.CSSProperties => ({
  width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: danger ? 'rgba(255,64,64,0.07)' : 'var(--bg-s1)',
  border: `1px solid ${danger ? 'rgba(255,64,64,0.25)' : 'var(--bd)'}`,
  borderRadius: '8px', cursor: 'pointer', flexShrink: 0,
})

const TH_COLS = ['Cluster Name', 'Provider', 'Region', 'K8s Version', 'Status', 'Nodes', 'Endpoint', 'Last Synced', '']

export default function KubernetesPage() {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [provider, setProvider] = useState('')
  const [mapTarget, setMapTarget] = useState<KubernetesCluster | null>(null)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 50

  const { data: k8sPage, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['kubernetes', provider, page],
    queryFn: () => kubernetesApi.list({ provider: provider || undefined, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    refetchInterval: 60_000,
  })
  const clusters = k8sPage?.items ?? []
  const k8sTotal = k8sPage?.total ?? 0

  useEffect(() => { setPage(1) }, [provider, search])

  const syncMutation = useMutation({
    mutationFn: () => kubernetesApi.sync(provider || undefined),
    onSuccess: () => {
      toast.success('Kubernetes sync started')
      setTimeout(() => qc.invalidateQueries({ queryKey: ['kubernetes'] }), 4000)
    },
    onError: (error: unknown) => toast.error(`Sync failed: ${getErrorMessage(error)}`),
  })

  const filtered = clusters.filter(c =>
    !search ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.region?.toLowerCase().includes(search.toLowerCase()) ||
    c.version?.toLowerCase().includes(search.toLowerCase())
  )

  const runningCount = clusters.filter(c => c.status === 'running' || c.status === 'active').length
  const totalNodes   = clusters.reduce((s, c) => s + (c.node_count ?? 0), 0)

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--tx1)', letterSpacing: '-0.02em', margin: 0, fontFamily: 'Inter,sans-serif' }}>Kubernetes</h1>
          <p style={{ fontSize: '13px', color: 'var(--tx3)', margin: '4px 0 0', fontFamily: 'Inter,sans-serif' }}>Managed cluster fleet across EKS, GKE, AKS, DOKS and LKE.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 16px', background: 'transparent', border: '1px solid var(--bd)', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', color: 'var(--tx2)', fontFamily: 'Inter,sans-serif', fontWeight: 500 }}
          >
            <RefreshCw size={14} className={syncMutation.isPending ? 'animate-spin' : ''} />
            Sync All
          </button>
          <button
            type="button"
            disabled
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'var(--ac)', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, color: '#fff', fontFamily: 'Inter,sans-serif', cursor: 'not-allowed', opacity: 0.55 }}
          >
            Add Cluster
          </button>
        </div>
      </div>

      {/* Stats row */}
      {!isLoading && k8sTotal > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '16px' }}>
          {[
            { label: 'Total Clusters', value: k8sTotal,     top: 'var(--ac)' },
            { label: 'Running',        value: runningCount, top: 'var(--sg)' },
            { label: 'Total Nodes',    value: totalNodes,   top: 'var(--sy)' },
          ].map(({ label, value, top }) => (
            <div key={label} style={{ ...cardSt, position: 'relative', padding: '0' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: top, borderRadius: '12px 12px 0 0' }} />
              <div style={{ padding: '18px 20px 16px' }}>
                <div style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--tx3)', fontFamily: 'Inter,sans-serif', marginBottom: '10px' }}>{label}</div>
                <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--tx1)', letterSpacing: '-0.02em', fontFamily: 'Inter,sans-serif', lineHeight: 1 }}>{value}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Main table card */}
      <div style={{ ...cardSt, overflow: 'hidden' }}>

        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 20px', borderBottom: '1px solid var(--bd)', background: 'var(--bg-s1)', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
            <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--tx3)', pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder="Search cluster name, region…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', paddingLeft: '36px', paddingRight: '12px', height: '36px', background: 'var(--bg-base)', border: '1px solid var(--bd)', borderRadius: '8px', fontSize: '13px', color: 'var(--tx1)', outline: 'none', fontFamily: 'Inter,sans-serif' }}
            />
          </div>
          <select
            value={provider}
            onChange={e => { setProvider(e.target.value); setSearch('') }}
            style={{ height: '36px', padding: '0 10px', background: 'var(--bg-base)', border: '1px solid var(--bd)', borderRadius: '8px', fontSize: '13px', color: 'var(--tx2)', fontFamily: 'Inter,sans-serif', outline: 'none', cursor: 'pointer', minWidth: '160px' }}
          >
            <option value="">All Providers</option>
            {['aws', 'gcp', 'azure', 'linode', 'digitalocean', 'hivelocity'].map(p => (
              <option key={p} value={p}>{p.toUpperCase()}</option>
            ))}
          </select>
          <span style={{ fontSize: '12px', color: 'var(--tx3)', fontFamily: 'monospace', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
            <span style={{ color: 'var(--ac)', fontWeight: 700 }}>{filtered.length}</span> cluster{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }} aria-label="Kubernetes clusters">
            <thead>
              <tr>
                {TH_COLS.map((h, i) => (
                  <th key={i} style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--tx3)', padding: '10px 16px', background: 'var(--bg-s1)', borderBottom: '1px solid var(--bd)', textAlign: h === 'Nodes' ? 'center' : 'left', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>

              {isError && (
                <tr>
                  <td colSpan={9} style={{ padding: '64px 24px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', maxWidth: '400px', margin: '0 auto' }}>
                      <span style={{ fontSize: '24px' }}>⚠️</span>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--tx1)', fontFamily: 'Inter,sans-serif' }}>Failed to fetch clusters</span>
                      <span style={{ fontSize: '12px', color: 'var(--tx3)', fontFamily: 'Inter,sans-serif' }}>Check backend connectivity or cloud credentials. {error instanceof Error ? error.message : 'Offline'}</span>
                      <button type="button" onClick={() => refetch()} style={{ padding: '7px 14px', background: 'var(--bg-s1)', border: '1px solid var(--bd)', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--tx2)', fontFamily: 'Inter,sans-serif' }}>Retry</button>
                    </div>
                  </td>
                </tr>
              )}

              {isLoading && !isError && <SkeletonTableRows count={5} />}

              {!isLoading && !isError && filtered.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ padding: '80px 24px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                      <Box size={32} style={{ color: 'var(--tx3)', opacity: 0.4 }} />
                      <span style={{ fontSize: '13px', color: 'var(--tx3)', fontFamily: 'Inter,sans-serif' }}>
                        {k8sTotal === 0 ? 'No clusters found. Click "Sync All" to fetch from cloud providers.' : 'No clusters match your filters.'}
                      </span>
                    </div>
                  </td>
                </tr>
              )}

              {filtered.map(cluster => {
                const dotColor = STATUS_COLOR[cluster.status] ?? 'var(--tx3)'
                return (
                  <tr
                    key={cluster.id}
                    style={{ borderBottom: '1px solid var(--bd)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg-s1)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = '' }}
                  >
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--tx1)', fontFamily: 'Inter,sans-serif' }}>{cluster.name}</div>
                      {cluster.cloud_id && cluster.cloud_id !== cluster.name && (
                        <div style={{ fontSize: '11px', color: 'var(--tx3)', fontFamily: 'monospace', marginTop: '2px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '220px' }}>{cluster.cloud_id}</div>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <ProviderBadge provider={cluster.provider} showLogo />
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: '13px', color: 'var(--tx1)', fontFamily: 'Inter,sans-serif' }}>{cluster.region ?? '—'}</span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--tx2)' }}>{cluster.version ? `v${cluster.version}` : '—'}</span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                        <span style={{ fontSize: '12px', color: 'var(--tx2)', textTransform: 'capitalize', fontFamily: 'Inter,sans-serif' }}>{cluster.status}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      {cluster.node_count != null ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', background: 'var(--bg-s1)', border: '1px solid var(--bd)', borderRadius: '999px', fontSize: '11px', fontFamily: 'monospace', color: 'var(--tx2)' }}>
                          <Cpu size={10} style={{ color: 'var(--tx3)' }} />
                          {cluster.node_count}
                        </span>
                      ) : <span style={{ color: 'var(--tx3)' }}>—</span>}
                    </td>
                    <td style={{ padding: '12px 16px', maxWidth: '180px' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--tx3)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', display: 'block' }}>{cluster.endpoint ?? '—'}</span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--tx3)', fontFamily: 'monospace' }}>{fmt(cluster.last_synced)}</span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <button
                        type="button"
                        onClick={() => setMapTarget(cluster)}
                        style={iconBtnSt()}
                        title="Resource Map"
                      >
                        <Map size={14} style={{ color: 'var(--tx2)' }} />
                      </button>
                    </td>
                  </tr>
                )
              })}

            </tbody>
          </table>
        </div>

        <Pagination page={page} total={k8sTotal} pageSize={PAGE_SIZE} onPage={setPage} />
      </div>

      {mapTarget && (
        <ResourceMapModal
          resourceId={mapTarget.id}
          resourceType="kubernetes"
          resourceName={mapTarget.name}
          provider={mapTarget.provider}
          region={mapTarget.region}
          onClose={() => setMapTarget(null)}
        />
      )}
    </div>
  )
}
