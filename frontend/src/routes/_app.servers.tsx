import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type Page, type Server } from "@/lib/api";
import { Card, PageHeader, ProviderBadge, StatusPill, EmptyState, CustomSelect, OsBadge } from "@/components/ui-bits";
import type { SshCredential } from "@/lib/api";
import { Search, RefreshCw, Trash2, Plus, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

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

function ServersPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [provider, setProvider] = useState("");
  const [status, setStatus] = useState("");
  const [offset, setOffset] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Server | null>(null);
  const limit = 50;

  const { data, isLoading } = useQuery({
    queryKey: ["servers", { q, provider, status, offset }],
    queryFn: () =>
      api<Page<Server>>("/api/servers", {
        query: { search: q, provider, status, limit, offset },
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
  const defaultCredId = sshCreds.find(c => c.is_default)?.id ?? sshCreds[0]?.id;

  const sshSync = useMutation({
    mutationFn: (id: number) => {
      if (!defaultCredId) throw new Error("No SSH credential configured. Add one in SSH Keys.");
      return api(`/api/servers/${id}/ssh-sync?ssh_credential_id=${defaultCredId}`, { method: "POST" });
    },
    onSuccess: () => {
      toast.success("SSH sync complete");
      qc.invalidateQueries({ queryKey: ["servers"] });
    },
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

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="p-6 space-y-4">
      {showAdd && <AddServerDialog onClose={() => setShowAdd(false)} />}
      {editing && <EditServerDialog server={editing} onClose={() => setEditing(null)} />}
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
      <Card className="p-3 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setOffset(0); }}
            placeholder="Search by name, IP, hostname…"
            className="w-full pl-9 pr-3 py-1.5 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <CustomSelect
          value={provider}
          onChange={(v) => { setProvider(v); setOffset(0); }}
          options={["aws", "gcp", "azure", "digitalocean", "linode", "ovh", "hivelocity"].map((p) => ({ value: p }))}
          placeholder="All providers"
        />
        <CustomSelect
          value={status}
          onChange={(v) => { setStatus(v); setOffset(0); }}
          options={["running", "stopped", "pending", "unknown"].map((s) => ({ value: s }))}
          placeholder="All statuses"
        />
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-surface-muted border-b border-border">
            <tr>
              <th className="px-4 py-2.5 th-label">Instance</th>
              <th className="px-4 py-2.5 th-label">Provider</th>
              <th className="px-4 py-2.5 th-label">Region</th>
              <th className="px-4 py-2.5 th-label">Public IP</th>
              <th className="px-4 py-2.5 th-label">Type</th>
              <th className="px-4 py-2.5 th-label">OS</th>
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
                <td className="px-4 py-2.5 text-xs text-muted-foreground">
                  {s.last_synced ? formatDistanceToNow(new Date(s.last_synced), { addSuffix: true }) : "never"}
                </td>
                <td className="px-4 py-2.5"><StatusPill status={s.status} /></td>
                <td className="px-4 py-2.5 text-right" onClick={e => e.stopPropagation()}>
                  <div className="inline-flex items-center gap-0.5">
                    <button onClick={() => setEditing(s)} className="icon-btn" title="Edit">
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      onClick={() => sshSync.mutate(s.id)}
                      disabled={sshSync.isPending}
                      className="icon-btn disabled:opacity-40" title="SSH sync"
                    ><RefreshCw className={`size-3.5 ${sshSync.isPending ? "animate-spin" : ""}`} /></button>
                    <button
                      onClick={() => { if (confirm(`Delete ${s.name}?`)) del.mutate(s.id); }}
                      className="icon-btn hover:text-red-600 hover:bg-red-50" title="Delete"
                    ><Trash2 className="size-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && items.length === 0 && (
              <tr>
                <td colSpan={9}>
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
