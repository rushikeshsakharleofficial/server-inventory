import { useMemo, useState, useRef, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, Globe, Lock, Wifi, RefreshCw } from 'lucide-react'
import { serversApi, sshCredentialsApi } from '../api'
import { useToast } from '../hooks/useToast'
import type { Server } from '../types'
import ProviderBadge from './ProviderBadge'

interface IpRow {
  ip: string
  type: 'public' | 'private' | 'interface'
  server: Server
  version: 4 | 6
}

interface StreamResult {
  server_id: number
  server_name: string
  provider: string
  host: string
  ips: string[]
  success: boolean
}

function ipVersion(ip: string): 4 | 6 {
  return ip.includes(':') ? 6 : 4
}

function isPrivateIp(ip: string): boolean {
  return (
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    ip.startsWith('fd') ||
    ip.startsWith('fc')
  )
}

const cardSt: React.CSSProperties = {
  background: 'var(--bg-base)',
  border: '1px solid var(--bd)',
  borderRadius: 12,
  boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
}

const thSt: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--tx3)',
  padding: '10px 16px',
  background: 'var(--bg-s1)',
  borderBottom: '1px solid var(--bd)',
  textAlign: 'left',
  fontFamily: 'Inter, sans-serif',
  whiteSpace: 'nowrap',
}

const tdSt: React.CSSProperties = {
  padding: '10px 16px',
  borderBottom: '1px solid var(--bd)',
  verticalAlign: 'middle',
}

export default function IpsPage({ onServerClick }: { onServerClick?: (server: Server) => void }) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [search, setSearch]               = useState('')
  const [typeFilter, setTypeFilter]       = useState<'' | 'public' | 'private' | 'interface'>('')
  const [versionFilter, setVersionFilter] = useState<'' | '4' | '6'>('')
  const [selectedCredId, setSelectedCredId] = useState<string>('')
  const [page, setPage]       = useState(1)
  const [fetching, setFetching]           = useState(false)
  const [streamResults, setStreamResults] = useState<StreamResult[]>([])
  const [hoveredRow, setHoveredRow]       = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const { data: sshCreds = [] } = useQuery({
    queryKey: ['ssh-credentials'],
    queryFn: sshCredentialsApi.list,
    staleTime: 60_000,
  })

  const { data: servers = [], isLoading, isError } = useQuery<Server[]>({
    queryKey: ['servers-all'],
    queryFn: () => serversApi.listAll(),
    staleTime: 30_000,
  })

  async function startFetch() {
    if (fetching) { abortRef.current?.abort(); return }
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setFetching(true)
    setStreamResults([])

    const token = localStorage.getItem('si_token')
    const url = '/api/servers/ssh-fetch-ips-stream' +
      (selectedCredId ? `?ssh_credential_id=${selectedCredId}` : '')

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        signal: ctrl.signal,
      })
      if (!resp.ok) {
        if (resp.status === 401) { window.dispatchEvent(new Event('auth:expired')); return }
        const body = await resp.json().catch(() => ({}))
        toast.error(body?.detail || 'SSH fetch failed')
        return
      }

      if (!resp.body) {
        toast.error('Server did not return a stream')
        return
      }

      const reader = resp.body.getReader()
      const dec = new TextDecoder()
      let buf = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const result: StreamResult = JSON.parse(line)
            setStreamResults(prev => [...prev, result])
          } catch { /* skip malformed */ }
        }
      }

      qc.invalidateQueries({ queryKey: ['servers'] })
      toast.success('SSH IP fetch complete')
    } catch (e: unknown) {
      if ((e as Error)?.name !== 'AbortError') toast.error('SSH fetch error')
    } finally {
      setFetching(false)
    }
  }

  useEffect(() => {
    const handler = (e: Event) => {
      const event = (e as CustomEvent<{ type: string; server_name?: string; ips?: string[]; success?: boolean }>).detail
      if (event.type === 'ip_fetch_result' && event.success && !fetching) {
        qc.invalidateQueries({ queryKey: ['servers'] })
      }
    }
    window.addEventListener('ws:server-event', handler)
    return () => window.removeEventListener('ws:server-event', handler)
  }, [fetching, qc])

  const rows = useMemo<IpRow[]>(() => {
    const out: IpRow[] = []
    for (const srv of servers) {
      const seen = new Set<string>()

      const addIp = (ip: string | null | undefined, type: IpRow['type']) => {
        if (!ip || seen.has(ip)) return
        seen.add(ip)
        out.push({ ip, type, server: srv, version: ipVersion(ip) })
      }

      const sshInfo = srv.ssh_info as Record<string, unknown> | undefined
      const allIps = Array.isArray(sshInfo?.all_ips) ? sshInfo.all_ips as string[] : null

      if (allIps && allIps.length > 0) {
        for (const ip of allIps) {
          const clean = ip.split('/')[0] ?? ip
          const type: IpRow['type'] = (srv.public_ip && clean === srv.public_ip)
            ? 'public'
            : isPrivateIp(clean) ? 'private' : 'interface'
          addIp(clean, type)
        }
      } else {
        addIp(srv.public_ip, 'public')
        addIp(srv.private_ip, 'private')
      }
    }
    return out
  }, [servers])

  const PAGE_SIZE = 50

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (search && !r.ip.includes(search) && !r.server.name.toLowerCase().includes(search.toLowerCase())) return false
      if (typeFilter && r.type !== typeFilter) return false
      if (versionFilter && String(r.version) !== versionFilter) return false
      return true
    })
  }, [rows, search, typeFilter, versionFilter])

  useEffect(() => { setPage(1) }, [search, typeFilter, versionFilter])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageRows   = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  )

  const ipv4Count = useMemo(() => rows.filter(r => r.version === 4).length, [rows])
  const ipv6Count = useMemo(() => rows.filter(r => r.version === 6).length, [rows])

  const TypeIcon = ({ type }: { type: IpRow['type'] }) => {
    if (type === 'public')  return <Globe size={12} style={{ color: 'var(--ac)',  flexShrink: 0 }} />
    if (type === 'private') return <Lock  size={12} style={{ color: 'var(--tx3)', flexShrink: 0 }} />
    return                         <Wifi  size={12} style={{ color: 'var(--sg)',  flexShrink: 0 }} />
  }

  const typeColor = (type: IpRow['type']) => {
    if (type === 'public')  return 'var(--ac)'
    if (type === 'private') return 'var(--tx3)'
    return 'var(--sg)'
  }

  const typePillBg = (type: IpRow['type']) => {
    if (type === 'public')  return 'rgba(246,130,31,0.1)'
    if (type === 'private') return 'var(--bg-s2)'
    return 'rgba(0,181,32,0.1)'
  }

  const statCards = [
    { label: 'TOTAL IPs', value: rows.length,  accent: 'var(--ac)'  },
    { label: 'IPv4',      value: ipv4Count,     accent: '#4F8EF7'    },
    { label: 'IPv6',      value: ipv6Count,     accent: 'var(--sg)'  },
  ]

  const selectSt: React.CSSProperties = {
    padding: '7px 12px', background: 'var(--bg-s1)', border: '1px solid var(--bd)',
    borderRadius: 8, color: 'var(--tx1)', fontSize: 13,
    fontFamily: 'Inter,sans-serif', cursor: 'pointer', outline: 'none',
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <style>{`@keyframes ips-spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--tx1)', letterSpacing: '-0.02em', margin: 0, fontFamily: 'Inter,sans-serif' }}>
            IP Addresses
          </h1>
          <p style={{ fontSize: 13, color: 'var(--tx3)', margin: '4px 0 0', fontFamily: 'Inter,sans-serif' }}>
            {isLoading ? 'Loading…' : `${filtered.length} addresses across ${servers.length} servers`}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select
            value={selectedCredId}
            onChange={e => setSelectedCredId(e.target.value)}
            style={{ ...selectSt, fontFamily: 'var(--font-mono)', fontSize: 12, minWidth: 160 }}
          >
            <option value="">Default credential</option>
            {sshCreds.map(c => (
              <option key={c.id} value={String(c.id)}>
                {c.name}{c.is_default ? ' ★' : ''}
              </option>
            ))}
          </select>
          <button
            onClick={startFetch}
            style={{
              background: 'var(--ac)', color: 'white', border: 'none', borderRadius: 8,
              padding: '8px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              opacity: fetching ? 0.85 : 1, transition: 'all 140ms ease',
            }}
          >
            <RefreshCw size={13} style={{ animation: fetching ? 'ips-spin 1s linear infinite' : 'none' }} />
            {fetching ? `Fetching… (${streamResults.length})` : 'Fetch via SSH'}
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
        {statCards.map(s => (
          <div key={s.label} style={{ ...cardSt, padding: 0, position: 'relative' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: s.accent, borderRadius: '12px 12px 0 0' }} />
            <div style={{ padding: '18px 20px 16px' }}>
              <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--tx3)', fontFamily: 'Inter,sans-serif', marginBottom: 10 }}>
                {s.label}
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--tx1)', letterSpacing: '-0.02em', fontFamily: 'Inter,sans-serif', lineHeight: 1 }}>
                {isLoading ? '—' : s.value.toLocaleString()}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ ...cardSt, padding: '14px 16px' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 220px', position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx3)', pointerEvents: 'none' }} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search IP or server name…"
              style={{
                width: '100%', boxSizing: 'border-box', padding: '7px 12px 7px 32px',
                background: 'var(--bg-s1)', border: '1px solid var(--bd)', borderRadius: 8,
                color: 'var(--tx1)', fontSize: 13, fontFamily: 'Inter,sans-serif', outline: 'none',
              }}
            />
          </div>
          <div style={{ flex: '0 0 160px' }}>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as typeof typeFilter)} style={{ ...selectSt, width: '100%' }}>
              <option value="">All types</option>
              <option value="public">Public</option>
              <option value="private">Private</option>
              <option value="interface">Interface</option>
            </select>
          </div>
          <div style={{ flex: '0 0 130px' }}>
            <select value={versionFilter} onChange={e => setVersionFilter(e.target.value as typeof versionFilter)} style={{ ...selectSt, width: '100%' }}>
              <option value="">IPv4 + IPv6</option>
              <option value="4">IPv4 only</option>
              <option value="6">IPv6 only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table card */}
      <div style={{ ...cardSt, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thSt}>IP Address</th>
              <th style={thSt}>Type</th>
              <th style={thSt}>Ver</th>
              <th style={thSt}>Server</th>
              <th style={thSt}>Provider</th>
              <th style={thSt}>Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--tx3)', fontFamily: 'Inter,sans-serif', fontSize: 13 }}>
                  Loading…
                </td>
              </tr>
            )}
            {isError && (
              <tr>
                <td colSpan={6} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--sr)', fontFamily: 'Inter,sans-serif', fontSize: 13 }}>
                  Failed to load servers
                </td>
              </tr>
            )}
            {!isLoading && !isError && filtered.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--tx3)', fontFamily: 'Inter,sans-serif', fontSize: 13 }}>
                  No IPs found. Run a sync or SSH sync to populate.
                </td>
              </tr>
            )}
            {fetching && streamResults.map(result =>
              result.ips.map((ip, j) => (
                <tr key={`stream-${result.server_id}-${ip}-${j}`} style={{ opacity: 0.75, background: 'var(--ac-bg)', borderBottom: '1px solid var(--bd)' }}>
                  <td style={tdSt}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ac)' }}>{ip.split('/')[0] ?? ip}</span>
                  </td>
                  <td style={tdSt}>
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--tx3)', background: 'var(--bg-s2)', borderRadius: 4, padding: '2px 6px', border: '1px solid var(--bd)' }}>live</span>
                  </td>
                  <td style={tdSt}>
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--tx3)', background: 'var(--bg-s2)', borderRadius: 4, padding: '2px 6px', border: '1px solid var(--bd)' }}>
                      IPv{ip.includes(':') ? 6 : 4}
                    </span>
                  </td>
                  <td style={tdSt}><span style={{ fontSize: 13, color: 'var(--tx1)', fontFamily: 'Inter,sans-serif' }}>{result.server_name}</span></td>
                  <td style={tdSt}><span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--tx3)' }}>{result.provider}</span></td>
                  <td style={tdSt} />
                </tr>
              ))
            )}
            {pageRows.map((row, i) => {
              const rowKey = `${row.server.id}-${row.ip}-${i}`
              const isHovered = hoveredRow === rowKey
              return (
                <tr
                  key={rowKey}
                  style={{ borderBottom: '1px solid var(--bd)', background: isHovered ? 'var(--bg-s1)' : 'transparent', transition: 'background 100ms' }}
                  onMouseEnter={() => setHoveredRow(rowKey)}
                  onMouseLeave={() => setHoveredRow(null)}
                >
                  <td style={tdSt}>
                    <span
                      onClick={() => onServerClick?.(row.server)}
                      style={{
                        fontFamily: 'var(--font-mono)', fontSize: 12, color: typeColor(row.type),
                        cursor: onServerClick ? 'pointer' : 'default',
                        textDecoration: onServerClick ? 'underline' : 'none',
                        textDecorationStyle: 'dotted',
                        textUnderlineOffset: 3,
                      }}
                      title={onServerClick ? `Open server: ${row.server.name}` : undefined}
                    >
                      {row.ip}
                    </span>
                  </td>
                  <td style={tdSt}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em',
                      fontFamily: 'var(--font-mono)', color: typeColor(row.type),
                      background: typePillBg(row.type), borderRadius: 4, padding: '2px 7px',
                      border: `1px solid ${typeColor(row.type)}33`,
                    }}>
                      <TypeIcon type={row.type} />
                      {row.type}
                    </span>
                  </td>
                  <td style={tdSt}>
                    <span style={{
                      fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--tx3)',
                      background: 'var(--bg-s2)', borderRadius: 4, padding: '2px 6px',
                      border: '1px solid var(--bd)',
                    }}>
                      IPv{row.version}
                    </span>
                  </td>
                  <td style={tdSt}>
                    <span
                      onClick={() => onServerClick?.(row.server)}
                      style={{
                        fontSize: 13, color: onServerClick ? 'var(--ac)' : 'var(--tx1)',
                        fontFamily: 'Inter,sans-serif', cursor: onServerClick ? 'pointer' : 'default',
                        fontWeight: 500,
                      }}
                    >
                      {row.server.name}
                    </span>
                  </td>
                  <td style={tdSt}>
                    <ProviderBadge provider={row.server.provider} showLogo />
                  </td>
                  <td style={tdSt}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%', flexShrink: 0, display: 'inline-block',
                        backgroundColor: row.server.status === 'running' ? 'var(--sg)' : row.server.status === 'stopped' ? 'var(--sr)' : 'var(--sy)',
                      }} />
                      <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {row.server.status}
                      </span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Pagination */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', borderTop: '1px solid var(--bd)', background: 'var(--bg-s1)',
        }}>
          <span style={{ fontSize: 12, color: 'var(--tx3)', fontFamily: 'var(--font-mono)' }}>
            Page {page} of {Math.max(1, totalPages)} · {filtered.length} total
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{
                padding: '5px 12px', borderRadius: 8, border: '1px solid var(--bd)',
                background: 'var(--bg-s1)', color: page === 1 ? 'var(--tx3)' : 'var(--tx2)',
                fontSize: 12, cursor: page === 1 ? 'default' : 'pointer',
                fontFamily: 'Inter,sans-serif', opacity: page === 1 ? 0.5 : 1,
              }}
            >
              Prev
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => {
              const p = i + 1
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  style={{
                    width: 32, height: 32, borderRadius: 8, border: 'none',
                    cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all 150ms ease',
                    background: page === p ? 'var(--ac)' : 'transparent',
                    color: page === p ? 'white' : 'var(--tx2)',
                    fontFamily: 'Inter,sans-serif',
                  }}
                >
                  {p}
                </button>
              )
            })}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= Math.max(1, totalPages)}
              style={{
                padding: '5px 12px', borderRadius: 8, border: '1px solid var(--bd)',
                background: 'var(--bg-s1)', color: page >= Math.max(1, totalPages) ? 'var(--tx3)' : 'var(--tx2)',
                fontSize: 12, cursor: page >= Math.max(1, totalPages) ? 'default' : 'pointer',
                fontFamily: 'Inter,sans-serif', opacity: page >= Math.max(1, totalPages) ? 0.5 : 1,
              }}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
