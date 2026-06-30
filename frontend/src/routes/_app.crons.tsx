import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type CronJob, type CronJobCreate } from "@/lib/api";
import { Card, PageHeader, StatusPill, EmptyState } from "@/components/ui-bits";
import { Play, Power, Trash2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_app/crons")({
  head: () => ({ meta: [{ title: "Crons — System Control" }] }),
  component: CronsPage,
});

function AddCronDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<CronJobCreate>({ name: "", cron_expr: "0 * * * *", provider: "", is_active: true });
  const create = useMutation({
    mutationFn: (payload: CronJobCreate) => api("/api/crons", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => {
      toast.success("Cron job created");
      qc.invalidateQueries({ queryKey: ["crons"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border border-border rounded-lg p-6 w-full max-w-md space-y-4 shadow-lg">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm">Add cron job</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded"><X className="size-4" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1">Name</label>
            <input
              className="w-full px-3 py-1.5 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Daily sync"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1">Cron expression</label>
            <input
              className="w-full px-3 py-1.5 text-sm font-mono border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              value={form.cron_expr}
              onChange={e => setForm(f => ({ ...f, cron_expr: e.target.value }))}
              placeholder="0 * * * *"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1">Provider (optional)</label>
            <input
              className="w-full px-3 py-1.5 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              value={form.provider ?? ""}
              onChange={e => setForm(f => ({ ...f, provider: e.target.value || null }))}
              placeholder="aws / gcp / azure …"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted">Cancel</button>
          <button
            onClick={() => create.mutate({ ...form, provider: form.provider || null })}
            disabled={!form.name || !form.cron_expr || create.isPending}
            className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50"
          >
            {create.isPending ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CronsPage() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const { data } = useQuery({
    queryKey: ["crons"],
    queryFn: () => api<CronJob[]>("/api/crons"),
    refetchInterval: 10_000,
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
      {showAdd && <AddCronDialog onClose={() => setShowAdd(false)} />}
      <div className="flex items-center justify-between">
        <PageHeader title="Scheduled jobs" description="Sync schedules and recurring automation." />
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90"
        >
          <Plus className="size-3.5" /> Add cron
        </button>
      </div>
      <Card className="overflow-hidden">
        <table className="w-full text-left">
          <thead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider bg-surface-muted border-b border-border">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Schedule</th>
              <th className="px-4 py-2 font-medium">Provider</th>
              <th className="px-4 py-2 font-medium">Last run</th>
              <th className="px-4 py-2 font-medium">Next run</th>
              <th className="px-4 py-2 font-medium text-right">State</th>
              <th className="px-4 py-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(data ?? []).map((j) => (
              <tr key={j.id} className="text-sm">
                <td className="px-4 py-2.5 font-medium">{j.name}</td>
                <td className="px-4 py-2.5 font-mono text-xs">{j.cron_expr}</td>
                <td className="px-4 py-2.5">
                  {j.provider
                    ? <span className="text-xs bg-muted px-1.5 py-0.5 rounded border border-border">{j.provider}</span>
                    : <span className="text-xs text-muted-foreground">—</span>}
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">
                  {j.last_run_at ? formatDistanceToNow(new Date(j.last_run_at), { addSuffix: true }) : "—"}
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">
                  {j.next_run_at ? formatDistanceToNow(new Date(j.next_run_at), { addSuffix: true }) : "—"}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <StatusPill status={j.is_active ? "active" : "inactive"} />
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="inline-flex gap-1">
                    <button onClick={() => run.mutate(j.id)} className="p-1.5 hover:bg-muted rounded-md" title="Run now">
                      <Play className="size-3.5" />
                    </button>
                    <button onClick={() => toggle.mutate(j.id)} className="p-1.5 hover:bg-muted rounded-md" title="Toggle">
                      <Power className="size-3.5" />
                    </button>
                    <button
                      onClick={() => del.mutate(j.id)}
                      className="p-1.5 hover:bg-muted rounded-md text-red-600"
                      title="Delete"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {data && data.length === 0 && (
              <tr><td colSpan={7}><EmptyState title="No scheduled jobs" /></td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
