import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, RefreshCw, AlertCircle, Shield, Network, Cpu, HardDrive, Globe, Tag } from 'lucide-react'
import { resourceMapApi } from '../api'

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

function NodeCard({ node, edgeLabel }: { node: MapNode; edgeLabel?: string }) {
  const [expanded, setExpanded] = useState(false)
  const cat = CATEGORY_CFG[node.category] ?? CATEGORY_CFG.config
  const icon = NODE_ICON[node.type] ?? '◆'
  const props = Object.entries(node.properties).filter(([, v]) => v != null && v !== '' && v !== false)

  return (
    <div
      className="rounded-xl border transition-all duration-150 cursor-pointer select-none"
      style={{ background: 'var(--bg-s2)', borderColor: expanded ? cat.color + '60' : 'var(--bd)' }}
      onClick={() => setExpanded(e => !e)}
    >
      <div className="flex items-start gap-2.5 p-3">
        <span className="text-sm leading-none mt-0.5 flex-shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-ink-primary truncate">{node.label}</p>
          <p className="text-[10px] text-ink-muted font-mono mt-0.5 truncate">{node.type.replace(/_/g, ' ')}</p>
          {edgeLabel && !expanded && (
            <span
              className="inline-block mt-1 text-[9px] font-mono px-1.5 py-0.5 rounded uppercase tracking-wider"
              style={{ color: cat.color, background: cat.bg }}
            >
              {edgeLabel}
            </span>
          )}
        </div>
      </div>

      {expanded && props.length > 0 && (
        <div className="px-3 pb-3 border-t border-border space-y-1.5 pt-2">
          {props.map(([k, v]) => (
            <div key={k} className="flex items-start justify-between gap-2">
              <span className="text-[10px] text-ink-muted capitalize flex-shrink-0">{k.replace(/_/g, ' ')}</span>
              <span className="text-[10px] font-mono text-ink-secondary text-right break-all max-w-[180px]">
                {Array.isArray(v) ? v.slice(0, 3).join(', ') : String(v).slice(0, 80)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function RootCard({ data }: { data: ResourceMap['resource'] }) {
  const icon = data.type === 'server' ? '🖥️' : data.type === 'database' ? '🗄️' : '☸️'
  return (
    <div
      className="rounded-2xl border p-4 flex items-center gap-4 w-full max-w-sm mx-auto"
      style={{
        background: 'var(--bg-s1)',
        border: '1px solid var(--ac-bd)',
        boxShadow: '0 0 24px var(--ac-glow)',
      }}
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
        style={{ background: 'var(--ac-bg)', border: '1px solid var(--ac-bd)' }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="font-display text-base font-bold text-ink-primary truncate">{data.name}</p>
        <p className="text-[10px] font-mono text-accent mt-0.5 uppercase tracking-widest">
          {data.provider} · {data.type}{data.region ? ` · ${data.region}` : ''}
        </p>
      </div>
    </div>
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
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)' }}
      role="dialog" aria-modal="true"
    >
      <div
        className="glass-modal w-full max-w-5xl max-h-[92vh] rounded-2xl flex flex-col animate-slide-up overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div>
            <h2 className="font-display text-base font-bold text-ink-primary">Resource Map</h2>
            <p className="text-[10px] font-mono text-accent mt-0.5">
              {resourceName} · {provider}{region ? ` · ${region}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="btn-ghost px-2.5 py-1.5 text-xs"
            >
              <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-ink-muted hover:text-ink-primary hover:bg-surface-3 rounded-lg transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden min-h-0">

          {/* Sidebar */}
          <div
            className="w-48 flex-shrink-0 flex flex-col border-r border-border py-3 space-y-0.5 overflow-y-auto"
            style={{ background: 'var(--bg-s1)' }}
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-ink-muted px-4 mb-2">Filter</p>

            {['all', ...categories].map(cat => {
              const cfg   = cat === 'all' ? null : CATEGORY_CFG[cat]
              const count = cat === 'all' ? nodes.length : nodes.filter(n => n.category === cat).length
              const active = activeCategory === cat
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className="flex items-center justify-between gap-2 px-4 py-2 text-[13px] transition-colors text-left border-l-2"
                  style={{
                    borderColor: active ? (cfg?.color ?? 'var(--ac)') : 'transparent',
                    background:  active ? (cfg?.bg   ?? 'var(--ac-bg)') : 'transparent',
                    color:       active ? (cfg?.color ?? 'var(--ac)') : 'var(--tx2)',
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {cfg ? <cfg.Icon size={13} className="flex-shrink-0" /> : <Globe size={13} className="flex-shrink-0" />}
                    <span className="truncate">{cfg?.label ?? 'All'}</span>
                  </div>
                  <span
                    className="text-[10px] font-mono rounded-full px-1.5 py-0.5 flex-shrink-0"
                    style={{
                      background: active ? (cfg?.color ?? 'var(--ac)') + '22' : 'var(--bg-s3)',
                      color:      active ? (cfg?.color ?? 'var(--ac)') : 'var(--tx3)',
                    }}
                  >
                    {count}
                  </span>
                </button>
              )
            })}

            {/* Legend */}
            {nodes.length > 0 && (
              <div className="px-4 pt-4 mt-2 border-t border-border">
                <p className="text-[10px] font-bold uppercase tracking-widest text-ink-muted mb-3">Legend</p>
                <div className="space-y-2">
                  {[['vpc / vnet','🌐'],['subnet','📡'],['security group','🛡️'],
                    ['IAM / role','👤'],['load balancer','⚖️'],['disk','💾']].map(([label, icon]) => (
                    <div key={label} className="flex items-center gap-2">
                      <span className="text-xs">{icon}</span>
                      <span className="text-[10px] text-ink-muted capitalize">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Main canvas */}
          <div
            className="flex-1 overflow-y-auto p-6 space-y-6 bg-base"
            style={{
              backgroundImage: 'radial-gradient(circle, var(--dot-color) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          >
            {isLoading && (
              <div className="flex flex-col items-center justify-center h-64 gap-4">
                <RefreshCw size={28} className="animate-spin text-accent opacity-60" />
                <p className="text-sm text-ink-muted">Fetching cloud topology…</p>
              </div>
            )}

            {!isLoading && error && (
              <div className="flex flex-col items-center justify-center h-64 gap-3">
                <AlertCircle size={28} className="text-status-red opacity-60" />
                <p className="text-sm text-ink-muted">Failed to load resource map.</p>
                <button onClick={() => refetch()} className="btn-ghost text-xs px-3 py-1.5">
                  <RefreshCw size={12} /> Retry
                </button>
              </div>
            )}

            {!isLoading && !error && (
              <>
                {/* Root */}
                {data && (
                  <div className="flex justify-center">
                    <RootCard data={data.resource} />
                  </div>
                )}

                {Object.keys(grouped).length === 0 && nodes.length === 0 && (
                  <div className="text-center py-16">
                    <p className="text-ink-muted text-sm">
                      No connected resources found. Provider may not support topology mapping for this resource.
                    </p>
                  </div>
                )}

                {Object.keys(grouped).length === 0 && nodes.length > 0 && (
                  <div className="text-center py-8">
                    <p className="text-ink-muted text-sm">No resources match selected category.</p>
                  </div>
                )}

                {Object.entries(grouped).map(([cat, catNodes]) => {
                  const cfg = CATEGORY_CFG[cat] ?? CATEGORY_CFG.config
                  return (
                    <div key={cat}>
                      {/* Category divider */}
                      <div className="flex items-center gap-2 mb-3">
                        <div className="h-px flex-1" style={{ background: `linear-gradient(to right, ${cfg.color}40, transparent)` }} />
                        <span
                          className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
                          style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}30` }}
                        >
                          <cfg.Icon size={11} />
                          {cfg.label}
                          <span className="ml-1 px-1.5 rounded-full text-[9px]" style={{ background: cfg.color + '25' }}>
                            {catNodes.length}
                          </span>
                        </span>
                        <div className="h-px flex-1" style={{ background: `linear-gradient(to left, ${cfg.color}40, transparent)` }} />
                      </div>

                      {/* Node grid */}
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                        {catNodes.map(node => (
                          <NodeCard key={node.id} node={node} edgeLabel={edgeLabels[node.id]} />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-2.5 border-t border-border bg-surface-2 flex-shrink-0 text-[10px] font-mono text-ink-muted">
          <span>
            <span className="text-accent font-bold">{nodes.length}</span> resources ·{' '}
            <span className="text-accent font-bold">{edges.length}</span> connections
          </span>
          <span>Click any node to expand details</span>
        </div>
      </div>
    </div>
  )
}
