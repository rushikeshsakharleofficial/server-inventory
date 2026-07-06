import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiKey, type ApiKeyAuditLog, type ApiKeyCreateResponse } from "@/lib/api";
import { Card, PageHeader, EmptyState, confirmAsync, Modal } from "@/components/ui-bits";
import { SmartTable, type SmartTableColumn } from "@/components/SmartTable";
import { Plus, Trash2, ScrollText, RotateCw, Copy, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/api-keys")({
  head: () => ({ meta: [{ title: "API Keys — System Control" }] }),
  component: ApiKeysPage,
});

const SCOPE_GROUPS: Array<{ group: string; scopes: Array<{ value: string; label: string }> }> = [
  { group: "Servers", scopes: [{ value: "servers:read", label: "Read servers" }] },
  { group: "IP Inventory", scopes: [{ value: "ip_inventory:read", label: "Read IP inventory" }] },
  { group: "Databases", scopes: [{ value: "databases:read", label: "Read databases" }] },
  { group: "Kubernetes", scopes: [{ value: "kubernetes:read", label: "Read clusters" }] },
  { group: "Block Storage", scopes: [{ value: "block_storage:read", label: "Read block storage" }] },
  { group: "Discovery", scopes: [{ value: "discovery:read", label: "Read discovery" }, { value: "discovery:run", label: "Run discovery" }] },
  { group: "Sync", scopes: [{ value: "sync:trigger", label: "Trigger sync" }] },
];

// Mirrors backend/app/api_key_auth.py SCOPE_MAP exactly — each public scope's
// underlying (feature, action) in the IAM vocabulary. Used only to grey out
// scopes the caller's own effective permissions don't cover; the backend is
// still the sole enforcer (creation rejects, and existing keys lose access
// live, if this ever drifts out of sync with the real SCOPE_MAP).
const SCOPE_IAM_TARGET: Record<string, [string, string]> = {
  "servers:read": ["servers", "read"],
  "ip_inventory:read": ["servers", "read"],
  "databases:read": ["databases", "read"],
  "kubernetes:read": ["kubernetes", "read"],
  "block_storage:read": ["block-storages", "read"],
  "discovery:read": ["discovery", "read"],
  "discovery:run": ["discovery", "write"],
  "sync:trigger": ["sync", "write"],
};

function scopeIsAllowed(scope: string, effective: Record<string, string[]> | undefined): boolean {
  if (!effective) return true; // still loading — don't flash everything disabled
  const target = SCOPE_IAM_TARGET[scope];
  if (!target) return false;
  const [feature, action] = target;
  return (effective[feature] ?? []).includes(action);
}

function ApiKeysPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [auditKey, setAuditKey] = useState<ApiKey | null>(null);
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
      render: (k) => (
        <div className="flex flex-wrap gap-1 max-w-xs">
          {k.scopes.map((s) => (
            <span key={s} className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded border border-border">{s}</span>
          ))}
        </div>
      ),
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
          empty={<EmptyState title="No API keys yet" description="Create one to authenticate programmatic requests to the public API." />}
        />
      </Card>

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

function CreateKeyDialog({ onClose, onCreated }: Readonly<{ onClose: () => void; onCreated: (res: ApiKeyCreateResponse) => void }>) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>([]);
  const [allowedIps, setAllowedIps] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  // Grey out scopes the caller's own IAM policy doesn't grant — a key can
  // never exceed this regardless of what's checked here; the backend
  // enforces the same at creation and on every subsequent request.
  const { data: myPerms } = useQuery({
    queryKey: ["iam-me-effective"],
    queryFn: () => api<Record<string, string[]>>("/api/iam/me/effective"),
    staleTime: 60_000,
  });

  const toggleScope = (value: string) =>
    setScopes((prev) => (prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]));

  const create = useMutation({
    mutationFn: () => {
      const ips = allowedIps
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean);
      return api<ApiKeyCreateResponse>("/api/api-keys", {
        method: "POST",
        json: {
          name,
          scopes,
          ...(ips.length ? { allowed_ips: ips } : {}),
          ...(expiresAt ? { expires_at: new Date(expiresAt).toISOString() } : {}),
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
          if (!scopes.length) {
            toast.error("Select at least one scope");
            return;
          }
          create.mutate();
        }}
      >
        <Input label="Name" value={name} onChange={setName} required />

        <div>
          <Label>Scopes</Label>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Capped by your own IAM permissions — greyed-out scopes aren't part of your current policy.
          </p>
          <div className="mt-1 space-y-2 border border-border rounded-md p-3">
            {SCOPE_GROUPS.map(({ group, scopes: groupScopes }) => (
              <div key={group}>
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">{group}</div>
                <div className="space-y-1">
                  {groupScopes.map((s) => {
                    const allowed = scopeIsAllowed(s.value, myPerms);
                    return (
                      <label
                        key={s.value}
                        className={`flex items-center gap-2 text-xs ${allowed ? "cursor-pointer" : "cursor-not-allowed opacity-40"}`}
                        title={allowed ? undefined : "Not part of your current IAM permissions"}
                      >
                        <input
                          type="checkbox"
                          checked={scopes.includes(s.value)}
                          disabled={!allowed}
                          onChange={() => toggleScope(s.value)}
                          className="accent-primary disabled:cursor-not-allowed"
                        />
                        <span className="font-mono text-muted-foreground">{s.value}</span>
                        <span className="text-foreground/70">— {s.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

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
          <Label>Expires (optional)</Label>
          <input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">Leave blank for a key that never expires.</p>
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
  return <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{children}</label>;
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
