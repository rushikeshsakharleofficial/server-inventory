import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { ReactFlowProvider, type Node, type Edge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toast } from "sonner";
import { api, type Page, type Server } from "@/lib/api";
import type { SshCredential } from "@/lib/api";
import { apiToFlow, type RmApiData } from "@/lib/resource-map-layout";
import { PageHeader, StatusPill } from "@/components/ui-bits";
import { FlowInner, PropsPanel } from "@/components/resource-map-view";
import { Maximize2, Minimize2, RefreshCw, Search, Network } from "lucide-react";

export const Route = createFileRoute("/_app/resource-map")({
  head: () => ({ meta: [{ title: "Resource Map — System Control" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    server: search.server ? Number(search.server) : undefined,
  }),
  component: ResourceMapPage,
});

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
    let done = 0, skipped = 0;
    for (const s of serverList) {
      if (syncAbortRef.current) break;
      try {
        await api(`/api/servers/${s.id}/ssh-sync?ssh_credential_id=${credId}`, { method: "POST" });
        done++;
      } catch { skipped++; }
    }
    syncRunningRef.current = false;
    if (skipped) toast.error(`SSH sync failed for ${skipped} of ${done + skipped} servers`);
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

          <div style={{ flex: 1, overflowY: "auto" }}>
            {(() => {
              if (filteredServers.length > 0) {
                return (
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
                );
              }
              if (q) {
                return <p style={{ fontSize: 11, color: "#9ca3af", padding: "0 4px" }}>No results.</p>;
              }
              return null;
            })()}
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
