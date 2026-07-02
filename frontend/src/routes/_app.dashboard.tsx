import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { api, type Stats, type SyncLog, type Credential, type Page } from "@/lib/api";
import { ProviderBadge, StatusPill } from "@/components/ui-bits";
import { formatDistanceToNow } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Cell as PieCell,
} from "recharts";
import {
  Server, Play, Square, Link2, RefreshCw, MapPin, List, PlusCircle,
} from "lucide-react";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — System Control" }] }),
  component: Dashboard,
});

const PROVIDER_COLORS: Record<string, string> = {
  aws: "#f97316", gcp: "#3b82f6", azure: "#0ea5e9",
  digitalocean: "#60a5fa", linode: "#22c55e", ovh: "#6366f1", hivelocity: "#f59e0b",
};
const STATUS_COLORS: Record<string, string> = {
  running: "#22c55e", stopped: "#d1d5db", pending: "#f59e0b",
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
    <div className="h-2 rounded-full overflow-hidden" style={{ background: "#f1f5f9" }}>
      <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${width}%`, background: color }} />
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs shadow-lg">
      <div className="font-semibold mb-1 text-gray-800">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: p.fill ?? p.color }} />
          <span className="text-gray-500">{p.name}:</span>
          <span className="font-mono font-semibold text-gray-800">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

// KPI card matching screenshot
function KpiCard({
  label, value, hint, hintColor, icon: Icon, iconBg, iconColor,
}: {
  label: string; value: number; hint?: string; hintColor?: string;
  icon: React.ElementType; iconBg: string; iconColor: string;
}) {
  const animated = useCountUp(value);
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-4 shadow-sm">
      <div className="size-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: iconBg }}>
        <Icon style={{ color: iconColor }} className="size-5" />
      </div>
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-1">{label}</div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-gray-900 tabular-nums">{animated}</span>
          {hint && <span className="text-sm font-semibold" style={{ color: hintColor ?? "#6b7280" }}>{hint}</span>}
        </div>
      </div>
    </div>
  );
}

// Card wrapper
function DCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden ${className}`}>{children}</div>;
}

function CardHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      {right && <div className="text-xs text-gray-400">{right}</div>}
    </div>
  );
}

function Dashboard() {
  const stats = useQuery({ queryKey: ["stats"], queryFn: () => api<Stats>("/api/servers/stats") });
  const logs = useQuery({ queryKey: ["syncLogs", "dash"], queryFn: () => api<SyncLog[]>("/api/sync/logs", { query: { limit: 6 } }) });
  const creds = useQuery({ queryKey: ["creds"], queryFn: () => api<Page<Credential>>("/api/credentials", { query: { limit: 20 } }) });

  const data = stats.data;
  const providers = data ? Object.entries(data.by_provider) : [];
  const regions = data ? Object.entries(data.by_region).slice(0, 8) : [];
  const providerChartData = providers.map(([name, count]) => ({ name: name.toUpperCase(), count }));
  const total = data?.total ?? 0;
  const running = data?.running ?? 0;
  const stopped = data?.stopped ?? 0;
  const runningPct = total ? ((running / total) * 100).toFixed(1) : "0";
  const stoppedPct = total ? ((stopped / total) * 100).toFixed(1) : "0";
  const activeProviders = creds.data?.items.filter(c => c.is_active).length ?? 0;

  const statusChartData = [
    { name: "Running", value: running },
    { name: "Stopped", value: stopped },
  ];

  const running_ = logs.data?.find(l => l.status === "running");

  return (
    <div className="p-6 space-y-5" style={{ background: "#f8fafc", minHeight: "100%" }}>
      {/* Title */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Fleet overview</h1>
        <p className="text-sm text-gray-500 mt-0.5">Live state of all managed compute, storage, and orchestration resources.</p>
      </div>

      {/* Sync banner */}
      {running_ && (
        <div className="bg-white rounded-xl border border-amber-200 p-4 flex items-center gap-4">
          <span className="size-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin shrink-0" />
          <span className="text-sm font-medium text-gray-700">Syncing {running_.provider ?? "all providers"}…</span>
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="w-1/2 h-full bg-amber-400 animate-pulse" />
          </div>
          <span className="text-[10px] font-mono text-amber-600 uppercase tracking-wider">In Progress</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard label="Total Instances" value={total} icon={Server} iconBg="#eff6ff" iconColor="#3b82f6" />
        <KpiCard label="Running" value={running} hint={`${runningPct}%`} hintColor="#22c55e" icon={Play} iconBg="#f0fdf4" iconColor="#22c55e" />
        <KpiCard label="Stopped" value={stopped} hint={`${stoppedPct}%`} hintColor="#f59e0b" icon={Square} iconBg="#fffbeb" iconColor="#f59e0b" />
        <KpiCard label="Connected Providers" value={activeProviders} hint={`${creds.data?.total ?? 0} total`} hintColor="#6b7280" icon={Link2} iconBg="#f5f3ff" iconColor="#6366f1" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bar chart */}
        <DCard>
          <CardHeader title="Servers by provider" />
          <div className="p-4 h-60">
            {providerChartData.length === 0 ? (
              <p className="text-xs text-gray-400">No data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={providerChartData} barCategoryGap="40%" margin={{ top: 20, right: 8, left: -10, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={28}
                    gridLine={{ stroke: "#f1f5f9" }} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f8fafc" }} />
                  <Bar dataKey="count" name="Servers" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={900}
                    label={{ position: "top", fontSize: 11, fill: "#374151", fontWeight: 600 }}>
                    {providerChartData.map(entry => (
                      <Cell key={entry.name} fill={PROVIDER_COLORS[entry.name.toLowerCase()] ?? "#6366f1"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </DCard>

        {/* Donut chart with legend right */}
        <DCard>
          <CardHeader title="Status breakdown" />
          <div className="p-4 h-60 flex items-center gap-6">
            <div className="flex-1 h-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusChartData} dataKey="value" nameKey="name"
                    cx="50%" cy="50%" innerRadius={55} outerRadius={88}
                    paddingAngle={2} startAngle={90} endAngle={-270}
                    isAnimationActive animationDuration={900}>
                    {statusChartData.map(entry => (
                      <PieCell key={entry.name} fill={STATUS_COLORS[entry.name.toLowerCase()] ?? "#a1a1aa"} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Legend right */}
            <div className="space-y-3 shrink-0 pr-2">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-green-500" />
                <span className="text-xs text-gray-600">Running</span>
                <span className="text-xs font-semibold text-gray-900 ml-2 tabular-nums">{running} ({runningPct}%)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-gray-300" />
                <span className="text-xs text-gray-600">Stopped</span>
                <span className="text-xs font-semibold text-gray-900 ml-2 tabular-nums">{stopped} ({stoppedPct}%)</span>
              </div>
            </div>
          </div>
        </DCard>
      </div>

      {/* Middle row: distribution + regions + quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Distribution — spans 1 col */}
        <DCard>
          <CardHeader title="Distribution by provider" />
          <div className="p-5 space-y-4">
            {providers.length === 0 && <p className="text-xs text-gray-400">No data yet.</p>}
            {providers.map(([prov, count]) => {
              const pct = data ? (count / Math.max(1, data.total)) * 100 : 0;
              return (
                <div key={prov} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <ProviderBadge provider={prov} />
                    <span className="font-mono text-gray-400 tabular-nums">{count} · {pct.toFixed(1)}%</span>
                  </div>
                  <AnimatedBar pct={pct} color={PROVIDER_COLORS[prov] ?? "#6366f1"} />
                </div>
              );
            })}
          </div>
        </DCard>

        {/* Top regions */}
        <DCard>
          <CardHeader title="Top regions" />
          <div className="p-5 space-y-2.5">
            {regions.length === 0 && <p className="text-xs text-gray-400">No data yet.</p>}
            {regions.map(([r, c]) => (
              <div key={r} className="flex items-center justify-between text-xs">
                <span className="font-mono text-gray-500">{r}</span>
                <span className="font-mono font-semibold text-gray-800 tabular-nums">{c}</span>
              </div>
            ))}
            <div className="pt-2 border-t border-gray-100">
              <Link to="/servers" className="text-xs text-blue-500 hover:text-blue-600 font-medium">
                View all regions →
              </Link>
            </div>
          </div>
        </DCard>

        {/* Quick actions */}
        <DCard>
          <CardHeader title="Quick actions" />
          <div className="p-3 space-y-1">
            {[
              { icon: RefreshCw, label: "Sync providers", sub: "Refresh all provider data", to: "/sync" },
              { icon: PlusCircle, label: "Add provider", sub: "Connect a new provider", to: "/cloud-providers" },
              { icon: MapPin, label: "Resource map", sub: "Visualize infrastructure", to: "/resource-map" },
              { icon: List, label: "View all servers", sub: "Browse all instances", to: "/servers" },
            ].map(({ icon: Icon, label, sub, to }) => (
              <Link key={label} to={to}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors group">
                <div className="size-8 rounded-lg bg-gray-100 group-hover:bg-gray-200 flex items-center justify-center shrink-0 transition-colors">
                  <Icon className="size-4 text-gray-500 group-hover:text-gray-700" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-gray-800">{label}</div>
                  <div className="text-[10px] text-gray-400 truncate">{sub}</div>
                </div>
              </Link>
            ))}
          </div>
        </DCard>
      </div>

      {/* Recent sync activity */}
      <DCard>
        <CardHeader title="Recent sync activity" right={`Last ${logs.data?.length ?? 0} jobs`} />
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b border-gray-100">
              <tr>
                {["Provider", "Status", "Added", "Updated", "Started", "Error"].map(h => (
                  <th key={h} className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(logs.data ?? []).map(l => (
                <tr key={l.id} className="text-sm hover:bg-gray-50/60 transition-colors">
                  <td className="px-5 py-3"><ProviderBadge provider={l.provider ?? "all"} /></td>
                  <td className="px-5 py-3"><StatusPill status={l.status} /></td>
                  <td className="px-5 py-3 font-mono text-xs text-gray-600 tabular-nums">{l.servers_added}</td>
                  <td className="px-5 py-3 font-mono text-xs text-gray-600 tabular-nums">{l.servers_updated}</td>
                  <td className="px-5 py-3 text-xs text-gray-400">
                    {l.started_at ? formatDistanceToNow(new Date(l.started_at), { addSuffix: true }) : "—"}
                  </td>
                  <td className="px-5 py-3 text-xs text-red-500 max-w-xs truncate">
                    {l.error_message ? l.error_message : <span className="text-gray-300">—</span>}
                  </td>
                </tr>
              ))}
              {logs.data?.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-xs text-gray-400">
                    No sync runs yet — trigger one from the top bar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-gray-100 py-3 text-center">
          <Link to="/sync" className="text-xs text-blue-500 hover:text-blue-600 font-medium">
            View full sync history →
          </Link>
        </div>
      </DCard>
    </div>
  );
}
