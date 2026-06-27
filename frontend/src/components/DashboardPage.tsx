import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie,
} from 'recharts'
import { serversApi, http } from '../api'
import type { ServerSnapshot } from '../types'

const statsApi = {
  history: (days = 30) =>
    http.get<ServerSnapshot[]>('/api/stats/history', { params: { days } }).then(r => r.data),
  snapshot: () =>
    http.get<ServerSnapshot>('/api/stats/snapshot').then(r => r.data),
}

const PROVIDER_COLORS: Record<string, string> = {
  aws: '#FF9900', gcp: '#4285F4', azure: '#0078D4',
  linode: '#02B159', digitalocean: '#0080FF', ovh: '#123F6D',
  hivelocity: '#E84545', custom_dc: '#8B5CF6',
}
const PROVIDER_LABELS: Record<string, string> = {
  aws: 'AWS', gcp: 'GCP', azure: 'Azure', linode: 'Linode',
  digitalocean: 'DigitalOcean', ovh: 'OVH', hivelocity: 'Hivelocity', custom_dc: 'Custom',
}

const TICK = { fill: 'var(--tx3)', fontSize: 11 } as const
const MARGIN = { top: 4, right: 12, left: -10, bottom: 0 } as const

const cardSt: React.CSSProperties = {
  background: 'var(--bg-base)', border: '1px solid var(--bd)',
  borderRadius: '12px', boxShadow: '0 1px 6px rgba(0,0,0,0.05)', overflow: 'hidden',
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function Skeleton({ h = 220 }: { h?: number }) {
  return <div className="skeleton rounded-lg w-full" style={{ height: h }} aria-hidden />
}

function LineTooltip({ active, payload, label }: { active?: boolean; payload?: {value:number}[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg-base)', border: '1px solid var(--bd)', borderRadius: '8px', padding: '8px 12px', fontSize: '12px' }}>
      <div style={{ color: 'var(--tx3)', marginBottom: '2px' }}>{label}</div>
      <div style={{ fontWeight: 600, color: 'var(--tx1)' }}>{payload[0]?.value} servers</div>
    </div>
  )
}

function BarTooltip({ active, payload }: { active?: boolean; payload?: {value:number;payload:{provider:string}}[] }) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div style={{ background: 'var(--bg-base)', border: '1px solid var(--bd)', borderRadius: '8px', padding: '8px 12px', fontSize: '12px' }}>
      <div style={{ color: 'var(--tx3)', marginBottom: '2px' }}>{PROVIDER_LABELS[p?.payload.provider ?? ''] ?? p?.payload.provider}</div>
      <div style={{ fontWeight: 600, color: 'var(--tx1)' }}>{p?.value} servers</div>
    </div>
  )
}

export default function DashboardPage() {
  const [days, setDays] = useState(30)

  const { data: history, isLoading: histLoading } = useQuery({
    queryKey: ['stats-history', days],
    queryFn: () => statsApi.history(days),
    staleTime: 60_000,
  })

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: serversApi.stats,
    staleTime: 60_000,
  })

  const lineData = useMemo(
    () => (history ?? []).map(s => ({ date: fmtDate(s.date), total: s.total })),
    [history],
  )

  const barData = useMemo(
    () => Object.entries(stats?.by_provider ?? {})
      .map(([provider, count]) => ({ provider, count }))
      .sort((a, b) => b.count - a.count),
    [stats],
  )

  const regionData = useMemo(
    () => Object.entries(stats?.by_region ?? {})
      .map(([region, count]) => ({ region, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6),
    [stats],
  )

  const total   = stats?.total   ?? 0
  const running = stats?.running ?? 0
  const stopped = stats?.stopped ?? 0
  const runPct  = total > 0 ? Math.round((running / total) * 100) : 0

  const pieData = [
    { name: 'Online',  value: running, color: '#00B520' },
    { name: 'Offline', value: stopped, color: '#FF4040' },
  ]

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--tx1)', letterSpacing: '-0.02em', margin: 0, fontFamily: 'Inter,sans-serif' }}>Dashboard</h1>
          <p style={{ fontSize: '13px', color: 'var(--tx3)', margin: '4px 0 0', fontFamily: 'Inter,sans-serif' }}>Infrastructure overview &amp; metrics</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {([7, 30, 90] as const).map(d => (
            <button key={d} onClick={() => setDays(d)}
              style={{
                padding: '5px 14px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
                fontFamily: 'Inter,sans-serif', cursor: 'pointer', transition: 'all 120ms',
                background: days === d ? 'rgba(246,130,31,0.12)' : 'var(--bg-base)',
                color: days === d ? 'var(--ac)' : 'var(--tx3)',
                border: days === d ? '1px solid rgba(246,130,31,0.3)' : '1px solid var(--bd)',
              }}>
              {d}D
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px' }}>
        {statsLoading ? (
          Array.from({length:4}).map((_,i) => (
            <div key={i} style={{ ...cardSt, height: '100px' }} className="skeleton" />
          ))
        ) : [
          { label: 'TOTAL SERVERS', value: total.toLocaleString(),   sub: `${Object.keys(stats?.by_provider??{}).length} active providers`, accent: 'var(--ac)' },
          { label: 'ONLINE',        value: running.toLocaleString(), sub: `${runPct}% uptime`, accent: '#00B520' },
          { label: 'OFFLINE',       value: stopped.toLocaleString(), sub: stopped > 0 ? '⚠ Attention needed' : 'All nominal', accent: stopped > 0 ? '#FF4040' : '#00B520' },
          { label: 'PROVIDERS',     value: String(Object.keys(stats?.by_provider??{}).length), sub: Object.keys(stats?.by_provider??{}).slice(0,3).map(p=>PROVIDER_LABELS[p]??p).join(' · '), accent: 'var(--sy)' },
        ].map(k => (
          <div key={k.label} style={{ ...cardSt, padding: '0', position: 'relative' }}>
            {/* accent top line */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: k.accent, borderRadius: '12px 12px 0 0' }} />
            <div style={{ padding: '18px 16px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--tx3)', fontFamily: 'Inter,sans-serif' }}>{k.label}</span>
                <div style={{ width: '26px', height: '26px', borderRadius: '6px', background: `color-mix(in srgb, ${k.accent} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${k.accent} 25%, transparent)`, flexShrink: 0 }} />
              </div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--tx1)', letterSpacing: '-0.02em', fontFamily: 'Inter,sans-serif', lineHeight: 1, marginBottom: '8px' }}>{k.value}</div>
              <div style={{ fontSize: '11px', color: k.label === 'OFFLINE' && stopped > 0 ? '#FF4040' : 'var(--tx3)', fontFamily: 'Inter,sans-serif' }}>{k.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Charts Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* Server Growth */}
        <div style={cardSt}>
          <div style={{ padding: '20px 20px 0', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--tx1)', fontFamily: 'Inter,sans-serif' }}>Server Growth</span>
              <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.08em', color: 'var(--tx3)', fontFamily: 'Inter,sans-serif' }}>{days} DAYS</span>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--tx3)', margin: '3px 0 0', fontFamily: 'Inter,sans-serif' }}>Infrastructure scaling over time</p>
          </div>
          <div style={{ padding: '0 8px 16px' }}>
            {histLoading ? <Skeleton /> : lineData.length === 0 ? (
              <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-s1)', borderRadius: '8px', margin: '0 12px 0' }}>
                <span style={{ color: 'var(--tx3)', fontSize: '13px' }}>No historical data yet</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={lineData} margin={MARGIN}>
                  <defs>
                    <linearGradient id="acGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="var(--ac)" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="var(--ac)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--bd)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={TICK} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={TICK} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<LineTooltip />} />
                  <Line type="monotone" dataKey="total" stroke="var(--ac)" strokeWidth={2} dot={false}
                    activeDot={{ r: 4, fill: 'var(--ac)', strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Provider Breakdown */}
        <div style={cardSt}>
          <div style={{ padding: '20px 20px 0', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--tx1)', fontFamily: 'Inter,sans-serif' }}>Provider Breakdown</span>
              <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.08em', color: 'var(--tx3)', fontFamily: 'Inter,sans-serif' }}>{barData.length} ACTIVE</span>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--tx3)', margin: '3px 0 0', fontFamily: 'Inter,sans-serif' }}>Server count per cloud provider</p>
          </div>
          <div style={{ padding: '0 8px 16px' }}>
            {statsLoading ? <Skeleton /> : barData.length === 0 ? (
              <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-s1)', borderRadius: '8px', margin: '0 12px' }}>
                <span style={{ color: 'var(--tx3)', fontSize: '13px' }}>No provider data</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(180, barData.length * 48)}>
                <BarChart data={barData} layout="vertical" margin={{ top: 0, right: 24, left: 20, bottom: 0 }}>
                  <CartesianGrid stroke="var(--bd)" strokeDasharray="4 4" horizontal={false} />
                  <XAxis type="number" tick={TICK} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="provider" width={88} tick={{ fill: 'var(--tx2)', fontSize: 12 }}
                    axisLine={false} tickLine={false} tickFormatter={(v: string) => PROVIDER_LABELS[v] ?? v} />
                  <Tooltip content={<BarTooltip />} cursor={{ fill: 'var(--ac-bg)' }} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={20}>
                    {barData.map(e => <Cell key={e.provider} fill={PROVIDER_COLORS[e.provider] ?? '#4B4B72'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '16px' }}>
        {/* Region Breakdown table */}
        <div style={cardSt}>
          <div style={{ padding: '20px 20px 12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--tx1)', fontFamily: 'Inter,sans-serif' }}>Region Breakdown</span>
            <p style={{ fontSize: '11px', color: 'var(--tx3)', margin: '3px 0 0', fontFamily: 'Inter,sans-serif' }}>Top regions by server count</p>
          </div>
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 80px 100px', gap: '0', padding: '8px 20px', background: 'var(--bg-s1)', borderTop: '1px solid var(--bd)', borderBottom: '1px solid var(--bd)' }}>
            {['REGION', 'PROVIDER', 'SERVERS', 'SHARE'].map(h => (
              <span key={h} style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.08em', color: 'var(--tx3)', textTransform: 'uppercase', fontFamily: 'Inter,sans-serif' }}>{h}</span>
            ))}
          </div>
          {/* Rows */}
          {statsLoading ? (
            Array.from({length:4}).map((_,i) => (
              <div key={i} style={{ height: '44px', borderBottom: '1px solid var(--bd)', padding: '0 20px', display: 'flex', alignItems: 'center' }}>
                <div className="skeleton" style={{ width: '60%', height: '12px', borderRadius: '4px' }} />
              </div>
            ))
          ) : regionData.length === 0 ? (
            <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--tx3)', fontSize: '13px' }}>No region data yet</div>
          ) : regionData.map((r, i) => {
            // derive provider from region name heuristic
            const p = r.region.includes('us-east') || r.region.includes('us-west') || r.region.includes('ap-') || r.region.includes('eu-west') ? 'aws'
              : r.region.includes('us-central') || r.region.includes('europe-') || r.region.includes('asia-') ? 'gcp'
              : r.region.includes('eastus') || r.region.includes('westus') || r.region.includes('northeurope') ? 'azure'
              : 'custom_dc'
            const maxCount = regionData[0]?.count ?? 1
            const pct = (r.count / maxCount)
            const color = PROVIDER_COLORS[p] ?? '#6B7280'
            return (
              <div key={r.region} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 80px 100px', alignItems: 'center', padding: '0 20px', height: '44px', borderBottom: '1px solid var(--bd)', background: i % 2 === 1 ? 'var(--bg-s1)' : 'transparent' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--tx1)', fontFamily: 'monospace' }}>{r.region}</span>
                </div>
                <div>
                  <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', color, background: `${color}18`, border: `1px solid ${color}30`, fontFamily: 'Inter,sans-serif' }}>
                    {PROVIDER_LABELS[p] ?? p.toUpperCase()}
                  </span>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--tx1)', fontFamily: 'Inter,sans-serif' }}>{r.count.toLocaleString()}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ flex: 1, height: '5px', background: 'var(--bg-s2)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.round(pct * 100)}%`, background: color, opacity: 0.7, borderRadius: '3px', transition: 'width 600ms' }} />
                  </div>
                  <span style={{ fontSize: '10px', color: 'var(--tx3)', fontFamily: 'Inter,sans-serif', width: '28px', textAlign: 'right' }}>{Math.round(pct*100)}%</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Status Distribution */}
        <div style={cardSt}>
          <div style={{ padding: '20px 20px 12px', borderBottom: '1px solid var(--bd)' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--tx1)', fontFamily: 'Inter,sans-serif' }}>Status Distribution</span>
            <p style={{ fontSize: '11px', color: 'var(--tx3)', margin: '3px 0 0', fontFamily: 'Inter,sans-serif' }}>Current health snapshot</p>
          </div>
          {statsLoading ? <Skeleton h={240} /> : (
            <>
              {/* Donut */}
              <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0 8px', position: 'relative' }}>
                <ResponsiveContainer width={140} height={140}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={46} outerRadius={62}
                      dataKey="value" stroke="none" startAngle={90} endAngle={-270}>
                      {pieData.map(e => <Cell key={e.name} fill={e.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', marginTop: '8px' }}>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--tx1)', fontFamily: 'Inter,sans-serif', lineHeight: 1.1 }}>{runPct}%</div>
                  <div style={{ fontSize: '10px', color: 'var(--tx3)', fontFamily: 'Inter,sans-serif' }}>uptime</div>
                </div>
              </div>
              {/* Legend rows */}
              <div style={{ padding: '8px 20px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {pieData.map(s => {
                  const pct = total > 0 ? Math.round((s.value / total) * 100) : 0
                  return (
                    <div key={s.name}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.color }} />
                          <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--tx2)', fontFamily: 'Inter,sans-serif' }}>{s.name}</span>
                        </div>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: s.color, fontFamily: 'Inter,sans-serif' }}>{s.value.toLocaleString()}</span>
                      </div>
                      <div style={{ height: '5px', background: 'var(--bg-s2)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: s.color, opacity: 0.7, borderRadius: '3px', transition: 'width 600ms' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>

    </div>
  )
}
