import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, RefreshCw, AlertCircle, Shield, Network, Cpu, HardDrive, Globe, Tag } from 'lucide-react'
import { styled } from '../stitches.config'
import { resourceMapApi } from '../api'
import { Card, Button, Flex, Grid, Heading, Text } from './StitchUI'

type ResourceType = 'server' | 'database' | 'kubernetes'

interface MapNode { id: string; type: string; category: string; label: string; properties: Record<string, unknown> }
interface MapEdge { from: string; to: string; label: string }
interface ResourceMap {
  resource: { id: number; name: string; type: string; provider: string; region?: string }
  nodes: MapNode[]
  edges: MapEdge[]
}

interface Props {
  resourceId: number; resourceType: ResourceType
  resourceName: string; provider: string; region?: string
  onClose: () => void
}

const CATEGORY_CFG: Record<string, { label: string; Icon: React.ElementType; color: string; bg: string }> = {
  network:           { label: 'Network',      Icon: Network,   color: '#00D4FF', bg: 'rgba(0,212,255,0.08)'   },
  security:          { label: 'Security',     Icon: Shield,    color: '#EF4444', bg: 'rgba(239,68,68,0.08)'   },
  iam:               { label: 'IAM',          Icon: Cpu,       color: '#EAB308', bg: 'rgba(234,179,8,0.08)'   },
  compute:           { label: 'Compute',      Icon: Cpu,       color: '#8B5CF6', bg: 'rgba(139,92,246,0.08)'  },
  storage:           { label: 'Storage',      Icon: HardDrive, color: '#F97316', bg: 'rgba(249,115,22,0.08)'  },
  config:            { label: 'Config',       Icon: Globe,     color: '#6B7280', bg: 'rgba(107,114,128,0.08)' },
  meta:              { label: 'Tags / Meta',  Icon: Tag,       color: '#8B8AB0', bg: 'rgba(139,138,176,0.08)' },
  availability_zone: { label: 'Availability', Icon: Globe,     color: '#22C55E', bg: 'rgba(34,197,94,0.08)'   },
}

const NODE_ICON: Record<string, string> = {
  vpc:'🌐', vpc_network:'🌐', vnet:'🌐',
  subnet:'📡', subnetwork:'📡',
  security_group:'🛡️', nsg:'🛡️', firewall:'🔥', firewall_rule:'🔥',
  nat_gateway:'🔀', elastic_ip:'📍', public_ip:'📍', floating_ip:'📍',
  external_ip:'📍', private_ip:'🔒', network_interface:'🔌', nic:'🔌',
  load_balancer:'⚖️', route_table:'🗺️',
  iam_profile:'👤', iam_role:'👤', service_account:'👤',
  managed_identity:'👤', oidc_provider:'🔑', workload_identity:'🔑',
  autoscaling_group:'📈', node_group:'📦', node_pool:'📦',
  key_pair:'🔑', disk:'💾', subnet_group:'📋',
  parameter_group:'⚙️', addon:'🧩', read_replica:'📋',
  availability_zone:'🌍', tag:'🏷️', vlan:'🔗',
  maintenance_policy:'📅', backup:'🗄️',
}

const ModalBackdrop = styled('div', {
  position: 'fixed',
  inset: 0,
  zIndex: 60,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '$4',
  backgroundColor: 'rgba(0, 0, 0, 0.72)',
  backdropFilter: 'blur(6px)',
  animation: 'fadeIn 200ms ease-out',
  '@keyframes fadeIn': {
    from: { opacity: 0 },
    to: { opacity: 1 },
  },
});

const ModalContent = styled(Card, {
  width: '100%',
  maxWidth: '1024px',
  maxHeight: '92vh',
  display: 'flex',
  flexDirection: 'column',
  padding: 0,
  overflow: 'hidden',
  boxShadow: '$modal',
  animation: 'slideUp 250ms cubic-bezier(0.16, 1, 0.3, 1)',
  '@keyframes slideUp': {
    from: { transform: 'translateY(16px)', opacity: 0 },
    to: { transform: 'translateY(0)', opacity: 1 },
  },
});

const ModalHeader = styled(Flex, {
  padding: '$4 $6',
  borderBottom: '1px solid $border',
});

const ModalBody = styled(Flex, {
  flex: 1,
  overflow: 'hidden',
  minHeight: 0,
});

const Sidebar = styled('div', {
  width: '200px',
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  borderRight: '1px solid $border',
  padding: '$3 0',
  overflowY: 'auto',
  backgroundColor: '$bgS1',
});

const CanvasArea = styled('div', {
  flex: 1,
  overflowY: 'auto',
  padding: '$6',
  backgroundColor: '$bgBase',
  backgroundImage: 'radial-gradient(circle, var(--dot-color, rgba(255,255,255,0.05)) 1px, transparent 1px)',
  backgroundSize: '24px 24px',
  display: 'flex',
  flexDirection: 'column',
  gap: '$6',
});

const ModalFooter = styled(Flex, {
  padding: '$3 $6',
  borderTop: '1px solid $border',
  backgroundColor: '$bgS2',
  fontSize: '10px',
  fontFamily: 'monospace',
  color: '$tx3',
});

const SidebarFilterButton = styled('button', {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '$2',
  padding: '$2 $4',
  fontSize: '13px',
  textAlign: 'left',
  border: 'none',
  borderLeft: '2px solid transparent',
  cursor: 'pointer',
  transition: 'all 150ms ease',
  variants: {
    active: {
      true: {
        backgroundColor: '$accentBg',
        borderColor: '$accent',
        color: '$accent',
      },
      false: {
        backgroundColor: 'transparent',
        color: '$tx2',
        '&:hover': {
          backgroundColor: '$bgS2',
          color: '$tx1',
        },
      },
    },
  },
});

const NodeBadge = styled('span', {
  display: 'inline-block',
  marginTop: '$1',
  fontSize: '9px',
  fontFamily: 'monospace',
  padding: '0.125rem 0.375rem',
  borderRadius: '$sm',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
});

const RootResourceCard = styled('div', {
  borderRadius: '$xl',
  border: '1px solid $accentBorder',
  padding: '$4',
  display: 'flex',
  alignItems: 'center',
  gap: '$4',
  width: '100%',
  maxWidth: '380px',
  margin: '0 auto',
  backgroundColor: '$bgS1',
  boxShadow: '0 0 24px var(--ac-glow)',
});

const RootIconWrapper = styled('div', {
  width: '48px',
  height: '48px',
  borderRadius: '$md',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '1.25rem',
  flexShrink: 0,
  backgroundColor: '$accentBg',
  border: '1px solid $accentBorder',
});

const StyledNodeCard = styled('div', {
  borderRadius: '$lg',
  border: '1px solid $border',
  transition: 'all 150ms ease',
  cursor: 'pointer',
  userSelect: 'none',
  backgroundColor: '$bgS2',
  '&:hover': {
    borderColor: '$cardHoverBorder',
  },
});

function NodeCard({ node, edgeLabel }: { node: MapNode; edgeLabel?: string }) {
  const [expanded, setExpanded] = useState(false)
  const cat = CATEGORY_CFG[node.category] ?? CATEGORY_CFG.config
  const icon = NODE_ICON[node.type] ?? '◆'
  const props = Object.entries(node.properties).filter(([, v]) => v != null && v !== '' && v !== false)

  return (
    <StyledNodeCard
      style={{ borderColor: expanded ? cat.color + '60' : 'var(--bd)' }}
      onClick={() => setExpanded(e => !e)}
    >
      <Flex align="start" gap={2} style={{ padding: '0.75rem' }}>
        <span style={{ fontSize: '0.875rem', lineHeight: 1, marginTop: '0.125rem', flexShrink: 0 }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Text variant="body" style={{ fontWeight: 700, fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {node.label}
          </Text>
          <Text variant="smallMuted" style={{ fontFamily: 'monospace', fontSize: '10px', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {node.type.replace(/_/g, ' ')}
          </Text>
          {edgeLabel && !expanded && (
            <NodeBadge style={{ color: cat.color, background: cat.bg }}>
              {edgeLabel}
            </NodeBadge>
          )}
        </div>
      </Flex>

      {expanded && props.length > 0 && (
        <div style={{ padding: '0 0.75rem 0.75rem 0.75rem', borderTop: '1px solid var(--bd)', paddingTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          {props.map(([k, v]) => (
            <Flex key={k} justify="between" align="start" gap={2}>
              <Text variant="smallMuted" style={{ textTransform: 'capitalize', flexShrink: 0 }}>{k.replace(/_/g, ' ')}</Text>
              <Text variant="small" style={{ fontFamily: 'monospace', color: 'var(--tx2)', textAlign: 'right', wordBreak: 'break-all', maxWidth: '180px' }}>
                {Array.isArray(v) ? v.slice(0, 3).join(', ') : String(v).slice(0, 80)}
              </Text>
            </Flex>
          ))}
        </div>
      )}
    </StyledNodeCard>
  )
}

function RootCard({ data }: { data: ResourceMap['resource'] }) {
  const icon = data.type === 'server' ? '🖥️' : data.type === 'database' ? '🗄️' : '☸️'
  return (
    <RootResourceCard>
      <RootIconWrapper>{icon}</RootIconWrapper>
      <div style={{ minWidth: 0 }}>
        <Text variant="body" style={{ fontWeight: 700, fontSize: '1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {data.name}
        </Text>
        <Text variant="small" style={{ fontFamily: 'monospace', color: 'var(--ac)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {data.provider} · {data.type}{data.region ? ` · ${data.region}` : ''}
        </Text>
      </div>
    </RootResourceCard>
  )
}

export default function ResourceMapModal({ resourceId, resourceType, resourceName, provider, region, onClose }: Props) {
  const [activeCategory, setActiveCategory] = useState<string>('all')

  const fetchFn = {
    server:     () => resourceMapApi.server(resourceId),
    database:   () => resourceMapApi.database(resourceId),
    kubernetes: () => resourceMapApi.kubernetes(resourceId),
  }[resourceType]

  const { data, isLoading, error, refetch, isFetching } = useQuery<ResourceMap>({
    queryKey: ['resource-map', resourceType, resourceId],
    queryFn: fetchFn,
    staleTime: 120_000,
  })

  const nodes = data?.nodes ?? []
  const edges = data?.edges ?? []

  const edgeLabels: Record<string, string> = {}
  edges.forEach(e => { if (e.to && e.label) edgeLabels[e.to] = e.label })

  const categories = [...new Set(nodes.map(n => n.category))].filter(Boolean)
  const filtered   = activeCategory === 'all' ? nodes : nodes.filter(n => n.category === activeCategory)

  const grouped: Record<string, MapNode[]> = {}
  filtered.forEach(n => {
    if (!grouped[n.category]) grouped[n.category] = []
    grouped[n.category].push(n)
  })

  return (
    <ModalBackdrop role="dialog" aria-modal="true">
      <ModalContent modal>
        {/* Header */}
        <ModalHeader align="center" justify="between">
          <Flex direction="column" gap={1}>
            <Heading level="h2" style={{ fontSize: '1rem' }}>Resource Map</Heading>
            <Text variant="small" style={{ fontFamily: 'monospace', color: 'var(--ac)' }}>
              {resourceName} · {provider}{region ? ` · ${region}` : ''}
            </Text>
          </Flex>
          <Flex align="center" gap={2}>
            <Button
              onClick={() => refetch()}
              disabled={isFetching}
              intent="ghost"
              size="sm"
            >
              <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
              Refresh
            </Button>
            <Button
              onClick={onClose}
              intent="ghost"
              size="sm"
              style={{ padding: '0.375rem', borderRadius: '8px' }}
            >
              <X size={16} />
            </Button>
          </Flex>
        </ModalHeader>

        {/* Body */}
        <ModalBody>
          {/* Sidebar */}
          <Sidebar>
            <Text variant="label" style={{ padding: '0 1rem', marginBottom: '8px' }}>Filter</Text>

            {['all', ...categories].map(cat => {
              const cfg   = cat === 'all' ? null : CATEGORY_CFG[cat]
              const count = cat === 'all' ? nodes.length : nodes.filter(n => n.category === cat).length
              const active = activeCategory === cat
              return (
                <SidebarFilterButton
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  active={active}
                  style={{
                    borderLeftColor: active ? (cfg?.color ?? 'var(--ac)') : 'transparent',
                    color: active ? (cfg?.color ?? 'var(--ac)') : 'var(--tx2)',
                  }}
                >
                  <Flex align="center" gap={2} style={{ minWidth: 0 }}>
                    {cfg ? <cfg.Icon size={13} style={{ flexShrink: 0 }} /> : <Globe size={13} style={{ flexShrink: 0 }} />}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cfg?.label ?? 'All'}</span>
                  </Flex>
                  <span
                    style={{
                      fontSize: '10px',
                      fontFamily: 'monospace',
                      padding: '0.125rem 0.375rem',
                      borderRadius: '9999px',
                      flexShrink: 0,
                      background: active ? (cfg?.color ?? 'var(--ac)') + '22' : 'var(--bg-s3)',
                      color: active ? (cfg?.color ?? 'var(--ac)') : 'var(--tx3)',
                    }}
                  >
                    {count}
                  </span>
                </SidebarFilterButton>
              )
            })}

            {/* Legend */}
            {nodes.length > 0 && (
              <div style={{ padding: '1rem', marginTop: '8px', borderTop: '1px solid var(--bd)' }}>
                <Text variant="label" style={{ marginBottom: '12px' }}>Legend</Text>
                <Flex direction="column" gap={2}>
                  {[['vpc / vnet','🌐'],['subnet','📡'],['security group','🛡️'],
                    ['IAM / role','👤'],['load balancer','⚖️'],['disk','💾']].map(([label, icon]) => (
                    <Flex key={label} align="center" gap={2}>
                      <span style={{ fontSize: '0.75rem' }}>{icon}</span>
                      <Text variant="smallMuted" style={{ textTransform: 'capitalize' }}>{label}</Text>
                    </Flex>
                  ))}
                </Flex>
              </div>
            )}
          </Sidebar>

          {/* Main canvas */}
          <CanvasArea>
            {isLoading && (
              <Flex direction="column" align="center" justify="center" style={{ height: '240px', gap: '16px' }}>
                <RefreshCw size={28} className="animate-spin text-accent" style={{ opacity: 0.6 }} />
                <Text variant="muted">Fetching cloud topology…</Text>
              </Flex>
            )}

            {!isLoading && error && (
              <Flex direction="column" align="center" justify="center" style={{ height: '240px', gap: '12px' }}>
                <AlertCircle size={28} style={{ color: 'var(--sr)', opacity: 0.6 }} />
                <Text variant="muted">Failed to load resource map.</Text>
                <Button onClick={() => refetch()} intent="ghost" size="sm">
                  <RefreshCw size={12} /> Retry
                </Button>
              </Flex>
            )}

            {!isLoading && !error && (
              <>
                {/* Root */}
                {data && (
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <RootCard data={data.resource} />
                  </div>
                )}

                {Object.keys(grouped).length === 0 && nodes.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '4rem 0' }}>
                    <Text variant="muted">
                      No connected resources found. Provider may not support topology mapping for this resource.
                    </Text>
                  </div>
                )}

                {Object.keys(grouped).length === 0 && nodes.length > 0 && (
                  <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                    <Text variant="muted">No resources match selected category.</Text>
                  </div>
                )}

                {Object.entries(grouped).map(([cat, catNodes]) => {
                  const cfg = CATEGORY_CFG[cat] ?? CATEGORY_CFG.config
                  return (
                    <div key={cat}>
                      {/* Category divider */}
                      <Flex align="center" gap={2} style={{ marginBottom: '12px' }}>
                        <div style={{ height: '1px', flex: 1, background: `linear-gradient(to right, ${cfg.color}40, transparent)` }} />
                        <span
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '10px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                            padding: '0.25rem 0.625rem',
                            borderRadius: '9999px',
                            color: cfg.color,
                            background: cfg.bg,
                            border: `1px solid ${cfg.color}30`,
                          }}
                        >
                          <cfg.Icon size={11} />
                          {cfg.label}
                          <span style={{ marginLeft: '4px', padding: '0 0.375rem', borderRadius: '9999px', fontSize: '9px', background: cfg.color + '25' }}>
                            {catNodes.length}
                          </span>
                        </span>
                        <div style={{ height: '1px', flex: 1, background: `linear-gradient(to left, ${cfg.color}40, transparent)` }} />
                      </Flex>

                      {/* Node grid */}
                      <Grid columns="auto" gap={2}>
                        {catNodes.map(node => (
                          <NodeCard key={node.id} node={node} edgeLabel={edgeLabels[node.id]} />
                        ))}
                      </Grid>
                    </div>
                  )
                })}
              </>
            )}
          </CanvasArea>
        </ModalBody>

        {/* Footer */}
        <ModalFooter justify="between" align="center">
          <span>
            <span style={{ color: 'var(--ac)', fontWeight: 700 }}>{nodes.length}</span> resources ·{' '}
            <span style={{ color: 'var(--ac)', fontWeight: 700 }}>{edges.length}</span> connections
          </span>
          <span>Click any node to expand details</span>
        </ModalFooter>
      </ModalContent>
    </ModalBackdrop>
  )
}
