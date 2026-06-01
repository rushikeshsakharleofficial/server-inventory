import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Globe, Lock, Wifi } from 'lucide-react'
import { serversApi } from '../api'
import type { Server } from '../types'
import ProviderBadge from './ProviderBadge'
import {
  Card, Flex, Text, Input, Select,
  TableContainer, Table, THead, TH, TBody, TD,
} from './StitchUI'

interface IpRow {
  ip: string
  type: 'public' | 'private' | 'interface'
  server: Server
  version: 4 | 6
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

export default function IpsPage() {
  const [search, setSearch]     = useState('')
  const [typeFilter, setTypeFilter] = useState<'' | 'public' | 'private' | 'interface'>('')
  const [versionFilter, setVersionFilter] = useState<'' | '4' | '6'>('')

  const { data: servers = [], isLoading, isError } = useQuery({
    queryKey: ['servers'],
    queryFn: () => serversApi.list(),
    staleTime: 30_000,
  })

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
          const clean = ip.split('/')[0]
          const type: IpRow['type'] = clean === srv.public_ip
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

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (search && !r.ip.includes(search) && !r.server.name.toLowerCase().includes(search.toLowerCase())) return false
      if (typeFilter && r.type !== typeFilter) return false
      if (versionFilter && String(r.version) !== versionFilter) return false
      return true
    })
  }, [rows, search, typeFilter, versionFilter])

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
      </Flex>

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
            {filtered.map((row, i) => (
              <tr key={`${row.server.id}-${row.ip}-${i}`}>
                <TD>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: typeColor(row.type) }}>
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
    </div>
  )
}
