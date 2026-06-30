import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type Page, type DatabaseInstance } from "@/lib/api";
import { Card, PageHeader, ProviderBadge, StatusPill, EmptyState } from "@/components/ui-bits";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/databases")({
  head: () => ({ meta: [{ title: "Databases — System Control" }] }),
  component: DatabasesPage,
});

function DatabasesPage() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["dbs"],
    queryFn: () => api<Page<DatabaseInstance>>("/api/databases", { query: { limit: 200 } }),
  });
  const sync = useMutation({
    mutationFn: () => api("/api/databases/sync", { method: "POST" }),
    onSuccess: () => {
      toast.success("Database sync started");
      qc.invalidateQueries({ queryKey: ["dbs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Databases"
        description={`${data?.total ?? 0} managed database instances`}
        actions={
          <button
            onClick={() => sync.mutate()}
            disabled={sync.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md disabled:opacity-60"
          >
            <RefreshCw className="size-3.5" /> Sync databases
          </button>
        }
      />

      <Card className="overflow-hidden">
        <table className="w-full text-left">
          <thead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider bg-surface-muted border-b border-border">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Engine</th>
              <th className="px-4 py-2 font-medium">Provider / Region</th>
              <th className="px-4 py-2 font-medium">Endpoint</th>
              <th className="px-4 py-2 font-medium text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(data?.items ?? []).map((d) => (
              <tr key={d.id} className="text-sm">
                <td className="px-4 py-2.5 font-medium">{d.name}</td>
                <td className="px-4 py-2.5">
                  <span className="text-xs bg-muted px-1.5 py-0.5 rounded border border-border">
                    {d.engine ?? "—"}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <ProviderBadge provider={d.provider} />
                    <span className="text-xs text-muted-foreground">{d.region ?? "—"}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground truncate max-w-xs">
                  {d.endpoint ?? "—"}{d.port ? `:${d.port}` : ""}
                </td>
                <td className="px-4 py-2.5 text-right"><StatusPill status={d.status} /></td>
              </tr>
            ))}
            {data && data.items.length === 0 && (
              <tr><td colSpan={5}><EmptyState title="No databases discovered" description="Run a sync to populate." /></td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
