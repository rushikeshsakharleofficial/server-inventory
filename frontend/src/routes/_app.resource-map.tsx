import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ReactFlow, Background, Controls, MiniMap, ReactFlowProvider,
  type Node, type Edge, type NodeTypes, type NodeProps,
  useNodesState, useEdgesState, useReactFlow,
  Handle, Position, MarkerType, BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { api, type Page, type Server } from "@/lib/api";
import type { SshCredential } from "@/lib/api";
import { apiToFlow, type RmApiData, type RmNodeData } from "@/lib/resource-map-layout";
import { PageHeader, StatusPill } from "@/components/ui-bits";
import {
  Maximize2, Minimize2, RefreshCw, Search, ExternalLink, Wifi,
  Server as ServerIcon, Database, HardDrive, Network, Shield,
  Globe, Layers, Activity, Box,
} from "lucide-react";

export const Route = createFileRoute("/_app/resource-map")({
  head: () => ({ meta: [{ title: "Resource Map — System Control" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    server: search.server ? Number(search.server) : undefined,
  }),
  component: ResourceMapPage,
});

// ─── Category meta ────────────────────────────────────────────────────────────

const CAT_META: Record<string, { color: string; bg: string }> = {
  compute:        { color: "#6366f1", bg: "#eef2ff" },
  server:         { color: "#6366f1", bg: "#eef2ff" },
  database:       { color: "#f59e0b", bg: "#fffbeb" },
  kubernetes:     { color: "#10b981", bg: "#ecfdf5" },
  network:        { color: "#3b82f6", bg: "#eff6ff" },
  security:       { color: "#ef4444", bg: "#fef2f2" },
  storage:        { color: "#8b5cf6", bg: "#f5f3ff" },
  monitoring:     { color: "#f97316", bg: "#fff7ed" },
  cache:          { color: "#ef4444", bg: "#fef2f2" },
  dns:            { color: "#3b82f6", bg: "#eff6ff" },
  backup:         { color: "#8b5cf6", bg: "#f5f3ff" },
  config:         { color: "#6b7280", bg: "#f9fafb" },
  iam:            { color: "#0ea5e9", bg: "#f0f9ff" },
  infrastructure: { color: "#64748b", bg: "#f8fafc" },
  meta:           { color: "#94a3b8", bg: "#f8fafc" },
  unknown:        { color: "#6b7280", bg: "#f9fafb" },
};
const catMeta = (c: string) => CAT_META[c] ?? CAT_META.unknown;

const STATUS_COLOR: Record<string, string> = {
  running: "#22c55e", active: "#22c55e", ready: "#22c55e", available: "#22c55e",
  "in-use": "#3b82f6", stopped: "#6b7280", failed: "#ef4444", pending: "#f59e0b",
};
const statusColor = (s: string) => STATUS_COLOR[s.toLowerCase()] ?? "#6b7280";

const CAT_LABEL: Record<string, string> = {
  compute: "Server", server: "Server", database: "Database",
  kubernetes: "Kubernetes", network: "Network", security: "Security",
  storage: "Storage", monitoring: "Monitoring", cache: "Cache",
  dns: "DNS", backup: "Backup", config: "Config", iam: "IAM",
  infrastructure: "Infrastructure", meta: "Tag",
};

// ─── Node icon (no wrapper span — avoids SSR hydration mismatch) ──────────────

function NodeIcon({ cat, size = 14 }: Readonly<{ cat: string; size?: number }>) {
  const s = { width: size, height: size };
  if (cat === "database") return <Database style={s} />;
  if (cat === "storage" || cat === "backup") return <HardDrive style={s} />;
  if (cat === "security") return <Shield style={s} />;
  if (cat === "kubernetes") return <Box style={s} />;
  if (cat === "monitoring") return <Activity style={s} />;
  if (cat === "dns" || cat === "network") return <Globe style={s} />;
  if (cat === "cache") return <Database style={s} />;
  if (cat === "compute" || cat === "server") return <ServerIcon style={s} />;
  return <Layers style={s} />;
}

// ─── Custom node (ReactFlow passes `selected` as direct prop) ─────────────────

function ResourceNode({ data, selected }: NodeProps<RmNodeData>) {
  const cat = (data.resourceType ?? "unknown").toLowerCase();
  const { color, bg } = catMeta(cat);
  const sColor = data.status ? statusColor(String(data.status)) : "#6b7280";
  const isRoot = !!data.isRoot;
  let borderColor: string;
  if (selected) borderColor = "#3b82f6";
  else if (isRoot) borderColor = color;
  else borderColor = "#e5e7eb";
  const borderWidth = selected || isRoot ? 2 : 1;

  let boxShadow: string;
  if (selected) boxShadow = "0 0 0 4px rgba(59,130,246,0.15), 0 4px 16px rgba(0,0,0,0.1)";
  else if (isRoot) boxShadow = `0 0 0 3px ${color}22, 0 4px 12px rgba(0,0,0,0.08)`;
  else boxShadow = "0 2px 8px rgba(15,23,42,0.07)";

  return (
    <div style={{
      background: "#fff",
      border: `${borderWidth}px solid ${borderColor}`,
      boxShadow,
      borderRadius: 14,
      width: isRoot ? 240 : 210,
      padding: "12px 14px",
      cursor: "pointer",
      transition: "box-shadow 0.15s, border-color 0.15s",
      fontFamily: "inherit",
    }}>
      {/* Handles on all 4 sides */}
      <Handle type="target" position={Position.Left}
        style={{ background: color, width: 8, height: 8, border: "2px solid #fff", left: -5 }} />
      <Handle type="source" position={Position.Right}
        style={{ background: color, width: 8, height: 8, border: "2px solid #fff", right: -5 }} />
      <Handle type="source" position={Position.Bottom}
        style={{ background: color, width: 8, height: 8, border: "2px solid #fff", bottom: -5 }} />
      <Handle type="target" position={Position.Top}
        style={{ background: color, width: 8, height: 8, border: "2px solid #fff", top: -5 }} />

      {/* Category label */}
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color, marginBottom: 6 }}>
        {CAT_LABEL[cat] ?? String(data.label)}
      </div>

      {/* Icon + name row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color }}>
          <NodeIcon cat={cat} size={15} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#111827", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {String(data.name)}
          </div>
          {data.meta && (
            <div style={{ fontSize: 10, color: "#6b7280", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {String(data.meta)}
            </div>
          )}
        </div>
      </div>

      {/* Status + details */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {data.status && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: sColor }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: sColor }} />
            {String(data.status)}
          </div>
        )}
        {data.details && (
          <div style={{ fontSize: 9, color: "#94a3b8" }}>{String(data.details)}</div>
        )}
      </div>
    </div>
  );
}

// Defined outside component so React Flow doesn't re-create nodeTypes on each render
const NODE_TYPES: NodeTypes = { resourceNode: ResourceNode };

// ─── Layout: auto-arrange nodes in columns by category ───────────────────────

// ─── Map skeleton ─────────────────────────────────────────────────────────────

function MapSkeleton() {
  const cards = [
    { x: 40, y: 40, w: 150 }, { x: 40, y: 190, w: 140 },
    { x: 320, y: 115, w: 165 }, { x: 610, y: 115, w: 200 },
    { x: 920, y: 20, w: 160 }, { x: 920, y: 150, w: 150 }, { x: 920, y: 280, w: 155 },
  ];
  return (
    <div className="w-full h-full relative overflow-hidden"
      style={{ background: "#f8fafc", backgroundImage: "radial-gradient(#dbe2ea 1px, transparent 1px)", backgroundSize: "20px 20px" }}>
      <svg className="absolute inset-0 pointer-events-none" style={{ width: "100%", height: "100%" }}>
        <line x1={190} y1={80} x2={320} y2={160} stroke="#e2e8f0" strokeWidth={2} strokeDasharray="6 4" />
        <line x1={180} y1={210} x2={320} y2={165} stroke="#e2e8f0" strokeWidth={2} strokeDasharray="6 4" />
        <line x1={486} y1={150} x2={610} y2={150} stroke="#e2e8f0" strokeWidth={2} strokeDasharray="6 4" />
        <line x1={811} y1={140} x2={920} y2={80} stroke="#e2e8f0" strokeWidth={2} strokeDasharray="6 4" />
        <line x1={811} y1={155} x2={920} y2={185} stroke="#e2e8f0" strokeWidth={2} strokeDasharray="6 4" />
        <line x1={811} y1={165} x2={920} y2={315} stroke="#e2e8f0" strokeWidth={2} strokeDasharray="6 4" />
      </svg>
      {cards.map((c) => (
        <div key={`${c.x}-${c.y}-${c.w}`} className="absolute animate-pulse" style={{ left: c.x, top: c.y }}>
          <div style={{ width: c.w, background: "#fff", borderRadius: 14, border: "1px solid #f1f5f9", boxShadow: "0 2px 8px rgba(15,23,42,0.06)", padding: "12px 14px" }}>
            <div style={{ height: 8, background: "#f1f5f9", borderRadius: 4, width: "60%", marginBottom: 10 }} />
            <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "#f1f5f9", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ height: 10, background: "#f1f5f9", borderRadius: 4, marginBottom: 6 }} />
                <div style={{ height: 8, background: "#f1f5f9", borderRadius: 4, width: "75%" }} />
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#f1f5f9" }} />
              <div style={{ height: 7, background: "#f1f5f9", borderRadius: 4, width: "40%" }} />
            </div>
          </div>
        </div>
      ))}
      <div className="absolute" style={{ top: "50%", left: "50%", transform: "translate(-50%,-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <RefreshCw className="animate-spin" style={{ width: 20, height: 20, color: "#cbd5e1" }} />
        <div style={{ fontSize: 12, color: "#94a3b8" }}>Building topology…</div>
      </div>
    </div>
  );
}

// ─── Properties panel ─────────────────────────────────────────────────────────

function PropsPanel({ node, serverId }: Readonly<{ node: Node | null; serverId?: number }>) {
  if (!node) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 8, padding: "0 16px", textAlign: "center" }}>
      <Layers style={{ width: 24, height: 24, color: "#d1d5db" }} />
      <p style={{ fontSize: 12, color: "#9ca3af" }}>Click a node to inspect its properties.</p>
    </div>
  );

  const d = node.data as RmNodeData;
  const cat = (d.resourceType ?? "unknown").toLowerCase();
  const { color, bg } = catMeta(cat);
  const sColor = d.status ? statusColor(String(d.status)) : "#6b7280";
  const props = (d.properties ?? {}) as Record<string, string>;

  return (
    <div style={{ padding: 16, overflowY: "auto", height: "100%", display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color }}>
          <NodeIcon cat={cat} size={18} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color, marginBottom: 2 }}>
            {CAT_LABEL[cat] ?? String(d.label)}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {String(d.name)}
          </div>
          {d.status && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: sColor }} />
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: sColor }}>{String(d.status)}</span>
            </div>
          )}
        </div>
      </div>

      {d.meta && <div style={{ fontSize: 11, color: "#6b7280" }}>{String(d.meta)}</div>}
      {d.details && <div style={{ fontSize: 11, color: "#94a3b8" }}>{String(d.details)}</div>}

      {/* Properties table */}
      {Object.keys(props).length > 0 && (
        <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          {Object.entries(props)
            .filter(([, v]) => v && v !== "undefined" && v !== "null" && v !== "")
            .slice(0, 14)
            .map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11 }}>
                <span style={{ color: "#9ca3af", flexShrink: 0 }}>{k}</span>
                <span style={{ fontFamily: "monospace", color: "#374151", textAlign: "right", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={v}>{v}</span>
              </div>
            ))}
        </div>
      )}

      {(cat === "compute" || cat === "server") && serverId && (
        <Link
          to="/server-detail/$id"
          params={{ id: String(serverId) }}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", fontSize: 11, fontWeight: 500, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, color: "#374151", textDecoration: "none", marginTop: 4 }}
        >
          View server details
          <ExternalLink style={{ width: 13, height: 13, color: "#9ca3af" }} />
        </Link>
      )}
    </div>
  );
}

// ─── Flow inner (must be inside ReactFlowProvider) ────────────────────────────

function FlowInner({
  nodes: initNodes, edges: initEdges, onNodeClick,
}: Readonly<{
  nodes: Node[]; edges: Edge[]; onNodeClick: (n: Node) => void;
}>) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initEdges);
  const { fitView } = useReactFlow();
  const prevKey = useRef("");

  useEffect(() => {
    const key = initNodes.map(n => n.id).join(",");
    if (key === prevKey.current) return;
    prevKey.current = key;
    setNodes(initNodes);
    setEdges(initEdges);
    setTimeout(() => fitView({ padding: 0.18, duration: 500 }), 80);
  }, [initNodes, initEdges, fitView, setNodes, setEdges]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={NODE_TYPES}
      onNodeClick={(_, n) => onNodeClick(n)}
      proOptions={{ hideAttribution: true }}
      style={{ width: "100%", height: "100%" }}
      defaultEdgeOptions={{ type: "smoothstep" }}
      minZoom={0.2}
      maxZoom={2}
      panOnScroll
      zoomOnScroll
    >
      <Background color="#dbe2ea" gap={20} size={1.5} variant={BackgroundVariant.Dots} />
      <Controls
        style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}
        showInteractive={false}
      />
      <MiniMap
        style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8 }}
        nodeColor={(n) => catMeta(((n.data as RmNodeData).resourceType ?? "unknown").toLowerCase()).color}
        maskColor="rgba(0,0,0,0.04)"
      />
    </ReactFlow>
  );
}

// ─── Sidebar server item ──────────────────────────────────────────────────────

function SidebarItem({ label, sub, status, active, onClick }: Readonly<{
  label: string; sub: string; status?: string; active: boolean; onClick: () => void;
}>) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", textAlign: "left", padding: "8px 10px", borderRadius: 8,
        border: active ? "1px solid rgba(99,102,241,0.3)" : "1px solid transparent",
        background: active ? "rgba(99,102,241,0.06)" : "transparent",
        cursor: "pointer", transition: "background 0.1s, border-color 0.1s",
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 500, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
        <span style={{ fontSize: 10, color: "#9ca3af", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</span>
        {status && <StatusPill status={status} />}
      </div>
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

interface SyncProg { done: number; total: number; skipped: number; status: "idle" | "running" | "done" }

function ResourceMapPage() {
  const { server: targetServerId } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);
  const [activeNode, setActiveNode] = useState<Node | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [search, setSearch] = useState("");
  const [flowData, setFlowData] = useState<{ nodes: Node[]; edges: Edge[] } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const [syncProg, setSyncProg] = useState<SyncProg>({ done: 0, total: 0, skipped: 0, status: "idle" });
  const syncAbortRef = useRef(false);
  const syncRunningRef = useRef(false);

  const servers = useQuery({
    queryKey: ["servers", "map"],
    queryFn: () => api<Page<Server>>("/api/servers", { query: { limit: 500 } }),
  });

  useEffect(() => {
    if (!targetServerId || selectedServer || !servers.data) return;
    const match = servers.data.items.find(s => s.id === targetServerId);
    if (match) setSelectedServer(match);
  }, [targetServerId, servers.data, selectedServer]);
  const sshCreds = useQuery<SshCredential[]>({
    queryKey: ["sshCredentials"],
    queryFn: () => api("/api/ssh-credentials"),
    staleTime: 60_000,
  });
  const defaultCredId = sshCreds.data?.find(c => c.is_default)?.id ?? sshCreds.data?.[0]?.id;

  const rmQuery = useQuery({
    queryKey: ["resourceMap", selectedServer?.id],
    queryFn: () => api<RmApiData>(`/api/resource-map/server/${selectedServer!.id}`),
    enabled: !!selectedServer,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  useEffect(() => {
    if (!selectedServer) { setFlowData(null); return; }
    if (rmQuery.data) {
      const { nodes: n, edges: e } = apiToFlow(rmQuery.data);
      setFlowData({ nodes: n, edges: e });
    } else if (!rmQuery.isFetching && rmQuery.isError) {
      setFlowData({ nodes: [], edges: [] });
    }
  }, [rmQuery.data, rmQuery.isFetching, rmQuery.isError, selectedServer]);

  const runSshSync = useCallback(async (serverList: Server[], credId: number) => {
    if (syncRunningRef.current) return;
    syncRunningRef.current = true;
    syncAbortRef.current = false;
    setSyncProg({ done: 0, total: serverList.length, skipped: 0, status: "running" });
    let done = 0, skipped = 0;
    for (const s of serverList) {
      if (syncAbortRef.current) break;
      try {
        await api(`/api/servers/${s.id}/trust-host-key?ssh_credential_id=${credId}`, { method: "POST" }).catch(() => {});
        await api(`/api/servers/${s.id}/ssh-sync?ssh_credential_id=${credId}`, { method: "POST" });
        done++;
      } catch { skipped++; }
      setSyncProg(p => ({ ...p, done: done + skipped, skipped, status: "running" }));
    }
    syncRunningRef.current = false;
    setSyncProg({ done: done + skipped, total: serverList.length, skipped, status: "done" });
    if (!syncAbortRef.current) qc.invalidateQueries({ queryKey: ["servers"] });
  }, [qc]);

  const prevUpdatedAt = useRef(0);
  const initialDone = useRef(false);
  useEffect(() => {
    if (!servers.data || !initialDone.current) {
      if (servers.data) initialDone.current = true;
      prevUpdatedAt.current = servers.dataUpdatedAt;
      return;
    }
    if (servers.dataUpdatedAt > prevUpdatedAt.current && defaultCredId) {
      prevUpdatedAt.current = servers.dataUpdatedAt;
      runSshSync(servers.data.items, defaultCredId);
    }
  }, [servers.dataUpdatedAt, servers.data, defaultCredId, runSshSync]);

  useEffect(() => {
    const h = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) { document.exitFullscreen(); setFullscreen(false); }
    else { containerRef.current?.requestFullscreen(); setFullscreen(true); }
  };

  const q = search.toLowerCase();
  const filteredServers = (servers.data?.items ?? []).filter(s =>
    !q || s.name.toLowerCase().includes(q) ||
    (s.region ?? "").toLowerCase().includes(q) ||
    s.provider.toLowerCase().includes(q)
  );

  const CANVAS_H = "calc(100vh - 220px)";

  return (
    <div ref={containerRef} className={`flex flex-col ${fullscreen ? "fixed inset-0 z-50 bg-background p-4" : "p-6"} gap-4`}>
      <PageHeader
        title="Resource map"
        description="Infrastructure topology — servers, databases, storage, networking and services connected by live edges."
        actions={
          <button onClick={toggleFullscreen} className="p-2 rounded-md hover:bg-muted border border-border">
            {fullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </button>
        }
      />

      <div className="flex gap-4">
        {/* Left sidebar */}
        <div
          className="w-56 shrink-0 flex flex-col gap-2 overflow-hidden bg-background border border-border rounded-xl p-2"
          style={{ height: CANVAS_H }}
        >
          <div style={{ position: "relative", flexShrink: 0 }}>
            <Search style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 12, height: 12, color: "#9ca3af", pointerEvents: "none" }} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search servers…"
              className="w-full bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
              style={{ paddingLeft: 28, paddingRight: 12, paddingTop: 6, paddingBottom: 6, fontSize: 12 }}
            />
          </div>

          {/* SSH sync bar */}
          <div style={{ flexShrink: 0 }}>
            {(() => {
              if (syncProg.status === "running") {
                return (
                  <div style={{ padding: "0 4px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#9ca3af", marginBottom: 4 }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <RefreshCw className="animate-spin" style={{ width: 10, height: 10 }} />
                        Syncing {syncProg.done}/{syncProg.total}
                      </span>
                      <button onClick={() => { syncAbortRef.current = true; }} style={{ color: "#ef4444", background: "none", border: "none", cursor: "pointer", fontSize: 10 }}>stop</button>
                    </div>
                    <div style={{ height: 4, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", background: "#6366f1", borderRadius: 4, transition: "width 0.3s", width: syncProg.total ? `${(syncProg.done / syncProg.total) * 100}%` : "0%" }} />
                    </div>
                  </div>
                );
              }
              if (syncProg.status === "done") {
                return (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, padding: "0 4px" }}>
                    <span style={{ color: "#22c55e" }}>SSH sync done ✓</span>
                    {defaultCredId && <button onClick={() => runSshSync(servers.data!.items, defaultCredId)} style={{ color: "#9ca3af", background: "none", border: "none", cursor: "pointer", fontSize: 10 }}>re-run</button>}
                  </div>
                );
              }
              if (defaultCredId && servers.data?.items.length) {
                return (
                  <button
                    onClick={() => runSshSync(servers.data!.items, defaultCredId)}
                    className="w-full flex items-center justify-center gap-1.5 text-[10px] font-medium px-2 py-1.5 bg-muted hover:bg-muted/80 rounded-md border border-border transition-colors"
                  >
                    <Wifi className="size-3" /> Sync All via SSH
                  </button>
                );
              }
              return null;
            })()}
          </div>

          <div style={{ flex: 1, overflowY: "auto" }}>
            {filteredServers.length > 0 ? (
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#9ca3af", padding: "0 4px", marginBottom: 4 }}>
                  Servers ({filteredServers.length})
                </div>
                {filteredServers.map(s => (
                  <SidebarItem key={s.id} label={s.name}
                    sub={`${s.provider} · ${s.region ?? "—"}`}
                    status={s.status}
                    active={selectedServer?.id === s.id}
                    onClick={() => {
                      setSelectedServer(s);
                      setActiveNode(null);
                      setFlowData(null);
                      navigate({ search: { server: s.id } });
                    }}
                  />
                ))}
              </div>
            ) : q ? (
              <p style={{ fontSize: 11, color: "#9ca3af", padding: "0 4px" }}>No results.</p>
            ) : null}
          </div>
        </div>

        {/* Canvas */}
        <div
          className="flex-1 min-w-0 overflow-hidden relative rounded-xl border border-border"
          style={{ height: CANVAS_H, background: "#f8fafc" }}
        >
          {rmQuery.isFetching && (
            <div style={{
              position: "absolute", top: 12, right: 12, zIndex: 10,
              display: "flex", alignItems: "center", gap: 6,
              fontSize: 11, color: "#6b7280",
              background: "rgba(255,255,255,0.9)", backdropFilter: "blur(4px)",
              padding: "4px 10px", borderRadius: 8, border: "1px solid #e5e7eb",
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            }}>
              <RefreshCw className="animate-spin" style={{ width: 12, height: 12 }} />
              Fetching topology…
            </div>
          )}

          {(() => {
            if (!selectedServer) {
              return (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12, color: "#94a3b8" }}>
                  <Network style={{ width: 48, height: 48, opacity: 0.2 }} />
                  <p style={{ fontSize: 13 }}>Select a server from the left to view its topology.</p>
                </div>
              );
            }
            if (!flowData) return <MapSkeleton />;
            if (flowData.nodes.length === 0) {
              return (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12, color: "#94a3b8" }}>
                  <Network style={{ width: 48, height: 48, opacity: 0.2 }} />
                  <p style={{ fontSize: 13, textAlign: "center", maxWidth: 300 }}>
                    No cloud topology available for this server.<br />
                    <span style={{ fontSize: 11, color: "#b0b8c1" }}>Run a cloud sync to fetch connected resources (ELB, SGs, NICs, VPCs, etc.).</span>
                  </p>
                </div>
              );
            }
            return (
              <div style={{ width: "100%", height: "100%" }}>
                <ReactFlowProvider>
                  <FlowInner
                    nodes={flowData.nodes}
                    edges={flowData.edges}
                    onNodeClick={setActiveNode}
                  />
                </ReactFlowProvider>
              </div>
            );
          })()}
        </div>

        {/* Properties panel */}
        <div
          className="w-60 shrink-0 overflow-hidden bg-background border border-border rounded-xl flex flex-col"
          style={{ height: CANVAS_H }}
        >
          <div style={{ padding: "10px 16px", borderBottom: "1px solid #f3f4f6", flexShrink: 0 }}>
            <h3 style={{ fontSize: 11, fontWeight: 600, color: "#374151" }}>Properties</h3>
          </div>
          <div style={{ flex: 1, overflow: "hidden" }}>
            <PropsPanel node={activeNode} serverId={selectedServer?.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
