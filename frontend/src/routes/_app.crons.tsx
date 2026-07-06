import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type CronJob, type CronJobCreate, type Credential, type Page } from "@/lib/api";
import { Card, PageHeader, StatusPill, EmptyState, CustomSelect, PROVIDER_LOGOS, Modal } from "@/components/ui-bits";
import { Play, Power, Trash2, Plus, X, Pencil, CalendarClock, Terminal as TerminalIcon } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { AdvancedFilter, emptyFilterState, type FilterState } from "@/components/advanced-filter";
import { SmartTable, type SmartTableColumn } from "@/components/SmartTable";

type RepeatMode = "once" | "daily" | "weekly";

// Builds a 5-field cron expression from a picked date/time + repeat mode.
// "once" still needs a real cron trigger (this scheduler has no one-shot
// concept) — pin it to that exact minute/day/month, which only ever fires once.
function buildCronExpr(date: Date, mode: RepeatMode): string {
  const minute = date.getMinutes();
  const hour = date.getHours();
  if (mode === "daily") return `${minute} ${hour} * * *`;
  if (mode === "weekly") return `${minute} ${hour} * * ${date.getDay()}`;
  return `${minute} ${hour} ${date.getDate()} ${date.getMonth() + 1} *`;
}

export const Route = createFileRoute("/_app/crons")({
  head: () => ({ meta: [{ title: "Crons — System Control" }] }),
  component: CronsPage,
});

function CronDialog({ onClose, job }: Readonly<{ onClose: () => void; job?: CronJob }>) {
  const qc = useQueryClient();
  const [form, setForm] = useState<CronJobCreate>(
    job
      ? { name: job.name, cron_expr: job.cron_expr, provider: job.provider ?? null, is_active: job.is_active }
      : { name: "", cron_expr: "0 * * * *", provider: null, is_active: true }
  );
  const [scheduleMode, setScheduleMode] = useState<"cron" | "picker">("cron");
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("daily");
  const [pickedDate, setPickedDate] = useState<Date>(new Date());
  const [pickedTime, setPickedTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  });

  function applyPicker(date: Date, time: string, mode: RepeatMode) {
    const [h, m] = time.split(":").map(Number);
    const merged = new Date(date);
    merged.setHours(h, m, 0, 0);
    setForm((f) => ({ ...f, cron_expr: buildCronExpr(merged, mode) }));
  }

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

  let saveLabel: string;
  if (save.isPending) {
    saveLabel = job ? "Saving…" : "Creating…";
  } else {
    saveLabel = job ? "Save" : "Create";
  }

  return (
    <Modal onClose={onClose} closeOnOutsideClick={false} className="bg-background border border-border rounded-lg p-6 w-full max-w-md space-y-4 shadow-lg">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm">{job ? "Edit cron job" : "Add cron job"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded"><X className="size-4" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label htmlFor="cron-name" className="text-xs text-muted-foreground font-medium block mb-1">Name</label>
            <input
              id="cron-name"
              className={inp}
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Daily AWS sync"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="cron-expr" className="text-xs text-muted-foreground font-medium">Schedule</label>
              <div className="inline-flex rounded-md border border-border overflow-hidden text-xs">
                <button
                  type="button"
                  onClick={() => setScheduleMode("picker")}
                  className={`inline-flex items-center gap-1 px-2 py-1 ${scheduleMode === "picker" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
                >
                  <CalendarClock className="size-3" /> Calendar
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleMode("cron")}
                  className={`inline-flex items-center gap-1 px-2 py-1 border-l border-border ${scheduleMode === "cron" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
                >
                  <TerminalIcon className="size-3" /> Cron
                </button>
              </div>
            </div>

            {scheduleMode === "cron" ? (
              <>
                <input
                  id="cron-expr"
                  className={`${inp} font-mono`}
                  value={form.cron_expr}
                  onChange={e => setForm(f => ({ ...f, cron_expr: e.target.value }))}
                  placeholder="0 * * * *"
                />
                <p className="text-[10px] text-muted-foreground mt-1">minute hour day month weekday</p>
              </>
            ) : (
              <div className="border border-border rounded-md p-3 space-y-3">
                <div className="inline-flex rounded-md border border-border overflow-hidden text-xs w-full">
                  {(["once", "daily", "weekly"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => { setRepeatMode(m); applyPicker(pickedDate, pickedTime, m); }}
                      className={`flex-1 px-2 py-1 capitalize ${repeatMode === m ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"} ${m === "once" ? "" : "border-l border-border"}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <div className="flex justify-center">
                  <DayPicker
                    mode="single"
                    selected={pickedDate}
                    onSelect={(d) => { if (!d) { return; } setPickedDate(d); applyPicker(d, pickedTime, repeatMode); }}
                    className="text-xs"
                  />
                </div>
                <div>
                  <span className="text-xs text-muted-foreground font-medium block mb-1">Time</span>
                  <AnalogClockPicker
                    value={pickedTime}
                    onChange={(v) => { setPickedTime(v); applyPicker(pickedDate, v, repeatMode); }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground font-mono">{form.cron_expr}</p>
              </div>
            )}
          </div>
          <div>
            <span className="text-xs text-muted-foreground font-medium block mb-1">Provider</span>
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
            {saveLabel}
          </button>
        </div>
    </Modal>
  );
}

function CronsPage() {
  const qc = useQueryClient();
  const [editJob, setEditJob] = useState<CronJob | null | "new">(null);
  const [fs, setFs] = useState<FilterState>(emptyFilterState);
  const [page, setPage] = useState(1);

  const { data } = useQuery({
    queryKey: ["crons"],
    queryFn: () => api<CronJob[]>("/api/crons"),
  });

  const { data: creds } = useQuery({
    queryKey: ["creds"],
    queryFn: () => api<Page<Credential>>("/api/credentials", { query: { limit: 100 } }),
  });
  const allProviders = Array.from(
    new Set((creds?.items ?? []).filter((c) => c.is_active).map((c) => c.provider))
  );

  const providerFieldOptions = Array.from(
    new Set((data ?? []).map((j) => j.provider).filter((p): p is string => !!p))
  ).map((p) => ({ value: p, label: p.toUpperCase() }));

  const CRON_FIELDS = [
    { key: "state",    label: "State",    type: "select" as const, options: [{ value: "active", label: "Active" }, { value: "inactive", label: "Disabled" }] },
    { key: "provider", label: "Provider", type: "select" as const, options: providerFieldOptions },
  ];

  const stateFilter = (fs.filters.state    as string) ?? "";
  const provFilter  = (fs.filters.provider as string) ?? "";

  const items = (data ?? []).filter((j) => {
    if (fs.q && !j.name.toLowerCase().includes(fs.q.toLowerCase())) return false;
    if (stateFilter === "active"   && !j.is_active) return false;
    if (stateFilter === "inactive" &&  j.is_active) return false;
    if (provFilter && (j.provider ?? "") !== provFilter) return false;
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
        <AdvancedFilter
          fields={CRON_FIELDS}
          state={fs}
          onChange={s => { setFs(s); setPage(1); }}
          searchPlaceholder="Search job name…"
          searchSuggestions={(data ?? []).map((j) => j.name)}
        />
      </Card>

      <SmartTable
        columns={cronColumns(run, setEditJob, toggle, del, allProviders)}
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

// Analogue clock face for picking a time — native <input type="time"> can't
// be restyled into a clock (the browser owns that widget entirely), so this
// draws one from scratch: drag/click either hand around an SVG dial.
function AnalogClockPicker({ value, onChange }: Readonly<{ value: string; onChange: (v: string) => void }>) {
  const [h24, m] = value.split(":").map(Number);
  const isPM = h24 >= 12;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const [dragging, setDragging] = useState<"hour" | "minute" | null>(null);

  const R = 80, CX = 90, CY = 90;

  function angleFromEvent(e: { clientX: number; clientY: number }, svg: SVGSVGElement) {
    const rect = svg.getBoundingClientRect();
    const x = e.clientX - rect.left - CX;
    const y = e.clientY - rect.top - CY;
    let deg = (Math.atan2(y, x) * 180) / Math.PI + 90;
    if (deg < 0) deg += 360;
    return deg;
  }

  function setFromAngle(deg: number, hand: "hour" | "minute") {
    if (hand === "minute") {
      const minute = Math.round(deg / 6) % 60;
      onChange(`${String(h24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
    } else {
      const hour12 = Math.round(deg / 30) % 12 || 12;
      const nextH24 = isPM ? (hour12 % 12) + 12 : hour12 % 12;
      onChange(`${String(nextH24).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }

  function handlePointer(e: React.PointerEvent<SVGSVGElement>) {
    if (!dragging) return;
    setFromAngle(angleFromEvent(e, e.currentTarget), dragging);
  }

  const hourAngle = (h12 % 12) * 30 + m * 0.5;
  const minuteAngle = m * 6;

  function hand(angle: number, length: number, width: number, testId: "hour" | "minute") {
    const rad = ((angle - 90) * Math.PI) / 180;
    const x2 = CX + length * Math.cos(rad);
    const y2 = CY + length * Math.sin(rad);
    return (
      <line
        x1={CX} y1={CY} x2={x2} y2={y2}
        stroke="var(--color-primary)" strokeWidth={width} strokeLinecap="round"
        onPointerDown={() => setDragging(testId)}
        style={{ cursor: "grab" }}
      />
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <svg
        width={180} height={180} viewBox="0 0 180 180"
        onPointerMove={handlePointer}
        onPointerUp={() => setDragging(null)}
        onPointerLeave={() => setDragging(null)}
        className="select-none"
      >
        <circle cx={CX} cy={CY} r={R} fill="var(--color-background)" stroke="var(--color-border)" strokeWidth={1.5} />
        {Array.from({ length: 12 }, (_, i) => {
          const angle = ((i * 30 - 90) * Math.PI) / 180;
          const x = CX + (R - 12) * Math.cos(angle);
          const y = CY + (R - 12) * Math.sin(angle);
          return (
            <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={10} fill="var(--color-muted-foreground)">
              {i === 0 ? 12 : i}
            </text>
          );
        })}
        {hand(hourAngle, 40, 4, "hour")}
        {hand(minuteAngle, 62, 2.5, "minute")}
        <circle cx={CX} cy={CY} r={3} fill="var(--color-primary)" />
      </svg>
      <div className="flex items-center gap-2 text-xs font-mono">
        <span>{String(h12).padStart(2, "0")}:{String(m).padStart(2, "0")}</span>
        <div className="inline-flex rounded-md border border-border overflow-hidden">
          {(["AM", "PM"] as const).map((suffix) => (
            <button
              key={suffix}
              type="button"
              onClick={() => {
                const wantPM = suffix === "PM";
                const nextH24 = wantPM ? (h12 % 12) + 12 : h12 % 12;
                onChange(`${String(nextH24).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
              }}
              className={`px-2 py-0.5 ${(suffix === "PM") === isPM ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
            >
              {suffix}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const LOGO_GRID_MAX = 4;

function ProviderLogoGrid({ providers }: Readonly<{ providers: string[] }>) {
  const [open, setOpen] = useState(false);
  // Only show providers with a real recognizable logo — custom/generic
  // credential names (e.g. a reseller account) have no logo asset and would
  // otherwise render as broken images or pad the overflow count with
  // entries nobody can visually identify.
  const known = providers.filter((p) => PROVIDER_LOGOS[p]);
  if (!known.length) return <span className="text-xs text-muted-foreground">—</span>;
  const shown = known.slice(0, LOGO_GRID_MAX);
  const hidden = known.length - shown.length;
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setOpen(false)}
        className="inline-flex items-center gap-1"
      >
        <div className="grid grid-cols-2 gap-0.5">
          {shown.map((p) => (
            <img
              key={p}
              src={PROVIDER_LOGOS[p]}
              alt={p}
              title={p}
              className="size-3.5 object-contain rounded-sm"
            />
          ))}
        </div>
        {hidden > 0 && (
          <span className="text-[10px] text-muted-foreground font-medium">{hidden}+ more</span>
        )}
      </button>
      {open && (
        <div className="absolute z-30 top-full left-0 mt-1 bg-surface border border-border rounded-md shadow-lg p-2 flex flex-wrap gap-2 w-max max-w-[200px]">
          {known.map((p) => (
            <div key={p} className="flex items-center gap-1.5 text-xs">
              <img src={PROVIDER_LOGOS[p]} alt={p} className="size-4 object-contain rounded-sm" />
              <span className="capitalize">{p}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function cronColumns(
  run: ReturnType<typeof useMutation<unknown, Error, number>>,
  setEditJob: (j: CronJob) => void,
  toggle: ReturnType<typeof useMutation<unknown, Error, number>>,
  del: ReturnType<typeof useMutation<unknown, Error, number>>,
  allProviders: string[]
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
          : <ProviderLogoGrid providers={allProviders} />,
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
