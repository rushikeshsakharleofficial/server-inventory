import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Server,
  Database,
  Boxes,
  HardDrive,
  Network,
  RefreshCw,
  Clock,
  Cloud,
  Terminal,
  Users as UsersIcon,
  Settings as SettingsIcon,
  LogOut,
  Search,
  UsersRound,
  ShieldCheck,
  TrendingUp,
  Wifi,
  ScrollText,
  KeyRound,
} from "lucide-react";
import { useCurrentUser, logout } from "@/lib/auth";
import { ConfirmDialogHost } from "@/components/ui-bits";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppWebSocket, onWsConnectChange } from "@/lib/ws";
import { toast } from "sonner";
import { useState, useEffect, type ReactNode } from "react";

const NAV: Array<{
  group: string;
  items: Array<{ to: string; label: string; icon: typeof Server }>;
}> = [
  {
    group: "Compute",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard },
      { to: "/stats", label: "Stats", icon: TrendingUp },
      { to: "/servers", label: "Servers", icon: Server },
      { to: "/kubernetes", label: "Kubernetes", icon: Boxes },
      { to: "/databases", label: "Databases", icon: Database },
      { to: "/block-storages", label: "Block Storage", icon: HardDrive },
    ],
  },
  {
    group: "Infrastructure",
    items: [
      { to: "/resource-map", label: "Resource Map", icon: Network },
      { to: "/ips", label: "IP Inventory", icon: Wifi },
      { to: "/sync", label: "Sync", icon: RefreshCw },
      { to: "/crons", label: "Crons", icon: Clock },
      { to: "/event-logs", label: "Event Logs", icon: ScrollText },
    ],
  },
  {
    group: "Access",
    items: [
      { to: "/provider-credentials", label: "Provider Credentials", icon: KeyRound },
      { to: "/cloud-providers", label: "Cloud Providers", icon: Cloud },
      { to: "/ssh-keys", label: "SSH Keys", icon: Terminal },
      { to: "/users-groups", label: "Users & Groups", icon: UsersRound },
      { to: "/policies",     label: "IAM Policies",   icon: ShieldCheck },
      { to: "/settings", label: "Settings", icon: SettingsIcon },
    ],
  },
];

export function AppShell({ children }: { children: ReactNode }) {
  const user = useCurrentUser();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const qc = useQueryClient();
  const [wsLive, setWsLive] = useState(false);
  useEffect(() => { onWsConnectChange(setWsLive); }, []);
  useAppWebSocket();

  const { data: stats } = useQuery({
    queryKey: ["stats"],
    queryFn: () => api<{ total: number }>("/api/servers/stats"),
    staleTime: 30_000,
  });

  // Running sync indicator — refreshed by WS invalidation, no polling needed
  const { data: syncLogs } = useQuery({
    queryKey: ["syncLogs", "head"],
    queryFn: () => api<Array<{ id: number; status: string }>>("/api/sync/logs", { query: { limit: 5 } }),
  });
  const syncing = syncLogs?.some((l) => l.status === "running") ?? false;

  const sync = useMutation({
    mutationFn: () => api("/api/sync", { method: "POST" }),
    onSuccess: () => {
      toast.success("Sync started");
      qc.invalidateQueries({ queryKey: ["syncLogs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-surface flex flex-col shrink-0 sticky top-0 h-screen shadow-[1px_0_0_0_var(--color-border)]">
        <div className="px-4 py-4 border-b border-border flex items-center gap-2.5">
          <div className="size-7 bg-primary rounded-lg flex items-center justify-center shadow-sm logo-pop">
            <span className={`size-2 bg-success rounded-full ${!wsLive ? "animate-pulse" : ""}`} />
          </div>
          <span className="font-semibold text-sm tracking-tight">System Control</span>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0">
          {NAV.map((group) => (
            <div key={group.group} className="mb-5">
              <div className="px-2 pb-1.5 text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-widest">
                {group.group}
              </div>
              <div className="space-y-0.5">
                {group.items.map((it) => {
                  const active = it.to === "/" ? pathname === "/" : pathname.startsWith(it.to);
                  const Icon = it.icon;
                  const count = it.label === "Servers" ? stats?.total : undefined;
                  return (
                    <Link
                      key={it.to}
                      to={it.to}
                      className={[
                        "flex items-center gap-2.5 px-2.5 py-2 text-sm rounded-lg transition-all duration-150",
                        active
                          ? "bg-primary text-primary-foreground font-medium shadow-sm"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      ].join(" ")}
                    >
                      <Icon className="size-4 shrink-0" strokeWidth={active ? 2 : 1.75} />
                      <span className="flex-1 truncate">{it.label}</span>
                      {count !== undefined && (
                        <span className={`text-[10px] font-mono tabular-nums ${active ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{count}</span>
                      )}
                      {it.label === "Sync" && syncing && (
                        <span className="size-1.5 bg-warning rounded-full animate-pulse" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="px-3 py-3 border-t border-border">
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-muted transition-colors">
            <div className="size-8 rounded-full bg-secondary ring-1 ring-border flex items-center justify-center text-[11px] font-bold uppercase shrink-0">
              {(user?.full_name ?? user?.username)?.slice(0, 2) ?? "—"}
            </div>
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-xs font-medium truncate">{user?.full_name ?? user?.username ?? "guest"}</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                {user?.role ?? "no role"}
              </span>
            </div>
            <button
              onClick={logout}
              className="p-1.5 rounded-md hover:bg-border text-muted-foreground hover:text-foreground transition-colors"
              title="Sign out"
            >
              <LogOut className="size-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border bg-surface/80 backdrop-blur-sm flex items-center justify-between px-6 shrink-0 sticky top-0 z-10">
          <div className="flex items-center gap-4 flex-1 max-w-sm">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search fleet…"
                className="w-full pl-9 pr-4 py-1.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-ring transition-shadow"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`size-2 rounded-full transition-colors duration-500 ${wsLive ? "bg-green-500" : "bg-amber-400 animate-pulse"}`}
              title={wsLive ? "Live" : "Reconnecting…"}
            />
            {syncing && (
              <span className="inline-flex items-center gap-2 text-[11px] text-muted-foreground bg-warning/10 px-2.5 py-1 rounded-full">
                <span className="size-3 border-2 border-warning border-t-transparent rounded-full animate-spin" />
                Syncing…
              </span>
            )}
            <button
              onClick={() => sync.mutate()}
              disabled={sync.isPending}
              className="flex items-center text-sm font-medium py-1.5 px-3 gap-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm btn-press"
            >
              <RefreshCw className={`size-3.5 ${sync.isPending ? "animate-spin" : ""}`} />
              Force Sync
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">{children}</div>
      </main>
      <ConfirmDialogHost />
    </div>
  );
}
