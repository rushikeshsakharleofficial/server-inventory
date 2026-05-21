import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Search, HardDrive, X, Server } from 'lucide-react'
import { blockStoragesApi, getErrorMessage } from '../api'
import { useToast } from '../hooks/useToast'
import ProviderBadge from './ProviderBadge'
import { SkeletonTableRows } from './Skeleton'
import type { BlockStorage } from '../types'
import { styled } from '../stitches.config'
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

const STATUS_MAP: Record<string, 'green' | 'red' | 'yellow' | 'gray'> = {
  running:    'green',
  'in-use':   'green',
  available:  'yellow',
  stopped:    'red',
  pending:    'yellow',
  terminated: 'gray',
  unknown:    'gray',
}

// ── Styled Split Layout ────────────────────────────────────────────────────
const SplitPane = styled('div', {
  display: 'flex',
  flexDirection: 'column',
  gap: '$5',
  width: '100%',
  alignItems: 'stretch',
  '@lg': {
    flexDirection: 'row',
  },
});

const TablePane = styled('div', {
  flex: 1,
  minWidth: 0,
});

const DetailPane = styled('div', {
  width: '100%',
  flexShrink: 0,
  '@lg': {
    width: '400px',
    position: 'sticky',
    top: '0px',
    height: 'calc(100vh - 102px)',
    overflow: 'hidden',
  },
});

const DetailCard = styled(Card, {
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  padding: '0 !important',
  overflow: 'hidden',
  border: '1px solid $border',
});

const DetailHeader = styled('div', {
  padding: '18px 24px',
  borderBottom: '1px solid $border',
  backgroundColor: '$bgS1',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
});

const DetailBody = styled('div', {
  padding: '24px',
  overflowY: 'auto',
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: '20px',
});

const MetaRow = styled('div', {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '10px 0',
  borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
  fontSize: '$sm',
});

const TagBadge = styled('span', {
  padding: '2px 8px',
  borderRadius: '4px',
  fontSize: '11px',
  backgroundColor: 'rgba(255, 255, 255, 0.05)',
  border: '1px solid $border',
  color: '$tx2',
});

// Stats Grid
const StatsGrid = styled('div', {
  display: 'grid',
  gridTemplateColumns: 'repeat(1, 1fr)',
  gap: '$4',
  width: '100%',
  marginBottom: '$2',
  '@sm': {
    gridTemplateColumns: 'repeat(2, 1fr)',
  },
  '@lg': {
    gridTemplateColumns: 'repeat(4, 1fr)',
  },
});

const StatCard = styled(Card, {
  display: 'flex',
  flexDirection: 'column',
  gap: '$1',
  position: 'relative',
  overflow: 'hidden',
  '&::after': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    width: '4px',
    height: '100%',
    backgroundColor: '$accent',
    opacity: 0.6,
  },
});

function fmt(d?: string) {
  if (!d) return '—'
  return new Date(d).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
}

export default function BlockStoragePage() {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [provider, setProvider] = useState('')
  const [selectedVol, setSelectedVol] = useState<BlockStorage | null>(null)

  const { data: volumes = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['block-storages', provider],
    queryFn: () => blockStoragesApi.list({ provider: provider || undefined }),
    refetchInterval: 60_000,
  })

  const syncMutation = useMutation({
    mutationFn: () => blockStoragesApi.sync(provider || undefined),
    onSuccess: () => {
      toast.success('Block Storage sync started')
      setTimeout(() => qc.invalidateQueries({ queryKey: ['block-storages'] }), 4000)
    },
    onError: (err: any) => toast.error(`Sync failed: ${getErrorMessage(err)}`),
  })

  const filtered = volumes.filter(vol =>
    !search ||
    vol.name.toLowerCase().includes(search.toLowerCase()) ||
    vol.cloud_id?.toLowerCase().includes(search.toLowerCase()) ||
    vol.volume_type?.toLowerCase().includes(search.toLowerCase()) ||
    vol.attachment?.toLowerCase().includes(search.toLowerCase())
  )

  // Compute stats
  const totalCount = volumes.length
  const totalCapacity = volumes.reduce((sum, v) => sum + (v.size_gb || 0), 0)
  const attachedCount = volumes.filter(v => v.attachment || v.status === 'in-use' || v.status === 'running').length
  const unattachedCount = totalCount - attachedCount

  const handleRowClick = (vol: BlockStorage) => {
    setSelectedVol(selectedVol?.id === vol.id ? null : vol)
  }

  const renderTable = (compact: boolean) => (
    <TableContainer style={{ border: 'none', borderRadius: 0, boxShadow: 'none' }}>
      <Table aria-label="Block storage volumes" style={{ tableLayout: 'fixed', width: '100%' }}>
        <THead>
          <tr>
            <TH style={{ width: compact ? '40%' : '25%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Name</TH>
            <TH style={{ width: compact ? '20%' : '12%' }}>Provider</TH>
            <TH style={{ width: compact ? '20%' : '10%', textAlign: 'right' }}>Size</TH>
            <TH style={{ width: compact ? '20%' : '12%' }}>Status</TH>
            {!compact && (
              <>
                <TH style={{ width: '18%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Attachment</TH>
                <TH style={{ width: '13%' }}>Type</TH>
                <TH style={{ width: '10%' }}>Region</TH>
              </>
            )}
          </tr>
        </THead>
        <TBody>
          {isError && (
            <tr>
              <td colSpan={compact ? 4 : 7} style={{ padding: '64px 24px', textAlign: 'center' }}>
                <Flex direction="column" align="center" gap={3} style={{ maxWidth: '400px', margin: '0 auto' }}>
                  <Text style={{ fontSize: '24px' }}>⚠️</Text>
                  <Heading level="h4">Failed to fetch volumes</Heading>
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
              <td colSpan={compact ? 4 : 7} style={{ padding: '80px 24px', textAlign: 'center' }}>
                <HardDrive size={32} style={{ color: 'var(--tx3)', margin: '0 auto 12px auto', opacity: 0.4 }} />
                <Text variant="muted">
                  {volumes.length === 0
                    ? 'No block storage volumes found. Click "Sync All" to fetch from providers.'
                    : 'No volumes match your filters.'}
                </Text>
              </td>
            </tr>
          )}

          {filtered.map(vol => {
            const isSelected = selectedVol?.id === vol.id
            const isAttached = !!vol.attachment || vol.status === 'in-use' || vol.status === 'running'
            return (
              <tr
                key={vol.id}
                onClick={() => handleRowClick(vol)}
                style={{
                  cursor: 'pointer',
                  backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.02)' : undefined,
                  transition: 'background-color 150ms ease',
                }}
              >
                <TD style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <Text style={{ fontWeight: 700, color: isSelected ? 'var(--ac)' : 'inherit' }}>
                    {vol.name}
                  </Text>
                  {!compact && vol.cloud_id && vol.cloud_id !== vol.name && (
                    <Text
                      variant="smallMuted"
                      style={{
                        fontFamily: 'monospace',
                        marginTop: '2px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        display: 'block'
                      }}
                    >
                      {vol.cloud_id}
                    </Text>
                  )}
                </TD>
                <TD>
                  <ProviderBadge provider={vol.provider} showLogo />
                </TD>
                <TD style={{ textAlign: 'right', fontWeight: 600 }}>
                  {vol.size_gb != null ? `${vol.size_gb} GB` : '—'}
                </TD>
                <TD>
                  <Badge status={STATUS_MAP[vol.status] ?? 'gray'}>
                    {vol.status === 'in-use' ? 'attached' : vol.status}
                  </Badge>
                </TD>
                {!compact && (
                  <>
                    <TD style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {isAttached ? (
                        <Flex align="center" gap={1}>
                          <Server size={12} style={{ color: 'var(--tx3)' }} />
                          <Text style={{ fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {vol.attachment || 'Attached'}
                          </Text>
                        </Flex>
                      ) : (
                        <Text variant="muted">—</Text>
                      )}
                    </TD>
                    <TD>
                      <span
                        style={{
                          fontSize: '11px',
                          textTransform: 'uppercase',
                          fontWeight: 700,
                          opacity: 0.8,
                          fontFamily: 'monospace',
                        }}
                      >
                        {vol.volume_type ?? 'standard'}
                      </span>
                    </TD>
                    <TD>
                      <Text variant="smallMuted" style={{ fontFamily: 'monospace' }}>
                        {vol.region ?? '—'}
                      </Text>
                    </TD>
                  </>
                )}
              </tr>
            )
          })}
        </TBody>
      </Table>
    </TableContainer>
  )

  return (
    <Flex direction="column" gap={5} className="animate-fade-in" style={{ width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <Flex justify="between" align="center" wrap="true" gap={3}>
        <div>
          <Heading level="h1">Block Storage</Heading>
          <Text variant="muted" style={{ marginTop: '4px' }}>
            Multi-cloud block volumes and storage discs mapping.
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

      {/* Stats Grid */}
      <StatsGrid>
        <StatCard>
          <Text variant="muted" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
            Total Volumes
          </Text>
          <Text style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px' }}>{totalCount}</Text>
        </StatCard>
        <StatCard css={{ '&::after': { backgroundColor: '#10B981' } }}>
          <Text variant="muted" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
            Total Capacity
          </Text>
          <Text style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px' }}>
            {totalCapacity >= 1024 ? `${(totalCapacity / 1024).toFixed(2)} TB` : `${totalCapacity.toFixed(0)} GB`}
          </Text>
        </StatCard>
        <StatCard css={{ '&::after': { backgroundColor: '#3B82F6' } }}>
          <Text variant="muted" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
            Attached
          </Text>
          <Text style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px', color: '#60A5FA' }}>{attachedCount}</Text>
        </StatCard>
        <StatCard css={{ '&::after': { backgroundColor: '#F59E0B' } }}>
          <Text variant="muted" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
            Unattached
          </Text>
          <Text style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px', color: '#FBBF24' }}>{unattachedCount}</Text>
        </StatCard>
      </StatsGrid>

      {/* Split Pane Layout */}
      <SplitPane>
        <TablePane>
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
              <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
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
                  placeholder="Search name, attachment, type…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ paddingLeft: '36px' }}
                />
              </div>

              <div style={{ width: '160px' }}>
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
                <span style={{ color: 'var(--ac)', fontWeight: 700 }}>{filtered.length}</span> vol
                {filtered.length !== 1 ? 's' : ''} found
              </Text>
            </Flex>

            {/* Table */}
            {renderTable(!!selectedVol)}
          </Card>
        </TablePane>

        {selectedVol && (
          <DetailPane className="animate-fade-in">
            <DetailCard>
              <DetailHeader>
                <Flex align="center" gap={2}>
                  <HardDrive size={16} style={{ color: 'var(--ac)' }} />
                  <div>
                    <Heading level="h4" style={{ margin: 0 }}>Volume Details</Heading>
                    <Text variant="smallMuted" style={{ fontSize: '11px' }}>ID: {selectedVol.id}</Text>
                  </div>
                </Flex>
                <Button
                  size="sm"
                  intent="ghost"
                  onClick={() => setSelectedVol(null)}
                  style={{ padding: '4px' }}
                >
                  <X size={14} />
                </Button>
              </DetailHeader>

              <DetailBody>
                {/* Volume Basic Info */}
                <Flex direction="column" gap={1}>
                  <Text variant="muted" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700 }}>Name</Text>
                  <Heading level="h3" style={{ margin: 0, wordBreak: 'break-all' }}>{selectedVol.name}</Heading>
                </Flex>

                {/* Capacity Gauge */}
                <Card style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <Flex justify="between" align="center">
                    <Text variant="muted" style={{ fontWeight: 600 }}>Capacity</Text>
                    <Text style={{ fontSize: '18px', fontWeight: 800, color: 'var(--ac)' }}>{selectedVol.size_gb} GB</Text>
                  </Flex>
                  <div style={{ height: '6px', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, (selectedVol.size_gb || 0) / 10)}%`, backgroundColor: 'var(--ac)', borderRadius: '3px' }}></div>
                  </div>
                </Card>

                {/* Core Parameters */}
                <div>
                  <Text variant="muted" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, marginBottom: '8px', display: 'block' }}>Properties</Text>
                  <MetaRow>
                    <Text variant="muted">Provider</Text>
                    <ProviderBadge provider={selectedVol.provider} showLogo />
                  </MetaRow>
                  <MetaRow>
                    <Text variant="muted">Status</Text>
                    <Badge status={STATUS_MAP[selectedVol.status] ?? 'gray'}>{selectedVol.status}</Badge>
                  </MetaRow>
                  <MetaRow>
                    <Text variant="muted">Volume Type</Text>
                    <Text style={{ fontFamily: 'monospace', textTransform: 'uppercase' }}>{selectedVol.volume_type ?? 'standard'}</Text>
                  </MetaRow>
                  <MetaRow>
                    <Text variant="muted">Region</Text>
                    <Text style={{ fontFamily: 'monospace' }}>{selectedVol.region ?? '—'}</Text>
                  </MetaRow>
                  <MetaRow>
                    <Text variant="muted">Cloud ID</Text>
                    <Text style={{ fontFamily: 'monospace', fontSize: '11px', maxWidth: '240px', wordBreak: 'break-all', textAlign: 'right' }}>
                      {selectedVol.cloud_id ?? '—'}
                    </Text>
                  </MetaRow>
                </div>

                {/* Attachment Status */}
                <Card style={{ borderLeft: '3px solid var(--ac)', padding: '16px', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                  <Flex direction="column" gap={2}>
                    <Text variant="muted" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700 }}>Attachment Status</Text>
                    {selectedVol.attachment ? (
                      <Flex align="center" gap={2} style={{ marginTop: '4px' }}>
                        <Server size={14} style={{ color: 'var(--ac)' }} />
                        <Text style={{ fontWeight: 700 }}>{selectedVol.attachment}</Text>
                      </Flex>
                    ) : (
                      <Text style={{ fontWeight: 600, color: 'var(--tx3)' }}>Unattached / Available</Text>
                    )}
                  </Flex>
                </Card>

                {/* Tags Section */}
                {selectedVol.tags && Object.keys(selectedVol.tags).length > 0 && (
                  <div>
                    <Text variant="muted" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, marginBottom: '8px', display: 'block' }}>Labels / Tags</Text>
                    <Flex wrap="true" gap={1} style={{ marginTop: '6px' }}>
                      {Object.entries(selectedVol.tags).map(([k, v]) => (
                        <TagBadge key={k}>
                          {k === v ? k : `${k}: ${v}`}
                        </TagBadge>
                      ))}
                    </Flex>
                  </div>
                )}

                {/* Extra Details */}
                {selectedVol.extra && Object.keys(selectedVol.extra).length > 0 && (
                  <div>
                    <Text variant="muted" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, marginBottom: '8px', display: 'block' }}>Cloud Metadata</Text>
                    {Object.entries(selectedVol.extra)
                      .filter(([_, val]) => val !== null && val !== '')
                      .map(([k, val]) => (
                        <MetaRow key={k}>
                          <Text variant="muted" style={{ fontSize: '12px' }}>{k.replace(/_/g, ' ')}</Text>
                          <Text style={{ fontFamily: 'monospace', fontSize: '12px', maxWidth: '240px', wordBreak: 'break-all', textAlign: 'right' }}>
                            {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                          </Text>
                        </MetaRow>
                      ))}
                  </div>
                )}

                {/* Sync Date */}
                <Text variant="smallMuted" style={{ marginTop: 'auto', textAlign: 'center', fontSize: '11px' }}>
                  Last synced: {fmt(selectedVol.last_synced)}
                </Text>
              </DetailBody>
            </DetailCard>
          </DetailPane>
        )}
      </SplitPane>
    </Flex>
  )
}
