import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api, type SyncLog } from "@/lib/api";
import { Card, PageHeader, ProviderBadge, StatusPill } from "@/components/ui-bits";
import { formatDistanceToNow } from "date-fns";
import { AdvancedFilter, emptyFilterState, type FilterState } from "@/components/advanced-filter";
import { SmartTable, type SmartTableColumn } from "@/components/SmartTable";

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
  const [page, setPage] = useState(1);

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

  const columns: SmartTableColumn<SyncLog>[] = [
    { key: "provider", header: "Provider", render: (l) => <ProviderBadge provider={l.provider ?? "all"} /> },
    { key: "status", header: "Status", render: (l) => <StatusPill status={l.status} /> },
    { key: "added", header: "Added", className: "font-mono text-xs", render: (l) => l.servers_added },
    { key: "updated", header: "Updated", className: "font-mono text-xs", render: (l) => l.servers_updated },
    {
      key: "started",
      header: "Started",
      className: "text-xs text-muted-foreground",
      render: (l) => (l.started_at ? formatDistanceToNow(new Date(l.started_at), { addSuffix: true }) : "—"),
    },
    {
      key: "duration",
      header: "Duration",
      className: "font-mono text-xs",
      render: (l) => {
        if (l.started_at && l.completed_at) {
          const seconds = Math.round(
            (new Date(l.completed_at).getTime() - new Date(l.started_at).getTime()) / 1000,
          );
          return `${seconds}s`;
        }
        return l.status === "running" ? "…" : "—";
      },
    },
    {
      key: "error",
      header: "Error",
      className: "text-xs text-red-600 max-w-xs truncate",
      render: (l) => l.error_message ?? "",
    },
  ];

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Sync activity"
        description="Live log of resource discovery runs across providers."
      />

      <Card className="p-3">
        <AdvancedFilter
          fields={FIELDS}
          state={fs}
          onChange={(s) => { setFs(s); setPage(1); }}
          searchPlaceholder="Search provider or error…"
        />
      </Card>

      <SmartTable
        columns={columns}
        rows={items}
        rowKey={(l) => l.id}
        mode="client"
        page={page}
        onPageChange={setPage}
        totalItems={items.length}
        isLoading={!data}
        empty={
          <div className="px-4 py-8 text-center text-xs text-muted-foreground">No sync runs match.</div>
        }
      />
    </div>
  );
}
