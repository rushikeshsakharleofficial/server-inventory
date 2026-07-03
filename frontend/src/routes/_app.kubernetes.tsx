import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type Page, type KubernetesCluster } from "@/lib/api";
import { Card, PageHeader, ProviderBadge, StatusPill, EmptyState } from "@/components/ui-bits";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { AdvancedFilter, emptyFilterState, type FilterState } from "@/components/advanced-filter";

export const Route = createFileRoute("/_app/kubernetes")({
  head: () => ({ meta: [{ title: "Kubernetes — System Control" }] }),
  component: KubernetesPage,
});

function match(s: string, q: string) { return s.toLowerCase().includes(q.toLowerCase()); }

function buildFields(items: KubernetesCluster[]) {
  const uniq = (vals: (string | undefined | null)[]) => [...new Set(vals.filter((v): v is string => !!v))].sort();
  return [
    { key: "provider", label: "Provider", type: "multiselect" as const, options: uniq(items.map(c => c.provider)).map(v => ({ value: v })) },
    { key: "status",   label: "Status",   type: "multiselect" as const, options: uniq(items.map(c => c.status)).map(v => ({ value: v })) },
    { key: "region",   label: "Region",   type: "multiselect" as const, options: uniq(items.map(c => c.region)).map(v => ({ value: v })) },
    { key: "version",  label: "Version",  type: "text" as const },
  ];
}

function KubernetesPage() {
  const qc = useQueryClient();
  const [fs, setFs] = useState<FilterState>(emptyFilterState);

  const { data } = useQuery({
    queryKey: ["k8s"],
    queryFn: () => api<Page<KubernetesCluster>>("/api/kubernetes", { query: { limit: 500 } }),
  });

  const sync = useMutation({
    mutationFn: () => api("/api/kubernetes/sync", { method: "POST" }),
    onSuccess: () => { toast.success("Kubernetes sync started"); qc.invalidateQueries({ queryKey: ["k8s"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const providers = (fs.filters.provider as string[] | undefined) ?? [];
  const statuses  = (fs.filters.status   as string[] | undefined) ?? [];
  const regions   = (fs.filters.region   as string[] | undefined) ?? [];
  const version   = (fs.filters.version  as string)  ?? "";

  const fields = buildFields(data?.items ?? []);

  const items = (data?.items ?? []).filter((c) => {
    if (fs.q && !match(c.name, fs.q) && !match(c.endpoint ?? "", fs.q) && !match(c.region ?? "", fs.q) && !match(c.version ?? "", fs.q)) return false;
    if (providers.length && !providers.includes(c.provider)) return false;
    if (statuses.length  && !statuses.includes(c.status))   return false;
    if (regions.length && !regions.includes(c.region ?? "")) return false;
    if (version && !match(c.version ?? "", version)) return false;
    return true;
  });

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Kubernetes clusters"
        description={`${items.length} of ${data?.total ?? 0} clusters across providers`}
        actions={
          <button onClick={() => sync.mutate()} disabled={sync.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md disabled:opacity-60">
            <RefreshCw className="size-3.5" /> Sync clusters
          </button>
        }
      />

      <Card className="p-3">
        <AdvancedFilter fields={fields} state={fs} onChange={setFs} searchPlaceholder="Search name, endpoint, region, version…" />
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full text-left">
          <thead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider bg-surface-muted border-b border-border">
            <tr>
              <th className="px-4 py-2 font-medium">Cluster</th>
              <th className="px-4 py-2 font-medium">Version</th>
              <th className="px-4 py-2 font-medium">Provider / Region</th>
              <th className="px-4 py-2 font-medium">Nodes</th>
              <th className="px-4 py-2 font-medium text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((c) => (
              <tr key={c.id} className="text-sm">
                <td className="px-4 py-2.5">
                  <div className="font-medium">{c.name}</div>
                  {c.endpoint && <div className="font-mono text-[11px] text-muted-foreground truncate max-w-[200px]">{c.endpoint}</div>}
                </td>
                <td className="px-4 py-2.5 font-mono text-xs">{c.version ?? "—"}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <ProviderBadge provider={c.provider} />
                    <span className="text-xs text-muted-foreground">{c.region ?? "—"}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5 font-mono text-xs">{c.node_count ?? "—"}</td>
                <td className="px-4 py-2.5 text-right"><StatusPill status={c.status} /></td>
              </tr>
            ))}
            {data && items.length === 0 && (
              <tr><td colSpan={5}><EmptyState title="No clusters match" description="Adjust filters or run a sync." /></td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
