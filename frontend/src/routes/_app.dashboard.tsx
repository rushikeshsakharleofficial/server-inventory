import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api, type Stats, type SyncLog, type Credential, type Page } from "@/lib/api";
import { Card, KpiTile, ProviderBadge, StatusPill, PageHeader } from "@/components/ui-bits";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — System Control" }] }),
  component: Dashboard,
});

function Dashboard() {
  const stats = useQuery({
    queryKey: ["stats"],
    queryFn: () => api<Stats>("/api/servers/stats"),
    refetchInterval: 15_000,
  });
  const logs = useQuery({
    queryKey: ["syncLogs", "dash"],
    queryFn: () => api<SyncLog[]>("/api/sync/logs", { query: { limit: 6 } }),
    refetchInterval: 5_000,
  });
  const creds = useQuery({
    queryKey: ["creds"],
    queryFn: () => api<Page<Credential>>("/api/credentials", { query: { limit: 20 } }),
  });

  const running = logs.data?.find((l) => l.status === "running");
  const data = stats.data;
  const providers = data ? Object.entries(data.by_provider) : [];
  const regions = data ? Object.entries(data.by_region).slice(0, 8) : [];

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Fleet overview"
        description="Live state of all managed compute, storage, and orchestration resources."
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiTile label="Total Instances" value={data?.total ?? "—"} />
        <KpiTile label="Running" value={data?.running ?? "—"} hint="active" tone="success" />
        <KpiTile label="Stopped" value={data?.stopped ?? "—"} hint="idle" />
        <KpiTile
          label="Connected Providers"
          value={creds.data?.items.filter((c) => c.is_active).length ?? "—"}
          hint={`${creds.data?.total ?? 0} total`}
        />
      </div>

      {/* Sync banner */}
      {running && (
        <Card className="p-4 flex items-center gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <span className="size-4 border-2 border-warning border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium">
              Syncing {running.provider ?? "all providers"}…
            </span>
          </div>
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="w-1/2 h-full bg-warning animate-pulse" />
          </div>
          <span className="text-[10px] font-mono text-muted-foreground">IN PROGRESS</span>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Provider distribution */}
        <Card className="lg:col-span-2 overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-surface-muted">
            <h3 className="text-sm font-semibold">Distribution by provider</h3>
          </div>
          <div className="p-4 space-y-3">
            {providers.length === 0 && (
              <p className="text-xs text-muted-foreground">No data yet.</p>
            )}
            {providers.map(([prov, count]) => {
              const pct = data ? (count / Math.max(1, data.total)) * 100 : 0;
              return (
                <div key={prov} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <ProviderBadge provider={prov} />
                    <span className="font-mono text-muted-foreground tabular-nums">
                      {count} · {pct.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Regions */}
        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-surface-muted">
            <h3 className="text-sm font-semibold">Top regions</h3>
          </div>
          <div className="p-4 space-y-2">
            {regions.length === 0 && (
              <p className="text-xs text-muted-foreground">No data yet.</p>
            )}
            {regions.map(([r, c]) => (
              <div key={r} className="flex items-center justify-between text-xs">
                <span className="font-mono text-muted-foreground">{r}</span>
                <span className="font-mono tabular-nums">{c}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Recent sync activity */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-surface-muted flex items-center justify-between">
          <h3 className="text-sm font-semibold">Recent sync activity</h3>
          <span className="text-xs text-muted-foreground">
            last {logs.data?.length ?? 0} jobs
          </span>
        </div>
        <table className="w-full text-left">
          <thead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider bg-surface-muted border-b border-border">
            <tr>
              <th className="px-4 py-2 font-medium">Provider</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Added</th>
              <th className="px-4 py-2 font-medium">Updated</th>
              <th className="px-4 py-2 font-medium">Started</th>
              <th className="px-4 py-2 font-medium">Error</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(logs.data ?? []).map((l) => (
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
                <td className="px-4 py-2.5 text-xs text-red-600 max-w-xs truncate">
                  {l.error_message ?? ""}
                </td>
              </tr>
            ))}
            {logs.data && logs.data.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-xs text-muted-foreground">
                  No sync runs yet — trigger one from the top bar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
