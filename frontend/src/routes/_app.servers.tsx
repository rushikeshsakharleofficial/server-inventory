import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type Page, type Server, type Stats, type SshCredential, type ServerGroup } from "@/lib/api";
import { Card, PageHeader, ProviderBadge, StatusPill, OsBadge, CustomSelect, confirmAsync, EmptyState, Modal } from "@/components/ui-bits";
import { useCurrentUser } from "@/lib/auth";
import { RefreshCw, Trash2, Plus, Pencil, X, KeyRound, Eye, EyeOff, Copy } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { AdvancedFilter, emptyFilterState, type FilterState } from "@/components/advanced-filter";
import { SmartTable, type SmartTableColumn } from "@/components/SmartTable";

function copyToClipboard(text: string): boolean {
  if (navigator.clipboard?.writeText) { navigator.clipboard.writeText(text); return true; }
  const el = document.createElement("textarea");
  el.value = text;
  el.style.position = "fixed";
  el.style.opacity = "0";
  document.body.appendChild(el);
  el.select();
  // ponytail: execCommand is deprecated but kept as the fallback for browsers/contexts
  // (e.g. non-HTTPS) where navigator.clipboard is unavailable — remove once that's no longer a target.
  const ok = document.execCommand("copy");
  document.body.removeChild(el);
  return ok;
}

function SshInfoDialog({ cred, isAdmin, onClose }: Readonly<{ cred: SshCredential; isAdmin: boolean; onClose: () => void }>) {
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
    <Modal onClose={onClose} className="bg-background border border-border rounded-lg p-5 w-full max-w-sm shadow-lg space-y-3">
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
    </Modal>
  );
}

export const Route = createFileRoute("/_app/servers")({
  head: () => ({ meta: [{ title: "Servers — System Control" }] }),
  component: ServersPage,
});

type AddForm = { name: string; provider: string; public_ip: string; region: string; status: string; notes: string };

function AddServerDialog({ onClose }: Readonly<{ onClose: () => void }>) {
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
    <Modal onClose={onClose} closeOnOutsideClick={false} className="bg-background border border-border rounded-lg p-6 w-full max-w-md space-y-4 shadow-lg">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-sm">Add custom server</h2>
        <button onClick={onClose} className="p-1 hover:bg-muted rounded"><X className="size-4" /></button>
      </div>
      <div className="space-y-3">
        <div>
          <label htmlFor="add-name" className="text-xs text-muted-foreground font-medium block mb-1">Name *</label>
          <input id="add-name" className={inp} value={form.name} onChange={set("name")} placeholder="my-server-01" required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="text-xs text-muted-foreground font-medium block mb-1">Provider</span>
            <CustomSelect
              value={form.provider}
              onChange={(v) => setForm(f => ({ ...f, provider: v }))}
              options={["custom","aws","gcp","azure","digitalocean","linode","ovh","hivelocity"].map(p => ({ value: p }))}
            />
          </div>
          <div>
            <span className="text-xs text-muted-foreground font-medium block mb-1">Status</span>
            <CustomSelect
              value={form.status}
              onChange={(v) => setForm(f => ({ ...f, status: v }))}
              options={["unknown","running","stopped","pending"].map(s => ({ value: s }))}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="add-public-ip" className="text-xs text-muted-foreground font-medium block mb-1">Public IP</label>
            <input id="add-public-ip" className={inp} value={form.public_ip} onChange={set("public_ip")} placeholder="1.2.3.4" /> {/* NOSONAR */}
          </div>
          <div>
            <label htmlFor="add-region" className="text-xs text-muted-foreground font-medium block mb-1">Region</label>
            <input id="add-region" className={inp} value={form.region} onChange={set("region")} placeholder="us-east-1" />
          </div>
        </div>
        <div>
          <label htmlFor="add-notes" className="text-xs text-muted-foreground font-medium block mb-1">Notes</label>
          <textarea id="add-notes" className={inp} rows={2} value={form.notes} onChange={set("notes")} placeholder="Optional notes…" />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onClose} className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted">Cancel</button>
        <button onClick={() => create.mutate()} disabled={!form.name || create.isPending}
          className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50">
          {create.isPending ? "Adding…" : "Add server"}
        </button>
      </div>
    </Modal>
  );
}

function EditServerDialog({ server, onClose }: Readonly<{ server: Server; onClose: () => void }>) {
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
    <Modal onClose={onClose} closeOnOutsideClick={false} className="bg-background border border-border rounded-lg p-6 w-full max-w-md space-y-4 shadow-lg">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-sm">Edit server</h2>
        <button onClick={onClose} className="p-1 hover:bg-muted rounded"><X className="size-4" /></button>
      </div>
      <div className="space-y-3">
        <div>
          <label htmlFor="edit-name" className="text-xs text-muted-foreground font-medium block mb-1">Name *</label>
          <input id="edit-name" className={inp} value={form.name} onChange={set("name")} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="text-xs text-muted-foreground font-medium block mb-1">Status</span>
            <CustomSelect value={form.status} onChange={(v) => setForm(f => ({ ...f, status: v }))}
              options={["unknown","running","stopped","pending"].map(s => ({ value: s }))} />
          </div>
          <div>
            <label htmlFor="edit-region" className="text-xs text-muted-foreground font-medium block mb-1">Region</label>
            <input id="edit-region" className={inp} value={form.region} onChange={set("region")} placeholder="us-east-1" />
          </div>
        </div>
        <div>
          <label htmlFor="edit-public-ip" className="text-xs text-muted-foreground font-medium block mb-1">Public IP</label>
          <input id="edit-public-ip" className={inp} value={form.public_ip} onChange={set("public_ip")} placeholder="1.2.3.4" /> {/* NOSONAR */}
        </div>
        <div>
          <label htmlFor="edit-notes" className="text-xs text-muted-foreground font-medium block mb-1">Notes</label>
          <textarea id="edit-notes" className={inp} rows={2} value={form.notes} onChange={set("notes")} />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onClose} className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted">Cancel</button>
        <button onClick={() => update.mutate()} disabled={!form.name || update.isPending}
          className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50">
          {update.isPending ? "Saving…" : "Save"}
        </button>
      </div>
    </Modal>
  );
}

function buildServerFilterFields(stats: Stats | undefined, items: Server[]) {
  const cmp = (a: string, b: string) => a.localeCompare(b);
  const providerOpts = Object.keys(stats?.by_provider ?? {}).sort(cmp).map(v => ({ value: v }));
  const statusOpts   = Object.keys(stats?.by_status   ?? {}).sort(cmp).map(v => ({ value: v }));
  const regionOpts   = Object.keys(stats?.by_region ?? {}).sort(cmp).map(v => ({ value: v }));
  const osOpts       = [...new Set(items.map(s => s.os).filter((v): v is string => !!v))].sort(cmp).map(v => ({ value: v }));
  return [
    { key: "provider", label: "Provider", type: "multiselect" as const, options: providerOpts },
    { key: "status",   label: "Status",   type: "multiselect" as const, options: statusOpts },
    { key: "region",   label: "Region",   type: "multiselect" as const, options: regionOpts },
    { key: "os",       label: "OS",       type: "multiselect" as const, options: osOpts },
    { key: "datacenter", label: "Datacenter", type: "text" as const },
  ];
}

function ServersPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const [fs, setFs] = useState<FilterState>(emptyFilterState);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Server | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [sshInfoFor, setSshInfoFor] = useState<Server | null>(null);
  const offset = (page - 1) * pageSize;

  const providers = (fs.filters.provider as string[] | undefined) ?? [];
  const statuses  = (fs.filters.status   as string[] | undefined) ?? [];
  const regions   = (fs.filters.region   as string[] | undefined) ?? [];
  const oses      = (fs.filters.os       as string[] | undefined) ?? [];
  const datacenter = (fs.filters.datacenter as string) ?? "";

  // Backend supports provider/status/region/os as single values, search, datacenter.
  // Multi-select: send first value to backend, client-side filter the rest.
  const apiProvider = providers.length === 1 ? providers[0] : "";
  const apiStatus   = statuses.length  === 1 ? statuses[0]  : "";
  const apiRegion   = regions.length   === 1 ? regions[0]   : "";
  const apiOs       = oses.length      === 1 ? oses[0]      : "";
  const anyMultiOverflow = providers.length > 1 || statuses.length > 1 || regions.length > 1 || oses.length > 1;

  const { data, isLoading } = useQuery({
    queryKey: ["servers", { q: fs.q, provider: apiProvider, status: apiStatus, region: apiRegion, os: apiOs, datacenter, offset, pageSize }],
    queryFn: () =>
      api<Page<Server>>("/api/servers", {
        query: { search: fs.q, provider: apiProvider, status: apiStatus, region: apiRegion, os: apiOs, datacenter, limit: anyMultiOverflow ? 500 : pageSize, offset: anyMultiOverflow ? 0 : offset },
      }),
    placeholderData: (prev) => prev,
  });

  const { data: stats } = useQuery({
    queryKey: ["stats"],
    queryFn: () => api<Stats>("/api/servers/stats"),
    staleTime: 30_000,
  });
  const filterFields = buildServerFilterFields(stats, data?.items ?? []);

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
  const { data: serverGroups = [] } = useQuery<ServerGroup[]>({
    queryKey: ["server-groups"],
    queryFn: () => api("/api/server-groups"),
    staleTime: 30_000,
  });
  const addToGroup = useMutation({
    mutationFn: async ({ groupId, serverIds }: { groupId: number; serverIds: number[] }) => {
      const current = await api<number[]>(`/api/server-groups/${groupId}/members`);
      const merged = Array.from(new Set([...current, ...serverIds]));
      return api(`/api/server-groups/${groupId}/members`, { method: "PUT", json: { server_ids: merged } });
    },
    onSuccess: () => {
      toast.success("Added to group");
      qc.invalidateQueries({ queryKey: ["server-groups"] });
      setSelected(new Set());
    },
    onError: (e: Error) => toast.error(e.message),
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

  // Client-side filter for multi-select overflow (provider/status/region/os)
  const allItems = data?.items ?? [];
  const items = allItems.filter((s) =>
    (providers.length <= 1 || providers.includes(s.provider)) &&
    (statuses.length  <= 1 || statuses.includes(s.status)) &&
    (regions.length   <= 1 || regions.includes(s.region ?? "")) &&
    (oses.length      <= 1 || oses.includes(s.os ?? ""))
  );
  const total = anyMultiOverflow ? items.length : (data?.total ?? 0);

  const serverColumns: SmartTableColumn<Server>[] = [
    {
      key: "select",
      className: "w-8",
      header: (
        <input type="checkbox"
          checked={items.length > 0 && items.every(s => selected.has(s.id))}
          onChange={e => setSelected(e.target.checked ? new Set(items.map(s => s.id)) : new Set())}
          className="rounded"
        />
      ),
      render: (s) => (
        <input type="checkbox"
          checked={selected.has(s.id)}
          onClick={e => e.stopPropagation()}
          onChange={e => setSelected(prev => {
            const next = new Set(prev);
            e.target.checked ? next.add(s.id) : next.delete(s.id);
            return next;
          })}
          className="rounded"
        />
      ),
    },
    {
      key: "instance",
      header: "Instance",
      render: (s) => (
        <div className="flex flex-col">
          <span className="text-sm font-medium">{s.name}</span>
          {s.cloud_id && (
            <span className="text-[10px] text-muted-foreground font-mono">{s.cloud_id}</span>
          )}
        </div>
      ),
    },
    { key: "provider", header: "Provider", render: (s) => <ProviderBadge provider={s.provider} /> },
    { key: "region", header: "Region", className: "text-xs text-muted-foreground font-mono", render: (s) => s.region ?? "—" },
    { key: "public_ip", header: "Public IP", className: "font-mono text-xs text-muted-foreground", render: (s) => s.public_ip ?? "—" },
    {
      key: "type",
      header: "Type",
      render: (s) => s.instance_type ? (
        <span className="text-xs bg-muted px-1.5 py-0.5 rounded border border-border">{s.instance_type}</span>
      ) : "—",
    },
    { key: "os", header: "OS", render: (s) => <OsBadge os={s.os} /> },
    {
      key: "ssh_key",
      header: "SSH Key",
      render: (s) => (
        <select
          className="text-xs px-1.5 py-0.5 border border-border rounded bg-background max-w-[120px] truncate"
          value={s.ssh_credential_id ?? ""}
          onClick={e => e.stopPropagation()}
          onChange={e => assignSSH.mutate({ serverId: s.id, sshCredentialId: e.target.value ? Number(e.target.value) : null })}
        >
          <option value="">None</option>
          {sshCreds.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      ),
    },
    {
      key: "synced",
      header: "Synced",
      className: "text-xs text-muted-foreground",
      render: (s) => s.last_synced ? formatDistanceToNow(new Date(s.last_synced), { addSuffix: true }) : "never",
    },
    { key: "status", header: "Status", render: (s) => <StatusPill status={s.status} /> },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (s) => (
        <div className="inline-flex items-center gap-0.5">
          {s.ssh_credential_id && (
            <button onClick={e => { e.stopPropagation(); setSshInfoFor(s); }} className="icon-btn" title="View SSH credential">
              <KeyRound className="size-3.5" />
            </button>
          )}
          <button onClick={e => { e.stopPropagation(); setEditing(s); }} className="icon-btn" title="Edit">
            <Pencil className="size-3.5" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); sshSync.mutate(s.id); }}
            disabled={sshSync.isPending}
            className="icon-btn disabled:opacity-40" title="SSH sync"
          ><RefreshCw className={`size-3.5 ${sshSync.isPending ? "animate-spin" : ""}`} /></button>
          <button
            onClick={async e => { e.stopPropagation(); if (await confirmAsync(`Delete ${s.name}?`)) del.mutate(s.id); }}
            className="icon-btn hover:text-red-600 hover:bg-red-50" title="Delete"
          ><Trash2 className="size-3.5" /></button>
        </div>
      ),
    },
  ];

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
          fields={filterFields}
          state={fs}
          onChange={(s) => { setFs(s); setPage(1); }}
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
            <select
              className="px-2 py-1 text-xs border border-border rounded bg-background"
              defaultValue=""
              onChange={e => {
                const val = e.target.value;
                if (!val) return;
                addToGroup.mutate({ groupId: Number(val), serverIds: Array.from(selected) });
                e.target.value = "";
              }}
            >
              <option value="">Add to group…</option>
              {serverGroups.filter(g => !g.is_auto).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <button
              onClick={() => sshGroupSync.mutate({ serverIds: Array.from(selected) })}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-border rounded hover:bg-muted"
            ><RefreshCw className="size-3" /> SSH Sync</button>
            <button onClick={() => setSelected(new Set())} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
          </div>
        </div>
      )}

      <SmartTable<Server>
        columns={serverColumns}
        rows={items}
        rowKey={(s) => s.id}
        mode={anyMultiOverflow ? "client" : "server"}
        page={page}
        onPageChange={setPage}
        totalItems={total}
        onPageSizeChange={setPageSize}
        isLoading={isLoading}
        onRowClick={(s) => navigate({ to: "/server-detail/$id", params: { id: String(s.id) } })}
        empty={
          <EmptyState
            title="No servers match"
            description="Add cloud credentials and run a sync to discover instances."
          />
        }
      />

    </div>
  );
}
