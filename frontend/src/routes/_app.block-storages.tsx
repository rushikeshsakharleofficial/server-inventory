import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type Page, type BlockStorage } from "@/lib/api";
import { Card, PageHeader, ProviderBadge, StatusPill, EmptyState } from "@/components/ui-bits";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/block-storages")({
  head: () => ({ meta: [{ title: "Block Storage — System Control" }] }),
  component: BlockStoragePage,
});

function BlockStoragePage() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["bs"],
    queryFn: () => api<Page<BlockStorage>>("/api/block-storages", { query: { limit: 200 } }),
  });
  const sync = useMutation({
    mutationFn: () => api("/api/block-storages/sync", { method: "POST" }),
    onSuccess: () => {
      toast.success("Block storage sync started");
      qc.invalidateQueries({ queryKey: ["bs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Block storage"
        description={`${data?.total ?? 0} volumes`}
        actions={
          <button
            onClick={() => sync.mutate()}
            disabled={sync.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md disabled:opacity-60"
          >
            <RefreshCw className="size-3.5" /> Sync volumes
          </button>
        }
      />
      <Card className="overflow-hidden">
        <table className="w-full text-left">
          <thead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider bg-surface-muted border-b border-border">
            <tr>
              <th className="px-4 py-2 font-medium">Volume</th>
              <th className="px-4 py-2 font-medium">Size</th>
              <th className="px-4 py-2 font-medium">Provider / Region</th>
              <th className="px-4 py-2 font-medium">Attached</th>
              <th className="px-4 py-2 font-medium text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(data?.items ?? []).map((v) => (
              <tr key={v.id} className="text-sm">
                <td className="px-4 py-2.5 font-medium">{v.name}</td>
                <td className="px-4 py-2.5 font-mono text-xs">{v.size_gb ? `${v.size_gb} GB` : "—"}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <ProviderBadge provider={v.provider} />
                    <span className="text-xs text-muted-foreground">{v.region ?? "—"}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{v.attached_to ?? "—"}</td>
                <td className="px-4 py-2.5 text-right"><StatusPill status={v.status} /></td>
              </tr>
            ))}
            {data && data.items.length === 0 && (
              <tr><td colSpan={5}><EmptyState title="No volumes discovered" /></td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
