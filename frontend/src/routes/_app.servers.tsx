import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type Page, type Server } from "@/lib/api";
import { Card, PageHeader, ProviderBadge, StatusPill, EmptyState, OsBadge, CustomSelect, confirmAsync } from "@/components/ui-bits";
import type { SshCredential } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth";
import { RefreshCw, Trash2, Plus, Pencil, X, KeyRound, Eye, EyeOff, Copy } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { AdvancedFilter, emptyFilterState, type FilterState } from "@/components/advanced-filter";

function copyToClipboard(text: string): boolean {
  if (navigator.clipboard?.writeText) { navigator.clipboard.writeText(text); return true; }
  const el = document.createElement("textarea");
  el.value = text;
  el.style.position = "fixed";
  el.style.opacity = "0";
  document.body.appendChild(el);
  el.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(el);
  return ok;
}

function SshInfoDialog({ cred, isAdmin, onClose }: { cred: SshCredential; isAdmin: boolean; onClose: () => void }) {
  const [revealed, setRevealed] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function reveal(): Promise<string | null> {
    if (!isAdmin) { toast.error("Admin role required to reveal secrets"); return null; }
    if (!(await confirmAsync("Reveal password? This action will be audit logged."))) return null;
    setLoading(true);
    try {
      const res = await api<{ value: string }>(`/api/ssh-credentials/${cred.id}/reveal-secret`, {
        method: "POST", json: { field: cred.auth_method === "key" ? "private_key" : "password" },
      });
      setRevealed(res.value);
      return res.value;
    } catch { toast.error("Failed to reveal"); return null; }
    finally { setLoading(false); }
  }

  function copy(label: string, value: string) {
    if (copyToClipboard(value)) toast.success(`${label} copied`);
    else toast.error("Failed to copy");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-background border border-border rounded-lg p-5 w-full max-w-sm shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm">{cred.name}</h2>
          <button onClick={onClose} className="icon-btn"><X className="size-4" /></button>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-xs text-muted-foreground">Username</div>
              <div className="font-mono">{cred.username}</div>
            </div>
            <button onClick={() => copy("Username", cred.username)} className="icon-btn" title="Copy username"><Copy className="size-3.5" /></button>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">{cred.auth_method === "key" ? "Private key" : "Password"}</div>
              <div className="font-mono truncate">{revealed ?? "••••••••••••"}</div>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <button onClick={reveal} disabled={loading} className="icon-btn disabled:opacity-40" title="Reveal">
                {revealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>
              <button
                onClick={async () => {
                  const value = revealed ?? (await reveal());
                  if (value) copy(cred.auth_method === "key" ? "Private key" : "Password", value);
                }}
                className="icon-btn" title="Copy"
              ><Copy className="size-3.5" /></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_app/servers")({
  head: () => ({ meta: [{ title: "Servers — System Control" }] }),
  component: ServersPage,
});

type AddForm = { name: string; provider: string; public_ip: string; region: string; status: string; notes: string };

function AddServerDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<AddForm>({ name: "", provider: "custom", public_ip: "", region: "", status: "unknown", notes: "" });
  const set = (k: keyof AddForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));
  const create = useMutation({
    mutationFn: () => api("/api/servers", { method: "POST", body: JSON.stringify({ ...form, public_ip: form.public_ip || null, region: form.region || null, notes: form.notes || null }) }),
    onSuccess: () => { toast.success("Server added"); qc.invalidateQueries({ queryKey: ["servers"] }); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const inp = "w-full px-3 py-1.5 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border border-border rounded-lg p-6 w-full max-w-md space-y-4 shadow-lg">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm">Add custom server</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded"><X className="size-4" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1">Name *</label>
            <input className={inp} value={form.name} onChange={set("name")} placeholder="my-server-01" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1">Provider</label>
              <CustomSelect
                value={form.provider}
                onChange={(v) => setForm(f => ({ ...f, provider: v }))}
                options={["custom","aws","gcp","azure","digitalocean","linode","ovh","hivelocity"].map(p => ({ value: p }))}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1">Status</label>
              <CustomSelect
                value={form.status}
                onChange={(v) => setForm(f => ({ ...f, status: v }))}
                options={["unknown","running","stopped","pending"].map(s => ({ value: s }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1">Public IP</label>
              <input className={inp} value={form.public_ip} onChange={set("public_ip")} placeholder="1.2.3.4" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1">Region</label>
              <input className={inp} value={form.region} onChange={set("region")} placeholder="us-east-1" />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1">Notes</label>
            <textarea className={inp} rows={2} value={form.notes} onChange={set("notes")} placeholder="Optional notes…" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted">Cancel</button>
          <button onClick={() => create.mutate()} disabled={!form.name || create.isPending}
            className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50">
            {create.isPending ? "Adding…" : "Add server"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditServerDialog({ server, onClose }: { server: Server; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: server.name, public_ip: server.public_ip ?? "", region: server.region ?? "", status: server.status, notes: server.notes ?? "" });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));
  const update = useMutation({
    mutationFn: () => api(`/api/servers/${server.id}`, { method: "PUT", body: JSON.stringify({ ...form, public_ip: form.public_ip || null, region: form.region || null, notes: form.notes || null }) }),
    onSuccess: () => { toast.success("Server updated"); qc.invalidateQueries({ queryKey: ["servers"] }); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const inp = "w-full px-3 py-1.5 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border border-border rounded-lg p-6 w-full max-w-md space-y-4 shadow-lg">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm">Edit server</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded"><X className="size-4" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1">Name *</label>
            <input className={inp} value={form.name} onChange={set("name")} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1">Status</label>
              <CustomSelect value={form.status} onChange={(v) => setForm(f => ({ ...f, status: v }))}
                options={["unknown","running","stopped","pending"].map(s => ({ value: s }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1">Region</label>
              <input className={inp} value={form.region} onChange={set("region")} placeholder="us-east-1" />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1">Public IP</label>
            <input className={inp} value={form.public_ip} onChange={set("public_ip")} placeholder="1.2.3.4" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1">Notes</label>
            <textarea className={inp} rows={2} value={form.notes} onChange={set("notes")} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted">Cancel</button>
          <button onClick={() => update.mutate()} disabled={!form.name || update.isPending}
            className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50">
            {update.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

const SERVER_FILTER_FIELDS = [
  { key: "provider", label: "Provider", type: "multiselect" as const, options: ["aws","gcp","azure","digitalocean","linode","ovh","hivelocity","custom"].map(v => ({ value: v })) },
  { key: "status",   label: "Status",   type: "multiselect" as const, options: ["running","stopped","pending","unknown"].map(v => ({ value: v })) },
  { key: "region",   label: "Region",   type: "text" as const },
  { key: "os",       label: "OS",       type: "text" as const },
  { key: "datacenter", label: "Datacenter", type: "text" as const },
];

function ServersPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const [fs, setFs] = useState<FilterState>(emptyFilterState);
  const [offset, setOffset] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Server | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [sshInfoFor, setSshInfoFor] = useState<Server | null>(null);
  const limit = 50;

  const providers = (fs.filters.provider as string[] | undefined) ?? [];
  const statuses  = (fs.filters.status   as string[] | undefined) ?? [];
  const region    = (fs.filters.region   as string)  ?? "";
  const os        = (fs.filters.os       as string)  ?? "";
  const datacenter = (fs.filters.datacenter as string) ?? "";

  // Backend supports provider (single), status (single), search, region, os, datacenter.
  // Multi-select for provider/status: send first value to backend, client-side filter rest.
  const apiProvider = providers.length === 1 ? providers[0] : "";
  const apiStatus   = statuses.length  === 1 ? statuses[0]  : "";

  const { data, isLoading } = useQuery({
    queryKey: ["servers", { q: fs.q, provider: apiProvider, status: apiStatus, region, os, datacenter, offset }],
    queryFn: () =>
      api<Page<Server>>("/api/servers", {
        query: { search: fs.q, provider: apiProvider, status: apiStatus, region, os, datacenter, limit: providers.length > 1 || statuses.length > 1 ? 500 : limit, offset: providers.length > 1 || statuses.length > 1 ? 0 : offset },
      }),
    placeholderData: (prev) => prev,
  });

  const sync = useMutation({
    mutationFn: () => api("/api/sync", { method: "POST" }),
    onSuccess: () => { toast.success("Cloud sync started"); qc.invalidateQueries({ queryKey: ["servers"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: sshCreds = [] } = useQuery<SshCredential[]>({
    queryKey: ["sshCredentials"],
    queryFn: () => api("/api/ssh-credentials"),
    staleTime: 60_000,
  });
  const sshSync = useMutation({
    mutationFn: (id: number) =>
      api("/api/sync/ssh", { method: "POST", json: { server_ids: [id], ssh_group: null } }),
    onSuccess: () => {
      toast.success("SSH sync started");
      qc.invalidateQueries({ queryKey: ["servers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const assignSSH = useMutation({
    mutationFn: ({ serverId, sshCredentialId, sshGroup }: { serverId: number; sshCredentialId: number | null; sshGroup?: string }) =>
      api(`/api/servers/${serverId}/assign-ssh`, { method: "PATCH", json: { ssh_credential_id: sshCredentialId, ssh_group: sshGroup ?? null } }),
    onSuccess: () => { toast.success("SSH key assigned"); qc.invalidateQueries({ queryKey: ["servers"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkAssignSSH = useMutation({
    mutationFn: ({ serverIds, sshCredentialId, sshGroup }: { serverIds: number[]; sshCredentialId: number | null; sshGroup?: string }) =>
      api("/api/servers/bulk-assign-ssh", { method: "POST", json: { server_ids: serverIds, ssh_credential_id: sshCredentialId, ssh_group: sshGroup ?? null } }),
    onSuccess: (_, vars) => {
      toast.success(`SSH key assigned to ${vars.serverIds.length} servers`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["servers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sshGroupSync = useMutation({
    mutationFn: ({ serverIds, sshGroup }: { serverIds?: number[]; sshGroup?: string }) =>
      api("/api/sync/ssh", { method: "POST", json: { server_ids: serverIds ?? null, ssh_group: sshGroup ?? null } }),
    onSuccess: () => { toast.success("SSH sync started"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: number) => api(`/api/servers/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Server deleted");
      qc.invalidateQueries({ queryKey: ["servers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Client-side filter for multi-select provider/status
  const allItems = data?.items ?? [];
  const items = allItems.filter((s) =>
    (providers.length <= 1 || providers.includes(s.provider)) &&
    (statuses.length  <= 1 || statuses.includes(s.status))
  );
  const total = providers.length > 1 || statuses.length > 1 ? items.length : (data?.total ?? 0);

  return (
    <div className="p-6 space-y-4">
      {showAdd && <AddServerDialog onClose={() => setShowAdd(false)} />}
      {editing && <EditServerDialog server={editing} onClose={() => setEditing(null)} />}
      {sshInfoFor && sshCreds.find(c => c.id === sshInfoFor.ssh_credential_id) && (
        <SshInfoDialog
          cred={sshCreds.find(c => c.id === sshInfoFor.ssh_credential_id)!}
          isAdmin={currentUser?.role === "admin"}
          onClose={() => setSshInfoFor(null)}
        />
      )}
      <div className="flex items-center justify-between">
        <PageHeader
          title="Servers"
          description={`${total.toLocaleString()} instances across all providers`}
        />
        <div className="flex items-center gap-2">
          <button onClick={() => sync.mutate()} disabled={sync.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted disabled:opacity-50">
            <RefreshCw className={`size-3.5 ${sync.isPending ? "animate-spin" : ""}`} /> Sync servers
          </button>
          <button onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90">
            <Plus className="size-3.5" /> Add server
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <Card className="p-3">
        <AdvancedFilter
          fields={SERVER_FILTER_FIELDS}
          state={fs}
          onChange={(s) => { setFs(s); setOffset(0); }}
          searchPlaceholder="Search name, IP, hostname, OS, region…"
        />
      </Card>

      {selected.size > 0 && (
        <div className="flex items-center gap-2 p-3 mb-2 bg-muted/60 border border-border rounded-lg text-sm">
          <span className="font-medium">{selected.size} selected</span>
          <div className="flex items-center gap-1.5 ml-auto">
            <select
              className="px-2 py-1 text-xs border border-border rounded bg-background"
              defaultValue=""
              onChange={e => {
                const val = e.target.value;
                if (!val) return;
                bulkAssignSSH.mutate({ serverIds: Array.from(selected), sshCredentialId: Number(val) });
                e.target.value = "";
              }}
            >
              <option value="">Assign SSH key…</option>
              {sshCreds.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button
              onClick={() => sshGroupSync.mutate({ serverIds: Array.from(selected) })}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-border rounded hover:bg-muted"
            ><RefreshCw className="size-3" /> SSH Sync</button>
            <button onClick={() => setSelected(new Set())} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
          </div>
        </div>
      )}

      <Card className="overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-surface-muted border-b border-border">
            <tr>
              <th className="px-3 py-2.5 w-8">
                <input type="checkbox"
                  checked={items.length > 0 && items.every(s => selected.has(s.id))}
                  onChange={e => setSelected(e.target.checked ? new Set(items.map(s => s.id)) : new Set())}
                  className="rounded"
                />
              </th>
              <th className="px-4 py-2.5 th-label">Instance</th>
              <th className="px-4 py-2.5 th-label">Provider</th>
              <th className="px-4 py-2.5 th-label">Region</th>
              <th className="px-4 py-2.5 th-label">Public IP</th>
              <th className="px-4 py-2.5 th-label">Type</th>
              <th className="px-4 py-2.5 th-label">OS</th>
              <th className="px-4 py-2.5 th-label">SSH Key</th>
              <th className="px-4 py-2.5 th-label">Synced</th>
              <th className="px-4 py-2.5 th-label">Status</th>
              <th className="px-4 py-2.5 th-label text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((s) => (
              <tr
                key={s.id}
                onClick={() => navigate({ to: "/server-detail/$id", params: { id: String(s.id) } })}
                className="cursor-pointer hover:bg-muted/40 transition-colors"
              >
                <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                  <input type="checkbox"
                    checked={selected.has(s.id)}
                    onChange={e => setSelected(prev => {
                      const next = new Set(prev);
                      e.target.checked ? next.add(s.id) : next.delete(s.id);
                      return next;
                    })}
                    className="rounded"
                  />
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{s.name}</span>
                    {s.cloud_id && (
                      <span className="text-[10px] text-muted-foreground font-mono">{s.cloud_id}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <ProviderBadge provider={s.provider} />
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono">{s.region ?? "—"}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{s.public_ip ?? "—"}</td>
                <td className="px-4 py-2.5">
                  {s.instance_type ? (
                    <span className="text-xs bg-muted px-1.5 py-0.5 rounded border border-border">{s.instance_type}</span>
                  ) : "—"}
                </td>
                <td className="px-4 py-2.5"><OsBadge os={s.os} /></td>
                <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                  <select
                    className="text-xs px-1.5 py-0.5 border border-border rounded bg-background max-w-[120px] truncate"
                    value={s.ssh_credential_id ?? ""}
                    onChange={e => assignSSH.mutate({ serverId: s.id, sshCredentialId: e.target.value ? Number(e.target.value) : null })}
                  >
                    <option value="">None</option>
                    {sshCreds.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">
                  {s.last_synced ? formatDistanceToNow(new Date(s.last_synced), { addSuffix: true }) : "never"}
                </td>
                <td className="px-4 py-2.5"><StatusPill status={s.status} /></td>
                <td className="px-4 py-2.5 text-right" onClick={e => e.stopPropagation()}>
                  <div className="inline-flex items-center gap-0.5">
                    {s.ssh_credential_id && (
                      <button onClick={() => setSshInfoFor(s)} className="icon-btn" title="View SSH credential">
                        <KeyRound className="size-3.5" />
                      </button>
                    )}
                    <button onClick={() => setEditing(s)} className="icon-btn" title="Edit">
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      onClick={() => sshSync.mutate(s.id)}
                      disabled={sshSync.isPending}
                      className="icon-btn disabled:opacity-40" title="SSH sync"
                    ><RefreshCw className={`size-3.5 ${sshSync.isPending ? "animate-spin" : ""}`} /></button>
                    <button
                      onClick={async () => { if (await confirmAsync(`Delete ${s.name}?`)) del.mutate(s.id); }}
                      className="icon-btn hover:text-red-600 hover:bg-red-50" title="Delete"
                    ><Trash2 className="size-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && items.length === 0 && (
              <tr>
                <td colSpan={11}>
                  <EmptyState
                    title="No servers match"
                    description="Add cloud credentials and run a sync to discover instances."
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {total > limit && (
          <div className="px-4 py-3 border-t border-border flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {offset + 1}–{Math.min(offset + limit, total)} of {total.toLocaleString()}
            </span>
            <div className="flex gap-1">
              <button
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - limit))}
                className="px-3 py-1 border border-border rounded-md disabled:opacity-40"
              >
                Prev
              </button>
              <button
                disabled={offset + limit >= total}
                onClick={() => setOffset(offset + limit)}
                className="px-3 py-1 border border-border rounded-md disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </Card>

    </div>
  );
}
