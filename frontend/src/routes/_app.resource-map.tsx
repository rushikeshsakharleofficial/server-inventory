import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api, type Page, type Server } from "@/lib/api";
import { Card, PageHeader, ProviderBadge, StatusPill } from "@/components/ui-bits";
import { useState } from "react";

export const Route = createFileRoute("/_app/resource-map")({
  head: () => ({ meta: [{ title: "Resource Map — System Control" }] }),
  component: ResourceMapPage,
});

interface RmNode { id: string; type: string; category: string; label: string; properties?: Record<string, unknown> }
interface RmEdge { from: string; to: string; label?: string }
interface RmData { resource: { id: number; name: string; type: string; provider: string; region: string | null }; nodes: RmNode[]; edges: RmEdge[] }

const NODE_W = 120;
const NODE_H = 40;
const COL_W = 160;
const ROW_H = 70;

function categoryColor(cat: string) {
  const m: Record<string, string> = {
    server: "#6366f1", database: "#f59e0b", kubernetes: "#10b981",
    storage: "#3b82f6", network: "#8b5cf6", iam: "#ec4899", unknown: "#6b7280",
  };
  return m[cat] ?? m.unknown;
}

function ResourceFlowChart({ data }: { data: RmData }) {
  const nodes = data.nodes;
  const edges = data.edges;

  const cats = [...new Set(nodes.map(n => n.category))];
  const pos = new Map<string, { x: number; y: number }>();
  cats.forEach((cat, ci) => {
    nodes.filter(n => n.category === cat).forEach((n, ri) => {
      pos.set(n.id, { x: ci * COL_W + 20, y: ri * ROW_H + 20 });
    });
  });

  const svgW = Math.max(cats.length * COL_W + 40, 300);
  const maxRows = cats.reduce((m, cat) => Math.max(m, nodes.filter(n => n.category === cat).length), 0);
  const svgH = Math.max(maxRows * ROW_H + 60, 200);

  if (nodes.length === 0) return (
    <p className="text-xs text-muted-foreground text-center py-8">No connected resources found.</p>
  );

  return (
    <svg width="100%" viewBox={`0 0 ${svgW} ${svgH}`} className="overflow-visible">
      <defs>
        <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3 z" fill="#94a3b8" />
        </marker>
      </defs>
      {edges.map((e, i) => {
        const a = pos.get(e.from);
        const b = pos.get(e.to);
        if (!a || !b) return null;
        const x1 = a.x + NODE_W / 2, y1 = a.y + NODE_H / 2;
        const x2 = b.x + NODE_W / 2, y2 = b.y + NODE_H / 2;
        return (
          <g key={i}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#94a3b8" strokeWidth={1} markerEnd="url(#arrow)" />
            {e.label && <text x={(x1+x2)/2} y={(y1+y2)/2 - 4} fontSize={9} fill="#94a3b8" textAnchor="middle">{e.label}</text>}
          </g>
        );
      })}
      {nodes.map(n => {
        const p = pos.get(n.id);
        if (!p) return null;
        const color = categoryColor(n.category);
        return (
          <g key={n.id}>
            <rect x={p.x} y={p.y} width={NODE_W} height={NODE_H} rx={6} fill="white" stroke={color} strokeWidth={1.5} />
            <rect x={p.x} y={p.y} width={4} height={NODE_H} rx={2} fill={color} />
            <text x={p.x + 12} y={p.y + 14} fontSize={9} fill="#6b7280" fontFamily="monospace">{n.category}</text>
            <text x={p.x + 12} y={p.y + 27} fontSize={11} fill="#111" fontWeight="500">
              {n.label.length > 14 ? n.label.slice(0, 13) + "…" : n.label}
            </text>
            {n.type && n.type !== n.category &&
              <text x={p.x + 12} y={p.y + 37} fontSize={8} fill="#9ca3af">{n.type}</text>}
          </g>
        );
      })}
    </svg>
  );
}

function ResourceMapPage() {
  const [selected, setSelected] = useState<Server | null>(null);
  const { data } = useQuery({
    queryKey: ["servers", "map"],
    queryFn: () => api<Page<Server>>("/api/servers", { query: { limit: 200 } }),
  });

  const tree = new Map<string, Map<string, Server[]>>();
  for (const s of data?.items ?? []) {
    const p = s.provider || "unknown";
    const r = s.region || "—";
    if (!tree.has(p)) tree.set(p, new Map());
    const sub = tree.get(p)!;
    if (!sub.has(r)) sub.set(r, []);
    sub.get(r)!.push(s);
  }

  const detail = useQuery({
    queryKey: ["resourceMap", selected?.id],
    queryFn: () => api<RmData>(`/api/resource-map/server/${selected!.id}`),
    enabled: !!selected,
  });

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Resource map"
        description="Topology of every discovered resource grouped by provider and region."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-4 space-y-6 overflow-auto max-h-[75vh]">
          {[...tree.entries()].map(([prov, regions]) => (
            <div key={prov}>
              <div className="flex items-center justify-between mb-3">
                <ProviderBadge provider={prov} />
                <span className="text-[10px] font-mono text-muted-foreground">
                  {[...regions.values()].reduce((a, b) => a + b.length, 0)} resources
                </span>
              </div>
              <div className="ml-2 pl-4 border-l border-dashed border-border space-y-3">
                {[...regions.entries()].map(([r, servers]) => (
                  <div key={r}>
                    <div className="text-xs font-mono text-muted-foreground mb-1.5">{r}</div>
                    <div className="flex flex-wrap gap-2">
                      {servers.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => setSelected(s)}
                          className={`px-2 py-1 text-xs rounded-md border transition-colors text-left ${
                            selected?.id === s.id
                              ? "bg-secondary border-foreground"
                              : "bg-surface border-border hover:border-muted-foreground/40"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="size-1.5 rounded-full bg-emerald-500" />
                            <span className="font-medium">{s.name}</span>
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono">{s.public_ip ?? "—"}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {tree.size === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No resources to map yet.</p>
          )}
        </Card>

        <Card className="p-4 overflow-auto max-h-[75vh]">
          {selected ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold">{selected.name}</h3>
                <StatusPill status={selected.status} />
              </div>
              {detail.isLoading && (
                <p className="text-xs text-muted-foreground text-center py-8">Loading connections…</p>
              )}
              {detail.data && <ResourceFlowChart data={detail.data} />}
              {detail.data && detail.data.nodes.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2 pt-3 border-t border-border">
                  {[...new Set(detail.data.nodes.map(n => n.category))].map(cat => (
                    <span key={cat} className="text-[10px] px-2 py-0.5 rounded-full border border-border text-muted-foreground">
                      {cat}
                    </span>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              Select a resource to inspect its relationships.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
