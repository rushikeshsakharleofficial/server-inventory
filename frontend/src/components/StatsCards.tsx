import { useQuery } from '@tanstack/react-query'
import { serversApi } from '../api'
import { SkeletonCard } from './Skeleton'
import { Grid, Card } from './StitchUI'

const PROVIDER_COLORS: Record<string, string> = {
  aws:          '#FF9900',
  gcp:          '#4285F4',
  azure:        '#0078D4',
  linode:       '#02B159',
  digitalocean: '#0080FF',
  ovh:          '#123F6D',
  hivelocity:   '#E84545',
  custom_dc:    '#8B5CF6',
}

const PROVIDER_LABELS: Record<string, string> = {
  aws:          'AWS',
  gcp:          'GCP',
  azure:        'Azure',
  linode:       'Linode',
  digitalocean: 'DO',
  ovh:          'OVH',
  hivelocity:   'Hivelocity',
  custom_dc:    'Custom',
}


export default function StatsCards() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: serversApi.stats,
    refetchInterval: 60_000,
  })

  if (isLoading) {
    return (
      <Grid columns={{ '@initial': 2, '@xl': 4 }} gap={4}>
        {[0, 1, 2, 3].map(i => <SkeletonCard key={i} />)}
      </Grid>
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
    <Grid columns={{ '@initial': 2, '@xl': 4 }} gap={4}>
      {/* Total Servers */}
      <Card hoverable style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, right: 0, width: '64px', height: '64px', background: 'rgba(200,136,58,0.05)', transform: 'rotate(45deg)', transformOrigin: 'top right', transition: 'background 200ms' }} />
        <p style={{ fontSize: '9px', fontFamily: "'JetBrains Mono', monospace", color: 'var(--tx3)', letterSpacing: '0.15em', textTransform: 'uppercase', margin: '0 0 8px 0' }}>Total Assets</p>
        <p style={{ fontSize: '36px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 400, color: 'var(--tx1)', lineHeight: 1, margin: '0 0 12px 0' }}>{total}</p>
        <p style={{ fontSize: '9px', fontFamily: "'JetBrains Mono', monospace", color: 'var(--tx3)', letterSpacing: '0.1em' }}>
          {Object.keys(stats?.by_provider ?? {}).length} ACTIVE PROVIDER{Object.keys(stats?.by_provider ?? {}).length !== 1 ? 'S' : ''}
        </p>
      </Card>

      {/* Running */}
      <Card hoverable style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '12px', right: '12px', display: 'flex', gap: '3px' }}>
          {[0,1,2].map(i => <span key={i} style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--sg)' }} />)}
        </div>
        <p style={{ fontSize: '9px', fontFamily: "'JetBrains Mono', monospace", color: 'var(--tx3)', letterSpacing: '0.15em', textTransform: 'uppercase', margin: '0 0 8px 0' }}>Operational</p>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', marginBottom: '12px' }}>
          <p style={{ fontSize: '36px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 400, color: 'var(--sg)', lineHeight: 1, margin: 0 }}>{running}</p>
          <span style={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", color: 'var(--tx3)', marginBottom: '4px' }}>/ {runPct}%</span>
        </div>
        <div style={{ height: '2px', background: 'var(--bd)', width: '100%' }}>
          <div style={{ height: '100%', background: 'var(--sg)', width: `${runPct}%`, transition: 'width 500ms ease' }} />
        </div>
      </Card>

      {/* Stopped */}
      <Card hoverable>
        <p style={{ fontSize: '9px', fontFamily: "'JetBrains Mono', monospace", color: 'var(--tx3)', letterSpacing: '0.15em', textTransform: 'uppercase', margin: '0 0 8px 0' }}>Offline</p>
        <p style={{ fontSize: '36px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 400, color: 'var(--sr)', lineHeight: 1, margin: '0 0 12px 0' }}>{stopped}</p>
        {stopped > 0 && (
          <p style={{ fontSize: '9px', fontFamily: "'JetBrains Mono', monospace", color: 'var(--sr)', letterSpacing: '0.1em', opacity: 0.8 }}>⚠ ATTENTION REQUIRED</p>
        )}
        {stopped === 0 && (
          <p style={{ fontSize: '9px', fontFamily: "'JetBrains Mono', monospace", color: 'var(--tx3)', letterSpacing: '0.1em' }}>ALL NODES NOMINAL</p>
        )}
      </Card>

      {/* Provider Distribution */}
      <Card hoverable>
        <p style={{ fontSize: '9px', fontFamily: "'JetBrains Mono', monospace", color: 'var(--tx3)', letterSpacing: '0.15em', textTransform: 'uppercase', margin: '0 0 8px 0' }}>Active Providers</p>
        <p style={{ fontSize: '36px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 400, color: 'var(--tx1)', lineHeight: 1, margin: '0 0 12px 0' }}>{Object.keys(stats?.by_provider ?? {}).length}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {providerData.slice(0, 4).map(d => (
            <span key={d.key} style={{
              fontSize: '8px', fontFamily: "'JetBrains Mono', monospace",
              padding: '2px 6px', border: `1px solid ${d.color}40`,
              color: d.color, background: `${d.color}10`,
              letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>{d.label} {d.value}</span>
          ))}
        </div>
      </Card>
    </Grid>
  )
}

