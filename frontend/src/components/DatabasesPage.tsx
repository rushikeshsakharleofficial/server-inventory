import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Search, Database, Map } from 'lucide-react'
import { databasesApi } from '../api'
import { useToast } from '../hooks/useToast'
import ProviderBadge from './ProviderBadge'
import ResourceMapModal from './ResourceMapModal'
import { SkeletonTableRows } from './Skeleton'
import type { DatabaseInstance } from '../types'

const STATUS_CFG: Record<string, { bg: string; text: string; border: string; dot?: 'pulse' | 'solid' }> = {
  running:    { bg: 'var(--sg-bg)',  text: 'var(--sg)',  border: 'var(--sg-bd)',  dot: 'solid'  },
  stopped:    { bg: 'var(--sr-bg)',  text: 'var(--sr)',  border: 'var(--sr-bd)',  dot: 'solid'  },
  pending:    { bg: 'var(--sy-bg)',  text: 'var(--sy)',  border: 'var(--sy-bd)',  dot: 'pulse'  },
  terminated: { bg: 'var(--sgr-bg)', text: 'var(--sgr)', border: 'var(--sgr-bd)' },
  unknown:    { bg: 'var(--sgr-bg)', text: 'var(--sgr)', border: 'var(--sgr-bd)' },
}

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

function EngineChip({ engine }: { engine?: string }) {
  if (!engine) return <span className="text-ink-muted text-xs">—</span>
  const color = ENGINE_COLORS[engine.toLowerCase()] ?? '#8B8AB0'
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight"
      style={{ color, background: color + '18', border: `1px solid ${color}30` }}
    >
      {engine}
    </span>
  )
}

export default function DatabasesPage() {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [provider, setProvider] = useState('')
  const [mapTarget, setMapTarget] = useState<DatabaseInstance | null>(null)

  const { data: databases = [], isLoading } = useQuery({
    queryKey: ['databases', provider],
    queryFn: () => databasesApi.list({ provider: provider || undefined }),
    refetchInterval: 60_000,
  })

  const syncMutation = useMutation({
    mutationFn: () => databasesApi.sync(provider || undefined),
    onSuccess: () => {
      toast.success('Database sync started')
      setTimeout(() => qc.invalidateQueries({ queryKey: ['databases'] }), 4000)
    },
    onError: () => toast.error('Sync failed'),
  })

  const filtered = databases.filter(db =>
    !search ||
    db.name.toLowerCase().includes(search.toLowerCase()) ||
    db.endpoint?.toLowerCase().includes(search.toLowerCase()) ||
    db.engine?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-3xl font-bold text-ink-primary tracking-tight">Databases</h2>
          <p className="text-ink-secondary text-sm mt-1">Managed database instances across all cloud providers.</p>
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

      {/* Table card */}
      <div className="card-dark overflow-hidden">
        {/* Toolbar */}
        <div className="px-6 py-4 border-b border-border flex flex-wrap gap-3 items-center" style={{ background: 'var(--bg-s1)' }}>
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              type="text"
              placeholder="Search name, endpoint, engine…"
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
            <span className="text-accent font-bold">{filtered.length}</span> instance{filtered.length !== 1 ? 's' : ''} found
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="table-dark min-w-[800px]" aria-label="Database instances">
            <thead>
              <tr>
                <th>Name</th>
                <th>Provider</th>
                <th>Engine</th>
                <th>Version</th>
                <th>Status</th>
                <th>Endpoint</th>
                <th className="text-center">Port</th>
                <th className="text-center">Storage</th>
                <th>Type</th>
                <th>Last Synced</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <SkeletonTableRows count={6} />}

              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center py-20">
                    <Database size={32} className="text-ink-muted mx-auto mb-3 opacity-40" />
                    <p className="text-ink-muted text-sm">
                      {databases.length === 0
                        ? 'No databases found. Click "Sync All" to fetch from cloud providers.'
                        : 'No databases match your filters.'}
                    </p>
                  </td>
                </tr>
              )}

              {filtered.map(db => {
                const cfg = STATUS_CFG[db.status] ?? STATUS_CFG.unknown
                return (
                  <tr key={db.id}>
                    <td>
                      <p className="text-sm font-bold text-ink-primary">{db.name}</p>
                      {db.cloud_id && db.cloud_id !== db.name && (
                        <p className="text-[10px] font-mono text-ink-muted mt-0.5">{db.cloud_id}</p>
                      )}
                    </td>
                    <td><ProviderBadge provider={db.provider} showLogo /></td>
                    <td><EngineChip engine={db.engine} /></td>
                    <td><span className="text-xs font-mono text-ink-secondary">{db.engine_version ?? '—'}</span></td>
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
                        {db.status}
                      </span>
                    </td>
                    <td>
                      <span className="text-xs font-mono text-ink-secondary">{db.endpoint ?? '—'}</span>
                    </td>
                    <td className="text-center">
                      <span className="text-xs font-mono text-ink-secondary tabular-nums">{db.port ?? '—'}</span>
                    </td>
                    <td className="text-center">
                      <span className="text-xs font-mono text-ink-secondary tabular-nums">
                        {db.storage_gb != null ? `${db.storage_gb} GB` : '—'}
                      </span>
                    </td>
                    <td>
                      <span className="text-xs font-mono text-ink-muted">{db.instance_type ?? '—'}</span>
                    </td>
                    <td>
                      <span className="text-xs text-ink-muted tabular-nums">{fmt(db.last_synced)}</span>
                    </td>
                    <td>
                      <button
                        onClick={() => setMapTarget(db)}
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
