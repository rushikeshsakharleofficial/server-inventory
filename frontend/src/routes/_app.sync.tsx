import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api, type SyncLog } from "@/lib/api";
import { Card, PageHeader, ProviderBadge, StatusPill } from "@/components/ui-bits";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_app/sync")({
  head: () => ({ meta: [{ title: "Sync — System Control" }] }),
  component: SyncPage,
});

function SyncPage() {
  const { data } = useQuery({
    queryKey: ["syncLogs", "all"],
    queryFn: () => api<SyncLog[]>("/api/sync/logs", { query: { limit: 100 } }),
    refetchInterval: 3_000,
  });

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Sync activity"
        description="Live log of resource discovery runs across providers."
      />

      <Card className="overflow-hidden">
        <table className="w-full text-left">
          <thead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider bg-surface-muted border-b border-border">
            <tr>
              <th className="px-4 py-2 font-medium">Provider</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Added</th>
              <th className="px-4 py-2 font-medium">Updated</th>
              <th className="px-4 py-2 font-medium">Started</th>
              <th className="px-4 py-2 font-medium">Duration</th>
              <th className="px-4 py-2 font-medium">Error</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(data ?? []).map((l) => {
              const dur =
                l.started_at && l.completed_at
                  ? `${Math.round((new Date(l.completed_at).getTime() - new Date(l.started_at).getTime()) / 1000)}s`
                  : l.status === "running"
                    ? "…"
                    : "—";
              return (
                <tr key={l.id} className="text-sm">
                  <td className="px-4 py-2.5">
                    <ProviderBadge provider={l.provider ?? "all"} />
                  </td>
                  <td className="px-4 py-2.5"><StatusPill status={l.status} /></td>
                  <td className="px-4 py-2.5 font-mono text-xs">{l.servers_added}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{l.servers_updated}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {l.started_at ? formatDistanceToNow(new Date(l.started_at), { addSuffix: true }) : "—"}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs">{dur}</td>
                  <td className="px-4 py-2.5 text-xs text-red-600 max-w-xs truncate">{l.error_message ?? ""}</td>
                </tr>
              );
            })}
            {data && data.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-xs text-muted-foreground">
                  No sync runs yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
