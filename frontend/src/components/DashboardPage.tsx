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
import { serversApi, http } from '../api'
import StatsCards from './StatsCards'
import type { ServerSnapshot } from '../types'

const statsApi = {
  history: (days = 30) =>
    http.get<ServerSnapshot[]>('/api/stats/history', { params: { days } }).then(r => r.data),
  snapshot: () =>
    http.get<ServerSnapshot>('/api/stats/snapshot').then(r => r.data),
}

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
  return (
    <div
      className="rounded-lg px-3 py-2 text-sm shadow-lg"
      style={{
        background:  'var(--bg-s2)',
        border:      '1px solid var(--bd)',
        color:       'var(--tx1)',
      }}
    >
      <p className="text-ink-muted text-xs mb-1">{label}</p>
      <p className="font-semibold tabular-nums">{payload[0].value} servers</p>
    </div>
  )
}

interface BarTooltipProps {
  active?: boolean
  payload?: Array<{ value: number; payload: { provider: string } }>
}

function BarTooltipContent({ active, payload }: BarTooltipProps) {
  if (!active || !payload?.length) return null
  const { provider } = payload[0].payload
  return (
    <div
      className="rounded-lg px-3 py-2 text-sm shadow-lg"
      style={{
        background: 'var(--bg-s2)',
        border:     '1px solid var(--bd)',
        color:      'var(--tx1)',
      }}
    >
      <p className="text-ink-muted text-xs mb-1">{PROVIDER_LABELS[provider] ?? provider}</p>
      <p className="font-semibold tabular-nums">{payload[0].value} servers</p>
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

  const lineData = (history ?? []).map(snap => ({
    date:  fmtDate(snap.date),
    total: snap.total,
  }))

  const barData = Object.entries(stats?.by_provider ?? {})
    .map(([provider, count]) => ({ provider, count }))
    .sort((a, b) => b.count - a.count)

  return (
    <div className="space-y-6 animate-fade-in">
      <StatsCards />

      {/* Server Growth */}
      <div className="card-dark p-5">
        <div className="mb-4">
          <p className="text-sm font-semibold text-ink-primary">Server Growth</p>
          <p className="text-xs text-ink-muted mt-0.5">Total server count over the last 30 days</p>
        </div>

        {histLoading ? (
          <ChartSkeleton height={240} />
        ) : lineData.length === 0 ? (
          <div
            className="flex items-center justify-center rounded-xl"
            style={{ height: 240, background: 'var(--bg-s2)', border: '1px solid var(--bd)' }}
          >
            <p className="text-sm text-ink-muted">No historical data yet</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={lineData} margin={{ top: 4, right: 12, left: -10, bottom: 0 }}>
              <CartesianGrid stroke="var(--bd)" strokeDasharray="4 4" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: 'var(--tx3)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: 'var(--tx3)', fontSize: 11 }}
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

      {/* Provider Breakdown */}
      <div className="card-dark p-5">
        <div className="mb-4">
          <p className="text-sm font-semibold text-ink-primary">Provider Breakdown</p>
          <p className="text-xs text-ink-muted mt-0.5">Server count per cloud provider</p>
        </div>

        {statsLoading ? (
          <ChartSkeleton height={240} />
        ) : barData.length === 0 ? (
          <div
            className="flex items-center justify-center rounded-xl"
            style={{ height: 240, background: 'var(--bg-s2)', border: '1px solid var(--bd)' }}
          >
            <p className="text-sm text-ink-muted">No provider data yet</p>
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
  )
}
