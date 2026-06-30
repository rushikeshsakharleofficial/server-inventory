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
  KeyRound,
  Terminal,
  Users as UsersIcon,
  Settings as SettingsIcon,
  LogOut,
  Search,
} from "lucide-react";
import { useCurrentUser, logout } from "@/lib/auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import type { ReactNode } from "react";

const NAV: Array<{
  group: string;
  items: Array<{ to: string; label: string; icon: typeof Server }>;
}> = [
  {
    group: "Compute",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard },
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
      { to: "/sync", label: "Sync", icon: RefreshCw },
      { to: "/crons", label: "Crons", icon: Clock },
    ],
  },
  {
    group: "Access",
    items: [
      { to: "/credentials", label: "Credentials", icon: KeyRound },
      { to: "/ssh-keys", label: "SSH Keys", icon: Terminal },
      { to: "/users", label: "Users", icon: UsersIcon },
      { to: "/settings", label: "Settings", icon: SettingsIcon },
    ],
  },
];

export function AppShell({ children }: { children: ReactNode }) {
  const user = useCurrentUser();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const qc = useQueryClient();

  const { data: stats } = useQuery({
    queryKey: ["stats"],
    queryFn: () => api<{ total: number }>("/api/servers/stats"),
    staleTime: 30_000,
  });

  // Running sync indicator
  const { data: syncLogs } = useQuery({
    queryKey: ["syncLogs", "head"],
    queryFn: () => api<Array<{ id: number; status: string }>>("/api/sync/logs", { query: { limit: 5 } }),
    refetchInterval: 5_000,
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
      <aside className="w-64 border-r border-border bg-surface flex flex-col shrink-0 sticky top-0 h-screen">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <div className="size-6 bg-primary rounded flex items-center justify-center">
            <span className="size-2 bg-success rounded-full" />
          </div>
          <span className="font-medium text-sm tracking-tight">System Control</span>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {NAV.map((group) => (
            <div key={group.group} className="mb-4">
              <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                {group.group}
              </div>
              {group.items.map((it) => {
                const active = it.to === "/" ? pathname === "/" : pathname.startsWith(it.to);
                const Icon = it.icon;
                const count = it.label === "Servers" ? stats?.total : undefined;
                return (
                  <Link
                    key={it.to}
                    to={it.to}
                    className={[
                      "flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors",
                      active
                        ? "bg-secondary text-foreground font-medium"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    ].join(" ")}
                  >
                    <Icon className="size-4 shrink-0" strokeWidth={1.75} />
                    <span className="flex-1">{it.label}</span>
                    {count !== undefined && (
                      <span className="text-[10px] font-mono text-muted-foreground">{count}</span>
                    )}
                    {it.label === "Sync" && syncing && (
                      <span className="size-1.5 bg-warning rounded-full animate-pulse" />
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-border flex items-center gap-3">
          <div className="size-8 rounded-full bg-secondary ring-1 ring-border flex items-center justify-center text-[10px] font-semibold uppercase">
            {user?.username?.slice(0, 2) ?? "—"}
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-xs font-medium truncate">{user?.username ?? "guest"}</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-tight">
              {user?.role ?? "no role"}
            </span>
          </div>
          <button
            onClick={logout}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
            title="Sign out"
          >
            <LogOut className="size-3.5" />
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border bg-surface flex items-center justify-between px-6 shrink-0 sticky top-0 z-10">
          <div className="flex items-center gap-4 flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search fleet…"
                className="w-full pl-9 pr-4 py-1.5 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            {syncing && (
              <span className="inline-flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="size-3 border-2 border-warning border-t-transparent rounded-full animate-spin" />
                Sync in progress
              </span>
            )}
            <button
              onClick={() => sync.mutate()}
              disabled={sync.isPending}
              className="flex items-center text-sm font-medium py-1.5 px-3 gap-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-60"
            >
              <RefreshCw className="size-3.5" />
              Force Sync
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">{children}</div>
      </main>
    </div>
  );
}
