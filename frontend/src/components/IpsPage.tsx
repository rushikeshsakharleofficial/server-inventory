import { useMemo, useState, useRef, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, Globe, Lock, Wifi, RefreshCw } from 'lucide-react'
import { http, sshCredentialsApi } from '../api'
import { useToast } from '../hooks/useToast'
import type { Server } from '../types'
import ProviderBadge from './ProviderBadge'
import {
  Card, Flex, Text, Input, Select, Button,
  TableContainer, Table, THead, TH, TBody, TD,
} from './StitchUI'

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

export default function IpsPage({ onServerClick }: { onServerClick?: (server: Server) => void }) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [search, setSearch]         = useState('')
  const [typeFilter, setTypeFilter] = useState<'' | 'public' | 'private' | 'interface'>('')
  const [versionFilter, setVersionFilter] = useState<'' | '4' | '6'>('')
  const [selectedCredId, setSelectedCredId] = useState<string>('')
  const [page, setPage] = useState(1)
  const [fetching, setFetching]     = useState(false)
  const [streamResults, setStreamResults] = useState<StreamResult[]>([])
  const abortRef = useRef<AbortController | null>(null)

  const { data: sshCreds = [] } = useQuery({
    queryKey: ['ssh-credentials'],
    queryFn: sshCredentialsApi.list,
    staleTime: 60_000,
  })

  const { data: servers = [], isLoading, isError } = useQuery<Server[]>({
    queryKey: ['servers'],
    queryFn: () => http.get<Server[]>('/api/servers').then(r => r.data),
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

  // Listen to WS ip_fetch_result events from other clients / shared state
  useEffect(() => {
    const handler = (e: Event) => {
      const event = (e as CustomEvent<{ type: string; server_name?: string; ips?: string[]; success?: boolean }>).detail
      if (event.type === 'ip_fetch_result' && event.success && !fetching) {
        // Another session or background fetch completed — refresh server list
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

      // SSH-gathered IPs take priority — most complete
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
    [filtered, page, PAGE_SIZE],
  )

  const TypeIcon = ({ type }: { type: IpRow['type'] }) => {
    if (type === 'public')    return <Globe    size={12} style={{ color: 'var(--ac)',  flexShrink: 0 }} />
    if (type === 'private')   return <Lock     size={12} style={{ color: 'var(--tx3)', flexShrink: 0 }} />
    return                           <Wifi     size={12} style={{ color: 'var(--sg)',  flexShrink: 0 }} />
  }

  const typeColor = (type: IpRow['type']) => {
    if (type === 'public')  return 'var(--ac)'
    if (type === 'private') return 'var(--tx3)'
    return 'var(--sg)'
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <Flex justify="between" align="center">
        <div>
          <h2 style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', fontStyle: 'italic', fontSize: '1.5rem', fontWeight: 600, margin: 0, color: 'var(--tx1)' }}>
            IP Addresses
          </h2>
          <Text variant="muted" style={{ marginTop: '2px' }}>
            {isLoading ? 'Loading…' : `${filtered.length} addresses across ${servers.length} servers`}
          </Text>
        </div>
        <Flex align="center" gap={2}>
          <select
            value={selectedCredId}
            onChange={e => setSelectedCredId(e.target.value)}
            style={{
              background: 'var(--bg-s2)', border: '1px solid var(--bd)',
              borderRadius: '2px', color: 'var(--tx1)', padding: '0.4rem 0.65rem',
              fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', cursor: 'pointer',
              minWidth: '160px',
            }}
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
          disabled={false}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '0.45rem 0.9rem',
            background: 'var(--ac)', color: 'var(--btn-primary-fg)',
            border: 'none', borderRadius: '2px', cursor: 'pointer',
            fontSize: '13px', fontWeight: 600, letterSpacing: '0.02em',
            opacity: fetching ? 0.85 : 1,
            transition: 'all 140ms ease',
          }}
        >
          <RefreshCw size={13} style={{ animation: fetching ? 'spin 1s linear infinite' : 'none' }} />
          {fetching ? `Fetching… (${streamResults.length})` : 'Fetch via SSH'}
        </button>
        </Flex>
      </Flex>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Filters */}
      <Card style={{ padding: '14px 16px' }}>
        <Flex gap={3} wrap>
          <div style={{ flex: '1 1 220px' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--tx3)', pointerEvents: 'none' }} />
              <Input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search IP or server name…"
                style={{ paddingLeft: '32px' }}
              />
            </div>
          </div>
          <div style={{ flex: '0 0 160px' }}>
            <Select value={typeFilter} onChange={e => setTypeFilter(e.target.value as typeof typeFilter)}>
              <option value="">All types</option>
              <option value="public">Public</option>
              <option value="private">Private</option>
              <option value="interface">Interface</option>
            </Select>
          </div>
          <div style={{ flex: '0 0 130px' }}>
            <Select value={versionFilter} onChange={e => setVersionFilter(e.target.value as typeof versionFilter)}>
              <option value="">IPv4 + IPv6</option>
              <option value="4">IPv4 only</option>
              <option value="6">IPv6 only</option>
            </Select>
          </div>
        </Flex>
      </Card>

      {/* Table */}
      <TableContainer>
        <Table>
          <THead>
            <tr>
              <TH>IP Address</TH>
              <TH>Type</TH>
              <TH>Version</TH>
              <TH>Server</TH>
              <TH>Provider</TH>
              <TH>Status</TH>
            </tr>
          </THead>
          <TBody>
            {isLoading && (
              <tr>
                <TD colSpan={6} style={{ textAlign: 'center', color: 'var(--tx3)', padding: '2.5rem' }}>
                  Loading…
                </TD>
              </tr>
            )}
            {isError && (
              <tr>
                <TD colSpan={6} style={{ textAlign: 'center', color: 'var(--sr)', padding: '2.5rem' }}>
                  Failed to load servers
                </TD>
              </tr>
            )}
            {!isLoading && !isError && filtered.length === 0 && (
              <tr>
                <TD colSpan={6} style={{ textAlign: 'center', color: 'var(--tx3)', padding: '2.5rem' }}>
                  No IPs found. Run a sync or SSH sync to populate.
                </TD>
              </tr>
            )}
            {/* Live stream results shown while fetching */}
            {fetching && streamResults.map(result =>
              result.ips.map((ip, j) => (
                <tr key={`stream-${result.server_id}-${ip}-${j}`} style={{ opacity: 0.75, background: 'var(--ac-bg)' }}>
                  <TD>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: 'var(--ac)' }}>{ip.split('/')[0] ?? ip}</span>
                  </TD>
                  <TD><span style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', color: 'var(--tx3)' }}>live</span></TD>
                  <TD><span style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', color: 'var(--tx3)' }}>IPv{ip.includes(':') ? 6 : 4}</span></TD>
                  <TD><span style={{ fontSize: '13px', color: 'var(--tx1)' }}>{result.server_name}</span></TD>
                  <TD><span style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', color: 'var(--tx3)' }}>{result.provider}</span></TD>
                  <TD />
                </tr>
              ))
            )}
            {pageRows.map((row, i) => (
              <tr key={`${row.server.id}-${row.ip}-${i}`}>
                <TD>
                  <span
                    onClick={() => onServerClick?.(row.server)}
                    style={{
                      fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: typeColor(row.type),
                      cursor: onServerClick ? 'pointer' : 'default',
                      textDecoration: onServerClick ? 'underline' : 'none',
                      textDecorationStyle: 'dotted',
                      textUnderlineOffset: '3px',
                    }}
                    title={onServerClick ? `Open server: ${row.server.name}` : undefined}
                  >
                    {row.ip}
                  </span>
                </TD>
                <TD>
                  <Flex align="center" gap={1}>
                    <TypeIcon type={row.type} />
                    <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'JetBrains Mono, monospace', color: typeColor(row.type) }}>
                      {row.type}
                    </span>
                  </Flex>
                </TD>
                <TD>
                  <span style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', color: 'var(--tx3)' }}>
                    IPv{row.version}
                  </span>
                </TD>
                <TD>
                  <span style={{ fontSize: '13px', color: 'var(--tx1)' }}>{row.server.name}</span>
                </TD>
                <TD>
                  <ProviderBadge provider={row.server.provider} showLogo />
                </TD>
                <TD>
                  <Flex align="center" gap={2}>
                    <span style={{
                      display: 'inline-block',
                      width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
                      backgroundColor: row.server.status === 'running' ? 'var(--sg)' : row.server.status === 'stopped' ? 'var(--sgr)' : 'var(--sy)',
                    }} />
                    <span style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {row.server.status}
                    </span>
                  </Flex>
                </TD>
              </tr>
            ))}
          </TBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      {(
        <Flex
          align="center"
          justify="between"
          style={{
            padding: '12px 24px',
            borderTop: '1px solid var(--bd)',
            backgroundColor: 'var(--bg-s1)',
            borderRadius: '0 0 4px 4px',
            border: '1px solid var(--bd)',
            borderTopColor: 'transparent',
          }}
        >
          <Text variant="small" style={{ fontFamily: 'monospace' }}>
            Page {page} of {Math.max(1, totalPages)} · {filtered.length} total
          </Text>
          <Flex align="center" gap={1}>
            <Button
              intent="ghost"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              size="sm"
              style={{ padding: '6px 12px' }}
            >
              Prev
            </Button>
            {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => {
              const p = i + 1
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  style={{
                    width: '32px', height: '32px',
                    borderRadius: '2px', border: 'none',
                    cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                    transition: 'all 150ms ease',
                    backgroundColor: page === p ? 'var(--ac)' : 'transparent',
                    color: page === p ? 'var(--btn-primary-fg)' : 'var(--tx2)',
                  }}
                  onMouseEnter={e => {
                    if (page !== p) e.currentTarget.style.backgroundColor = 'var(--bg-s3)'
                  }}
                  onMouseLeave={e => {
                    if (page !== p) e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                >
                  {p}
                </button>
              )
            })}
            <Button
              intent="ghost"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= Math.max(1, totalPages)}
              size="sm"
              style={{ padding: '6px 12px' }}
            >
              Next
            </Button>
          </Flex>
        </Flex>
      )}
    </div>
  )
}
