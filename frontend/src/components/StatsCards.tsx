import { useQuery } from '@tanstack/react-query'
import { Server, Activity, Power } from 'lucide-react'
import { serversApi } from '../api'
import { SkeletonCard } from './Skeleton'
import ProviderLogo from './ProviderLogo'

const PROVIDER_COLORS: Record<string, string> = {
  aws:          '#FF9900',
  gcp:          '#4285F4',
  azure:        '#0078D4',
  linode:       '#02B159',
  digitalocean: '#0080FF',
  ovh:          '#123F6D',
  custom_dc:    '#8B5CF6',
}

const PROVIDER_LABELS: Record<string, string> = {
  aws:          'AWS',
  gcp:          'GCP',
  azure:        'Azure',
  linode:       'Linode',
  digitalocean: 'DigitalOcean',
  ovh:          'OVH Cloud',
  custom_dc:    'Custom DC',
}

function DonutChart({
  data,
}: {
  data: Array<{ label: string; value: number; color: string }>
}) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) {
    return (
      <div
        className="w-24 h-24 rounded-full flex-shrink-0 flex items-center justify-center text-xs text-ink-muted"
        style={{ background: 'var(--bg-s2)' }}
        role="img"
        aria-label="No provider data"
      >
        —
      </div>
    )
  }

  let acc = 0
  const segments = data
    .filter(d => d.value > 0)
    .map(d => {
      const pct = (d.value / total) * 100
      const seg = { ...d, from: acc, to: acc + pct }
      acc += pct
      return seg
    })

  const gradient = segments
    .map(s => `${s.color} ${s.from.toFixed(2)}% ${s.to.toFixed(2)}%`)
    .join(', ')

  return (
    <div
      className="w-24 h-24 rounded-full relative flex-shrink-0"
      style={{ background: `conic-gradient(${gradient})` }}
      role="img"
      aria-label="Provider distribution chart"
    >
      <div
        className="absolute rounded-full"
        style={{ inset: '28%', background: 'var(--bg-s1)' }}
      />
    </div>
  )
}

export default function StatsCards() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: serversApi.stats,
    refetchInterval: 60_000,
  })

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map(i => <SkeletonCard key={i} />)}
      </div>
    )
  }

  const total   = stats?.total   ?? 0
  const running = stats?.running ?? 0
  const stopped = stats?.stopped ?? 0
  const runPct  = total > 0 ? Math.round((running / total) * 100) : 0

  const providerData = Object.entries(stats?.by_provider ?? {})
    .map(([p, v]) => ({
      label: PROVIDER_LABELS[p] ?? p,
      key:   p,
      value: v,
      color: PROVIDER_COLORS[p] ?? '#4B4B72',
    }))
    .sort((a, b) => b.value - a.value)

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
      {/* Total */}
      <div className="card-dark p-5 flex items-center gap-4">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--ac-bg)', border: '1px solid var(--ac-bd)' }}
        >
          <Server size={19} className="text-accent" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] text-ink-muted font-medium uppercase tracking-widest">
            Total Servers
          </p>
          <p className="text-2xl font-bold text-ink-primary tabular-nums mt-0.5">{total}</p>
          <p className="text-xs text-ink-muted mt-0.5">
            {Object.keys(stats?.by_provider ?? {}).length} provider
            {Object.keys(stats?.by_provider ?? {}).length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Running */}
      <div className="card-dark p-5 flex items-center gap-4">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--sg-bg)', border: '1px solid var(--sg-bd)' }}
        >
          <Activity size={19} className="text-status-green" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] text-ink-muted font-medium uppercase tracking-widest">
            Running
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-2xl font-bold text-ink-primary tabular-nums">{running}</p>
            <span className="status-dot-running" aria-hidden="true" />
          </div>
          <p className="text-xs text-ink-muted mt-0.5">{runPct}% of fleet</p>
        </div>
      </div>

      {/* Stopped */}
      <div className="card-dark p-5 flex items-center gap-4">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--sr-bg)', border: '1px solid var(--sr-bd)' }}
        >
          <Power size={19} className="text-status-red" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] text-ink-muted font-medium uppercase tracking-widest">
            Stopped
          </p>
          <p className="text-2xl font-bold text-ink-primary tabular-nums mt-0.5">{stopped}</p>
          <p className="text-xs text-ink-muted mt-0.5">
            {total > 0 ? `${100 - runPct}% idle` : 'No servers'}
          </p>
        </div>
      </div>

      {/* Provider Distribution */}
      <div className="card-dark p-5 flex items-center gap-4 col-span-1">
        <DonutChart data={providerData} />
        <div className="flex-1 min-w-0 space-y-1.5">
          <p className="text-[11px] text-ink-muted font-medium uppercase tracking-widest">
            By Provider
          </p>
          {providerData.length === 0 ? (
            <p className="text-xs text-ink-muted">No providers yet</p>
          ) : (
            providerData.slice(0, 5).map(d => (
              <div key={d.key} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: d.color }}
                    aria-hidden="true"
                  />
                  <span className="text-xs text-ink-secondary truncate">{d.label}</span>
                </div>
                <span className="text-xs font-mono text-ink-primary font-medium tabular-nums">
                  {d.value}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
