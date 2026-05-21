import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Search, Database, Map } from 'lucide-react'
import { databasesApi, getErrorMessage } from '../api'
import { useToast } from '../hooks/useToast'
import ProviderBadge from './ProviderBadge'
import ResourceMapModal from './ResourceMapModal'
import { SkeletonTableRows } from './Skeleton'
import type { DatabaseInstance } from '../types'
import {
  Card,
  Flex,
  Heading,
  Text,
  Input,
  Select,
  Button,
  Badge,
  TableContainer,
  Table,
  THead,
  TBody,
  TH,
  TD,
} from './StitchUI'

const ENGINE_COLORS: Record<string, string> = {
  postgres:   '#336791',
  postgresql: '#336791',
  mysql:      '#4479A1',
  mariadb:    '#003545',
  redis:      '#DC382D',
  mongodb:    '#47A248',
  sqlserver:  '#CC2927',
  aurora:     '#FF9900',
}

const STATUS_MAP: Record<string, 'green' | 'red' | 'yellow' | 'gray'> = {
  running:    'green',
  stopped:    'red',
  pending:    'yellow',
  terminated: 'gray',
  unknown:    'gray',
}

function fmt(d?: string) {
  if (!d) return '—'
  return new Date(d).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
}

function EngineChip({ engine }: { engine?: string }) {
  if (!engine) return <Text variant="muted">—</Text>
  const color = ENGINE_COLORS[engine.toLowerCase()] ?? '#8B8AB0'
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 6px',
        borderRadius: '4px',
        fontSize: '10px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.02em',
        color,
        background: color + '12',
        border: `1px solid ${color}30`,
      }}
    >
      {engine}
    </span>
  )
}

export default function DatabasesPage() {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [provider, setProvider] = useState('')
  const [mapTarget, setMapTarget] = useState<DatabaseInstance | null>(null)

  const { data: databases = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['databases', provider],
    queryFn: () => databasesApi.list({ provider: provider || undefined }),
    refetchInterval: 60_000,
  })

  const syncMutation = useMutation({
    mutationFn: () => databasesApi.sync(provider || undefined),
    onSuccess: () => {
      toast.success('Database sync started')
      setTimeout(() => qc.invalidateQueries({ queryKey: ['databases'] }), 4000)
    },
    onError: (error: any) => toast.error(`Sync failed: ${getErrorMessage(error)}`),
  })

  const filtered = databases.filter(db =>
    !search ||
    db.name.toLowerCase().includes(search.toLowerCase()) ||
    db.endpoint?.toLowerCase().includes(search.toLowerCase()) ||
    db.engine?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Flex direction="column" gap={5} className="animate-fade-in">
      {/* Header */}
      <Flex justify="between" align="center">
        <div>
          <Heading level="h1">Databases</Heading>
          <Text variant="muted" style={{ marginTop: '4px' }}>
            Managed database instances across all cloud providers.
          </Text>
        </div>
        <Button
          intent="primary"
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
        >
          <RefreshCw size={14} className={syncMutation.isPending ? 'animate-spin' : ''} />
          Sync All
        </Button>
      </Flex>

      {/* Main content table card */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {/* Toolbar */}
        <Flex
          wrap="true"
          gap={3}
          align="center"
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid var(--bd)',
            backgroundColor: 'var(--bg-s1)',
          }}
        >
          <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--tx3)',
                pointerEvents: 'none',
              }}
            />
            <Input
              type="text"
              placeholder="Search name, endpoint, engine…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: '36px' }}
            />
          </div>

          <div style={{ width: '180px' }}>
            <Select
              value={provider}
              onChange={e => {
                setProvider(e.target.value)
                setSearch('')
              }}
            >
              <option value="">All Providers</option>
              {['aws', 'gcp', 'azure', 'linode', 'digitalocean'].map(p => (
                <option key={p} value={p}>
                  {p.toUpperCase()}
                </option>
              ))}
            </Select>
          </div>

          <Text variant="smallMuted" style={{ marginLeft: 'auto', fontFamily: 'monospace' }}>
            <span style={{ color: 'var(--ac)', fontWeight: 700 }}>{filtered.length}</span> instance
            {filtered.length !== 1 ? 's' : ''} found
          </Text>
        </Flex>

        {/* Table wrapper */}
        <TableContainer style={{ border: 'none', borderRadius: 0, boxShadow: 'none' }}>
          <Table aria-label="Database instances">
            <THead>
              <tr>
                <TH>Name</TH>
                <TH>Provider</TH>
                <TH>Engine</TH>
                <TH>Version</TH>
                <TH>Status</TH>
                <TH>Endpoint</TH>
                <TH style={{ textAlign: 'center' }}>Port</TH>
                <TH style={{ textAlign: 'center' }}>Storage</TH>
                <TH>Type</TH>
                <TH>Last Synced</TH>
                <TH style={{ width: '48px' }}></TH>
              </tr>
            </THead>
            <TBody>
              {isError && (
                <tr>
                  <td colSpan={11} style={{ padding: '64px 24px', textAlign: 'center' }}>
                    <Flex direction="column" align="center" gap={3} style={{ maxWidth: '400px', margin: '0 auto' }}>
                      <Text style={{ fontSize: '24px' }}>⚠️</Text>
                      <Heading level="h4">Failed to fetch databases</Heading>
                      <Text variant="smallMuted">
                        Check backend connectivity or cloud credentials. Details:{' '}
                        {error instanceof Error ? error.message : 'Offline'}
                      </Text>
                      <Button size="sm" onClick={() => refetch()}>
                        Retry Query
                      </Button>
                    </Flex>
                  </td>
                </tr>
              )}

              {isLoading && !isError && <SkeletonTableRows count={6} />}

              {!isLoading && !isError && filtered.length === 0 && (
                <tr>
                  <td colSpan={11} style={{ padding: '80px 24px', textAlign: 'center' }}>
                    <Database size={32} style={{ color: 'var(--tx3)', margin: '0 auto 12px auto', opacity: 0.4 }} />
                    <Text variant="muted">
                      {databases.length === 0
                        ? 'No databases found. Click "Sync All" to fetch from cloud providers.'
                        : 'No databases match your filters.'}
                    </Text>
                  </td>
                </tr>
              )}

              {filtered.map(db => (
                <tr key={db.id}>
                  <TD>
                    <Text style={{ fontWeight: 700 }}>{db.name}</Text>
                    {db.cloud_id && db.cloud_id !== db.name && (
                      <Text variant="smallMuted" style={{ fontFamily: 'monospace', marginTop: '2px' }}>
                        {db.cloud_id}
                      </Text>
                    )}
                  </TD>
                  <TD>
                    <ProviderBadge provider={db.provider} showLogo />
                  </TD>
                  <TD>
                    <EngineChip engine={db.engine} />
                  </TD>
                  <TD>
                    <Text style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                      {db.engine_version ?? '—'}
                    </Text>
                  </TD>
                  <TD>
                    <Badge status={STATUS_MAP[db.status] ?? 'gray'}>{db.status}</Badge>
                  </TD>
                  <TD>
                    <Text style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                      {db.endpoint ?? '—'}
                    </Text>
                  </TD>
                  <TD style={{ textAlign: 'center' }}>
                    <Text style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                      {db.port ?? '—'}
                    </Text>
                  </TD>
                  <TD style={{ textAlign: 'center' }}>
                    <Text style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                      {db.storage_gb != null ? `${db.storage_gb} GB` : '—'}
                    </Text>
                  </TD>
                  <TD>
                    <Text variant="smallMuted" style={{ fontFamily: 'monospace' }}>
                      {db.instance_type ?? '—'}
                    </Text>
                  </TD>
                  <TD>
                    <Text variant="smallMuted" style={{ fontFamily: 'monospace' }}>
                      {fmt(db.last_synced)}
                    </Text>
                  </TD>
                  <TD>
                    <Button
                      size="sm"
                      intent="ghost"
                      onClick={() => setMapTarget(db)}
                      style={{ padding: '6px' }}
                      title="Resource Map"
                    >
                      <Map size={14} />
                    </Button>
                  </TD>
                </tr>
              ))}
            </TBody>
          </Table>
        </TableContainer>
      </Card>

      {mapTarget && (
        <ResourceMapModal
          resourceId={mapTarget.id}
          resourceType="database"
          resourceName={mapTarget.name}
          provider={mapTarget.provider}
          region={mapTarget.region}
          onClose={() => setMapTarget(null)}
        />
      )}
    </Flex>
  )
}
