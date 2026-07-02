import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api, type SyncLog } from "@/lib/api";
import { Card, PageHeader, ProviderBadge, StatusPill } from "@/components/ui-bits";
import { formatDistanceToNow } from "date-fns";
import { AdvancedFilter, emptyFilterState, type FilterState } from "@/components/advanced-filter";

export const Route = createFileRoute("/_app/sync")({
  head: () => ({ meta: [{ title: "Sync — System Control" }] }),
  component: SyncPage,
});

const FIELDS = [
  { key: "status",   label: "Status",   type: "multiselect" as const, options: ["running","success","failed"].map(v => ({ value: v })) },
  { key: "provider", label: "Provider", type: "text" as const },
];

function SyncPage() {
  const [fs, setFs] = useState<FilterState>(emptyFilterState);

  const { data } = useQuery({
    queryKey: ["syncLogs", "all"],
    queryFn: () => api<SyncLog[]>("/api/sync/logs", { query: { limit: 100 } }),
  });

  const statuses = (fs.filters.status   as string[] | undefined) ?? [];
  const provFilter = (fs.filters.provider as string) ?? "";

  const items = (data ?? []).filter((l) => {
    if (fs.q && !(l.provider ?? "all").toLowerCase().includes(fs.q.toLowerCase()) && !(l.error_message ?? "").toLowerCase().includes(fs.q.toLowerCase())) return false;
    if (statuses.length && !statuses.includes(l.status)) return false;
    if (provFilter && !(l.provider ?? "all").toLowerCase().includes(provFilter.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Sync activity"
        description="Live log of resource discovery runs across providers."
      />

      <Card className="p-3">
        <AdvancedFilter fields={FIELDS} state={fs} onChange={setFs} searchPlaceholder="Search provider or error…" />
      </Card>

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
            {items.map((l) => {
              const dur =
                l.started_at && l.completed_at
                  ? `${Math.round((new Date(l.completed_at).getTime() - new Date(l.started_at).getTime()) / 1000)}s`
                  : l.status === "running" ? "…" : "—";
              return (
                <tr key={l.id} className="text-sm">
                  <td className="px-4 py-2.5"><ProviderBadge provider={l.provider ?? "all"} /></td>
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
            {data && items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-xs text-muted-foreground">
                  No sync runs match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
