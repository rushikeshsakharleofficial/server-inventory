import { useQuery } from '@tanstack/react-query'
import { serversApi } from '../api'
import { SkeletonCard } from './Skeleton'

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
  digitalocean: 'DO',
  ovh:          'OVH',
  custom_dc:    'Custom',
}

function DonutSVG({ data }: { data: Array<{ value: number; color: string }> }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) return <circle cx="18" cy="18" r="16" fill="none" stroke="#1A1A28" strokeWidth="4" />

  let offset = 0
  const circumference = 2 * Math.PI * 16
  return (
    <>
      <circle cx="18" cy="18" r="16" fill="none" stroke="#1A1A28" strokeWidth="4" />
      {data.filter(d => d.value > 0).map((d, i) => {
        const pct = d.value / total
        const dash = pct * circumference
        const el = (
          <circle
            key={i}
            cx="18" cy="18" r="16"
            fill="none"
            stroke={d.color}
            strokeWidth="4"
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={-offset}
          />
        )
        offset += dash
        return el
      })}
    </>
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
    .map(([p, v]) => ({ key: p, label: PROVIDER_LABELS[p] ?? p, value: v, color: PROVIDER_COLORS[p] ?? '#4B4B72' }))
    .sort((a, b) => b.value - a.value)

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
      {/* Total */}
      <div className="card-dark p-6">
        <div className="flex justify-between items-start mb-4">
          <span className="text-[11px] font-bold uppercase tracking-widest text-ink-muted">Total Servers</span>
          <svg className="w-4 h-4 text-ink-muted opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M5 6h14M5 18h14" />
          </svg>
        </div>
        <p className="font-display text-4xl font-extrabold text-ink-primary tabular-nums leading-none">{total}</p>
        <p className="mt-2 text-[10px] font-mono text-ink-muted">
          {Object.keys(stats?.by_provider ?? {}).length} provider{Object.keys(stats?.by_provider ?? {}).length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Running */}
      <div className="card-dark p-6">
        <div className="flex justify-between items-start mb-4">
          <span className="text-[11px] font-bold uppercase tracking-widest text-ink-muted">Running</span>
          <span className="status-dot-running flex-shrink-0" aria-hidden="true" />
        </div>
        <p className="font-display text-4xl font-extrabold tabular-nums leading-none" style={{ color: 'var(--sg)' }}>{running}</p>
        <p className="mt-2 text-[10px] font-mono" style={{ color: 'var(--sg)' }}>
          {runPct}% of fleet healthy
        </p>
      </div>

      {/* Stopped */}
      <div className="card-dark p-6">
        <div className="flex justify-between items-start mb-4">
          <span className="text-[11px] font-bold uppercase tracking-widest text-ink-muted">Stopped</span>
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--sr)' }} aria-hidden="true" />
        </div>
        <p className="font-display text-4xl font-extrabold tabular-nums leading-none" style={{ color: 'var(--sr)' }}>{stopped}</p>
        <p className="mt-2 text-[10px] font-mono" style={{ color: 'var(--sr)' }}>
          {total > 0 ? `${100 - runPct}% idle` : 'No servers'}
        </p>
      </div>

      {/* Provider Distribution */}
      <div className="card-dark p-6">
        <div className="flex items-start justify-between mb-3">
          <span className="text-[11px] font-bold uppercase tracking-widest text-ink-muted">Providers</span>
          <span className="text-[10px] font-mono text-ink-muted">Live</span>
        </div>
        {providerData.length === 0 ? (
          <p className="text-xs text-ink-muted mt-4">No providers yet</p>
        ) : (
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16 flex-shrink-0">
              <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
                <DonutSVG data={providerData} />
              </svg>
            </div>
            <div className="flex-1 space-y-1.5 min-w-0">
              {providerData.slice(0, 4).map(d => (
                <div key={d.key} className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="text-[10px] text-ink-primary font-mono truncate">{d.label}</span>
                  </div>
                  <span className="text-[10px] font-mono text-ink-secondary tabular-nums">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
