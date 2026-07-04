import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, type Server, type SshCredential, type ServerIpAddress } from "@/lib/api";
import { Card, ProviderBadge, StatusPill, OsBadge, CustomSelect, confirmAsync } from "@/components/ui-bits";
import { ArrowLeft, RefreshCw, Trash2, Pencil, Network, ShieldCheck, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_app/server-detail/$id")({
  head: () => ({ meta: [{ title: "Server Detail — System Control" }] }),
  component: ServerDetailPage,
});

// ── inline edit dialog (reused from servers list) ─────────────────────────────
function EditDialog({ server, onClose }: Readonly<{ server: Server; onClose: () => void }>) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: server.name,
    public_ip: server.public_ip ?? "",
    region: server.region ?? "",
    status: server.status,
    notes: server.notes ?? "",
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));
  const update = useMutation({
    mutationFn: () => api(`/api/servers/${server.id}`, {
      method: "PUT",
      body: JSON.stringify({ ...form, public_ip: form.public_ip || null, region: form.region || null, notes: form.notes || null }),
    }),
    onSuccess: () => {
      toast.success("Server updated");
      qc.invalidateQueries({ queryKey: ["server", server.id] });
      qc.invalidateQueries({ queryKey: ["servers"] });
      onClose();
    },
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
            <label htmlFor="edit-server-name" className="text-xs text-muted-foreground font-medium block mb-1">Name *</label>
            <input id="edit-server-name" className={inp} value={form.name} onChange={set("name")} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1">
                Status
                <CustomSelect value={form.status} onChange={v => setForm(f => ({ ...f, status: v }))}
                  options={["unknown","running","stopped","pending"].map(s => ({ value: s }))} />
              </label>
            </div>
            <div>
              <label htmlFor="edit-server-region" className="text-xs text-muted-foreground font-medium block mb-1">Region</label>
              <input id="edit-server-region" className={inp} value={form.region} onChange={set("region")} placeholder="us-east-1" />
            </div>
          </div>
          <div>
            <label htmlFor="edit-server-public-ip" className="text-xs text-muted-foreground font-medium block mb-1">Public IP</label>
            <input id="edit-server-public-ip" className={inp} value={form.public_ip} onChange={set("public_ip")} placeholder="1.2.3.4" /> {/* NOSONAR */}
          </div>
          <div>
            <label htmlFor="edit-server-notes" className="text-xs text-muted-foreground font-medium block mb-1">Notes</label>
            <textarea id="edit-server-notes" className={inp} rows={2} value={form.notes} onChange={set("notes")} />
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

// ── SSH sync dialog ──────────────────────────────────────────────────────────

function SshSyncDialog({ serverId, lastCredentialId, onClose, onDone }: Readonly<{
  serverId: string;
  lastCredentialId?: number;
  onClose: () => void;
  onDone: () => void;
}>) {
  const { data: creds = [], isLoading } = useQuery<SshCredential[]>({
    queryKey: ["sshCredentials"],
    queryFn: () => api("/api/ssh-credentials"),
  });
  const defaultCred = lastCredentialId
    ? String(lastCredentialId)
    : creds.find(c => c.is_default)?.id?.toString() ?? "";
  const [credId, setCredId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hostKeyErr, setHostKeyErr] = useState(false);
  const [trusted, setTrusted] = useState(false);

  const effectiveCredId = credId || defaultCred;

  const trustKey = useMutation({
    mutationFn: () => api(`/api/servers/${serverId}/trust-host-key?ssh_credential_id=${effectiveCredId}`, { method: "POST" }),
    onSuccess: () => { setTrusted(true); setHostKeyErr(false); setError(null); sync.mutate(); },
    onError: (e: Error) => setError(e.message),
  });

  const sync = useMutation({
    mutationFn: () => api(`/api/servers/${serverId}/ssh-sync?ssh_credential_id=${effectiveCredId}`, { method: "POST" }),
    onSuccess: () => { toast.success("SSH sync complete"); onDone(); onClose(); },
    onError: (e: Error) => {
      const msg = e.message;
      if (msg.includes("known_hosts") || msg.includes("host key") || msg.includes("not in trusted")) {
        setHostKeyErr(true);
        setError("Host key not trusted. Trust it first, then sync.");
      } else {
        setError(msg);
      }
    },
  });

  const credOptions = creds.map(c => ({
    value: String(c.id),
    label: `${c.name} (${c.username}${c.proxy_host ? " via proxy" : ""})`,
  }));

  let credentialField: React.ReactNode;
  if (isLoading) {
    credentialField = <p className="text-xs text-muted-foreground">Loading credentials…</p>;
  } else if (creds.length === 0) {
    credentialField = <p className="text-xs text-muted-foreground">No SSH credentials found. Add one in <a href="/ssh-keys" className="underline">SSH Keys</a>.</p>;
  } else {
    credentialField = (
      <div>
        <label className="text-xs text-muted-foreground font-medium block mb-1">
          SSH Credential
          <CustomSelect
            value={effectiveCredId}
            onChange={setCredId}
            options={credOptions}
          />
        </label>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border border-border rounded-lg p-6 w-full max-w-sm space-y-4 shadow-lg">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm">SSH Sync</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded"><X className="size-4" /></button>
        </div>

        {credentialField}

        {trusted && (
          <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded p-2 flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 shrink-0" /> Host key trusted — syncing now…
          </div>
        )}
        {error && !trusted && (
          <div className={`text-xs rounded p-2 space-y-2 ${hostKeyErr ? "text-amber-700 bg-amber-50 border border-amber-200" : "text-red-600 bg-red-50 border border-red-200"}`}>
            <p>{error}</p>
            {hostKeyErr && (
              <button
                onClick={() => trustKey.mutate()}
                disabled={trustKey.isPending}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium bg-amber-500 text-white rounded hover:bg-amber-600 disabled:opacity-50"
              >
                <ShieldCheck className="size-3" />
                {trustKey.isPending ? "Trusting…" : "Trust & Sync"}
              </button>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted">Cancel</button>
          <button
            onClick={() => { setError(null); sync.mutate(); }}
            disabled={!effectiveCredId || sync.isPending || creds.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50"
          >
            <RefreshCw className={`size-3.5 ${sync.isPending ? "animate-spin" : ""}`} />
            {sync.isPending ? "Syncing…" : "Run SSH Sync"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── detail section helpers ────────────────────────────────────────────────────

function Section({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <Card className="overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-surface-muted">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </Card>
  );
}

function FieldGrid({ entries }: Readonly<{ entries: [string, React.ReactNode][] }>) {
  // Drop fields with no real value (bare "—" placeholder), and use flex-wrap
  // instead of a fixed grid-cols-N track — a fixed column count still leaves
  // visible empty track space when only 1-2 fields are populated, since the
  // grid reserves columns regardless of how many cells actually render.
  // No max-w cap: fewer cells than a row can hold should stretch to fill it
  // rather than leaving dead space, since flex-1 alone (capped) still left a
  // gap when e.g. 3 cells populated a 4-wide row.
  const populated = entries.filter(([, value]) => value !== "—" && value !== null && value !== undefined);
  if (!populated.length) return <p className="text-xs text-muted-foreground">No data.</p>;
  return (
    <div className="flex flex-wrap gap-px bg-border ring-1 ring-border rounded-lg overflow-hidden">
      {populated.map(([label, value]) => (
        <div key={label} className="bg-surface p-3 flex-1 min-w-[140px]">
          <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-0.5">{label}</div>
          <div className="text-sm font-mono break-all">{value}</div>
        </div>
      ))}
    </div>
  );
}

function KVTable({ data }: Readonly<{ data: Record<string, unknown> }>) {
  const entries = Object.entries(data).filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (!entries.length) return <p className="text-xs text-muted-foreground">No entries.</p>;
  return (
    <table className="w-full text-xs">
      <tbody className="divide-y divide-border">
        {entries.map(([k, v]) => (
          <tr key={k} className="hover:bg-muted/30 transition-colors">
            <td className="py-1.5 pr-4 font-mono text-muted-foreground w-1/3 align-top">{k}</td>
            <td className="py-1.5 font-mono text-foreground break-all">
              {typeof v === "object" ? JSON.stringify(v, null, 2) : String(v)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function formatSshValue(k: string, v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (k === "memory_mb" && typeof v === "number") return `${(v / 1024).toFixed(1)} GB`;
  if (k === "last_ssh_sync" && typeof v === "string") {
    try { return new Date(v).toLocaleString(); } catch { return v; }
  }
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}

function SshInfoSection({ sshInfo }: Readonly<{ sshInfo: Record<string, unknown> }>) {
  const allIps: string[] = Array.isArray(sshInfo.all_ips) ? (sshInfo.all_ips as string[]) : [];
  const scalarKeys = ["hostname","os_release","kernel","cpu_count","memory_mb","credential_name","last_ssh_sync"];
  const scalar = scalarKeys.filter(k => sshInfo[k] !== null && sshInfo[k] !== undefined);
  const labelMap: Record<string, string> = {
    hostname: "Hostname", os_release: "OS Release", kernel: "Kernel",
    cpu_count: "CPU Cores", memory_mb: "Memory", credential_name: "SSH Credential",
    last_ssh_sync: "Last Sync",
  };

  return (
    <div className="space-y-4">
      {scalar.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-px bg-border ring-1 ring-border rounded-lg overflow-hidden">
          {scalar.map(k => (
            <div key={k} className="bg-surface p-3">
              <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-0.5">{labelMap[k] ?? k}</div>
              <div className="text-sm font-mono break-all">{formatSshValue(k, sshInfo[k])}</div>
            </div>
          ))}
        </div>
      )}

      {allIps.length > 0 && (
        <div>
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">
            All IPs ({allIps.length})
          </div>
          <div className="max-h-48 overflow-y-auto rounded-lg ring-1 ring-border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10 bg-zinc-50 dark:bg-zinc-800 border-b border-border">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">#</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Address / CIDR</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {allIps.map((ip, i) => {
                  const isV6 = ip.includes(":");
                  const isLoopback = ip.startsWith("127.") || ip.startsWith("::1");
                  const isLink = ip.startsWith("fe80:");
                  let type: string;
                  if (isLoopback) type = "loopback";
                  else if (isLink) type = "link-local";
                  else if (isV6) type = "IPv6";
                  else type = "IPv4";
                  let badgeClass: string;
                  if (isLoopback) badgeClass = "bg-zinc-100 text-zinc-500 border-zinc-200";
                  else if (isLink) badgeClass = "bg-yellow-50 text-yellow-700 border-yellow-200";
                  else if (isV6) badgeClass = "bg-blue-50 text-blue-700 border-blue-200";
                  else badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
                  return (
                    <tr key={i} className="hover:bg-muted/30">
                      <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-1.5 font-mono">{ip}</td>
                      <td className="px-3 py-1.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${badgeClass}`}>{type}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── discovered networks section (server_ip_addresses, best-effort) ─────────────
// NOTE: no `GET /api/servers/{id}/ip-addresses` endpoint exists yet on the
// backend at time of writing (not in the discovery router's 10 endpoints).
// This queries it defensively — a 404 renders the empty state below instead
// of an error, so this section is a no-op until that endpoint ships.

function DiscoveredNetworksSection({ serverId, server }: Readonly<{ serverId: string; server: Server }>) {
  const { data: rawAddrs, isLoading, error } = useQuery({
    queryKey: ["serverIpAddresses", serverId],
    queryFn: () => api<ServerIpAddress[]>(`/api/servers/${serverId}/ip-addresses`),
    retry: false,
  });

  const notFound = error instanceof ApiError && error.status === 404;
  const discovered = (error && !notFound) ? [] : (rawAddrs ?? []);

  // Union with the legacy IP sources (public_ip/private_ip/ssh_info.all_ips) so
  // servers never scanned by discovery still show their known addresses here,
  // not just an empty "no discovered aliases" message. Dedup by address —
  // discovery-sourced rows win when both list the same address (richer data).
  const seen = new Set(discovered.map(a => a.address));
  const legacy: ServerIpAddress[] = [];
  const allIps: string[] = Array.isArray(server.ssh_info?.all_ips) ? (server.ssh_info!.all_ips as string[]) : [];
  const legacyAddrs = new Set([
    ...(server.public_ip ? [server.public_ip] : []),
    ...(server.private_ip ? [server.private_ip] : []),
    ...allIps,
  ]);
  for (const addr of legacyAddrs) {
    const bareAddr = addr.split("/")[0];
    if (seen.has(bareAddr)) continue;
    seen.add(bareAddr);
    legacy.push({
      id: -legacy.length - 1,
      server_id: server.id,
      address: bareAddr,
      cidr: addr,
      ip_version: bareAddr.includes(":") ? 6 : 4,
      interface_name: "known",
      mac_address: null,
      scope: bareAddr === server.public_ip ? "public" : "private",
      is_primary: bareAddr === (server.private_ip ?? server.public_ip),
      discovered_from_ip: null,
      source: "manual",
      first_seen_at: null,
      last_seen_at: null,
    });
  }
  const addrs = [...discovered, ...legacy];

  if (isLoading) return <p className="text-xs text-muted-foreground">Loading…</p>;
  if (addrs.length === 0) {
    return <p className="text-xs text-muted-foreground">No known IP addresses yet.</p>;
  }

  const groups = new Map<string, ServerIpAddress[]>();
  for (const a of addrs) {
    const key = a.interface_name ?? "unknown";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(a);
  }

  return (
    <div className="space-y-4">
      {[...groups.entries()].map(([iface, rows]) => (
        <div key={iface}>
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">
            {iface} ({rows.length})
          </div>
          <div className="max-h-48 overflow-y-auto rounded-lg ring-1 ring-border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10 bg-zinc-50 dark:bg-zinc-800 border-b border-border">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Address</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Scope</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">MAC</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Primary</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Last Seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((a) => (
                  <tr key={a.id} className="hover:bg-muted/30">
                    <td className="px-3 py-1.5 font-mono">{a.address}</td>
                    <td className="px-3 py-1.5">{a.scope}</td>
                    <td className="px-3 py-1.5 font-mono">{a.mac_address ?? "—"}</td>
                    <td className="px-3 py-1.5">{a.is_primary ? "yes" : "—"}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">
                      {a.last_seen_at ? formatDistanceToNow(new Date(a.last_seen_at), { addSuffix: true }) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

function ServerDetailPage() {
  const { id } = Route.useParams() as { id: string };
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [sshSyncOpen, setSshSyncOpen] = useState(false);

  const { data: server, isLoading, isError } = useQuery({
    queryKey: ["server", Number(id)],
    queryFn: () => api<Server>(`/api/servers/${id}`),
  });

  const del = useMutation({
    mutationFn: () => api(`/api/servers/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast.success("Server deleted"); navigate({ to: "/servers" }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (isError || !server) return <div className="p-6 text-sm text-red-600">Failed to load server.</div>;

  const sshInfo = server.ssh_info ?? {};
  const tags = server.tags ?? {};
  const extra = server.extra ?? {};

  return (
    <div className="p-6 space-y-5">
      {editing && <EditDialog server={server} onClose={() => setEditing(false)} />}
      {sshSyncOpen && (
        <SshSyncDialog
          serverId={id}
          lastCredentialId={typeof sshInfo.credential_id === "number" ? sshInfo.credential_id : undefined}
          onClose={() => setSshSyncOpen(false)}
          onDone={() => qc.invalidateQueries({ queryKey: ["server", Number(id)] })}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => navigate({ to: "/servers" })} className="icon-btn shrink-0">
            <ArrowLeft className="size-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-semibold truncate">{server.name}</h1>
              <StatusPill status={server.status} />
              <ProviderBadge provider={server.provider} />
            </div>
            {server.cloud_id && (
              <div className="text-[11px] text-muted-foreground font-mono mt-0.5">{server.cloud_id}</div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/resource-map"
            search={{ server: Number(id) }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted"
          >
            <Network className="size-3.5" /> Resource Map
          </Link>
          <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted">
            <Pencil className="size-3.5" /> Edit
          </button>
          <button
            onClick={() => setSshSyncOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90"
          >
            <RefreshCw className="size-3.5" /> SSH Sync
          </button>
          <button
            onClick={async () => { if (await confirmAsync(`Delete ${server.name}?`)) del.mutate(); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded-md hover:bg-red-50"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Resource summary */}
      <Section title="Resource Summary">
        <FieldGrid entries={[
          ["vCPU",    server.vcpu ?? "—"],
          ["Memory",  server.memory_gb ? `${server.memory_gb} GB` : "—"],
          ["Storage", server.storage_gb ? `${server.storage_gb} GB` : "—"],
          ["OS",      <OsBadge os={server.os} />],
          ["Region",  server.region ?? "—"],
          ["Zone",    server.zone ?? "—"],
          ["Type",    server.instance_type ?? "—"],
          ["DC",      server.datacenter ?? "—"],
        ]} />
      </Section>

      {/* Network */}
      <Section title="Network">
        <FieldGrid entries={[
          ["Public IP",  server.public_ip ?? "—"],
          ["Private IP", server.private_ip ?? "—"],
          ["Hostname",   server.hostname ?? "—"],
        ]} />
      </Section>

      {/* Timestamps */}
      <Section title="Timestamps">
        <FieldGrid entries={[
          ["Created",     server.created_at ? formatDistanceToNow(new Date(server.created_at), { addSuffix: true }) : "—"],
          ["Updated",     server.updated_at ? formatDistanceToNow(new Date(server.updated_at), { addSuffix: true }) : "—"],
          ["Last Synced", server.last_synced ? formatDistanceToNow(new Date(server.last_synced), { addSuffix: true }) : "never"],
        ]} />
      </Section>

      {/* SSH info */}
      {Object.keys(sshInfo).length > 0 && (
        <Section title="SSH Info">
          <SshInfoSection sshInfo={sshInfo} />
        </Section>
      )}

      {/* Discovered Networks (server_ip_addresses, best-effort — see component note) */}
      <Section title="Discovered Networks">
        <DiscoveredNetworksSection serverId={id} server={server} />
      </Section>

      {/* Tags */}
      {Object.keys(tags).length > 0 && (
        <Section title="Tags">
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(tags).map(([k, v]) => (
              <span key={k} className="text-[11px] bg-muted px-2 py-0.5 rounded-full border border-border font-mono">
                {k}: {String(v)}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* Extra / provider-specific metadata */}
      {Object.keys(extra).length > 0 && (
        <Section title="Provider Metadata">
          <KVTable data={extra} />
        </Section>
      )}

      {/* Notes */}
      {server.notes && (
        <Section title="Notes">
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{server.notes}</p>
        </Section>
      )}
    </div>
  );
}
