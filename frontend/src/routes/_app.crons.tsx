import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type CronJob, type CronJobCreate, type Credential, type Page } from "@/lib/api";
import { Card, PageHeader, StatusPill, EmptyState, CustomSelect } from "@/components/ui-bits";
import { Play, Power, Trash2, Plus, X, Pencil } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { AdvancedFilter, emptyFilterState, type FilterState } from "@/components/advanced-filter";
import { SmartTable, type SmartTableColumn } from "@/components/SmartTable";

export const Route = createFileRoute("/_app/crons")({
  head: () => ({ meta: [{ title: "Crons — System Control" }] }),
  component: CronsPage,
});

function CronDialog({ onClose, job }: { onClose: () => void; job?: CronJob }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<CronJobCreate>(
    job
      ? { name: job.name, cron_expr: job.cron_expr, provider: job.provider ?? null, is_active: job.is_active }
      : { name: "", cron_expr: "0 * * * *", provider: null, is_active: true }
  );

  const { data: creds } = useQuery({
    queryKey: ["creds"],
    queryFn: () => api<Page<Credential>>("/api/credentials", { query: { limit: 100 } }),
  });

  const providerOptions = [
    { value: "", label: "All providers (sync everything)" },
    ...Array.from(new Set((creds?.items ?? []).filter(c => c.is_active).map(c => c.provider)))
      .map(p => ({ value: p, label: p.toUpperCase() })),
  ];

  const save = useMutation({
    mutationFn: (payload: CronJobCreate) =>
      job
        ? api(`/api/crons/${job.id}`, { method: "PUT", json: payload })
        : api("/api/crons", { method: "POST", json: payload }),
    onSuccess: () => {
      toast.success(job ? "Cron job updated" : "Cron job created");
      qc.invalidateQueries({ queryKey: ["crons"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const inp = "w-full px-3 py-1.5 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border border-border rounded-lg p-6 w-full max-w-md space-y-4 shadow-lg">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm">{job ? "Edit cron job" : "Add cron job"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded"><X className="size-4" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1">Name</label>
            <input
              className={inp}
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Daily AWS sync"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1">Schedule</label>
            <input
              className={`${inp} font-mono`}
              value={form.cron_expr}
              onChange={e => setForm(f => ({ ...f, cron_expr: e.target.value }))}
              placeholder="0 * * * *"
            />
            <p className="text-[10px] text-muted-foreground mt-1">minute hour day month weekday</p>
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1">Provider</label>
            <CustomSelect
              value={form.provider ?? ""}
              onChange={v => setForm(f => ({ ...f, provider: v || null }))}
              options={providerOptions}
              placeholder="All providers"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted">Cancel</button>
          <button
            onClick={() => save.mutate(form)}
            disabled={!form.name || !form.cron_expr || save.isPending}
            className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50"
          >
            {save.isPending ? (job ? "Saving…" : "Creating…") : (job ? "Save" : "Create")}
          </button>
        </div>
      </div>
    </div>
  );
}

const CRON_FIELDS = [
  { key: "state",    label: "State",    type: "select" as const, options: [{ value: "active", label: "Active" }, { value: "inactive", label: "Disabled" }] },
  { key: "provider", label: "Provider", type: "text" as const },
];

function CronsPage() {
  const qc = useQueryClient();
  const [editJob, setEditJob] = useState<CronJob | null | "new">(null);
  const [fs, setFs] = useState<FilterState>(emptyFilterState);
  const [page, setPage] = useState(1);

  const { data } = useQuery({
    queryKey: ["crons"],
    queryFn: () => api<CronJob[]>("/api/crons"),
  });

  const stateFilter = (fs.filters.state    as string) ?? "";
  const provFilter  = (fs.filters.provider as string) ?? "";

  const items = (data ?? []).filter((j) => {
    if (fs.q && !j.name.toLowerCase().includes(fs.q.toLowerCase())) return false;
    if (stateFilter === "active"   && !j.is_active) return false;
    if (stateFilter === "inactive" &&  j.is_active) return false;
    if (provFilter && !(j.provider ?? "").toLowerCase().includes(provFilter.toLowerCase())) return false;
    return true;
  });
  const toggle = useMutation({
    mutationFn: (id: number) => api(`/api/crons/${id}/toggle`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crons"] }),
  });
  const run = useMutation({
    mutationFn: (id: number) => api(`/api/crons/${id}/run-now`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Job triggered");
      qc.invalidateQueries({ queryKey: ["crons"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: number) => api(`/api/crons/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crons"] }),
  });

  return (
    <div className="p-6 space-y-4">
      {editJob !== null && (
        <CronDialog
          job={editJob === "new" ? undefined : editJob}
          onClose={() => setEditJob(null)}
        />
      )}
      <div className="flex items-center justify-between">
        <PageHeader title="Scheduled jobs" description="Sync schedules and recurring automation." />
        <button
          onClick={() => setEditJob("new")}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90"
        >
          <Plus className="size-3.5" /> Add cron
        </button>
      </div>
      <Card className="p-3">
        <AdvancedFilter fields={CRON_FIELDS} state={fs} onChange={s => { setFs(s); setPage(1); }} searchPlaceholder="Search job name…" />
      </Card>

      <SmartTable
        columns={cronColumns(run, setEditJob, toggle, del)}
        rows={items}
        rowKey={(j) => j.id}
        mode="client"
        page={page}
        onPageChange={setPage}
        totalItems={items.length}
        empty={<EmptyState title="No scheduled jobs match" />}
      />
    </div>
  );
}

function cronColumns(
  run: ReturnType<typeof useMutation<unknown, Error, number>>,
  setEditJob: (j: CronJob) => void,
  toggle: ReturnType<typeof useMutation<unknown, Error, number>>,
  del: ReturnType<typeof useMutation<unknown, Error, number>>
): SmartTableColumn<CronJob>[] {
  return [
    { key: "name", header: "Name", render: (j) => <span className="font-medium">{j.name}</span> },
    { key: "schedule", header: "Schedule", render: (j) => <span className="font-mono text-xs">{j.cron_expr}</span> },
    {
      key: "provider",
      header: "Provider",
      render: (j) =>
        j.provider
          ? <span className="text-xs bg-muted px-1.5 py-0.5 rounded border border-border">{j.provider}</span>
          : <span className="text-xs text-muted-foreground">—</span>,
    },
    {
      key: "last_run",
      header: "Last run",
      render: (j) => (
        <span className="text-xs text-muted-foreground">
          {j.last_run_at ? formatDistanceToNow(new Date(j.last_run_at), { addSuffix: true }) : "—"}
        </span>
      ),
    },
    {
      key: "next_run",
      header: "Next run",
      render: (j) => (
        <span className="text-xs text-muted-foreground">
          {j.next_run_at ? formatDistanceToNow(new Date(j.next_run_at), { addSuffix: true }) : "—"}
        </span>
      ),
    },
    {
      key: "state",
      header: "State",
      className: "text-right",
      render: (j) => <StatusPill status={j.is_active ? "active" : "inactive"} />,
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (j) => (
        <div className="inline-flex gap-0.5">
          <button onClick={() => run.mutate(j.id)} className="icon-btn" title="Run now">
            <Play className="size-3.5" />
          </button>
          <button onClick={() => setEditJob(j)} className="icon-btn" title="Edit">
            <Pencil className="size-3.5" />
          </button>
          <button onClick={() => toggle.mutate(j.id)} className="icon-btn" title={j.is_active ? "Disable" : "Enable"}>
            <Power className="size-3.5" />
          </button>
          <button onClick={() => del.mutate(j.id)} className="icon-btn hover:text-red-600 hover:bg-red-50" title="Delete">
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ),
    },
  ];
}
