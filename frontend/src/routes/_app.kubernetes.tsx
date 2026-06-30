import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type Page, type KubernetesCluster } from "@/lib/api";
import { Card, PageHeader, ProviderBadge, StatusPill, EmptyState } from "@/components/ui-bits";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/kubernetes")({
  head: () => ({ meta: [{ title: "Kubernetes — System Control" }] }),
  component: KubernetesPage,
});

function KubernetesPage() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["k8s"],
    queryFn: () => api<Page<KubernetesCluster>>("/api/kubernetes", { query: { limit: 200 } }),
  });
  const sync = useMutation({
    mutationFn: () => api("/api/kubernetes/sync", { method: "POST" }),
    onSuccess: () => {
      toast.success("Kubernetes sync started");
      qc.invalidateQueries({ queryKey: ["k8s"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Kubernetes clusters"
        description={`${data?.total ?? 0} clusters across providers`}
        actions={
          <button
            onClick={() => sync.mutate()}
            disabled={sync.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md disabled:opacity-60"
          >
            <RefreshCw className="size-3.5" /> Sync clusters
          </button>
        }
      />
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
            {(data?.items ?? []).map((c) => (
              <tr key={c.id} className="text-sm">
                <td className="px-4 py-2.5 font-medium">{c.name}</td>
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
            {data && data.items.length === 0 && (
              <tr><td colSpan={5}><EmptyState title="No clusters discovered" description="Run a sync to populate." /></td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
