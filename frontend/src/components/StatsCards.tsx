import { useQuery } from '@tanstack/react-query'
import { Server, Activity, WifiOff, Cloud } from 'lucide-react'
import { serversApi } from '../api'
import { SkeletonCard } from './Skeleton'
import { Grid } from './StitchUI'

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

interface StatCardProps {
  label: string
  value: string | number
  sub?: React.ReactNode
  icon: React.ElementType
  accentColor: string
  children?: React.ReactNode
}

function StatCard({ label, value, sub, icon: Icon, accentColor, children }: StatCardProps) {
  return (
    <div
      style={{
        position: 'relative',
        backgroundColor: 'var(--bg-s1)',
        border: '1px solid var(--bd)',
        borderRadius: '8px',
        padding: '20px',
        boxShadow: 'var(--shadow-card)',
        overflow: 'hidden',
        transition: 'border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease',
        willChange: 'transform',
        transformStyle: 'preserve-3d',
      }}
      onMouseMove={e => {
        const el = e.currentTarget as HTMLDivElement
        const r = el.getBoundingClientRect()
        const x = (e.clientX - r.left) / r.width
        const y = (e.clientY - r.top) / r.height
        const rx = (y - 0.5) * -7
        const ry = (x - 0.5) * 9
        el.style.transform = `perspective(700px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(3px)`
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.borderColor = 'var(--card-hover-bd)'
        el.style.boxShadow = '0 8px 24px rgba(0,0,0,0.45), 0 0 0 1px var(--ac-bd)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.borderColor = 'var(--bd)'
        el.style.boxShadow = 'var(--shadow-card)'
        el.style.transform = 'perspective(700px) rotateX(0deg) rotateY(0deg) translateZ(0)'
      }}
    >
      {/* Top accent line */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        height: '2px',
        background: `linear-gradient(90deg, ${accentColor}, transparent)`,
      }} />

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
        <p style={{
          fontSize: '10px',
          fontFamily: "'JetBrains Mono', monospace",
          color: 'var(--tx3)',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          margin: 0,
          fontWeight: 500,
        }}>
          {label}
        </p>
        <div style={{
          width: '28px', height: '28px',
          borderRadius: '6px',
          backgroundColor: `${accentColor}14`,
          border: `1px solid ${accentColor}28`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon size={14} style={{ color: accentColor }} />
        </div>
      </div>

      {/* Value */}
      <p style={{
        fontSize: '32px',
        fontFamily: "'JetBrains Mono', monospace",
        fontWeight: 400,
        color: 'var(--tx1)',
        lineHeight: 1,
        margin: '0 0 12px 0',
        letterSpacing: '-0.02em',
      }}>
        {value}
      </p>

      {/* Sub content */}
      {sub && (
        <div style={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", color: 'var(--tx3)', letterSpacing: '0.06em' }}>
          {sub}
        </div>
      )}

      {children}
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
      {/* Total Assets */}
      <StatCard
        label="Total Assets"
        value={total}
        icon={Server}
        accentColor="var(--ac)"
        sub={`${Object.keys(stats?.by_provider ?? {}).length} active provider${Object.keys(stats?.by_provider ?? {}).length !== 1 ? 's' : ''}`}
      />

      {/* Operational */}
      <StatCard
        label="Operational"
        value={running}
        icon={Activity}
        accentColor="var(--sg)"
        sub={
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ color: 'var(--sg)' }}>{runPct}% uptime</span>
            </div>
            <div style={{ height: '3px', background: 'var(--bd)', borderRadius: '9999px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                background: 'linear-gradient(90deg, var(--sg), var(--sg))',
                width: `${runPct}%`,
                borderRadius: '9999px',
                transition: 'width 600ms cubic-bezier(0.16,1,0.3,1)',
                boxShadow: '0 0 6px var(--sg-glow)',
              }} />
            </div>
          </div>
        }
      />

      {/* Offline */}
      <StatCard
        label="Offline"
        value={stopped}
        icon={WifiOff}
        accentColor={stopped > 0 ? 'var(--sr)' : 'var(--sgr)'}
        sub={
          stopped > 0
            ? <span style={{ color: 'var(--sr)' }}>⚠ Attention required</span>
            : <span style={{ color: 'var(--sg)' }}>All nodes nominal</span>
        }
      />

      {/* Active Providers */}
      <StatCard
        label="Active Providers"
        value={providerData.length}
        icon={Cloud}
        accentColor="var(--sy)"
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
          {providerData.slice(0, 4).map(d => (
            <span key={d.key} style={{
              fontSize: '9px',
              fontFamily: "'JetBrains Mono', monospace",
              padding: '2px 7px',
              borderRadius: '3px',
              border: `1px solid ${d.color}35`,
              color: d.color,
              background: `${d.color}0d`,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              fontWeight: 500,
            }}>
              {d.label} <span style={{ opacity: 0.65 }}>{d.value}</span>
            </span>
          ))}
        </div>
      </StatCard>
    </Grid>
  )
}
