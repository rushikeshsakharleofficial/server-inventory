import { useQuery } from '@tanstack/react-query'
import { Server, CheckCircle2, XCircle, Cloud } from 'lucide-react'
import { serversApi } from '../api'
import { SkeletonCard } from './Skeleton'

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

interface MetricCardProps {
  label: string
  value: number | string
  icon: React.ReactNode
  accentColor: string
  sublabel?: React.ReactNode
}

function MetricCard({ label, value, icon, accentColor, sublabel }: MetricCardProps) {
  return (
    <div
      style={{
        backgroundColor: 'var(--bg-s1)',
        border: '1px solid var(--bd)',
        borderRadius: '12px',
        padding: '20px',
        boxShadow: 'var(--shadow-card)',
        position: 'relative',
        overflow: 'hidden',
        transition: 'border-color 180ms ease, box-shadow 180ms ease',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = `${accentColor}40`
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = `var(--shadow-card), 0 0 0 1px ${accentColor}20`
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--bd)'
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-card)'
      }}
    >
      {/* Accent top stripe */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: accentColor, borderRadius: '12px 12px 0 0' }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
        <p style={{ margin: 0, fontSize: '12px', fontWeight: 500, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}
        </p>
        <div style={{
          width: '34px', height: '34px', borderRadius: '8px',
          background: `${accentColor}15`,
          border: `1px solid ${accentColor}25`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {icon}
        </div>
      </div>

      <p style={{ margin: '0 0 8px 0', fontSize: '32px', fontWeight: 700, color: 'var(--tx1)', lineHeight: 1, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </p>

      {sublabel && (
        <div style={{ fontSize: '12px', color: 'var(--tx3)' }}>
          {sublabel}
        </div>
      )}
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        {[0, 1, 2, 3].map(i => <SkeletonCard key={i} />)}
      </div>
    )
  }

  const total   = stats?.total   ?? 0
  const running = stats?.running ?? 0
  const stopped = stats?.stopped ?? 0
  const runPct  = total > 0 ? Math.round((running / total) * 100) : 0
  const providerCount = Object.keys(stats?.by_provider ?? {}).length

  const providerData = Object.entries(stats?.by_provider ?? {})
    .map(([p, v]) => ({ key: p, label: PROVIDER_LABELS[p] ?? p, value: v, color: PROVIDER_COLORS[p] ?? '#6366F1' }))
    .sort((a, b) => b.value - a.value)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
      <MetricCard
        label="Total Servers"
        value={total}
        accentColor="#6366F1"
        icon={<Server size={16} color="#6366F1" />}
        sublabel={
          <span>{providerCount} active provider{providerCount !== 1 ? 's' : ''}</span>
        }
      />

      <MetricCard
        label="Online"
        value={running}
        accentColor="#22C55E"
        icon={<CheckCircle2 size={16} color="#22C55E" />}
        sublabel={
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <span style={{ color: '#22C55E', fontWeight: 600 }}>{runPct}%</span>
              <span>uptime ratio</span>
            </div>
            <div style={{ height: '3px', background: 'var(--bg-s3)', borderRadius: '99px', overflow: 'hidden' }}>
              <div style={{ height: '100%', background: '#22C55E', width: `${runPct}%`, borderRadius: '99px', transition: 'width 600ms ease' }} />
            </div>
          </div>
        }
      />

      <MetricCard
        label="Offline"
        value={stopped}
        accentColor={stopped > 0 ? '#EF4444' : '#6B7280'}
        icon={<XCircle size={16} color={stopped > 0 ? '#EF4444' : '#6B7280'} />}
        sublabel={
          stopped > 0
            ? <span style={{ color: '#EF4444', fontWeight: 500 }}>⚠ Attention required</span>
            : <span style={{ color: 'var(--sg)' }}>✓ All nodes healthy</span>
        }
      />

      <MetricCard
        label="Providers"
        value={providerCount}
        accentColor="#F59E0B"
        icon={<Cloud size={16} color="#F59E0B" />}
        sublabel={
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {providerData.slice(0, 3).map(d => (
              <span key={d.key} style={{
                fontSize: '10px', fontWeight: 500,
                padding: '2px 7px', borderRadius: '99px',
                color: d.color, background: `${d.color}15`,
                border: `1px solid ${d.color}30`,
              }}>
                {d.label}
              </span>
            ))}
            {providerData.length > 3 && (
              <span style={{ fontSize: '10px', fontWeight: 500, padding: '2px 7px', borderRadius: '99px', color: 'var(--tx3)', background: 'var(--bg-s3)' }}>
                +{providerData.length - 3}
              </span>
            )}
          </div>
        }
      />
    </div>
  )
}
