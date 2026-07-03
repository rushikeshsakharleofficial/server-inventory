import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { api } from "@/lib/api";
import { SmartTable, type SmartTableColumn } from "@/components/SmartTable";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import {
  AlertCircle, AlertTriangle, Info, CheckCircle2, Download,
  Search, X, Shield, ScrollText,
  RefreshCw,
} from "lucide-react";

export const Route = createFileRoute("/_app/event-logs")({
  head: () => ({ meta: [{ title: "Event Logs — System Control" }] }),
  component: EventLogsPage,
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface EventLog {
  id: number;
  timestamp: string;
  severity: "info" | "warning" | "error" | "critical";
  source: string | null;
  resource: string | null;
  event: string;
  status: string;
  owner: string | null;
  message: string | null;
  tags: string[];
}

interface StatsOut {
  total: number;
  critical: number;
  warnings: number;
  resolved_today: number;
  by_severity: Record<string, number>;
  by_source: { source: string; count: number }[];
  volume: { hour: string; count: number }[];
}

interface PageResult {
  total: number;
  limit: number;
  offset: number;
  items: EventLog[];
}

// ─── Severity config ──────────────────────────────────────────────────────────

const SEV: Record<string, { color: string; bg: string; border: string; dot: string; Icon: typeof Info }> = {
  info:     { color: "#3b82f6", bg: "#eff6ff", border: "#bfdbfe", dot: "#3b82f6", Icon: Info },
  warning:  { color: "#f59e0b", bg: "#fffbeb", border: "#fde68a", dot: "#f59e0b", Icon: AlertTriangle },
  error:    { color: "#ef4444", bg: "#fef2f2", border: "#fecaca", dot: "#ef4444", Icon: AlertCircle },
  critical: { color: "#dc2626", bg: "#fef2f2", border: "#fecaca", dot: "#dc2626", Icon: AlertCircle },
};
const sev = (s: string) => SEV[s] ?? SEV.info;

const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  open:           { color: "#dc2626", bg: "#fef2f2" },
  acknowledged:   { color: "#d97706", bg: "#fffbeb" },
  investigating:  { color: "#2563eb", bg: "#eff6ff" },
  resolved:       { color: "#16a34a", bg: "#f0fdf4" },
};
const statusStyle = (s: string) => STATUS_STYLE[s] ?? { color: "#6b7280", bg: "#f9fafb" };

const PIE_COLORS = { info: "#3b82f6", warning: "#f59e0b", error: "#ef4444", critical: "#dc2626" };

function fmt(ts: string) {
  return new Date(ts).toLocaleString("en-GB", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).replace(",", "");
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, iconColor, iconBg }: {
  label: string; value: number | string; sub: string;
  icon: typeof Info; iconColor: string; iconBg: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex items-center gap-4">
      <div className="size-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: iconBg }}>
        <Icon style={{ width: 20, height: 20, color: iconColor }} />
      </div>
      <div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">{label}</div>
        <div className="text-3xl font-bold text-gray-900 tabular-nums">{typeof value === "number" ? value.toLocaleString() : value}</div>
        <div className="text-[11px] text-gray-400 mt-0.5">{sub}</div>
      </div>
    </div>
  );
}

// ─── Severity pill ────────────────────────────────────────────────────────────

function SevPill({ severity }: { severity: string }) {
  const s = sev(severity);
  const { Icon } = s;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: s.color, background: s.bg, border: `1px solid ${s.border}`, borderRadius: 6, padding: "2px 8px", whiteSpace: "nowrap" }}>
      <Icon style={{ width: 11, height: 11 }} />
      {severity.charAt(0).toUpperCase() + severity.slice(1)}
    </span>
  );
}

// ─── Status pill ──────────────────────────────────────────────────────────────

function StatusPillEl({ status }: { status: string }) {
  const s = statusStyle(status);
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color: s.color, background: s.bg, borderRadius: 6, padding: "2px 8px", whiteSpace: "nowrap" }}>{label}</span>
  );
}

// ─── Event details panel ──────────────────────────────────────────────────────

function EventDetails({ event, onClose, onUpdate }: {
  event: EventLog; onClose: () => void;
  onUpdate: (id: number, status: string) => void;
}) {
  const s = sev(event.severity);
  const { Icon } = s;
  return (
    <div className="flex flex-col h-full" style={{ borderLeft: "1px solid #f3f4f6" }}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
        <h3 className="text-xs font-semibold text-gray-700">Event details</h3>
        <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 transition-colors">
          <X style={{ width: 14, height: 14, color: "#9ca3af" }} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* ID */}
        <div className="space-y-2">
          <Row label="Event ID" value={`evt_${String(event.id).padStart(8, "0")}`} mono />
          <Row label="Resource" value={event.resource ?? "—"} />
          <div className="flex justify-between gap-2">
            <span className="text-gray-400 shrink-0">Severity</span>
            <SevPill severity={event.severity} />
          </div>
          <Row label="Source" value={event.source ?? "—"} />
          <Row label="First Seen" value={fmt(event.timestamp)} />
          <Row label="Status" value="">
            <StatusPillEl status={event.status} />
          </Row>
          <Row label="Owner" value={event.owner ?? "—"} />
        </div>

        {/* Description */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Description</div>
          <p className="text-gray-700 leading-relaxed">{event.event}</p>
        </div>

        {/* Tags */}
        {event.tags.length > 0 && (
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Tags</div>
            <div className="flex flex-wrap gap-1.5">
              {event.tags.map(t => (
                <span key={t} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600">{t}</span>
              ))}
            </div>
          </div>
        )}

        {/* Message */}
        {event.message && (
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Message</div>
            <pre className="bg-gray-900 text-green-400 rounded-lg p-3 text-[10px] font-mono overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">{event.message}</pre>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="shrink-0 p-3 border-t border-gray-100 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onUpdate(event.id, "acknowledged")}
            disabled={event.status === "acknowledged" || event.status === "resolved"}
            className="flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Shield style={{ width: 12, height: 12 }} /> Acknowledge
          </button>
          <button
            onClick={() => onUpdate(event.id, "resolved")}
            disabled={event.status === "resolved"}
            className="flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <CheckCircle2 style={{ width: 12, height: 12 }} /> Resolve
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono, children }: { label: string; value?: string; mono?: boolean; children?: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2 items-start">
      <span className="text-gray-400 shrink-0">{label}</span>
      {children ?? <span className={`text-gray-700 text-right ${mono ? "font-mono" : ""}`}>{value}</span>}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const HOURS_OPTIONS = [
  { label: "Last 24 hours", value: 24 },
  { label: "Last 48 hours", value: 48 },
  { label: "Last 7 days",   value: 168 },
];

function EventLogsPage() {
  const qc = useQueryClient();
  const [tab, setTab]             = useState<"all" | "alerts" | "audit">("all");
  const [severity, setSeverity]   = useState("");
  const [source, setSource]       = useState("");
  const [status, setStatus]       = useState("");
  const [hours, setHours]         = useState(24);
  const [q, setQ]                 = useState("");
  const [page, setPage]           = useState(1);
  const [pageSize, setPageSize]   = useState(25);
  const [selected, setSelected]   = useState<EventLog | null>(null);

  const statsQ = useQuery({
    queryKey: ["eventStats", hours],
    queryFn: () => api<StatsOut>(`/api/event-logs/stats?hours=${hours}`),
    staleTime: 30_000,
  });

  const listQ = useQuery({
    queryKey: ["eventLogs", severity, source, status, hours, q, page, pageSize, tab],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("hours", String(hours));
      params.set("limit", String(pageSize));
      params.set("offset", String((page - 1) * pageSize));
      if (severity || (tab === "alerts")) params.set("severity", severity || "critical,error");
      if (source) params.set("source", source);
      if (status) params.set("status", status);
      if (q) params.set("q", q);
      return api<PageResult>(`/api/event-logs?${params}`);
    },
    staleTime: 15_000,
  });

  const updateMut = useMutation({
    mutationFn: ({ id, s }: { id: number; s: string }) =>
      api<EventLog>(`/api/event-logs/${id}`, { method: "PATCH", json: { status: s } }),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ["eventLogs"] });
      qc.invalidateQueries({ queryKey: ["eventStats"] });
      setSelected(prev => prev?.id === updated.id ? updated : prev);
    },
  });

  const stats = statsQ.data;
  const list  = listQ.data;

  const pieData = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats.by_severity).map(([name, value]) => ({ name, value }));
  }, [stats]);

  const maxSrc = stats?.by_source[0]?.count ?? 1;

  function exportCsv() {
    if (!list) return;
    const rows = [["Timestamp","Severity","Source","Resource","Event","Status","Owner"]];
    list.items.forEach(e => rows.push([fmt(e.timestamp), e.severity, e.source ?? "", e.resource ?? "", e.event, e.status, e.owner ?? ""]));
    const blob = new Blob([rows.map(r => r.join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "event-logs.csv"; a.click();
  }

  const columns: SmartTableColumn<EventLog>[] = [
    { key: "timestamp", header: "TIMESTAMP ↓", className: "font-mono text-gray-500 whitespace-nowrap", render: ev => fmt(ev.timestamp) },
    { key: "severity", header: "SEVERITY", render: ev => <SevPill severity={ev.severity} /> },
    { key: "source", header: "SOURCE", className: "text-gray-600", render: ev => ev.source ?? "—" },
    {
      key: "resource", header: "RESOURCE",
      render: ev => (
        <div className="flex items-center gap-1.5">
          <span className="size-4 rounded flex items-center justify-center bg-gray-100 shrink-0">
            <ScrollText style={{ width: 9, height: 9, color: "#6b7280" }} />
          </span>
          <span className="text-gray-700 font-medium">{ev.resource ?? "—"}</span>
        </div>
      ),
    },
    { key: "event", header: "EVENT", className: "text-gray-700 max-w-[220px] truncate", render: ev => ev.event },
    { key: "status", header: "STATUS", render: ev => <StatusPillEl status={ev.status} /> },
    { key: "owner", header: "OWNER", className: "text-gray-500", render: ev => ev.owner ?? "—" },
    { key: "menu", header: "", className: "text-gray-300 text-right", render: () => "⋮" },
  ];

  return (
    <div className="p-6 space-y-5">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Event logs</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track real dashboard activity and audit records generated by this instance.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={exportCsv} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-gray-200 rounded-lg hover:bg-gray-50 shadow-sm transition-colors">
            <Download style={{ width: 13, height: 13 }} /> Export logs
          </button>
          <button onClick={() => { qc.invalidateQueries({ queryKey: ["eventLogs"] }); qc.invalidateQueries({ queryKey: ["eventStats"] }); }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-gray-200 rounded-lg hover:bg-gray-50 shadow-sm transition-colors">
            <RefreshCw style={{ width: 13, height: 13 }} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(["all","alerts","audit"] as const).map(t => (
          <button key={t} onClick={() => { setTab(t); setPage(1); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {t === "all" ? "All Activity" : t === "alerts" ? "Alerts" : "Audit Trail"}
          </button>
        ))}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-4">
        <KpiCard label="Total Events" value={stats?.total ?? 0} sub={`Last ${hours} hours`}
          icon={ScrollText} iconColor="#3b82f6" iconBg="#eff6ff" />
        <KpiCard label="Critical" value={stats?.critical ?? 0} sub={`Last ${hours} hours`}
          icon={AlertCircle} iconColor="#dc2626" iconBg="#fef2f2" />
        <KpiCard label="Warnings" value={stats?.warnings ?? 0} sub={`Last ${hours} hours`}
          icon={AlertTriangle} iconColor="#f59e0b" iconBg="#fffbeb" />
        <KpiCard label="Resolved Today" value={stats?.resolved_today ?? 0} sub="Since 00:00 UTC"
          icon={CheckCircle2} iconColor="#16a34a" iconBg="#f0fdf4" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-3 gap-4">
        {/* Volume chart */}
        <div className="col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-800">Activity volume</h2>
            <select value={hours} onChange={e => { setHours(Number(e.target.value)); setPage(1); }}
              className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500">
              {HOURS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={stats?.volume ?? []} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id="vol" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="hour" tick={{ fontSize: 9, fill: "#9ca3af" }} tickLine={false} interval={3} />
              <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }} />
              <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} fill="url(#vol)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Severity breakdown */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Severity breakdown</h2>
          <div className="flex items-center gap-4">
            <PieChart width={110} height={110}>
              <Pie data={pieData} dataKey="value" innerRadius={32} outerRadius={50} strokeWidth={2}>
                {pieData.map(entry => (
                  <Cell key={entry.name} fill={PIE_COLORS[entry.name as keyof typeof PIE_COLORS] ?? "#6b7280"} />
                ))}
              </Pie>
            </PieChart>
            <div className="flex-1 space-y-2">
              {pieData.map(entry => {
                const total = pieData.reduce((a, b) => a + b.value, 0) || 1;
                const pct = ((entry.value / total) * 100).toFixed(1);
                return (
                  <div key={entry.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full" style={{ background: PIE_COLORS[entry.name as keyof typeof PIE_COLORS] ?? "#6b7280" }} />
                      <span className="text-gray-600 capitalize">{entry.name}</span>
                    </div>
                    <span className="text-gray-400">{pct}% ({entry.value.toLocaleString()})</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Main table + detail panel */}
      <div className="flex gap-4">
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {/* Table header row */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-sm font-semibold text-gray-800 shrink-0">Recent activity</h2>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Severity filter */}
              <select value={severity} onChange={e => { setSeverity(e.target.value); setPage(1); }}
                className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500">
                <option value="">Severity</option>
                <option value="critical">Critical</option>
                <option value="error">Error</option>
                <option value="warning">Warning</option>
                <option value="info">Info</option>
              </select>
              {/* Source filter */}
              <select value={source} onChange={e => { setSource(e.target.value); setPage(1); }}
                className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500">
                <option value="">Source</option>
                {(stats?.by_source ?? []).map(s => <option key={s.source} value={s.source}>{s.source}</option>)}
              </select>
              {/* Status filter */}
              <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}
                className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500">
                <option value="">Status</option>
                <option value="open">Open</option>
                <option value="acknowledged">Acknowledged</option>
                <option value="investigating">Investigating</option>
                <option value="resolved">Resolved</option>
              </select>
              {/* Search */}
              <div className="relative">
                <Search style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", width: 12, height: 12, color: "#9ca3af", pointerEvents: "none" }} />
                <input value={q} onChange={e => { setQ(e.target.value); setPage(1); }} placeholder="Search events…"
                  className="text-xs border border-gray-200 rounded-lg pl-7 pr-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 w-36" />
              </div>
              <button onClick={exportCsv} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5 border border-gray-200 rounded-lg">
                <Download style={{ width: 12, height: 12 }} /> Export
              </button>
            </div>
          </div>

          {/* Table + pagination (SmartTable) */}
          <SmartTable
            columns={columns}
            rows={list?.items ?? []}
            rowKey={ev => ev.id}
            mode="server"
            page={page}
            onPageChange={setPage}
            totalItems={list?.total ?? 0}
            onPageSizeChange={setPageSize}
            isLoading={listQ.isLoading}
            error={listQ.isError ? "Failed to load event logs." : null}
            empty={<div className="px-4 py-8 text-center text-gray-400 text-xs">No events found.</div>}
            onRowClick={ev => setSelected(selected?.id === ev.id ? null : ev)}
            rowClassName={ev => (selected?.id === ev.id ? "bg-blue-50" : "")}
          />
        </div>

        {/* Right panel — top sources + event detail */}
        <div className="w-72 shrink-0 flex flex-col gap-4">
          {/* Top sources */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-gray-800">Top sources</h3>
              <span className="text-[10px] text-gray-400">Top {stats?.by_source.length ?? 0}</span>
            </div>
            <div className="space-y-2.5">
              {(stats?.by_source ?? []).map(s => (
                <div key={s.source} className="flex items-center gap-2.5">
                  <span className="text-[11px] text-gray-600 w-24 shrink-0 truncate">{s.source}</span>
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(s.count / maxSrc) * 100}%` }} />
                  </div>
                  <span className="text-[10px] text-gray-400 w-12 text-right tabular-nums">{s.count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Event detail panel */}
          {selected ? (
            <div className="flex-1 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <EventDetails
                event={selected}
                onClose={() => setSelected(null)}
                onUpdate={(id, s) => updateMut.mutate({ id, s })}
              />
            </div>
          ) : (
            <div className="flex-1 bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col items-center justify-center gap-2 p-6 text-center">
              <ScrollText style={{ width: 32, height: 32, color: "#e5e7eb" }} />
              <p className="text-xs text-gray-400">Click any event row to inspect its full details.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
