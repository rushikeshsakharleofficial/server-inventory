import { Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import {
  ReactFlow, Background, Controls, MiniMap,
  type Node, type Edge, type NodeTypes, type NodeProps,
  useNodesState, useEdgesState, useReactFlow,
  Handle, Position, BackgroundVariant,
} from "@xyflow/react";
import type { RmNodeData } from "@/lib/resource-map-layout";
import {
  ExternalLink, Server as ServerIcon, Database, HardDrive, Shield,
  Globe, Layers, Activity, Box,
} from "lucide-react";

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

function ResourceNode({ data, selected }: NodeProps<Node<RmNodeData>>) {
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

// ─── Properties panel ─────────────────────────────────────────────────────────

export function PropsPanel({ node, serverId }: Readonly<{ node: Node | null; serverId?: number }>) {
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

export function FlowInner({
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
