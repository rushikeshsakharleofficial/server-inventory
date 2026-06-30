import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api, type Page, type Server } from "@/lib/api";
import { Card, PageHeader, ProviderBadge, StatusPill } from "@/components/ui-bits";
import { useState } from "react";

export const Route = createFileRoute("/_app/resource-map")({
  head: () => ({ meta: [{ title: "Resource Map — System Control" }] }),
  component: ResourceMapPage,
});

function ResourceMapPage() {
  const [selected, setSelected] = useState<Server | null>(null);
  const { data } = useQuery({
    queryKey: ["servers", "map"],
    queryFn: () => api<Page<Server>>("/api/servers", { query: { limit: 200 } }),
  });

  // Group by provider → region → server
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
    queryFn: () => api<unknown>(`/api/resource-map/server/${selected!.id}`),
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
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">{selected.name}</h3>
                <StatusPill status={selected.status} />
              </div>
              <pre className="text-[10px] font-mono bg-background border border-border rounded-md p-3 overflow-auto whitespace-pre-wrap">
                {JSON.stringify(detail.data ?? {}, null, 2)}
              </pre>
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
