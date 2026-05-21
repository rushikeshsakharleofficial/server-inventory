import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Search, Box, Cpu, Map } from 'lucide-react'
import { kubernetesApi, getErrorMessage } from '../api'
import { useToast } from '../hooks/useToast'
import ProviderBadge from './ProviderBadge'
import ResourceMapModal from './ResourceMapModal'
import { SkeletonTableRows } from './Skeleton'
import type { KubernetesCluster } from '../types'
import {
  Card,
  Flex,
  Grid,
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

export default function KubernetesPage() {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [provider, setProvider] = useState('')
  const [mapTarget, setMapTarget] = useState<KubernetesCluster | null>(null)

  const { data: clusters = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['kubernetes', provider],
    queryFn: () => kubernetesApi.list({ provider: provider || undefined }),
    refetchInterval: 60_000,
  })

  const syncMutation = useMutation({
    mutationFn: () => kubernetesApi.sync(provider || undefined),
    onSuccess: () => {
      toast.success('Kubernetes sync started')
      setTimeout(() => qc.invalidateQueries({ queryKey: ['kubernetes'] }), 4000)
    },
    onError: (error: unknown) => toast.error(`Sync failed: ${getErrorMessage(error)}`),
  })

  const filtered = clusters.filter(c =>
    !search ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.region?.toLowerCase().includes(search.toLowerCase()) ||
    c.version?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Flex direction="column" gap={5} className="animate-fade-in">
      {/* Header */}
      <Flex justify="between" align="center">
        <div>
          <Heading level="h1">Kubernetes</Heading>
          <Text variant="muted" style={{ marginTop: '4px' }}>
            Managed cluster fleet across EKS, GKE, AKS, DOKS and LKE.
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

      {/* Stats mini row */}
      {!isLoading && clusters.length > 0 && (
        <Grid columns={{ '@initial': 2, '@md': 4 }} gap={4}>
          {[
            { label: 'Total Clusters', value: clusters.length },
            { label: 'Running',  value: clusters.filter(c => c.status === 'running').length,  color: 'var(--sg)' },
            { label: 'Pending',  value: clusters.filter(c => c.status === 'pending').length,  color: 'var(--sy)' },
            { label: 'Total Nodes', value: clusters.reduce((s, c) => s + (c.node_count ?? 0), 0) },
          ].map(stat => (
            <Card key={stat.label} style={{ padding: '16px' }}>
              <Text variant="label" style={{ fontSize: '10px' }}>{stat.label}</Text>
              <Text
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '28px',
                  fontWeight: 800,
                  fontVariantNumeric: 'tabular-nums',
                  marginTop: '8px',
                  color: stat.color ?? 'var(--tx1)',
                }}
              >
                {stat.value}
              </Text>
            </Card>
          ))}
        </Grid>
      )}

      {/* Table card */}
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
              placeholder="Search cluster name, region…"
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
            <span style={{ color: 'var(--ac)', fontWeight: 700 }}>{filtered.length}</span> cluster
            {filtered.length !== 1 ? 's' : ''} found
          </Text>
        </Flex>

        {/* Table container */}
        <TableContainer style={{ border: 'none', borderRadius: 0, boxShadow: 'none' }}>
          <Table aria-label="Kubernetes clusters">
            <THead>
              <tr>
                <TH>Cluster Name</TH>
                <TH>Provider</TH>
                <TH>Region</TH>
                <TH>K8s Version</TH>
                <TH>Status</TH>
                <TH style={{ textAlign: 'center' }}>Nodes</TH>
                <TH>Endpoint</TH>
                <TH>Last Synced</TH>
                <TH style={{ width: '48px' }}></TH>
              </tr>
            </THead>
            <TBody>
              {isError && (
                <tr>
                  <td colSpan={9} style={{ padding: '64px 24px', textAlign: 'center' }}>
                    <Flex direction="column" align="center" gap={3} style={{ maxWidth: '400px', margin: '0 auto' }}>
                      <Text style={{ fontSize: '24px' }}>⚠️</Text>
                      <Heading level="h4">Failed to fetch clusters</Heading>
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

              {isLoading && !isError && <SkeletonTableRows count={5} />}

              {!isLoading && !isError && filtered.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ padding: '80px 24px', textAlign: 'center' }}>
                    <Box size={32} style={{ color: 'var(--tx3)', margin: '0 auto 12px auto', opacity: 0.4 }} />
                    <Text variant="muted">
                      {clusters.length === 0
                        ? 'No clusters found. Click "Sync All" to fetch from cloud providers.'
                        : 'No clusters match your filters.'}
                    </Text>
                  </td>
                </tr>
              )}

              {filtered.map(cluster => (
                <tr key={cluster.id}>
                  <TD>
                    <Text style={{ fontWeight: 700 }}>{cluster.name}</Text>
                    {cluster.cloud_id && cluster.cloud_id !== cluster.name && (
                      <Text
                        variant="smallMuted"
                        style={{
                          fontFamily: 'monospace',
                          marginTop: '2px',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                          maxWidth: '220px',
                        }}
                      >
                        {cluster.cloud_id}
                      </Text>
                    )}
                  </TD>
                  <TD>
                    <ProviderBadge provider={cluster.provider} showLogo />
                  </TD>
                  <TD>
                    <Text style={{ fontSize: '13px' }}>{cluster.region ?? '—'}</Text>
                  </TD>
                  <TD>
                    <Text style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                      {cluster.version ? `v${cluster.version}` : '—'}
                    </Text>
                  </TD>
                  <TD>
                    <Badge status={STATUS_MAP[cluster.status] ?? 'gray'}>{cluster.status}</Badge>
                  </TD>
                  <TD style={{ textAlign: 'center' }}>
                    <Flex align="center" justify="center" gap={1}>
                      <Cpu size={12} style={{ color: 'var(--tx3)' }} />
                      <Text style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                        {cluster.node_count ?? '—'}
                      </Text>
                    </Flex>
                  </TD>
                  <TD>
                    <Text
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '12px',
                        textOverflow: 'ellipsis',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        maxWidth: '180px',
                      }}
                    >
                      {cluster.endpoint ?? '—'}
                    </Text>
                  </TD>
                  <TD>
                    <Text variant="smallMuted" style={{ fontFamily: 'monospace' }}>
                      {fmt(cluster.last_synced)}
                    </Text>
                  </TD>
                  <TD>
                    <Button
                      size="sm"
                      intent="ghost"
                      onClick={() => setMapTarget(cluster)}
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
          resourceType="kubernetes"
          resourceName={mapTarget.name}
          provider={mapTarget.provider}
          region={mapTarget.region}
          onClose={() => setMapTarget(null)}
        />
      )}
    </Flex>
  )
}
