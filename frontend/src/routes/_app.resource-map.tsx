import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ReactFlow, Background, Controls, MiniMap,
  type Node, type Edge, type NodeTypes,
  useNodesState, useEdgesState,
  Handle, Position, MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { api, type Page, type Server } from "@/lib/api";
import { Card, PageHeader, ProviderBadge, StatusPill } from "@/components/ui-bits";
import { Maximize2, Minimize2, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_app/resource-map")({
  head: () => ({ meta: [{ title: "Resource Map — System Control" }] }),
  component: ResourceMapPage,
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface RmNode {
  id: string;
  type: string;
  category: string;
  label: string;
  properties?: Record<string, unknown>;
}
interface RmEdge { from: string; to: string; label?: string }
interface RmData {
  resource: { id: number; name: string; type: string; provider: string; region: string | null };
  nodes: RmNode[];
  edges: RmEdge[];
}
interface DatabaseInstance { id: number; name: string; provider: string; engine?: string; region?: string | null; status?: string }
interface KubernetesCluster { id: number; name: string; provider: string; region?: string | null; status?: string }

// ─── Category colours (CSS vars safe — used as SVG/inline fill) ───────────────

const CAT_COLOR: Record<string, string> = {
  server:     "#6366f1",
  compute:    "#6366f1",
  database:   "#f59e0b",
  kubernetes: "#10b981",
  network:    "#3b82f6",
  security:   "#ef4444",
  iam:        "#ec4899",
  storage:    "#8b5cf6",
  config:     "#64748b",
  unknown:    "#6b7280",
};
const catColor = (c: string) => CAT_COLOR[c] ?? CAT_COLOR.unknown;

// ─── Custom React Flow node ───────────────────────────────────────────────────

function RmFlowNode({ data }: { data: { label: string; category: string; nodeType: string; props?: Record<string,unknown>; selected?: boolean } }) {
  const color = catColor(data.category);
  return (
    <div
      style={{ borderColor: color }}
      className="bg-surface border-2 rounded-lg w-[160px] shadow-md cursor-pointer hover:shadow-lg transition-shadow"
    >
      <Handle type="target" position={Position.Left} className="!bg-border !size-2" />
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="size-2.5 rounded-full shrink-0" style={{ background: color }} />
        <div className="min-w-0">
          <div className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground truncate">{data.category}</div>
          <div className="text-[11px] font-medium text-foreground truncate">{data.label}</div>
          {data.nodeType && data.nodeType !== data.category && (
            <div className="text-[9px] text-muted-foreground truncate">{data.nodeType}</div>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-border !size-2" />
    </div>
  );
}

const NODE_TYPES: NodeTypes = { rmNode: RmFlowNode };

// ─── Layout helper: column-by-category ───────────────────────────────────────

function buildFlow(rmData: RmData): { nodes: Node[]; edges: Edge[] } {
  const cats = [...new Set(rmData.nodes.map(n => n.category))];
  const catIndex = new Map(cats.map((c, i) => [c, i]));
  const catCount = new Map<string, number>();

  const COL_W = 220;
  const ROW_H = 80;

  const nodes: Node[] = rmData.nodes.map(n => {
    const ci = catIndex.get(n.category) ?? 0;
    const ri = catCount.get(n.category) ?? 0;
    catCount.set(n.category, ri + 1);
    return {
      id: n.id,
      type: "rmNode",
      position: { x: ci * COL_W, y: ri * ROW_H },
      data: { label: n.label, category: n.category, nodeType: n.type, props: n.properties },
    };
  });

  const edges: Edge[] = rmData.edges.map((e, i) => ({
    id: `e${i}`,
    source: e.from,
    target: e.to,
    label: e.label ?? "",
    labelStyle: { fontSize: 9, fill: "var(--muted-foreground)" },
    style: { stroke: "var(--border)", strokeWidth: 1.5 },
    markerEnd: { type: MarkerType.ArrowClosed, color: "var(--border)", width: 12, height: 12 },
    animated: false,
  }));

  return { nodes, edges };
}

// ─── Properties panel ─────────────────────────────────────────────────────────

function PropsPanel({ node }: { node: Node | null }) {
  if (!node) return (
    <div className="flex items-center justify-center h-full text-xs text-muted-foreground px-4 text-center">
      Click a node to inspect its properties.
    </div>
  );
  const d = node.data as { label: string; category: string; nodeType: string; props?: Record<string,unknown> };
  const props = d.props ?? {};
  const color = catColor(d.category);
  return (
    <div className="p-4 space-y-3 overflow-y-auto h-full">
      <div className="flex items-center gap-2">
        <span className="size-3 rounded-full shrink-0" style={{ background: color }} />
        <div>
          <div className="text-xs font-semibold">{d.label}</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-widest">{d.category} · {d.nodeType}</div>
        </div>
      </div>
      {Object.keys(props).length > 0 ? (
        <div className="space-y-1">
          {Object.entries(props).map(([k, v]) => (
            <div key={k} className="grid grid-cols-2 gap-2 text-[11px]">
              <span className="text-muted-foreground font-mono truncate">{k}</span>
              <span className="font-mono truncate text-foreground" title={String(v ?? "—")}>{String(v ?? "—")}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">No properties.</p>
      )}
    </div>
  );
}

// ─── Flow panel (center) ──────────────────────────────────────────────────────

function FlowPanel({ rmData, onNodeClick }: { rmData: RmData | undefined; onNodeClick: (n: Node) => void }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    if (!rmData) { setNodes([]); setEdges([]); return; }
    const { nodes: n, edges: e } = buildFlow(rmData);
    setNodes(n);
    setEdges(e);
  }, [rmData]);

  if (!rmData) return (
    <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
      Select a resource on the left to view its topology.
    </div>
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={NODE_TYPES}
      onNodeClick={(_, node) => onNodeClick(node)}
      fitView
      fitViewOptions={{ padding: 0.3 }}
      proOptions={{ hideAttribution: true }}
      style={{ background: "var(--background)", width: "100%", height: "100%" }}
    >
      <Background color="var(--border)" gap={20} size={1} />
      <Controls
        style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }}
        showInteractive={false}
      />
      <MiniMap
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        nodeColor={(n) => catColor((n.data as { category: string }).category)}
        maskColor="var(--muted)"
      />
    </ReactFlow>
  );
}

// ─── Sidebar resource list ────────────────────────────────────────────────────

type ResourceKind = { kind: "server"; data: Server } | { kind: "database"; data: DatabaseInstance } | { kind: "kubernetes"; data: KubernetesCluster };

function SidebarItem({
  label, sub, status, active, onClick,
}: { label: string; sub: string; status?: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-md border transition-colors ${
        active ? "bg-primary/10 border-primary/40" : "border-transparent hover:bg-muted/60 hover:border-border"
      }`}
    >
      <div className="text-xs font-medium truncate">{label}</div>
      <div className="flex items-center gap-2 mt-0.5">
        <span className="text-[10px] text-muted-foreground font-mono truncate">{sub}</span>
        {status && <StatusPill status={status} />}
      </div>
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function ResourceMapPage() {
  const [selected, setSelected] = useState<ResourceKind | null>(null);
  const [activeNode, setActiveNode] = useState<Node | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const servers = useQuery({
    queryKey: ["servers", "map"],
    queryFn: () => api<Page<Server>>("/api/servers", { query: { limit: 500 } }),
  });
  const databases = useQuery({
    queryKey: ["databases", "map"],
    queryFn: () => api<Page<DatabaseInstance>>("/api/databases", { query: { limit: 500 } }),
  });
  const kubernetes = useQuery({
    queryKey: ["kubernetes", "map"],
    queryFn: () => api<Page<KubernetesCluster>>("/api/kubernetes", { query: { limit: 500 } }),
  });

  const endpoint =
    selected?.kind === "server"     ? `/api/resource-map/server/${selected.data.id}` :
    selected?.kind === "database"   ? `/api/resource-map/database/${selected.data.id}` :
    selected?.kind === "kubernetes" ? `/api/resource-map/kubernetes/${selected.data.id}` :
    null;

  const rmQuery = useQuery({
    queryKey: ["resourceMap", endpoint],
    queryFn: () => api<RmData>(endpoint!),
    enabled: !!endpoint,
    staleTime: 5 * 60 * 1000, // mirror backend 5-min cache
  });

  const handleNodeClick = useCallback((n: Node) => setActiveNode(n), []);

  // Fullscreen via native API
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setFullscreen(true);
    } else {
      document.exitFullscreen();
      setFullscreen(false);
    }
  };
  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const isSelected = (kind: string, id: number) =>
    selected?.kind === kind && selected.data.id === id;

  return (
    <div ref={containerRef} className={`flex flex-col ${fullscreen ? "fixed inset-0 z-50 bg-background p-4" : "p-6"} gap-4 h-full`}>
      <PageHeader
        title="Resource map"
        description="Topology of every discovered resource — servers, databases, and Kubernetes clusters."
        actions={
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-md hover:bg-muted border border-border"
            title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {fullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </button>
        }
      />

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Left sidebar */}
        <div className="w-64 shrink-0 flex flex-col gap-3 overflow-y-auto">
          {/* Servers */}
          <div>
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-1 mb-1">
              Servers ({servers.data?.total ?? 0})
            </div>
            <div className="space-y-0.5">
              {(servers.data?.items ?? []).map(s => (
                <SidebarItem
                  key={s.id}
                  label={s.name}
                  sub={`${s.provider} · ${s.region ?? "—"}`}
                  status={s.status}
                  active={isSelected("server", s.id)}
                  onClick={() => { setSelected({ kind: "server", data: s }); setActiveNode(null); }}
                />
              ))}
              {servers.data?.total === 0 && <p className="text-[11px] text-muted-foreground px-1">No servers.</p>}
            </div>
          </div>

          {/* Databases */}
          {(databases.data?.total ?? 0) > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-1 mb-1">
                Databases ({databases.data?.total})
              </div>
              <div className="space-y-0.5">
                {(databases.data?.items ?? []).map(d => (
                  <SidebarItem
                    key={d.id}
                    label={d.name}
                    sub={`${d.provider} · ${d.engine ?? "—"}`}
                    status={d.status}
                    active={isSelected("database", d.id)}
                    onClick={() => { setSelected({ kind: "database", data: d }); setActiveNode(null); }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Kubernetes */}
          {(kubernetes.data?.total ?? 0) > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-1 mb-1">
                Kubernetes ({kubernetes.data?.total})
              </div>
              <div className="space-y-0.5">
                {(kubernetes.data?.items ?? []).map(k => (
                  <SidebarItem
                    key={k.id}
                    label={k.name}
                    sub={`${k.provider} · ${k.region ?? "—"}`}
                    status={k.status}
                    active={isSelected("kubernetes", k.id)}
                    onClick={() => { setSelected({ kind: "kubernetes", data: k }); setActiveNode(null); }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Flow canvas */}
        <Card className="flex-1 min-w-0 overflow-hidden relative" style={{ height: 600 }}>
          {rmQuery.isFetching && (
            <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 text-[11px] text-muted-foreground bg-surface/80 backdrop-blur px-2 py-1 rounded-md border border-border">
              <RefreshCw className="size-3 animate-spin" /> Loading…
            </div>
          )}
          {rmQuery.isError && (
            <div className="absolute top-3 left-3 z-10 text-[11px] text-red-600 bg-surface/90 px-2 py-1 rounded-md border border-red-200">
              Failed to load topology
            </div>
          )}
          <div style={{ width: "100%", height: "100%" }}>
            <FlowPanel rmData={rmQuery.data} onNodeClick={handleNodeClick} />
          </div>
        </Card>

        {/* Right properties panel */}
        <Card className="w-56 shrink-0 overflow-hidden" style={{ height: 600 }}>
          <div className="px-4 py-3 border-b border-border bg-surface-muted">
            <h3 className="text-xs font-semibold">Properties</h3>
          </div>
          <div className="overflow-y-auto" style={{ height: "calc(100% - 44px)" }}>
            <PropsPanel node={activeNode} />
          </div>
        </Card>
      </div>
    </div>
  );
}
