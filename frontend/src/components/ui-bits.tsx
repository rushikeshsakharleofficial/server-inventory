import { type ReactNode, type CSSProperties, useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "— select —",
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label?: string }[];
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [dropStyle, setDropStyle] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });
  const selected = options.find(o => o.value === value);

  useEffect(() => {
    function close(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function handleOpen() {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setDropStyle({ top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX, width: r.width });
    }
    setOpen(o => !o);
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        className="w-full flex items-center justify-between px-3 py-2 text-sm bg-background border border-border rounded-md hover:border-muted-foreground/50 transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <span className={selected ? "text-foreground" : "text-muted-foreground"}>
          {selected?.label ?? selected?.value ?? placeholder}
        </span>
        <ChevronDown className={`size-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div
          style={{ position: "fixed", top: dropStyle.top, left: dropStyle.left, width: dropStyle.width, zIndex: 9999 }}
          className="bg-background border border-border rounded-md shadow-lg"
        >
          {!value && <div className="px-3 py-2 text-sm text-muted-foreground">{placeholder}</div>}
          {options.map(o => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted transition-colors text-left ${value === o.value ? "text-primary font-medium" : "text-foreground"}`}
            >
              {o.label ?? o.value}
              {value === o.value && <Check className="size-3.5 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

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
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={`bg-surface ring-1 ring-black/5 rounded-lg ${className}`} style={style}>
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
  aws: "/providers/aws.png",
  gcp: "/providers/gcp.png",
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
