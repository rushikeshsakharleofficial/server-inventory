import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Search, Box, Cpu, Map } from 'lucide-react'
import { kubernetesApi } from '../api'
import { useToast } from '../hooks/useToast'
import ProviderBadge from './ProviderBadge'
import ResourceMapModal from './ResourceMapModal'
import { SkeletonTableRows } from './Skeleton'
import type { KubernetesCluster } from '../types'

const STATUS_CFG: Record<string, { bg: string; text: string; border: string; dot?: 'pulse' | 'solid' }> = {
  running:    { bg: 'var(--sg-bg)',  text: 'var(--sg)',  border: 'var(--sg-bd)',  dot: 'solid'  },
  stopped:    { bg: 'var(--sr-bg)',  text: 'var(--sr)',  border: 'var(--sr-bd)',  dot: 'solid'  },
  pending:    { bg: 'var(--sy-bg)',  text: 'var(--sy)',  border: 'var(--sy-bd)',  dot: 'pulse'  },
  terminated: { bg: 'var(--sgr-bg)', text: 'var(--sgr)', border: 'var(--sgr-bd)' },
  unknown:    { bg: 'var(--sgr-bg)', text: 'var(--sgr)', border: 'var(--sgr-bd)' },
}

function fmt(d?: string) {
  if (!d) return '—'
  return new Date(d).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
}

export default function KubernetesPage() {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [provider, setProvider] = useState('')
  const [mapTarget, setMapTarget] = useState<KubernetesCluster | null>(null)

  const { data: clusters = [], isLoading } = useQuery({
    queryKey: ['kubernetes', provider],
    queryFn: () => kubernetesApi.list({ provider: provider || undefined }),
    refetchInterval: 60_000,
  })

  const syncMutation = useMutation({
    mutationFn: () => kubernetesApi.sync(provider || undefined),
    onSuccess: () => {
      toast.success('Kubernetes sync started')
      setTimeout(() => qc.invalidateQueries({ queryKey: ['kubernetes'] }), 4000)
    },
    onError: () => toast.error('Sync failed'),
  })

  const filtered = clusters.filter(c =>
    !search ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.region?.toLowerCase().includes(search.toLowerCase()) ||
    c.version?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-3xl font-bold text-ink-primary tracking-tight">Kubernetes</h2>
          <p className="text-ink-secondary text-sm mt-1">Managed cluster fleet across EKS, GKE, AKS, DOKS and LKE.</p>
        </div>
        <button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="btn-primary"
        >
          <RefreshCw size={14} className={syncMutation.isPending ? 'animate-spin' : ''} />
          Sync All
        </button>
      </div>

      {/* Stats mini row */}
      {!isLoading && clusters.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Clusters', value: clusters.length },
            { label: 'Running',  value: clusters.filter(c => c.status === 'running').length,  color: 'var(--sg)' },
            { label: 'Pending',  value: clusters.filter(c => c.status === 'pending').length,  color: 'var(--sy)' },
            { label: 'Total Nodes', value: clusters.reduce((s, c) => s + (c.node_count ?? 0), 0) },
          ].map(stat => (
            <div key={stat.label} className="card-dark p-4">
              <p className="text-[11px] font-bold uppercase tracking-widest text-ink-muted">{stat.label}</p>
              <p
                className="font-display text-3xl font-extrabold tabular-nums mt-2"
                style={{ color: stat.color ?? 'var(--tx1)' }}
              >
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Table card */}
      <div className="card-dark overflow-hidden">
        {/* Toolbar */}
        <div className="px-6 py-4 border-b border-border flex flex-wrap gap-3 items-center" style={{ background: 'var(--bg-s1)' }}>
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              type="text"
              placeholder="Search cluster name, region…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-dark pl-9"
            />
          </div>

          <select
            value={provider}
            onChange={e => { setProvider(e.target.value); setSearch('') }}
            className="bg-surface-2 border border-border text-ink-secondary text-sm rounded-lg px-3 py-2
                       focus:outline-none focus:ring-1 focus:ring-accent appearance-none pr-8"
          >
            <option value="">All Providers</option>
            {['aws','gcp','azure','linode','digitalocean'].map(p => (
              <option key={p} value={p}>{p.toUpperCase()}</option>
            ))}
          </select>

          <span className="ml-auto text-xs text-ink-muted font-mono">
            <span className="text-accent font-bold">{filtered.length}</span> cluster{filtered.length !== 1 ? 's' : ''} found
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="table-dark min-w-[700px]" aria-label="Kubernetes clusters">
            <thead>
              <tr>
                <th>Cluster Name</th>
                <th>Provider</th>
                <th>Region</th>
                <th>K8s Version</th>
                <th>Status</th>
                <th className="text-center">Nodes</th>
                <th>Endpoint</th>
                <th>Last Synced</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <SkeletonTableRows count={5} />}

              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-20">
                    <Box size={32} className="text-ink-muted mx-auto mb-3 opacity-40" />
                    <p className="text-ink-muted text-sm">
                      {clusters.length === 0
                        ? 'No clusters found. Click "Sync All" to fetch from cloud providers.'
                        : 'No clusters match your filters.'}
                    </p>
                  </td>
                </tr>
              )}

              {filtered.map(cluster => {
                const cfg = STATUS_CFG[cluster.status] ?? STATUS_CFG.unknown
                return (
                  <tr key={cluster.id}>
                    <td>
                      <p className="text-sm font-bold text-ink-primary">{cluster.name}</p>
                      {cluster.cloud_id && cluster.cloud_id !== cluster.name && (
                        <p className="text-[10px] font-mono text-ink-muted mt-0.5 truncate max-w-[220px]">
                          {cluster.cloud_id}
                        </p>
                      )}
                    </td>
                    <td><ProviderBadge provider={cluster.provider} showLogo /></td>
                    <td><span className="text-sm text-ink-secondary">{cluster.region ?? '—'}</span></td>
                    <td>
                      <span className="text-xs font-mono text-ink-secondary">
                        {cluster.version ? `v${cluster.version}` : '—'}
                      </span>
                    </td>
                    <td>
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight w-fit"
                        style={{ color: cfg.text, background: cfg.bg, border: `1px solid ${cfg.border}` }}
                      >
                        {cfg.dot && (
                          <span
                            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot === 'pulse' ? 'animate-pulse' : ''}`}
                            style={{ background: cfg.text }}
                          />
                        )}
                        {cluster.status}
                      </span>
                    </td>
                    <td className="text-center">
                      <div className="inline-flex items-center gap-1 text-sm font-mono text-ink-secondary tabular-nums">
                        <Cpu size={12} className="text-ink-muted" />
                        {cluster.node_count ?? '—'}
                      </div>
                    </td>
                    <td>
                      <span className="text-xs font-mono text-ink-muted truncate max-w-[180px] block">
                        {cluster.endpoint ?? '—'}
                      </span>
                    </td>
                    <td>
                      <span className="text-xs text-ink-muted tabular-nums">{fmt(cluster.last_synced)}</span>
                    </td>
                    <td>
                      <button
                        onClick={() => setMapTarget(cluster)}
                        className="p-1.5 text-ink-dim hover:text-accent rounded-lg transition-colors hover:bg-surface-3"
                        aria-label="Resource map"
                        title="Resource Map"
                      >
                        <Map size={14} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
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
