import type { Node, Edge } from "@xyflow/react";
import { MarkerType } from "@xyflow/react";

export interface RmNodeData extends Record<string, unknown> {
  label: string;
  name: string;
  meta?: string;
  details?: string;
  status?: string;
  resourceType?: string;
  isRoot?: boolean;
  properties?: Record<string, string>;
}

export interface RmApiNode {
  id: string; type: string; category: string; label: string;
  properties?: Record<string, unknown>;
}
export interface RmApiEdge { from: string; to: string; label?: string }
export interface RmApiData {
  resource: { id: number; name: string; type: string; provider: string; region: string | null };
  nodes: RmApiNode[];
  edges: RmApiEdge[];
}

export function layoutNodes(apiNodes: RmApiNode[], rootId: string): Map<string, { x: number; y: number }> {
  const COL_W = 280, ROW_H = 130;

  // Determine tree depth from root using BFS
  // We get edges from the API response, passed separately
  // For layout, group by category then order root category first
  const cats = [...new Set(apiNodes.map(n => n.category))];
  const rootCat = apiNodes.find(n => n.id === rootId)?.category ?? "compute";
  const catOrder = [rootCat, ...cats.filter(c => c !== rootCat)];
  const catCol = new Map(catOrder.map((c, i) => [c, i]));
  const catRow = new Map<string, number>();

  const pos = new Map<string, { x: number; y: number }>();
  for (const n of apiNodes) {
    const col = catCol.get(n.category) ?? 0;
    const row = catRow.get(n.category) ?? 0;
    catRow.set(n.category, row + 1);
    pos.set(n.id, { x: col * COL_W, y: row * ROW_H + (col % 2 === 1 ? 50 : 0) });
  }
  return pos;
}

// ─── Convert API data → Flow nodes + edges ────────────────────────────────────

export function apiToFlow(rmData: RmApiData): { nodes: Node[]; edges: Edge[] } {
  // Derive root node id from edges (the "from" id that has no matching node in nodes[])
  const nodeIds = new Set(rmData.nodes.map(n => n.id));
  const edgeFromIds = rmData.edges.map(e => e.from);
  const inferredRootId = edgeFromIds.find(id => !nodeIds.has(id));
  const rootId = inferredRootId ?? rmData.nodes.find(n => n.category === "compute" || n.type === "server")?.id ?? rmData.nodes[0]?.id ?? "";

  // Synthesize root node from resource metadata if missing from nodes[]
  const allNodes: RmApiNode[] = nodeIds.has(rootId) ? rmData.nodes : [
    {
      id: rootId,
      type: "server",
      category: "compute",
      label: rmData.resource.name,
      properties: { provider: rmData.resource.provider, region: rmData.resource.region ?? "" },
    },
    ...rmData.nodes,
  ];

  const pos = layoutNodes(allNodes, rootId);

  // All edge endpoints are connected; root always included
  const connectedIds = new Set<string>();
  if (rootId) connectedIds.add(rootId);
  for (const e of rmData.edges) {
    connectedIds.add(e.from);
    connectedIds.add(e.to);
  }

  // Only render nodes that appear in at least one edge (or are root)
  const visibleNodes = allNodes.filter(n => connectedIds.has(n.id));

  const nodes: Node[] = visibleNodes.map(n => {
    const p = n.properties ?? {};
    const position = pos.get(n.id) ?? { x: 0, y: 0 };
    return {
      id: n.id,
      type: "resourceNode",
      position,
      data: {
        label: n.type,
        name: n.label,
        meta: String(p.os ?? p.engine ?? p.cidr ?? p.ip ?? p.version ?? p.type ?? ""),
        details: (() => {
          const parts: string[] = [];
          if (p.vcpu || p.vcpus) parts.push(`${String(p.vcpu ?? p.vcpus)} vCPU`);
          if (p.memory_gb) parts.push(`${String(p.memory_gb)} GB RAM`);
          if (p.size_mb) parts.push(`${Math.round(Number(p.size_mb) / 1024)} GB`);
          if (p.rules) parts.push(`${String(p.rules)} rules`);
          if (p.count) parts.push(`${String(p.count)} nodes`);
          return parts.join(" · ") || "";
        })(),
        status: String(p.status ?? p.state ?? p.power_status ?? ""),
        resourceType: n.category,
        isRoot: n.id === rootId,
        properties: Object.fromEntries(
          Object.entries(p)
            .filter(([, v]) => v !== null && v !== undefined && String(v) !== "" && String(v) !== "undefined")
            .map(([k, v]) => [k, String(v)])
        ),
      } satisfies RmNodeData,
    };
  });

  const validIds = new Set(nodes.map(n => n.id));
  const edges: Edge[] = rmData.edges
    .filter(e => validIds.has(e.from) && validIds.has(e.to))
    .map((e, i) => ({
      id: `e${i}-${e.from}-${e.to}`,
      source: e.from,
      target: e.to,
      type: "smoothstep",
      label: e.label,
      labelStyle: { fontSize: 9, fill: "#94a3b8" },
      labelBgStyle: { fill: "#fff", fillOpacity: 0.85 },
      style: { stroke: "#cbd5e1", strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: "#cbd5e1", width: 10, height: 10 },
    }));

  return { nodes, edges };
}
