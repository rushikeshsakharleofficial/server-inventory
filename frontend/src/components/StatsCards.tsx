import { useQuery } from '@tanstack/react-query'
import { serversApi } from '../api'
import { SkeletonCard } from './Skeleton'
import { Grid, Card, Flex, Text, StatusDot } from './StitchUI'

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
  if (total === 0) return <circle cx="18" cy="18" r="16" fill="none" stroke="var(--bd)" strokeWidth="4" />

  let offset = 0
  const circumference = 2 * Math.PI * 16
  return (
    <>
      <circle cx="18" cy="18" r="16" fill="none" stroke="var(--bd)" strokeWidth="4" />
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
      {/* Total */}
      <Card hoverable>
        <Flex justify="between" align="start" style={{ marginBottom: '16px' }}>
          <Text variant="label">Total Servers</Text>
          <svg style={{ width: '16px', height: '16px', color: 'var(--tx3)', opacity: 0.6 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M5 6h14M5 18h14" />
          </svg>
        </Flex>
        <Text style={{ fontSize: '36px', fontWeight: 800, color: 'var(--tx1)', fontFamily: 'DM Sans', lineHeight: 1 }}>{total}</Text>
        <Text variant="smallMuted" style={{ marginTop: '8px', fontFamily: 'monospace' }}>
          {Object.keys(stats?.by_provider ?? {}).length} provider{Object.keys(stats?.by_provider ?? {}).length !== 1 ? 's' : ''}
        </Text>
      </Card>

      {/* Running */}
      <Card hoverable>
        <Flex justify="between" align="start" style={{ marginBottom: '16px' }}>
          <Text variant="label">Running</Text>
          <StatusDot running />
        </Flex>
        <Text style={{ fontSize: '36px', fontWeight: 800, color: 'var(--sg)', fontFamily: 'DM Sans', lineHeight: 1 }}>{running}</Text>
        <Text style={{ marginTop: '8px', fontFamily: 'monospace', fontSize: '10px', color: 'var(--sg)' }}>
          {runPct}% of fleet healthy
        </Text>
      </Card>

      {/* Stopped */}
      <Card hoverable>
        <Flex justify="between" align="start" style={{ marginBottom: '16px' }}>
          <Text variant="label">Stopped</Text>
          <StatusDot running={false} style={{ backgroundColor: 'var(--sr)' }} />
        </Flex>
        <Text style={{ fontSize: '36px', fontWeight: 800, color: 'var(--sr)', fontFamily: 'DM Sans', lineHeight: 1 }}>{stopped}</Text>
        <Text style={{ marginTop: '8px', fontFamily: 'monospace', fontSize: '10px', color: 'var(--sr)' }}>
          {total > 0 ? `${100 - runPct}% idle` : 'No servers'}
        </Text>
      </Card>

      {/* Provider Distribution */}
      <Card hoverable>
        <Flex justify="between" align="start" style={{ marginBottom: '12px' }}>
          <Text variant="label">Providers</Text>
          <Text variant="small" style={{ fontFamily: 'monospace' }}>Live</Text>
        </Flex>
        {providerData.length === 0 ? (
          <Text variant="muted" style={{ marginTop: '16px' }}>No providers yet</Text>
        ) : (
          <Flex align="center" gap={4}>
            <div style={{ position: 'relative', width: '64px', height: '64px', flexShrink: 0 }}>
              <svg style={{ width: '64px', height: '64px', transform: 'rotate(-90deg)' }} viewBox="0 0 36 36">
                <DonutSVG data={providerData} />
              </svg>
            </div>
            <Flex direction="column" gap={1} style={{ flex: 1, minWidth: 0 }}>
              {providerData.slice(0, 4).map(d => (
                <Flex key={d.key} justify="between" align="center" gap={2} style={{ width: '100%' }}>
                  <Flex align="center" gap={1} style={{ minWidth: 0 }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0, backgroundColor: d.color }} />
                    <span style={{ fontSize: '10px', color: 'var(--tx1)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label}</span>
                  </Flex>
                  <span style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--tx2)' }}>{d.value}</span>
                </Flex>
              ))}
            </Flex>
          </Flex>
        )}
      </Card>
    </Grid>
  )
}

