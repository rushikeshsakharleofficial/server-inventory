import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  api, type ApiKey, type ApiKeyAuditLog, type ApiKeyCreateResponse,
  type ApiKeyEndpointUsage, type ApiKeyTimeseriesPoint,
} from "@/lib/api";
import { Card, PageHeader, EmptyState, confirmAsync, Modal, CustomSelect } from "@/components/ui-bits";
import { SmartTable, type SmartTableColumn } from "@/components/SmartTable";
import {
  Plus, Trash2, ScrollText, RotateCw, Copy, Check, Download,
  KeyRound, Sparkles, Clock, Ban, Search,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Cell as PieCell, LineChart, Line,
} from "recharts";

export const Route = createFileRoute("/_app/api-keys")({
  head: () => ({ meta: [{ title: "API Keys — System Control" }] }),
  component: ApiKeysPage,
});

// Matches dashboard.tsx's STATUS_COLORS convention (running=green, failed=red).
const _ALLOWED_COLOR = "#22c55e";
const _DENIED_COLOR = "#ef4444";
const _ENDPOINT_COLORS = ["#6366f1", "#3b82f6", "#0ea5e9", "#22c55e", "#f59e0b", "#f97316", "#a855f7"];

const _ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs shadow-lg">
      <div className="font-semibold mb-1 text-gray-800">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: p.fill ?? p.stroke ?? p.color }} />
          <span className="text-gray-500">{p.name}:</span>
          <span className="font-mono font-semibold text-gray-800">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

function StatCard({
  icon: Icon, iconBg, iconColor, label, value, hint,
}: Readonly<{ icon: React.ElementType; iconBg: string; iconColor: string; label: string; value: React.ReactNode; hint?: string }>) {
  return (
    <Card className="p-4 flex items-center gap-3">
      <div className="size-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: iconBg }}>
        <Icon className="size-4.5" style={{ color: iconColor }} />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground truncate">{label}</div>
        <div className="text-xl font-semibold tabular-nums">{value}</div>
        {hint && <div className="text-[11px] text-muted-foreground truncate">{hint}</div>}
      </div>
    </Card>
  );
}

const SCOPE_BADGES_MAX = 3;

/**
 * Same compact-list pattern as crons.tsx's ProviderLogoGrid: show a few
 * badges, "+N more" opens a small popover with the rest — instead of every
 * feature:action pair wrapping across several lines in the cell.
 */
function ScopeBadgeList({ scopes }: Readonly<{ scopes: Record<string, string[]> }>) {
  const [open, setOpen] = useState(false);
  const all = Object.entries(scopes).flatMap(([feature, actions]) => actions.map((action) => `${feature}:${action}`));
  if (!all.length) return <span className="text-xs text-muted-foreground">—</span>;
  const shown = all.slice(0, SCOPE_BADGES_MAX);
  const hidden = all.length - shown.length;

  const badge = (s: string) => (
    <span key={s} className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded border border-border">{s}</span>
  );

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setOpen(false)}
        className="inline-flex items-center gap-1 flex-wrap"
      >
        {shown.map(badge)}
        {hidden > 0 && <span className="text-[10px] text-muted-foreground font-medium">+{hidden} more</span>}
      </button>
      {open && (
        <div className="absolute z-30 top-full left-0 mt-1 bg-surface border border-border rounded-md shadow-lg p-2 flex flex-wrap gap-1.5 w-max max-w-xs">
          {all.map(badge)}
        </div>
      )}
    </div>
  );
}

function isExpired(k: ApiKey): boolean {
  return !!k.expires_at && new Date(k.expires_at).getTime() < Date.now();
}

function ApiKeysPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [auditKey, setAuditKey] = useState<ApiKey | null>(null);
  const [selectedKey, setSelectedKey] = useState<ApiKey | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  // One-time token to show after create/rotate. Local-only, never persisted
  // to a query cache or storage, and cleared the moment its dialog closes.
  const [revealToken, setRevealToken] = useState<{ name: string; token: string } | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["api-keys"],
    queryFn: () => api<ApiKey[]>("/api/api-keys"),
  });
  const allItems = data ?? [];
  const items = search
    ? allItems.filter((k) => k.name.toLowerCase().includes(search.toLowerCase()) || k.key_prefix.includes(search.toLowerCase()))
    : allItems;

  const totalKeys = allItems.length;
  const activeKeys = allItems.filter((k) => k.is_active && !isExpired(k)).length;
  const expiredKeys = allItems.filter((k) => k.is_active && isExpired(k)).length;
  const revokedKeys = allItems.filter((k) => !k.is_active).length;

  // selectedKey can go stale after a revoke/delete elsewhere — always render
  // from the live list entry with the same id, not the captured object.
  const liveSelectedKey = selectedKey ? (allItems.find((k) => k.id === selectedKey.id) ?? null) : null;

  const revoke = useMutation({
    mutationFn: (id: number) => api(`/api/api-keys/${id}/revoke`, { method: "POST" }),
    onSuccess: () => {
      toast.success("API key revoked");
      qc.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: number) => api(`/api/api-keys/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("API key deleted");
      setSelectedKey(null);
      qc.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const rotate = useMutation({
    mutationFn: (id: number) => api<ApiKeyCreateResponse>(`/api/api-keys/${id}/rotate`, { method: "POST" }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["api-keys"] });
      setRevealToken({ name: res.name, token: res.token });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const columns: SmartTableColumn<ApiKey>[] = [
    {
      key: "name",
      header: "Name",
      render: (k) => (
        <div className="flex items-center gap-2">
          <input type="checkbox" className="accent-primary" onClick={(e) => e.stopPropagation()} />
          <span className="font-medium">{k.name}</span>
        </div>
      ),
    },
    {
      key: "prefix",
      header: "Key Prefix",
      render: (k) => (
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded border border-border">{k.key_prefix}…</span>
          <button
            type="button"
            title="Copy prefix"
            onClick={async (e) => { e.stopPropagation(); await navigator.clipboard.writeText(k.key_prefix); toast.success("Prefix copied"); }}
            className="p-1 hover:bg-muted rounded"
          >
            <Copy className="size-3 text-muted-foreground" />
          </button>
        </div>
      ),
    },
    {
      key: "scopes",
      header: "Scopes",
      render: (k) => <ScopeBadgeList scopes={k.scopes} />,
    },
    {
      key: "status",
      header: "Status",
      render: (k) => {
        const expired = isExpired(k);
        const label = !k.is_active ? "REVOKED" : expired ? "EXPIRED" : "ACTIVE";
        const cls = !k.is_active
          ? "bg-zinc-100 text-zinc-600"
          : expired
            ? "bg-amber-50 text-amber-700"
            : "bg-green-50 text-green-700";
        const dot = !k.is_active ? "bg-zinc-400" : expired ? "bg-amber-500" : "bg-green-500";
        return (
          <span className={`pill ${cls}`}>
            <span className={`size-1.5 rounded-full ${dot}`} />
            {label}
          </span>
        );
      },
    },
    {
      key: "last_used",
      header: "Last used",
      render: (k) => <span className="text-xs text-muted-foreground">{k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "Never"}</span>,
    },
    {
      key: "created",
      header: "Created",
      render: (k) => <span className="text-xs text-muted-foreground">{new Date(k.created_at).toLocaleDateString()}</span>,
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (k) => (
        <div className="inline-flex gap-1">
          <button onClick={(e) => { e.stopPropagation(); setAuditKey(k); }} className="p-1.5 hover:bg-muted rounded-md" title="View audit logs">
            <ScrollText className="size-3.5" />
          </button>
          <button
            onClick={async (e) => {
              e.stopPropagation();
              if (await confirmAsync(`Rotate "${k.name}"? The old token will stop working immediately.`)) rotate.mutate(k.id);
            }}
            className="p-1.5 hover:bg-muted rounded-md"
            title="Rotate"
          >
            <RotateCw className="size-3.5" />
          </button>
          {k.is_active && (
            <button
              onClick={async (e) => {
                e.stopPropagation();
                if (await confirmAsync(`Revoke "${k.name}"? This cannot be undone.`)) revoke.mutate(k.id);
              }}
              className="px-2 py-1.5 text-xs font-medium hover:bg-muted rounded-md text-amber-600"
              title="Revoke"
            >
              Revoke
            </button>
          )}
          <button
            onClick={async (e) => {
              e.stopPropagation();
              if (await confirmAsync(`Delete "${k.name}" permanently?`)) del.mutate(k.id);
            }}
            className="p-1.5 hover:bg-muted rounded-md text-red-600"
            title="Delete"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="API Keys"
        description="Manage API keys for programmatic access to the public API."
        actions={
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md"
          >
            <Plus className="size-3.5" /> Create API key
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={KeyRound} iconBg="#eef2ff" iconColor="#6366f1" label="Total Keys" value={totalKeys} hint="All time" />
        <StatCard icon={Sparkles} iconBg="#ecfdf5" iconColor="#22c55e" label="Active Keys" value={activeKeys}
          hint={totalKeys ? `${Math.round((activeKeys / totalKeys) * 100)}% of total` : undefined} />
        <StatCard icon={Clock} iconBg="#fffbeb" iconColor="#f59e0b" label="Expired Keys" value={expiredKeys}
          hint={totalKeys ? `${Math.round((expiredKeys / totalKeys) * 100)}% of total` : undefined} />
        <StatCard icon={Ban} iconBg="#fef2f2" iconColor="#ef4444" label="Revoked Keys" value={revokedKeys}
          hint={totalKeys ? `${Math.round((revokedKeys / totalKeys) * 100)}% of total` : undefined} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4 items-start">
        <Card className="p-0">
          <div className="p-3 border-b border-border">
            <div className="relative max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search API keys…"
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-background border border-border rounded-md"
              />
            </div>
          </div>
          <SmartTable
            columns={columns}
            rows={items}
            rowKey={(k) => k.id}
            mode="client"
            page={page}
            onPageChange={setPage}
            totalItems={items.length}
            isLoading={isLoading}
            error={error ? (error as Error).message : null}
            onRowClick={setSelectedKey}
            rowClassName={(k) => (selectedKey?.id === k.id ? "bg-primary/5" : "")}
            empty={<EmptyState title="No API keys yet" description="Create one to authenticate programmatic requests to the public API." />}
          />
        </Card>

        <KeyDetailPanel apiKey={liveSelectedKey} onRevoke={(id) => revoke.mutate(id)} />
      </div>

      <ApiMonitoringSection />

      {open && (
        <CreateKeyDialog
          onClose={() => setOpen(false)}
          onCreated={(res) => {
            setOpen(false);
            setRevealToken({ name: res.name, token: res.token });
          }}
        />
      )}
      {revealToken && <RevealTokenDialog name={revealToken.name} token={revealToken.token} onClose={() => setRevealToken(null)} />}
      {auditKey && <AuditLogDialog apiKey={auditKey} onClose={() => setAuditKey(null)} />}
    </div>
  );
}

/**
 * Right-side detail panel for the selected key — name/status, key prefix,
 * created/last-used dates, allowed IPs, full scope list, and a Revoke
 * shortcut. All fields come straight off the ApiKey row; no fabricated data
 * (e.g. no "description" field exists on this model, so that section from
 * the reference design is simply omitted rather than faked).
 */
function KeyDetailPanel({ apiKey, onRevoke }: Readonly<{ apiKey: ApiKey | null; onRevoke: (id: number) => void }>) {
  if (!apiKey) {
    return (
      <Card className="p-4">
        <p className="text-sm text-muted-foreground">Click a key to see its details.</p>
      </Card>
    );
  }

  const scopeEntries = Object.entries(apiKey.scopes).flatMap(([feature, actions]) => actions.map((a) => `${feature}:${a}`));
  const expired = isExpired(apiKey);
  const statusLabel = !apiKey.is_active ? "REVOKED" : expired ? "EXPIRED" : "ACTIVE";
  const statusColor = !apiKey.is_active ? "text-zinc-600" : expired ? "text-amber-700" : "text-green-700";

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold truncate">{apiKey.name}</h3>
        <span className={`text-[11px] font-semibold shrink-0 ${statusColor}`}>● {statusLabel}</span>
      </div>

      <div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Key Prefix</div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono bg-muted px-2 py-1 rounded border border-border">{apiKey.key_prefix}…</span>
          <button
            type="button"
            onClick={async () => { await navigator.clipboard.writeText(apiKey.key_prefix); toast.success("Copied"); }}
            className="p-1 hover:bg-muted rounded"
          >
            <Copy className="size-3 text-muted-foreground" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Created</div>
          <div className="text-xs font-medium">{new Date(apiKey.created_at).toLocaleDateString()}</div>
        </div>
        <div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Last Used</div>
          <div className="text-xs font-medium">{apiKey.last_used_at ? new Date(apiKey.last_used_at).toLocaleString() : "Never"}</div>
          {apiKey.last_used_ip && <div className="text-[11px] text-muted-foreground font-mono">from {apiKey.last_used_ip}</div>}
        </div>
      </div>

      {apiKey.expires_at && (
        <div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Expires</div>
          <div className="text-xs font-medium">{new Date(apiKey.expires_at).toLocaleString()}</div>
        </div>
      )}

      <div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
          Allowed IPs {apiKey.allowed_ips?.length ? `(${apiKey.allowed_ips.length})` : ""}
        </div>
        {apiKey.allowed_ips?.length ? (
          <div className="flex flex-wrap gap-1">
            {apiKey.allowed_ips.map((ip) => (
              <span key={ip} className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded border border-border">{ip}</span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Any IP allowed.</p>
        )}
      </div>

      <div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Scopes ({scopeEntries.length})</div>
        <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
          {scopeEntries.map((s) => (
            <span key={s} className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded border border-border">{s}</span>
          ))}
        </div>
      </div>

      {apiKey.is_active && (
        <button
          type="button"
          onClick={async () => {
            if (await confirmAsync(`Revoke "${apiKey.name}"? This cannot be undone.`)) onRevoke(apiKey.id);
          }}
          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 rounded-md"
        >
          <Ban className="size-3.5" /> Revoke API key
        </button>
      )}
    </Card>
  );
}

/**
 * Real usage data only — every number here comes from the two aggregate
 * endpoints (audit-logs/summary, audit-logs/timeseries). No fabricated
 * demo values: an empty state renders wherever there's genuinely no data
 * yet, rather than showing placeholder numbers.
 */
function ApiMonitoringSection() {
  const summary = useQuery({
    queryKey: ["api-keys", "audit-logs", "summary"],
    queryFn: () => api<ApiKeyEndpointUsage[]>("/api/api-keys/audit-logs/summary"),
  });
  const timeseries = useQuery({
    queryKey: ["api-keys", "audit-logs", "timeseries"],
    queryFn: () => api<ApiKeyTimeseriesPoint[]>("/api/api-keys/audit-logs/timeseries", { query: { days: 7 } }),
  });

  const rows = summary.data ?? [];
  const points = timeseries.data ?? [];
  const isLoading = summary.isLoading || timeseries.isLoading;
  const hasError = summary.error || timeseries.error;
  const hasData = rows.length > 0;

  const totalRequests = rows.reduce((sum, r) => sum + r.total, 0);
  const totalAllowed = rows.reduce((sum, r) => sum + r.allowed, 0);
  const totalDenied = rows.reduce((sum, r) => sum + r.denied, 0);
  const successRate = totalRequests ? (totalAllowed / totalRequests) * 100 : null;
  const timedRows = rows.filter((r) => r.avg_response_time_ms != null);
  const avgResponseTime = timedRows.length
    ? Math.round(timedRows.reduce((sum, r) => sum + (r.avg_response_time_ms ?? 0), 0) / timedRows.length)
    : null;

  const barData = rows.map((r) => ({ name: `${r.method} ${r.path}`, count: r.total }));
  const pieData = [
    { name: "Allowed", value: totalAllowed },
    { name: "Denied", value: totalDenied },
  ].filter((d) => d.value > 0);
  const lineData = points.map((p) => ({ date: p.date.slice(5), total: p.total }));

  return (
    <Card className="p-4 space-y-4">
      <div>
        <h3 className="text-sm font-semibold">API Monitoring</h3>
        <p className="text-xs text-muted-foreground">Overview of API usage across all your keys, including revoked and deleted ones.</p>
      </div>

      {isLoading && <p className="text-xs text-muted-foreground">Loading…</p>}
      {hasError && <p className="text-xs text-red-600">{((summary.error ?? timeseries.error) as Error).message}</p>}

      {!isLoading && !hasError && !hasData && (
        <EmptyState title="No requests yet" description="Usage stats will appear here once a key makes its first request." />
      )}

      {hasData && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-lg bg-muted/40 p-3">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Requests</div>
              <div className="text-xl font-semibold tabular-nums">{totalRequests.toLocaleString()}</div>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Success Rate</div>
              <div className="text-xl font-semibold tabular-nums">{successRate != null ? `${successRate.toFixed(2)}%` : "—"}</div>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Avg Response Time</div>
              <div className="text-xl font-semibold tabular-nums">{avgResponseTime != null ? `${avgResponseTime} ms` : "—"}</div>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Denied Requests</div>
              <div className="text-xl font-semibold tabular-nums">{totalDenied.toLocaleString()}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-semibold mb-2">Requests over time (last 7 days)</div>
              <div className="h-52">
                {lineData.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={lineData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                      <Tooltip content={<_ChartTooltip />} />
                      <Line type="monotone" dataKey="total" name="Requests" stroke="#6366f1" strokeWidth={2} dot={false} isAnimationActive animationDuration={900} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-muted-foreground">No data in this range.</div>
                )}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold mb-2">Status breakdown</div>
              <div className="h-52 flex items-center gap-4">
                <div className="flex-1 h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                        innerRadius={45} outerRadius={70} paddingAngle={2} startAngle={90} endAngle={-270}
                        isAnimationActive animationDuration={900}>
                        {pieData.map((entry) => (
                          <PieCell key={entry.name} fill={entry.name === "Allowed" ? _ALLOWED_COLOR : _DENIED_COLOR} />
                        ))}
                      </Pie>
                      <Tooltip content={<_ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1.5 text-xs shrink-0">
                  <div className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: _ALLOWED_COLOR }} /> Allowed ({totalAllowed})</div>
                  <div className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: _DENIED_COLOR }} /> Denied ({totalDenied})</div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold mb-2">Top endpoints</div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} width={160} />
                    <Tooltip content={<_ChartTooltip />} cursor={{ fill: "#f8fafc" }} />
                    <Bar dataKey="count" name="Requests" radius={[0, 4, 4, 0]} isAnimationActive animationDuration={900}>
                      {barData.map((entry, i) => (
                        <Cell key={entry.name} fill={_ENDPOINT_COLORS[i % _ENDPOINT_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      <th className="px-2 py-1">Endpoint</th>
                      <th className="px-2 py-1 text-right">Requests</th>
                      <th className="px-2 py-1 text-right">Success</th>
                      <th className="px-2 py-1 text-right">Avg Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.map((r) => (
                      <tr key={`${r.method}:${r.path}`}>
                        <td className="px-2 py-1.5 font-mono truncate max-w-[12rem]">
                          <span className="text-muted-foreground">{r.method}</span> {r.path}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{r.total.toLocaleString()}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{((r.allowed / r.total) * 100).toFixed(1)}%</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{r.avg_response_time_ms != null ? `${r.avg_response_time_ms} ms` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

const EXPIRY_PRESETS = [
  { value: "1d", label: "1 day", days: 1 },
  { value: "1w", label: "1 week", days: 7 },
  { value: "1m", label: "1 month", days: 30 },
  { value: "1y", label: "1 year", days: 365 },
  { value: "lifetime", label: "Lifetime (never expires)", days: null },
  { value: "custom", label: "Custom date…", days: undefined },
] as const;

function CreateKeyDialog({ onClose, onCreated }: Readonly<{ onClose: () => void; onCreated: (res: ApiKeyCreateResponse) => void }>) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [allowedIps, setAllowedIps] = useState("");
  const [expiryChoice, setExpiryChoice] = useState<(typeof EXPIRY_PRESETS)[number]["value"]>("lifetime");
  const [customDate, setCustomDate] = useState("");

  const create = useMutation({
    mutationFn: () => {
      const ips = allowedIps
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean);

      let expiresAt: string | null = null;
      if (expiryChoice === "custom") {
        if (customDate) expiresAt = new Date(customDate).toISOString();
      } else {
        const preset = EXPIRY_PRESETS.find((p) => p.value === expiryChoice);
        if (preset?.days) expiresAt = new Date(Date.now() + preset.days * 86_400_000).toISOString();
      }

      return api<ApiKeyCreateResponse>("/api/api-keys", {
        method: "POST",
        json: {
          name,
          ...(ips.length ? { allowed_ips: ips } : {}),
          ...(expiresAt ? { expires_at: expiresAt } : {}),
        },
      });
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["api-keys"] });
      onCreated(res);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Modal onClose={onClose} className="w-full max-w-md bg-surface rounded-lg ring-1 ring-border shadow-2xl flex flex-col max-h-[90vh]">
      <div className="p-4 border-b border-border shrink-0">
        <h3 className="text-sm font-semibold">New API key</h3>
      </div>
      <form
        className="p-4 space-y-4 overflow-y-auto flex-1"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <Input label="Name" value={name} onChange={setName} required />
        <p className="text-[11px] text-muted-foreground -mt-2">
          This key will have exactly your current IAM permissions. If your permissions change later, the key changes with them.
        </p>

        <div>
          <Label>Allowed IPs (optional)</Label>
          <textarea
            rows={3}
            value={allowedIps}
            onChange={(e) => setAllowedIps(e.target.value)}
            placeholder={"One per line or comma-separated, e.g.\n203.0.113.4\n198.51.100.0/24"}
            className="mt-1 w-full px-3 py-2 text-xs font-mono bg-background border border-border rounded-md"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">Leave blank to allow requests from any IP.</p>
        </div>

        <div>
          <Label>Expires</Label>
          <CustomSelect
            value={expiryChoice}
            onChange={(v) => setExpiryChoice(v as typeof expiryChoice)}
            options={EXPIRY_PRESETS.map((p) => ({ value: p.value, label: p.label }))}
            className="mt-1 [&>button]:rounded-xl [&>div]:rounded-xl"
          />
          {expiryChoice === "custom" && (
            <input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
              required
              className="mt-2 w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
            />
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm rounded-md hover:bg-muted">Cancel</button>
          <button type="submit" disabled={create.isPending} className="px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md disabled:opacity-60">
            {create.isPending ? "Creating…" : "Create"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * The ONLY place the raw token is ever shown. Not dismissible via
 * backdrop/Escape — the user must explicitly acknowledge they've copied it.
 * Token lives only in this component's props (parent's local state, cleared
 * on close); it is never written to the query cache, localStorage, or a toast.
 */
function RevealTokenDialog({ name, token, onClose }: Readonly<{ name: string; token: string; onClose: () => void }>) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(token);
    setCopied(true);
  };

  const download = () => {
    const blob = new Blob([token], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name.replace(/[^a-z0-9_-]+/gi, "_")}.txt`;
    // Must be attached to the DOM for click() to reliably trigger a download
    // in every browser, and the object URL must outlive the (async) download
    // start — revoking it synchronously right after click() raced the
    // browser reading the blob, which is what produced the empty/garbage
    // file: the URL was already dead by the time the download actually read it.
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <Modal onClose={onClose} dismissible={false} className="w-full max-w-md bg-surface rounded-lg ring-1 ring-border shadow-2xl p-5 space-y-4">
      <h3 className="text-sm font-semibold">API key for "{name}"</h3>
      <div className="text-xs bg-amber-50 text-amber-800 border border-amber-200 rounded-md px-3 py-2">
        Copy this token now. It will not be shown again.
      </div>
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={token}
          onFocus={(e) => e.target.select()}
          className="flex-1 px-3 py-2 text-xs font-mono bg-muted border border-border rounded-md select-all"
        />
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md shrink-0"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
        <button
          type="button"
          onClick={download}
          title="Download as .txt"
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-muted hover:bg-muted/70 rounded-md shrink-0"
        >
          <Download className="size-3.5" />
        </button>
      </div>
      <div className="flex justify-end pt-1">
        <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md">
          Done — I've saved it
        </button>
      </div>
    </Modal>
  );
}

function AuditLogDialog({ apiKey, onClose }: Readonly<{ apiKey: ApiKey; onClose: () => void }>) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["api-keys", apiKey.id, "audit-logs"],
    queryFn: () => api<ApiKeyAuditLog[]>(`/api/api-keys/${apiKey.id}/audit-logs`),
  });

  return (
    <Modal onClose={onClose} className="w-full max-w-2xl bg-surface rounded-lg ring-1 ring-border shadow-2xl flex flex-col max-h-[80vh]">
      <div className="p-4 border-b border-border shrink-0">
        <h3 className="text-sm font-semibold">Audit logs — {apiKey.name}</h3>
      </div>
      <div className="p-4 overflow-y-auto flex-1">
        {isLoading && <p className="text-xs text-muted-foreground">Loading…</p>}
        {error && <p className="text-xs text-red-600">{(error as Error).message}</p>}
        {!isLoading && !error && !data?.length && (
          <EmptyState title="No requests yet" description="Requests made with this key will appear here." />
        )}
        {!!data?.length && (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                <th className="px-2 py-1">Time</th>
                <th className="px-2 py-1">Method</th>
                <th className="px-2 py-1">Path</th>
                <th className="px-2 py-1">IP</th>
                <th className="px-2 py-1">Status</th>
                <th className="px-2 py-1">Time</th>
                <th className="px-2 py-1">Decision</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((log) => (
                <tr key={log.id}>
                  <td className="px-2 py-1.5 text-muted-foreground">{new Date(log.created_at).toLocaleString()}</td>
                  <td className="px-2 py-1.5 font-mono">{log.method}</td>
                  <td className="px-2 py-1.5 font-mono truncate max-w-[16rem]">{log.path}</td>
                  <td className="px-2 py-1.5 font-mono">{log.ip_address ?? "—"}</td>
                  <td className="px-2 py-1.5">{log.status_code}</td>
                  <td className="px-2 py-1.5 tabular-nums">{log.response_time_ms != null ? `${log.response_time_ms} ms` : "—"}</td>
                  <td className="px-2 py-1.5">
                    <span className={log.decision === "allowed" ? "text-green-700" : "text-red-600"}>
                      {log.decision}
                      {log.denied_reason ? ` (${log.denied_reason})` : ""}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="p-4 border-t border-border shrink-0 flex justify-end">
        <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm rounded-md hover:bg-muted">Close</button>
      </div>
    </Modal>
  );
}

function Label({ children }: Readonly<{ children: React.ReactNode }>) {
  return <label className="text-sm font-semibold text-foreground">{children}</label>;
}
function Input({ label, value, onChange, required }: Readonly<{ label: string; value: string; onChange: (v: string) => void; required?: boolean }>) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
      />
    </div>
  );
}
