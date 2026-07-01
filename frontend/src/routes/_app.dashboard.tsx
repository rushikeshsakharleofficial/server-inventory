import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { api, type Stats, type SyncLog, type Credential, type Page } from "@/lib/api";
import { Card, KpiTile, ProviderBadge, StatusPill, PageHeader } from "@/components/ui-bits";
import { formatDistanceToNow } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from "recharts";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — System Control" }] }),
  component: Dashboard,
});

const PROVIDER_COLORS: Record<string, string> = {
  aws: "#f97316", gcp: "#3b82f6", azure: "#0ea5e9",
  digitalocean: "#60a5fa", linode: "#22c55e", ovh: "#6366f1", hivelocity: "#f59e0b",
};
const STATUS_COLORS: Record<string, string> = {
  running: "#22c55e", stopped: "#71717a", pending: "#f59e0b",
  failed: "#ef4444", unknown: "#a1a1aa",
};

function useCountUp(target: number, duration = 800) {
  const [val, setVal] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    if (target === 0) { setVal(0); return; }
    const start = prev.current;
    const diff = target - start;
    const startTime = performance.now();
    let raf: number;
    function tick(now: number) {
      const t = Math.min((now - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(start + diff * ease));
      if (t < 1) raf = requestAnimationFrame(tick);
      else prev.current = target;
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

function AnimatedBar({ pct, color = "#6366f1" }: { pct: number; color?: string }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(pct), 60);
    return () => clearTimeout(t);
  }, [pct]);
  return (
    <div className="h-2 bg-muted rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700 ease-out"
        style={{ width: `${width}%`, background: color }}
      />
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface border border-border rounded-md px-3 py-2 text-xs shadow-lg">
      <div className="font-medium mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: p.fill ?? p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-mono font-medium">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

function Dashboard() {
  const stats = useQuery({
    queryKey: ["stats"],
    queryFn: () => api<Stats>("/api/servers/stats"),
  });
  const logs = useQuery({
    queryKey: ["syncLogs", "dash"],
    queryFn: () => api<SyncLog[]>("/api/sync/logs", { query: { limit: 6 } }),
  });
  const creds = useQuery({
    queryKey: ["creds"],
    queryFn: () => api<Page<Credential>>("/api/credentials", { query: { limit: 20 } }),
  });

  const running = logs.data?.find((l) => l.status === "running");
  const data = stats.data;
  const providers = data ? Object.entries(data.by_provider) : [];
  const regions = data ? Object.entries(data.by_region).slice(0, 8) : [];

  const providerChartData = providers.map(([name, count]) => ({ name: name.toUpperCase(), count }));
  const statusChartData = data
    ? Object.entries(data.by_status).map(([name, value]) => ({ name, value }))
    : [];

  const totalCount = useCountUp(data?.total ?? 0);
  const runningCount = useCountUp(data?.running ?? 0);
  const stoppedCount = useCountUp(data?.stopped ?? 0);
  const activeProviders = creds.data?.items.filter((c) => c.is_active).length ?? 0;
  const activeCount = useCountUp(activeProviders);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Fleet overview"
        description="Live state of all managed compute, storage, and orchestration resources."
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiTile label="Total Instances" value={totalCount} />
        <KpiTile label="Running" value={runningCount} hint="active" tone="success" />
        <KpiTile label="Stopped" value={stoppedCount} hint="idle" />
        <KpiTile
          label="Connected Providers"
          value={activeCount}
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

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Provider bar chart */}
        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-surface-muted">
            <h3 className="text-sm font-semibold">Servers by provider</h3>
          </div>
          <div className="p-4 h-52">
            {providerChartData.length === 0 ? (
              <p className="text-xs text-muted-foreground">No data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={providerChartData} barCategoryGap="30%">
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--muted)" }} />
                  <Bar dataKey="count" name="Servers" radius={[3, 3, 0, 0]}
                    isAnimationActive animationDuration={900} animationEasing="ease-out">
                    {providerChartData.map((entry) => (
                      <Cell key={entry.name} fill={PROVIDER_COLORS[entry.name.toLowerCase()] ?? "#6366f1"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* Status pie chart */}
        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-surface-muted">
            <h3 className="text-sm font-semibold">Status breakdown</h3>
          </div>
          <div className="p-4 h-52">
            {statusChartData.length === 0 ? (
              <p className="text-xs text-muted-foreground">No data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%" cy="50%"
                    innerRadius={45} outerRadius={72}
                    paddingAngle={3}
                    isAnimationActive animationDuration={900} animationEasing="ease-out"
                  >
                    {statusChartData.map((entry) => (
                      <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? "#a1a1aa"} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" iconSize={8}
                    formatter={(v) => <span className="text-[11px] text-muted-foreground capitalize">{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Provider distribution bars */}
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
                  <AnimatedBar pct={pct} color={PROVIDER_COLORS[prov] ?? "#6366f1"} />
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
