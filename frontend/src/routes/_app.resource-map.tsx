import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api, type Page, type Server } from "@/lib/api";
import { useCallback, useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/_app/resource-map")({
  head: () => ({ meta: [{ title: "Resource Map — System Control" }] }),
  component: ResourceMapPage,
});

// ── types ────────────────────────────────────────────────────────────────────
interface Node {
  id: number;
  server: Server;
  x: number;
  y: number;
}

// ── helpers ──────────────────────────────────────────────────────────────────
function statusColor(status: string): string {
  const s = status.toLowerCase();
  if (s === "running" || s === "active") return "#22c55e";
  if (s === "stopped" || s === "terminated") return "#ef4444";
  return "#6b7280";
}

function initNodes(servers: Server[], cx: number, cy: number): Node[] {
  const total = servers.length;
  const radius = Math.min(300, Math.max(120, total * 18));
  return servers.map((s, i) => {
    const angle = (i / total) * 2 * Math.PI - Math.PI / 2;
    return { id: s.id, server: s, x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
  });
}

// ── component ────────────────────────────────────────────────────────────────
function ResourceMapPage() {
  const { data } = useQuery({
    queryKey: ["servers", "map"],
    queryFn: () => api<Page<Server>>("/api/servers", { query: { limit: 200 } }),
  });

  const servers = data?.items ?? [];

  // SVG container size
  const svgRef = useRef<SVGSVGElement>(null);
  const [svgSize, setSvgSize] = useState({ w: 800, h: 600 });
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSvgSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // nodes: re-initialise only when server list changes
  const [nodes, setNodes] = useState<Node[]>([]);
  const initialised = useRef(false);
  useEffect(() => {
    if (servers.length === 0) return;
    if (initialised.current) return;
    initialised.current = true;
    setNodes(initNodes(servers, svgSize.w / 2, svgSize.h / 2));
  }, [servers, svgSize]);

  // pan state
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panStart = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);

  // drag-node state
  const dragNode = useRef<{ id: number; ox: number; oy: number; mx: number; my: number } | null>(null);

  const [selected, setSelected] = useState<Server | null>(null);

  // ── pointer events on SVG background (pan) ─────────────────────────────
  const onBgPointerDown = useCallback((e: React.PointerEvent<SVGRectElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    panStart.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y };
  }, [pan]);

  const onBgPointerMove = useCallback((e: React.PointerEvent<SVGRectElement>) => {
    if (!panStart.current) return;
    setPan({
      x: panStart.current.px + e.clientX - panStart.current.mx,
      y: panStart.current.py + e.clientY - panStart.current.my,
    });
  }, []);

  const onBgPointerUp = useCallback(() => { panStart.current = null; }, []);

  // ── pointer events on nodes (drag) ─────────────────────────────────────
  const onNodePointerDown = useCallback((e: React.PointerEvent<SVGCircleElement>, id: number) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const n = nodes.find(n => n.id === id);
    if (!n) return;
    dragNode.current = { id, ox: n.x, oy: n.y, mx: e.clientX, my: e.clientY };
  }, [nodes]);

  const onNodePointerMove = useCallback((e: React.PointerEvent<SVGCircleElement>) => {
    const d = dragNode.current;
    if (!d) return;
    const dx = e.clientX - d.mx;
    const dy = e.clientY - d.my;
    setNodes(prev => prev.map(n => n.id === d.id ? { ...n, x: d.ox + dx, y: d.oy + dy } : n));
  }, []);

  const onNodePointerUp = useCallback((e: React.PointerEvent<SVGCircleElement>, server: Server) => {
    const d = dragNode.current;
    dragNode.current = null;
    // treat as click if moved < 4px
    const moved = Math.abs(e.clientX - (d?.mx ?? 0)) + Math.abs(e.clientY - (d?.my ?? 0));
    if (moved < 4) setSelected(srv => srv?.id === server.id ? null : server);
  }, []);

  // ── edges: connect nodes sharing the same provider ──────────────────────
  const edges: [number, number][] = [];
  const byProvider = new Map<string, number[]>();
  for (const n of nodes) {
    const p = n.server.provider || "unknown";
    if (!byProvider.has(p)) byProvider.set(p, []);
    byProvider.get(p)!.push(n.id);
  }
  for (const ids of byProvider.values()) {
    for (let i = 0; i < ids.length - 1; i++) edges.push([ids[i], ids[i + 1]]);
  }
  const nodeById = new Map(nodes.map(n => [n.id, n]));

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* canvas */}
      <div className="flex-1 relative">
        <svg
          ref={svgRef}
          className="w-full h-full bg-[#0f0f0f]"
          style={{ display: "block" }}
        >
          <g transform={`translate(${pan.x},${pan.y})`}>
            {/* background hit area for pan */}
            <rect
              x={-10000} y={-10000} width={20000} height={20000}
              fill="transparent"
              style={{ cursor: panStart.current ? "grabbing" : "grab" }}
              onPointerDown={onBgPointerDown}
              onPointerMove={onBgPointerMove}
              onPointerUp={onBgPointerUp}
            />

            {/* edges */}
            {edges.map(([a, b]) => {
              const na = nodeById.get(a);
              const nb = nodeById.get(b);
              if (!na || !nb) return null;
              return (
                <line
                  key={`${a}-${b}`}
                  x1={na.x} y1={na.y} x2={nb.x} y2={nb.y}
                  stroke="#374151" strokeWidth={1} strokeDasharray="4 4"
                />
              );
            })}

            {/* nodes */}
            {nodes.map(n => {
              const color = statusColor(n.server.status);
              const isSelected = selected?.id === n.server.id;
              return (
                <g key={n.id} style={{ cursor: "pointer" }}>
                  {/* glow ring when selected */}
                  {isSelected && (
                    <circle cx={n.x} cy={n.y} r={22} fill="none" stroke={color} strokeWidth={2} opacity={0.5} />
                  )}
                  <circle
                    cx={n.x} cy={n.y} r={16}
                    fill={color}
                    fillOpacity={0.15}
                    stroke={color}
                    strokeWidth={isSelected ? 2 : 1.5}
                    onPointerDown={e => onNodePointerDown(e, n.id)}
                    onPointerMove={onNodePointerMove}
                    onPointerUp={e => onNodePointerUp(e, n.server)}
                    style={{ touchAction: "none" }}
                  />
                  {/* label */}
                  <text
                    x={n.x} y={n.y + 30}
                    textAnchor="middle"
                    fontSize={10}
                    fill="#e5e7eb"
                    style={{ pointerEvents: "none", userSelect: "none" }}
                  >
                    {n.server.name}
                  </text>
                  <text
                    x={n.x} y={n.y + 42}
                    textAnchor="middle"
                    fontSize={8}
                    fill="#6b7280"
                    style={{ pointerEvents: "none", userSelect: "none" }}
                  >
                    {n.server.provider}{n.server.region ? ` · ${n.server.region}` : ""}
                  </text>
                </g>
              );
            })}
          </g>

          {/* empty state */}
          {nodes.length === 0 && (
            <text x="50%" y="50%" textAnchor="middle" fill="#4b5563" fontSize={14}>
              No servers to display.
            </text>
          )}
        </svg>
      </div>

      {/* detail panel */}
      {selected && (
        <aside className="w-72 border-l border-[#1f2937] bg-[#111827] p-5 overflow-y-auto flex-shrink-0">
          <div className="flex items-start justify-between mb-4">
            <h2 className="text-sm font-semibold text-white leading-snug">{selected.name}</h2>
            <button
              onClick={() => setSelected(null)}
              className="text-[#6b7280] hover:text-white text-xs leading-none mt-0.5"
            >✕</button>
          </div>
          <dl className="space-y-2.5 text-xs">
            {[
              ["Status", selected.status],
              ["Provider", selected.provider],
              ["Region", selected.region ?? "—"],
              ["IP", selected.public_ip ?? "—"],
              ["Instance type", selected.instance_type ?? "—"],
              ["OS", selected.os ?? "—"],
              ["vCPU", selected.vcpu ?? "—"],
              ["Memory", selected.memory_gb != null ? `${selected.memory_gb} GB` : "—"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2">
                <dt className="text-[#6b7280] shrink-0">{k}</dt>
                <dd className="text-[#e5e7eb] font-mono text-right break-all">{v}</dd>
              </div>
            ))}
          </dl>
        </aside>
      )}
    </div>
  );
}
