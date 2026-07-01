import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api, type Snapshot } from "@/lib/api";
import { Card, PageHeader, CustomSelect, EmptyState } from "@/components/ui-bits";
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/_app/stats")({
  head: () => ({ meta: [{ title: "Stats — System Control" }] }),
  component: StatsPage,
});

const PROVIDER_COLORS: Record<string, string> = {
  aws: "#f97316", gcp: "#3b82f6", azure: "#0ea5e9",
  digitalocean: "#60a5fa", linode: "#22c55e", ovh: "#6366f1", hivelocity: "#f59e0b",
};
const PROVIDER_FALLBACK = [
  "#6366f1", "#f59e0b", "#10b981", "#3b82f6", "#ec4899", "#64748b", "#ef4444",
];
const providerColor = (p: string, i: number) =>
  PROVIDER_COLORS[p.toLowerCase()] ?? PROVIDER_FALLBACK[i % PROVIDER_FALLBACK.length];

const RANGE_OPTIONS = [
  { value: "7",  label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

function formatDate(d: string) {
  // "YYYY-MM-DD" → "Jun 30"
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function StatsPage() {
  const [days, setDays] = useState("30");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["stats-history", days],
    queryFn: () => api<Snapshot[]>("/api/stats/history", { query: { days } }),
    staleTime: 5 * 60 * 1000,
  });

  // Derive provider keys present across all snapshots
  const providers = data
    ? Array.from(new Set(data.flatMap(s => Object.keys(s.by_provider))))
    : [];

  // Flatten for recharts — add formatted date + each provider count
  const chartData = (data ?? []).map(s => ({
    date: formatDate(s.date),
    rawDate: s.date,
    total: s.total,
    running: s.running,
    stopped: s.stopped,
    ...providers.reduce<Record<string, number>>((acc, p) => {
      acc[p] = s.by_provider[p] ?? 0;
      return acc;
    }, {}),
  }));

  const isEmpty = !isLoading && !isError && chartData.length === 0;

  const gridCls = "text-[10px] text-muted-foreground";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Stats"
          description="Historical trend of server inventory over time."
        />
        <div className="w-40">
          <CustomSelect value={days} onChange={setDays} options={RANGE_OPTIONS} />
        </div>
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading history…</p>
      )}
      {isError && (
        <p className="text-sm text-red-600">Failed to load history.</p>
      )}

      {isEmpty && (
        <Card>
          <EmptyState
            title="No snapshots yet"
            description="Snapshots are recorded daily. Check back after the first automated sync completes."
          />
        </Card>
      )}

      {!isEmpty && chartData.length > 0 && (
        <>
          {/* Total instances over time */}
          <Card className="p-4 space-y-2">
            <h3 className="text-xs font-semibold">Total instances</h3>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} className={gridCls} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} className={gridCls} />
                <Tooltip contentStyle={{ fontSize: 11 }} />
                <Area
                  type="monotone"
                  dataKey="total"
                  name="Total"
                  stroke="#6366f1"
                  fill="#6366f1"
                  fillOpacity={0.15}
                  strokeWidth={2}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          {/* Running vs Stopped */}
          <Card className="p-4 space-y-2">
            <h3 className="text-xs font-semibold">Running vs stopped</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="running" name="Running" stroke="#22c55e" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="stopped" name="Stopped" stroke="#71717a" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {/* By provider stacked area */}
          {providers.length > 0 && (
            <Card className="p-4 space-y-2">
              <h3 className="text-xs font-semibold">By provider</h3>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {providers.map((p, i) => (
                    <Area
                      key={p}
                      type="monotone"
                      dataKey={p}
                      name={p.toUpperCase()}
                      stackId="1"
                      stroke={providerColor(p, i)}
                      fill={providerColor(p, i)}
                      fillOpacity={0.6}
                      strokeWidth={1.5}
                      dot={false}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
