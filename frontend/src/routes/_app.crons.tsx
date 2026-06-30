import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type CronJob } from "@/lib/api";
import { Card, PageHeader, StatusPill, EmptyState } from "@/components/ui-bits";
import { Play, Power, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_app/crons")({
  head: () => ({ meta: [{ title: "Crons — System Control" }] }),
  component: CronsPage,
});

function CronsPage() {
  const qc = useQueryClient();
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
      <PageHeader title="Scheduled jobs" description="Sync schedules and recurring automation." />
      <Card className="overflow-hidden">
        <table className="w-full text-left">
          <thead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider bg-surface-muted border-b border-border">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Schedule</th>
              <th className="px-4 py-2 font-medium">Type</th>
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
                <td className="px-4 py-2.5 font-mono text-xs">{j.schedule}</td>
                <td className="px-4 py-2.5">
                  <span className="text-xs bg-muted px-1.5 py-0.5 rounded border border-border">{j.job_type}</span>
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">
                  {j.last_run ? formatDistanceToNow(new Date(j.last_run), { addSuffix: true }) : "—"}
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">
                  {j.next_run ? formatDistanceToNow(new Date(j.next_run), { addSuffix: true }) : "—"}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <StatusPill status={j.enabled ? "active" : "inactive"} />
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
                      onClick={() => confirm(`Delete ${j.name}?`) && del.mutate(j.id)}
                      className="p-1.5 hover:bg-muted rounded-md text-red-600"
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
