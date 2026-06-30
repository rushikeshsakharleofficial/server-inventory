import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-surface ring-1 ring-black/5 rounded-lg ${className}`}>
      {children}
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  running: "bg-emerald-50 text-emerald-700",
  online: "bg-emerald-50 text-emerald-700",
  active: "bg-emerald-50 text-emerald-700",
  healthy: "bg-emerald-50 text-emerald-700",
  available: "bg-emerald-50 text-emerald-700",
  ready: "bg-emerald-50 text-emerald-700",
  in_use: "bg-emerald-50 text-emerald-700",
  syncing: "bg-amber-50 text-amber-700",
  pending: "bg-amber-50 text-amber-700",
  starting: "bg-amber-50 text-amber-700",
  rebooting: "bg-amber-50 text-amber-700",
  creating: "bg-amber-50 text-amber-700",
  stopped: "bg-zinc-100 text-zinc-600",
  off: "bg-zinc-100 text-zinc-600",
  inactive: "bg-zinc-100 text-zinc-600",
  unknown: "bg-zinc-100 text-zinc-600",
  failed: "bg-red-50 text-red-700",
  error: "bg-red-50 text-red-700",
};
const DOT_STYLES: Record<string, string> = {
  running: "bg-emerald-500",
  online: "bg-emerald-500",
  active: "bg-emerald-500",
  healthy: "bg-emerald-500",
  available: "bg-emerald-500",
  ready: "bg-emerald-500",
  in_use: "bg-emerald-500",
  syncing: "bg-amber-500",
  pending: "bg-amber-500",
  starting: "bg-amber-500",
  rebooting: "bg-amber-500",
  creating: "bg-amber-500",
  stopped: "bg-zinc-400",
  off: "bg-zinc-400",
  inactive: "bg-zinc-400",
  unknown: "bg-zinc-400",
  failed: "bg-red-500",
  error: "bg-red-500",
};

export function StatusPill({ status }: { status: string }) {
  const key = (status || "unknown").toLowerCase();
  const cls = STATUS_STYLES[key] ?? "bg-zinc-100 text-zinc-600";
  const dot = DOT_STYLES[key] ?? "bg-zinc-400";
  const pulse = ["syncing", "pending", "starting", "creating", "rebooting"].includes(key);
  return (
    <span className={`pill ${cls}`}>
      <span className={`size-1.5 rounded-full ${dot} ${pulse ? "animate-pulse" : ""}`} />
      {status.toUpperCase()}
    </span>
  );
}

const PROVIDER_COLORS: Record<string, string> = {
  aws: "text-orange-600",
  gcp: "text-blue-600",
  azure: "text-sky-600",
  digitalocean: "text-blue-500",
  do: "text-blue-500",
  linode: "text-green-600",
  ovh: "text-indigo-600",
  hivelocity: "text-amber-600",
};

const PROVIDER_LOGOS: Record<string, string> = {
  aws: "/providers/aws.webp",
  gcp: "/providers/gcp.jpg",
  azure: "/providers/azure.png",
  digitalocean: "/providers/digitalocean.png",
  linode: "/providers/linode.png",
  ovh: "/providers/ovh.png",
  hivelocity: "/providers/hivelocity.png",
};

export function ProviderBadge({ provider }: { provider: string }) {
  const p = (provider || "").toLowerCase();
  const logo = PROVIDER_LOGOS[p];
  const short =
    p === "digitalocean" ? "DO" :
    p === "kubernetes" ? "K8S" :
    p.slice(0, 3).toUpperCase();
  const color = PROVIDER_COLORS[p] ?? "text-zinc-600";
  return (
    <div className="flex items-center gap-2">
      {logo ? (
        <img src={logo} alt={provider} className="size-5 object-contain rounded-sm" />
      ) : (
        <div className={`size-5 bg-secondary rounded-sm flex items-center justify-center text-[9px] font-bold ${color}`}>
          {short}
        </div>
      )}
      <span className="text-sm text-muted-foreground">{provider || "—"}</span>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <h3 className="text-sm font-semibold">{title}</h3>
      {description && (
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function KpiTile({
  label,
  value,
  hint,
  tone = "muted",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "muted" | "success" | "warning" | "danger";
}) {
  const toneClass =
    tone === "success" ? "text-emerald-600"
    : tone === "warning" ? "text-amber-600"
    : tone === "danger" ? "text-red-600"
    : "text-muted-foreground";
  return (
    <div className="bg-surface p-4 ring-1 ring-black/5 rounded-lg">
      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">
        {label}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold tracking-tight tabular-nums">{value}</span>
        {hint && <span className={`text-xs font-medium ${toneClass}`}>{hint}</span>}
      </div>
    </div>
  );
}
