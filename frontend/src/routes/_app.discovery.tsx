import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  api,
  type Page,
  type DiscoveryNetwork,
  type DiscoveryJob,
  type DiscoveryResult,
  type SshCredential,
} from "@/lib/api";
import { Card, PageHeader, StatusPill, CustomSelect, confirmAsync, EmptyState } from "@/components/ui-bits";
import { SmartTable, type SmartTableColumn } from "@/components/SmartTable";
import { formatDistanceToNow } from "date-fns";
import { Plus, Pencil, Trash2, Play, Square, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/discovery")({
  head: () => ({ meta: [{ title: "On-Prem Discovery — System Control" }] }),
  component: DiscoveryPage,
});

// ── network create/edit dialog ─────────────────────────────────────────────

type NetworkForm = {
  name: string;
  cidr: string;
  datacenter: string;
  environment: string;
  ssh_credential_id: string;
  max_parallel: string;
  timeout_seconds: string;
  is_active: boolean;
  notes: string;
};

function emptyNetworkForm(): NetworkForm {
  return { name: "", cidr: "", datacenter: "", environment: "", ssh_credential_id: "", max_parallel: "32", timeout_seconds: "8", is_active: true, notes: "" };
}

function networkToForm(n: DiscoveryNetwork): NetworkForm {
  return {
    name: n.name,
    cidr: n.cidr,
    datacenter: n.datacenter ?? "",
    environment: n.environment ?? "",
    ssh_credential_id: n.ssh_credential_id ? String(n.ssh_credential_id) : "",
    max_parallel: String(n.max_parallel ?? 32),
    timeout_seconds: String(n.timeout_seconds ?? 8),
    is_active: n.is_active,
    notes: n.notes ?? "",
  };
}

function NetworkDialog({ network, sshCreds, onClose }: Readonly<{ network: DiscoveryNetwork | null; sshCreds: SshCredential[]; onClose: () => void }>) {
  const qc = useQueryClient();
  const [form, setForm] = useState<NetworkForm>(network ? networkToForm(network) : emptyNetworkForm());
  const set = (k: keyof NetworkForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const payload = () => ({
    name: form.name,
    cidr: form.cidr,
    datacenter: form.datacenter || null,
    environment: form.environment || null,
    ssh_credential_id: form.ssh_credential_id ? Number(form.ssh_credential_id) : null,
    max_parallel: Number(form.max_parallel) || 32,
    timeout_seconds: Number(form.timeout_seconds) || 8,
    is_active: form.is_active,
    notes: form.notes || null,
  });

  const save = useMutation({
    mutationFn: () =>
      network
        ? api(`/api/discovery/networks/${network.id}`, { method: "PUT", json: payload() })
        : api("/api/discovery/networks", { method: "POST", json: payload() }),
    onSuccess: () => {
      toast.success(network ? "Network updated" : "Network created");
      qc.invalidateQueries({ queryKey: ["discoveryNetworks"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const inp = "w-full px-3 py-1.5 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border border-border rounded-lg p-6 w-full max-w-md space-y-4 shadow-lg">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm">{network ? "Edit discovery network" : "Add discovery network"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded"><X className="size-4" /></button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="net-name" className="text-xs text-muted-foreground font-medium block mb-1">Name *</label>
              <input id="net-name" className={inp} value={form.name} onChange={set("name")} placeholder="office-lan" required />
            </div>
            <div>
              <label htmlFor="net-cidr" className="text-xs text-muted-foreground font-medium block mb-1">CIDR *</label>
              <input id="net-cidr" className={inp} value={form.cidr} onChange={set("cidr")} placeholder="10.10.10.0/24" required /> {/* NOSONAR */}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="net-dc" className="text-xs text-muted-foreground font-medium block mb-1">Datacenter</label>
              <input id="net-dc" className={inp} value={form.datacenter} onChange={set("datacenter")} placeholder="dc-1" />
            </div>
            <div>
              <label htmlFor="net-env" className="text-xs text-muted-foreground font-medium block mb-1">Environment</label>
              <input id="net-env" className={inp} value={form.environment} onChange={set("environment")} placeholder="prod" />
            </div>
          </div>
          <label className="block">
            <span className="text-xs text-muted-foreground font-medium block mb-1">SSH Credential</span>
            <CustomSelect
              value={form.ssh_credential_id}
              onChange={(v) => setForm(f => ({ ...f, ssh_credential_id: v }))}
              placeholder="None"
              options={sshCreds.map(c => ({ value: String(c.id), label: c.name }))}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="net-max-parallel" className="text-xs text-muted-foreground font-medium block mb-1">Max parallel</label>
              <input id="net-max-parallel" type="number" min={1} className={inp} value={form.max_parallel} onChange={set("max_parallel")} />
            </div>
            <div>
              <label htmlFor="net-timeout" className="text-xs text-muted-foreground font-medium block mb-1">Timeout (s)</label>
              <input id="net-timeout" type="number" min={1} className={inp} value={form.timeout_seconds} onChange={set("timeout_seconds")} />
            </div>
          </div>
          <div>
            <label htmlFor="net-active" className="text-xs text-muted-foreground font-medium flex items-center gap-2">
              <input id="net-active" type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="rounded" />
              Active
            </label>
          </div>
          <div>
            <label htmlFor="net-notes" className="text-xs text-muted-foreground font-medium block mb-1">Notes</label>
            <textarea id="net-notes" className={inp} rows={2} value={form.notes} onChange={set("notes")} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted">Cancel</button>
          <button onClick={() => save.mutate()} disabled={!form.name || !form.cidr || save.isPending}
            className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50">
            {save.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── duration helper (mirrors sync.tsx exactly) ──────────────────────────────

function jobDuration(j: DiscoveryJob): string {
  if (j.started_at && j.completed_at)
    return `${Math.round((new Date(j.completed_at).getTime() - new Date(j.started_at).getTime()) / 1000)}s`;
  return j.status === "running" ? "…" : "—";
}

// ── main page ────────────────────────────────────────────────────────────────

function DiscoveryPage() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<DiscoveryNetwork | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [resultsPage, setResultsPage] = useState(1);
  const [resultsPageSize, setResultsPageSize] = useState(25);
  const [networksPage, setNetworksPage] = useState(1);
  const [jobsPage, setJobsPage] = useState(1);

  const [runForm, setRunForm] = useState({ cidr: "", ssh_credential_id: "", max_parallel: "32", timeout_seconds: "8" });

  const { data: networks = [], isLoading: networksLoading } = useQuery({
    queryKey: ["discoveryNetworks"],
    queryFn: () => api<DiscoveryNetwork[]>("/api/discovery/networks"),
  });

  const { data: sshCreds = [] } = useQuery<SshCredential[]>({
    queryKey: ["sshCredentials"],
    queryFn: () => api("/api/ssh-credentials"),
    staleTime: 60_000,
  });

  const { data: jobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ["discoveryJobs"],
    queryFn: () => api<DiscoveryJob[]>("/api/discovery/jobs", { query: { limit: 100 } }),
  });

  const { data: resultsPageData, isLoading: resultsLoading } = useQuery({
    queryKey: ["discoveryResults", selectedJobId, resultsPage, resultsPageSize],
    queryFn: () =>
      api<Page<DiscoveryResult>>(`/api/discovery/jobs/${selectedJobId}/results`, {
        query: { limit: resultsPageSize, offset: (resultsPage - 1) * resultsPageSize },
      }),
    enabled: !!selectedJobId,
  });

  const runNetwork = useMutation({
    mutationFn: (id: number) => api<{ job_id: number; message: string }>(`/api/discovery/networks/${id}/run`, { method: "POST" }),
    onSuccess: (res) => {
      toast.success(`Discovery started — job #${res.job_id}`);
      qc.invalidateQueries({ queryKey: ["discoveryJobs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteNetwork = useMutation({
    mutationFn: (id: number) => api(`/api/discovery/networks/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Network deleted");
      qc.invalidateQueries({ queryKey: ["discoveryNetworks"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const runOnce = useMutation({
    mutationFn: () =>
      api<{ job_id: number; message: string }>("/api/discovery/run-once", {
        method: "POST",
        json: {
          cidr: runForm.cidr,
          ssh_credential_id: runForm.ssh_credential_id ? Number(runForm.ssh_credential_id) : null,
          max_parallel: Number(runForm.max_parallel) || 32,
          timeout_seconds: Number(runForm.timeout_seconds) || 8,
        },
      }),
    onSuccess: (res) => {
      toast.success(`Discovery started — job #${res.job_id}`);
      qc.invalidateQueries({ queryKey: ["discoveryJobs"] });
      setRunForm(f => ({ ...f, cidr: "" }));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const stopJob = useMutation({
    mutationFn: (id: number) => api<{ stopped: boolean }>(`/api/discovery/jobs/${id}/stop`, { method: "POST" }),
    onSuccess: (res) => {
      if (res.stopped) toast.success("Job stopped");
      else toast.error("Job was not running");
      qc.invalidateQueries({ queryKey: ["discoveryJobs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── networks table ──────────────────────────────────────────────────────
  const networkColumns: SmartTableColumn<DiscoveryNetwork>[] = [
    { key: "name", header: "Name", render: (n) => <span className="font-medium text-sm">{n.name}</span> },
    { key: "cidr", header: "CIDR", className: "font-mono text-xs", render: (n) => n.cidr },
    { key: "dc", header: "Datacenter", className: "text-xs text-muted-foreground", render: (n) => n.datacenter ?? "—" },
    { key: "env", header: "Environment", className: "text-xs text-muted-foreground", render: (n) => n.environment ?? "—" },
    { key: "parallel", header: "Max Parallel", className: "font-mono text-xs", render: (n) => n.max_parallel },
    { key: "active", header: "Active", render: (n) => <StatusPill status={n.is_active ? "active" : "inactive"} /> },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (n) => (
        <div
          className="inline-flex items-center gap-0.5"
          role="button"
          tabIndex={0}
          onClick={e => e.stopPropagation()}
          onKeyDown={e => e.stopPropagation()}
        >
          <button onClick={() => runNetwork.mutate(n.id)} disabled={runNetwork.isPending || !n.is_active}
            className="icon-btn disabled:opacity-40" title="Run discovery">
            <Play className="size-3.5" />
          </button>
          <button onClick={() => setEditing(n)} className="icon-btn" title="Edit"><Pencil className="size-3.5" /></button>
          <button
            onClick={async () => { if (await confirmAsync(`Delete network ${n.name}?`)) deleteNetwork.mutate(n.id); }}
            className="icon-btn hover:text-red-600 hover:bg-red-50" title="Delete"
          ><Trash2 className="size-3.5" /></button>
        </div>
      ),
    },
  ];

  // ── job history table ────────────────────────────────────────────────────
  const jobColumns: SmartTableColumn<DiscoveryJob>[] = [
    { key: "cidr", header: "CIDR", className: "font-mono text-xs", render: (j) => j.cidr },
    { key: "status", header: "Status", render: (j) => <StatusPill status={j.status} /> },
    { key: "total", header: "Total", className: "font-mono text-xs", render: (j) => j.total_ips },
    { key: "scanned", header: "Scanned", className: "font-mono text-xs", render: (j) => j.scanned_ips },
    { key: "reachable", header: "Reachable", className: "font-mono text-xs", render: (j) => j.reachable_ssh },
    { key: "authed", header: "Authenticated", className: "font-mono text-xs", render: (j) => j.authenticated },
    { key: "added", header: "Servers Added", className: "font-mono text-xs", render: (j) => j.servers_added },
    { key: "updated", header: "Servers Updated", className: "font-mono text-xs", render: (j) => j.servers_updated },
    { key: "dupes", header: "Duplicates", className: "font-mono text-xs", render: (j) => j.duplicates_merged },
    { key: "failed", header: "Failed", className: "font-mono text-xs", render: (j) => j.failed },
    {
      key: "started",
      header: "Started",
      className: "text-xs text-muted-foreground",
      render: (j) => (j.started_at ? formatDistanceToNow(new Date(j.started_at), { addSuffix: true }) : "—"),
    },
    { key: "duration", header: "Duration", className: "font-mono text-xs", render: jobDuration },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (j) => (
        <div
          className="inline-flex items-center gap-1.5"
          role="button"
          tabIndex={0}
          onClick={e => e.stopPropagation()}
          onKeyDown={e => e.stopPropagation()}
        >
          <button
            onClick={() => { setSelectedJobId(j.id); setResultsPage(1); }}
            className="px-2 py-1 text-xs border border-border rounded hover:bg-muted"
          >
            View results
          </button>
          {j.status === "running" && (
            <button
              onClick={() => stopJob.mutate(j.id)}
              disabled={stopJob.isPending}
              className="icon-btn disabled:opacity-40 hover:text-red-600 hover:bg-red-50" title="Stop"
            ><Square className="size-3.5" /></button>
          )}
        </div>
      ),
    },
  ];

  // ── live progress (selected job, or most recent running one) ────────────
  const liveJob =
    (selectedJobId ? jobs.find(j => j.id === selectedJobId) : undefined) ??
    jobs.find(j => j.status === "running");

  // ── results table (server-mode, genuinely paginated backend) ────────────
  // Mapping from the single `status` enum to two conceptual columns:
  // - SSH status: "closed"/"skipped" => port never opened; anything else => "Open"
  // - Auth status: "success"/"duplicate" => Authenticated; "auth_failed" => Failed; else "—"
  const resultColumns: SmartTableColumn<DiscoveryResult>[] = [
    { key: "ip", header: "IP", className: "font-mono text-xs", render: (r) => r.ip },
    {
      key: "ssh",
      header: "SSH Status",
      render: (r) => {
        const open = r.status !== "closed" && r.status !== "skipped";
        return <StatusPill status={open ? "open" : r.status} />;
      },
    },
    {
      key: "auth",
      header: "Auth Status",
      render: (r) => {
        if (r.status === "success" || r.status === "duplicate") return <StatusPill status="authenticated" />;
        if (r.status === "auth_failed") return <StatusPill status="failed" />;
        return <span className="text-xs text-muted-foreground">—</span>;
      },
    },
    { key: "hostname", header: "Hostname", className: "text-xs", render: (r) => r.hostname ?? "—" },
    {
      key: "server",
      header: "Matched Server",
      render: (r) =>
        r.server_id ? (
          <Link to="/server-detail/$id" params={{ id: String(r.server_id) }} className="text-primary hover:underline text-xs">
            #{r.server_id}
          </Link>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      key: "identity",
      header: "Identity Source",
      className: "text-xs text-muted-foreground",
      // ponytail: backend doesn't expose which signal matched (raw_summary is
      // non-secret host facts, not an identity-match audit field) — fall back
      // to identity_hash presence as "matched" vs "new".
      render: (r) => (r.identity_hash ? "matched" : "new"),
    },
    {
      key: "error",
      header: "Error",
      className: "text-xs max-w-xs truncate",
      render: (r) => (r.error_message ? <span className="text-red-600">{r.error_message}</span> : "—"),
    },
  ];

  return (
    <div className="p-6 space-y-4">
      {showAdd && <NetworkDialog network={null} sshCreds={sshCreds} onClose={() => setShowAdd(false)} />}
      {editing && <NetworkDialog network={editing} sshCreds={sshCreds} onClose={() => setEditing(null)} />}

      <div className="flex items-center justify-between">
        <PageHeader
          title="On-Prem Discovery"
          description="Scan internal CIDR ranges over SSH and merge live hosts into inventory."
        />
        <button onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90">
          <Plus className="size-3.5" /> Add network
        </button>
      </div>

      {/* 1. Saved discovery networks */}
      <Card className="p-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Saved Networks</h3>
      </Card>
      <SmartTable
        columns={networkColumns}
        rows={networks}
        rowKey={(n) => n.id}
        mode="client"
        page={networksPage}
        onPageChange={setNetworksPage}
        totalItems={networks.length}
        isLoading={networksLoading}
        empty={<EmptyState title="No discovery networks" description="Add a CIDR range to enable repeat scans." />}
      />

      {/* 2. Run one-time CIDR scan */}
      <Card className="p-4 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Run One-Time CIDR Scan</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
          <div className="col-span-2 sm:col-span-1">
            <label htmlFor="run-cidr" className="text-xs text-muted-foreground font-medium block mb-1">CIDR *</label>
            <input
              id="run-cidr"
              className="w-full px-3 py-1.5 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              value={runForm.cidr}
              onChange={(e) => setRunForm(f => ({ ...f, cidr: e.target.value }))}
              placeholder="10.10.10.0/24" // NOSONAR
            />
          </div>
          <label className="block">
            <span className="text-xs text-muted-foreground font-medium block mb-1">SSH Credential</span>
            <CustomSelect
              value={runForm.ssh_credential_id}
              onChange={(v) => setRunForm(f => ({ ...f, ssh_credential_id: v }))}
              placeholder="Default"
              options={sshCreds.map(c => ({ value: String(c.id), label: c.name }))}
            />
          </label>
          <div>
            <label htmlFor="run-max-parallel" className="text-xs text-muted-foreground font-medium block mb-1">Max parallel</label>
            <input
              id="run-max-parallel"
              type="number" min={1}
              className="w-full px-3 py-1.5 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              value={runForm.max_parallel}
              onChange={(e) => setRunForm(f => ({ ...f, max_parallel: e.target.value }))}
            />
          </div>
          <div>
            <label htmlFor="run-timeout" className="text-xs text-muted-foreground font-medium block mb-1">Timeout (s)</label>
            <input
              id="run-timeout"
              type="number" min={1}
              className="w-full px-3 py-1.5 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              value={runForm.timeout_seconds}
              onChange={(e) => setRunForm(f => ({ ...f, timeout_seconds: e.target.value }))}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <button
            onClick={() => runOnce.mutate()}
            disabled={!runForm.cidr || runOnce.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50"
          >
            <Play className="size-3.5" /> {runOnce.isPending ? "Starting…" : "Run scan"}
          </button>
        </div>
      </Card>

      {/* 3. Job history */}
      <Card className="p-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Job History</h3>
      </Card>
      <SmartTable
        columns={jobColumns}
        rows={jobs}
        rowKey={(j) => j.id}
        mode="client"
        page={jobsPage}
        onPageChange={setJobsPage}
        totalItems={jobs.length}
        isLoading={jobsLoading}
        onRowClick={(j) => { setSelectedJobId(j.id); setResultsPage(1); }}
        empty={<EmptyState title="No discovery jobs" description="Run a network or a one-time scan to see history here." />}
      />

      {/* 4. Live progress */}
      {liveJob && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Live Progress — {liveJob.cidr}
            </h3>
            <StatusPill status={liveJob.status} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-px bg-border ring-1 ring-border rounded-lg overflow-hidden">
            {[
              ["Total IPs", liveJob.total_ips],
              ["Scanned", liveJob.scanned_ips],
              ["SSH Open", liveJob.reachable_ssh],
              ["Authenticated", liveJob.authenticated],
              ["Added", liveJob.servers_added],
              ["Updated", liveJob.servers_updated],
              ["Duplicates", liveJob.duplicates_merged],
              ["Failed", liveJob.failed],
            ].map(([label, value]) => (
              <div key={label as string} className="bg-surface p-3">
                <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-0.5">{label}</div>
                <div className="text-sm font-mono">{value}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 5. Results table */}
      {selectedJobId && (
        <>
          <Card className="p-3 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Results — Job #{selectedJobId}
            </h3>
            <button onClick={() => setSelectedJobId(null)} className="text-xs text-muted-foreground hover:text-foreground">Close</button>
          </Card>
          <SmartTable
            columns={resultColumns}
            rows={resultsPageData?.items ?? []}
            rowKey={(r) => r.id}
            mode="server"
            page={resultsPage}
            onPageChange={setResultsPage}
            totalItems={resultsPageData?.total ?? 0}
            onPageSizeChange={setResultsPageSize}
            isLoading={resultsLoading}
            empty={<EmptyState title="No results yet" description="This job hasn't recorded any scan results." />}
          />
        </>
      )}
    </div>
  );
}
