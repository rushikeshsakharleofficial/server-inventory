import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { CheckCircle2, XCircle, Loader } from 'lucide-react'
import { serversApi, syncApi, http } from '../api'
import StatsCards from './StatsCards'
import ProviderBadge from './ProviderBadge'
import type { ServerSnapshot, SyncLog } from '../types'
import { Text } from './StitchUI'

const statsApi = {
  history: (days = 30) =>
    http.get<ServerSnapshot[]>('/api/stats/history', { params: { days } }).then(r => r.data),
  snapshot: () =>
    http.get<ServerSnapshot>('/api/stats/snapshot').then(r => r.data),
}

const SYNC_STATUS_CFG: Record<
  SyncLog['status'],
  { Icon: React.ElementType; label: string; color: string }
> = {
  success: { Icon: CheckCircle2, label: 'Success', color: '#22C55E' },
  failed:  { Icon: XCircle,      label: 'Failed',  color: '#EF4444' },
  running: { Icon: Loader,       label: 'Running', color: '#F59E0B' },
}

function fmtShort(d?: string) {
  if (!d) return '—'
  return new Date(d).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
}

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
  digitalocean: 'DigitalOcean',
  ovh:          'OVH Cloud',
  hivelocity:   'Hivelocity',
  custom_dc:    'Custom DC',
}

const CHART_MARGIN = { top: 4, right: 12, left: -10, bottom: 0 } as const
const TICK_STYLE = { fill: 'var(--tx3)', fontSize: 11 } as const

function fmtDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getAccentColor() {
  try {
    const val = getComputedStyle(document.documentElement).getPropertyValue('--ac').trim()
    return val || '#00D4FF'
  } catch {
    return '#00D4FF'
  }
}

function ChartSkeleton({ height = 240 }: { height?: number }) {
  return (
    <div
      className="skeleton rounded-xl w-full"
      style={{ height }}
      aria-hidden="true"
    />
  )
}

interface LineTooltipProps {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}

function LineTooltipContent({ active, payload, label }: LineTooltipProps) {
  if (!active || !payload?.length) return null
  const [first] = payload
  return (
    <div
      className="rounded-lg px-3 py-2 text-sm shadow-lg"
      style={{
        background:  'var(--bg-s2)',
        border:      '1px solid var(--bd)',
        color:       'var(--tx1)',
      }}
    >
      <p className="text-ink-muted text-xs mb-1" style={{ color: 'var(--tx3)', margin: '0 0 4px 0' }}>{label}</p>
      <p className="font-semibold tabular-nums" style={{ margin: 0 }}>{first?.value} servers</p>
    </div>
  )
}

interface BarTooltipProps {
  active?: boolean
  payload?: Array<{ value: number; payload: { provider: string } }>
}

function BarTooltipContent({ active, payload }: BarTooltipProps) {
  if (!active || !payload?.length) return null
  const [first] = payload
  const provider = first?.payload.provider ?? ''
  return (
    <div
      className="rounded-lg px-3 py-2 text-sm shadow-lg"
      style={{
        background: 'var(--bg-s2)',
        border:     '1px solid var(--bd)',
        color:      'var(--tx1)',
      }}
    >
      <p className="text-ink-muted text-xs mb-1" style={{ color: 'var(--tx3)', margin: '0 0 4px 0' }}>{PROVIDER_LABELS[provider] ?? provider}</p>
      <p className="font-semibold tabular-nums" style={{ margin: 0 }}>{first?.value} servers</p>
    </div>
  )
}

export default function DashboardPage() {
  const accentColor = getAccentColor()

  const { data: history, isLoading: histLoading } = useQuery({
    queryKey: ['stats-history', 30],
    queryFn: () => statsApi.history(30),
    staleTime: 60_000,
  })

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: serversApi.stats,
    staleTime: 60_000,
  })

  const lineData = useMemo(
    () => (history ?? []).map(snap => ({ date: fmtDate(snap.date), total: snap.total })),
    [history],
  )

  const barData = useMemo(
    () =>
      Object.entries(stats?.by_provider ?? {})
        .map(([provider, count]) => ({ provider, count }))
        .sort((a, b) => b.count - a.count),
    [stats],
  )

  const cardStyle: CSSProperties = {
    backgroundColor: '#18181B',
    border: '1px solid #27272A',
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
  }

  const cardTitleStyle: CSSProperties = {
    fontSize: '13px',
    fontWeight: 500,
    color: '#A1A1AA',
    margin: 0,
    lineHeight: 1.4,
  }

  const cardSubtitleStyle: CSSProperties = {
    fontSize: '11px',
    color: '#71717A',
    margin: '3px 0 0 0',
    lineHeight: 1.4,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <StatsCards />

      {/* Charts row: Server Growth (60%) + Provider Breakdown (40%) */}
      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>

        {/* Server Growth — ~60% */}
        <div style={{ ...cardStyle, flex: '0 0 60%' }}>
          <div style={{ marginBottom: '20px' }}>
            <p style={cardTitleStyle}>Server Growth</p>
            <p style={cardSubtitleStyle}>Infrastructure over the last 30 days</p>
          </div>

          {histLoading ? (
            <ChartSkeleton height={240} />
          ) : lineData.length === 0 ? (
            <div
              className="flex items-center justify-center rounded-xl"
              style={{ height: 240, background: 'var(--bg-s2)', border: '1px solid var(--bd)' }}
            >
              <Text variant="muted">No historical data yet</Text>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={lineData} margin={CHART_MARGIN}>
                <CartesianGrid stroke="var(--bd)" strokeDasharray="4 4" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={TICK_STYLE}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={TICK_STYLE}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<LineTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke={accentColor}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: accentColor, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Provider Breakdown — ~40% */}
        <div style={{ ...cardStyle, flex: '1 1 0' }}>
          <div style={{ marginBottom: '20px' }}>
            <p style={cardTitleStyle}>Provider Breakdown</p>
            <p style={cardSubtitleStyle}>Server count per cloud provider</p>
          </div>

          {statsLoading ? (
            <ChartSkeleton height={240} />
          ) : barData.length === 0 ? (
            <div
              className="flex items-center justify-center rounded-xl"
              style={{ height: 240, background: 'var(--bg-s2)', border: '1px solid var(--bd)' }}
            >
              <Text variant="muted">No provider data yet</Text>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(180, barData.length * 44)}>
              <BarChart
                data={barData}
                layout="vertical"
                margin={{ top: 0, right: 24, left: 16, bottom: 0 }}
              >
                <CartesianGrid stroke="var(--bd)" strokeDasharray="4 4" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fill: 'var(--tx3)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="provider"
                  width={90}
                  tick={{ fill: 'var(--tx2)', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: string) => PROVIDER_LABELS[v] ?? v}
                />
                <Tooltip content={<BarTooltipContent />} cursor={{ fill: 'var(--ac-bg)' }} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={28}>
                  {barData.map(entry => (
                    <Cell
                      key={entry.provider}
                      fill={PROVIDER_COLORS[entry.provider] ?? '#4B4B72'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

      </div>
    </div>
  )
}

