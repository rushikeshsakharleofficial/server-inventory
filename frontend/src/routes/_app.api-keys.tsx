import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiKey, type ApiKeyAuditLog, type ApiKeyCreateResponse, type ApiKeyEndpointUsage } from "@/lib/api";
import { Card, PageHeader, EmptyState, confirmAsync, Modal, CustomSelect } from "@/components/ui-bits";
import { SmartTable, type SmartTableColumn } from "@/components/SmartTable";
import { Plus, Trash2, ScrollText, RotateCw, Copy, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/api-keys")({
  head: () => ({ meta: [{ title: "API Keys — System Control" }] }),
  component: ApiKeysPage,
});

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

function ApiKeysPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [auditKey, setAuditKey] = useState<ApiKey | null>(null);
  const [selectedKey, setSelectedKey] = useState<ApiKey | null>(null);
  const [page, setPage] = useState(1);
  // One-time token to show after create/rotate. Local-only, never persisted
  // to a query cache or storage, and cleared the moment its dialog closes.
  const [revealToken, setRevealToken] = useState<{ name: string; token: string } | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["api-keys"],
    queryFn: () => api<ApiKey[]>("/api/api-keys"),
  });
  const items = data ?? [];

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
    { key: "name", header: "Name", render: (k) => <span className="font-medium">{k.name}</span> },
    {
      key: "prefix",
      header: "Key",
      render: (k) => <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded border border-border">{k.key_prefix}…</span>,
    },
    {
      key: "scopes",
      header: "Scopes",
      render: (k) => <ScopeBadgeList scopes={k.scopes} />,
    },
    {
      key: "status",
      header: "Status",
      render: (k) => (
        <span className={`pill ${k.is_active ? "bg-green-50 text-green-700" : "bg-zinc-100 text-zinc-600"}`}>
          <span className={`size-1.5 rounded-full ${k.is_active ? "bg-green-500" : "bg-zinc-400"}`} />
          {k.is_active ? "ACTIVE" : "REVOKED"}
        </span>
      ),
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
          <button onClick={() => setAuditKey(k)} className="p-1.5 hover:bg-muted rounded-md" title="View audit logs">
            <ScrollText className="size-3.5" />
          </button>
          <button
            onClick={async () => (await confirmAsync(`Rotate "${k.name}"? The old token will stop working immediately.`)) && rotate.mutate(k.id)}
            className="p-1.5 hover:bg-muted rounded-md"
            title="Rotate"
          >
            <RotateCw className="size-3.5" />
          </button>
          {k.is_active && (
            <button
              onClick={async () => (await confirmAsync(`Revoke "${k.name}"? This cannot be undone.`)) && revoke.mutate(k.id)}
              className="px-2 py-1.5 text-xs font-medium hover:bg-muted rounded-md text-amber-600"
              title="Revoke"
            >
              Revoke
            </button>
          )}
          <button
            onClick={async () => (await confirmAsync(`Delete "${k.name}" permanently?`)) && del.mutate(k.id)}
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
        title="API keys"
        description="Tokens for programmatic access to the public API. Each token is shown only once, at creation or rotation."
        actions={
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md"
          >
            <Plus className="size-3.5" /> Create API key
          </button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">
        <Card className="p-0">
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

        <KeyMetricsPanel apiKey={selectedKey} />
      </div>

      <EndpointUsageSection />

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
 * Fleet-wide (or own-keys-only, without api_keys:manage_all) per-endpoint
 * request counts — includes revoked and even fully deleted keys' history,
 * since GET /api/api-keys/audit-logs/summary keys off ApiKeyAuditLog.user_id
 * directly rather than joining through the (possibly gone) ApiKey row.
 */
function EndpointUsageSection() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["api-keys", "audit-logs", "summary"],
    queryFn: () => api<ApiKeyEndpointUsage[]>("/api/api-keys/audit-logs/summary"),
  });

  const rows = data ?? [];
  const maxTotal = Math.max(1, ...rows.map((r) => r.total));

  return (
    <Card className="p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Endpoint usage</h3>
        <p className="text-xs text-muted-foreground">
          Request counts per endpoint across all your API keys, including revoked and deleted ones.
        </p>
      </div>

      {isLoading && <p className="text-xs text-muted-foreground">Loading…</p>}
      {error && <p className="text-xs text-red-600">{(error as Error).message}</p>}
      {!isLoading && !error && !rows.length && (
        <EmptyState title="No requests yet" description="Endpoint usage will appear here once a key makes its first request." />
      )}

      {!!rows.length && (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={`${r.method}:${r.path}`} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono">
                  <span className="text-muted-foreground">{r.method}</span> {r.path}
                </span>
                <span className="text-muted-foreground">
                  {r.total} req{r.total === 1 ? "" : "s"}
                  {r.denied > 0 && <span className="text-red-600"> · {r.denied} denied</span>}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${(r.total / maxTotal) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/**
 * Summary stats for one key, derived entirely client-side from its audit
 * logs — there is no dedicated metrics endpoint, this is just an aggregation
 * over GET /api/api-keys/{id}/audit-logs (same data the audit-log modal
 * shows row-by-row).
 */
function KeyMetricsPanel({ apiKey }: Readonly<{ apiKey: ApiKey | null }>) {
  const { data, isLoading } = useQuery({
    queryKey: ["api-keys", apiKey?.id, "audit-logs"],
    queryFn: () => api<ApiKeyAuditLog[]>(`/api/api-keys/${apiKey?.id}/audit-logs`),
    enabled: apiKey != null,
  });

  if (!apiKey) {
    return (
      <Card className="p-4">
        <p className="text-sm text-muted-foreground">Click a key to see its usage metrics.</p>
      </Card>
    );
  }

  if (isLoading || !data) {
    return (
      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-2 truncate">{apiKey.name}</h3>
        <p className="text-xs text-muted-foreground">Loading…</p>
      </Card>
    );
  }

  const total = data.length;
  const allowed = data.filter((l) => l.decision === "allowed").length;
  const denied = total - allowed;

  const pathCounts = new Map<string, number>();
  for (const log of data) pathCounts.set(log.path, (pathCounts.get(log.path) ?? 0) + 1);
  const topPath = [...pathCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  return (
    <Card className="p-4 space-y-3">
      <h3 className="text-sm font-semibold truncate">{apiKey.name}</h3>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-md bg-muted/40 p-2">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Requests{total >= 500 ? " (last 500)" : ""}
          </div>
          <div className="text-lg font-semibold">{total}</div>
        </div>
        <div className="rounded-md bg-muted/40 p-2">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Last used</div>
          <div className="text-xs font-medium">{apiKey.last_used_at ? new Date(apiKey.last_used_at).toLocaleDateString() : "Never"}</div>
        </div>
      </div>

      <div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Allowed vs denied</div>
        {total === 0 ? (
          <p className="text-xs text-muted-foreground">No requests yet.</p>
        ) : (
          <>
            <div className="flex h-2 rounded-full overflow-hidden bg-muted">
              <div className="bg-green-500" style={{ width: `${(allowed / total) * 100}%` }} />
              <div className="bg-red-500" style={{ width: `${(denied / total) * 100}%` }} />
            </div>
            <div className="flex justify-between mt-1 text-[11px] text-muted-foreground">
              <span className="text-green-700">{allowed} allowed</span>
              <span className="text-red-600">{denied} denied</span>
            </div>
          </>
        )}
      </div>

      {topPath && (
        <div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Most-used endpoint</div>
          <div className="text-xs font-mono truncate" title={topPath[0]}>{topPath[0]}</div>
          <div className="text-[11px] text-muted-foreground">{topPath[1]} request{topPath[1] === 1 ? "" : "s"}</div>
        </div>
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
