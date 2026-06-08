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
  value: React.ReactNode
  icon: React.ReactNode
  accentColor: string
  sublabel?: React.ReactNode
}

function MetricCard({ label, value, icon, accentColor, sublabel }: MetricCardProps) {
  return (
    <div
      style={{
        backgroundColor: '#18181B',
        border: '1px solid #27272A',
        borderRadius: '8px',
        padding: '16px',
        position: 'relative',
        overflow: 'hidden',
        transition: 'border-color 180ms ease',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = '#3F3F46'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = '#27272A'
      }}
    >
      {/* Colored top accent strip */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        height: '3px',
        background: accentColor,
        borderRadius: '8px 8px 0 0',
      }} />

      {/* Row: label LEFT, icon box RIGHT */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{
          margin: 0,
          fontSize: '11px',
          fontWeight: 500,
          color: '#71717A',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}>
          {label}
        </p>
        <div style={{
          width: '28px',
          height: '28px',
          borderRadius: '6px',
          background: `${accentColor}26`,
          border: `1px solid ${accentColor}40`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          {icon}
        </div>
      </div>

      {/* Big number */}
      <p style={{
        margin: '12px 0 0 0',
        fontSize: '28px',
        fontWeight: 700,
        lineHeight: 1,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
      </p>

      {/* Sub-content */}
      {sublabel && (
        <div style={{ marginTop: '8px', fontSize: '12px', color: '#71717A' }}>
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
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

  const offlineAccent = stopped > 0 ? '#EF4444' : '#71717A'

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>

      {/* Card 1 — Total Servers */}
      <MetricCard
        label="Total Servers"
        value={<span style={{ color: '#FAFAFA' }}>{total}</span>}
        accentColor="#6366F1"
        icon={<Server size={14} color="#6366F1" />}
        sublabel={
          <span>{providerCount} provider{providerCount !== 1 ? 's' : ''} active</span>
        }
      />

      {/* Card 2 — Online */}
      <MetricCard
        label="Online"
        value={<span style={{ color: '#22C55E' }}>{running}</span>}
        accentColor="#22C55E"
        icon={<CheckCircle2 size={14} color="#22C55E" />}
        sublabel={
          <div>
            {/* Mini progress bar */}
            <div style={{ height: '3px', background: '#27272A', borderRadius: '99px', overflow: 'hidden', marginBottom: '4px' }}>
              <div style={{
                height: '100%',
                background: '#22C55E',
                width: `${runPct}%`,
                borderRadius: '99px',
                transition: 'width 600ms ease',
              }} />
            </div>
            <span>{runPct}% uptime</span>
          </div>
        }
      />

      {/* Card 3 — Offline */}
      <MetricCard
        label="Offline"
        value={<span style={{ color: offlineAccent }}>{stopped}</span>}
        accentColor={offlineAccent}
        icon={<XCircle size={14} color={offlineAccent} />}
        sublabel={
          stopped > 0
            ? <span style={{ color: '#EF4444' }}>&#9888; Attention required</span>
            : <span style={{ color: '#22C55E' }}>&#10003; All healthy</span>
        }
      />

      {/* Card 4 — Providers */}
      <MetricCard
        label="Providers"
        value={<span style={{ color: '#FAFAFA' }}>{providerCount}</span>}
        accentColor="#F59E0B"
        icon={<Cloud size={14} color="#F59E0B" />}
        sublabel={
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {providerData.slice(0, 3).map(d => (
              <span key={d.key} style={{
                fontSize: '10px',
                fontWeight: 500,
                padding: '2px 7px',
                borderRadius: '99px',
                color: d.color,
                background: `${d.color}26`,
                border: `1px solid ${d.color}4D`,
              }}>
                {d.label}
              </span>
            ))}
            {providerData.length > 3 && (
              <span style={{
                fontSize: '10px',
                fontWeight: 500,
                padding: '2px 7px',
                borderRadius: '99px',
                color: '#71717A',
                background: '#27272A',
              }}>
                +{providerData.length - 3}
              </span>
            )}
          </div>
        }
      />

    </div>
  )
}
