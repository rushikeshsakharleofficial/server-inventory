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
  Layers,
  Globe,
  ChevronDown,
} from "lucide-react";
import { useCurrentUser, logout } from "@/lib/auth";
import { ConfirmDialogHost } from "@/components/ui-bits";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useBrandingLogo } from "@/lib/branding";
import { useAppWebSocket, onWsConnectChange } from "@/lib/ws";
import { toast } from "sonner";
import { useState, useEffect, type ReactNode } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

const SIDEBAR_EXPANDED = 264;
const SIDEBAR_COLLAPSED = 72;

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
      { to: "/server-groups", label: "Server Groups", icon: Layers },
      { to: "/ips", label: "IP Inventory", icon: Wifi },
      { to: "/discovery", label: "On-Prem Discovery", icon: Network },
      { to: "/sync", label: "Sync", icon: RefreshCw },
      { to: "/crons", label: "Crons", icon: Clock },
      { to: "/event-logs", label: "Event Logs", icon: ScrollText },
    ],
  },
  {
    group: "Domains",
    items: [
      { to: "/domains", label: "Domain Inventory", icon: Globe },
      { to: "/domain-credentials", label: "DNS Providers", icon: KeyRound },
    ],
  },
  {
    group: "Access",
    items: [
      {
        to: "/provider-credentials",
        label: "Provider Credentials",
        icon: KeyRound,
      },
      { to: "/cloud-providers", label: "Cloud Providers", icon: Cloud },
      { to: "/ssh-keys", label: "SSH Keys", icon: Terminal },
      { to: "/users-groups", label: "Users & Groups", icon: UsersRound },
      { to: "/policies", label: "IAM Policies", icon: ShieldCheck },
      { to: "/settings", label: "Settings", icon: SettingsIcon },
    ],
  },
];

export function AppShell({ children }: { children: ReactNode }) {
  const user = useCurrentUser();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const qc = useQueryClient();
  const logoUrl = useBrandingLogo();
  const [wsLive, setWsLive] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    new Set(NAV.map((g) => g.group)),
  );
  const toggleGroup = (group: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };
  useEffect(() => {
    onWsConnectChange(setWsLive);
  }, []);
  useAppWebSocket();

  const sidebarWidth = collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED;

  const { data: stats } = useQuery({
    queryKey: ["stats"],
    queryFn: () => api<{ total: number }>("/api/servers/stats"),
    staleTime: 30_000,
  });

  // Running sync indicator — refreshed by WS invalidation, no polling needed
  const { data: syncLogs } = useQuery({
    queryKey: ["syncLogs", "head"],
    queryFn: () =>
      api<Array<{ id: number; status: string }>>("/api/sync/logs", {
        query: { limit: 5 },
      }),
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
    <div className="min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside
        style={{ width: sidebarWidth }}
        className="fixed left-0 top-0 h-screen border-r border-border bg-surface flex flex-col shrink-0 shadow-[1px_0_0_0_var(--color-border)] transition-[width] duration-300 ease-in-out z-20 overflow-hidden"
      >
        <div
          className={`h-16 border-b border-border flex items-center shrink-0 transition-all duration-300 ${collapsed ? "justify-center px-0" : "gap-2.5 px-4"}`}
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Logo"
              className="size-7 rounded-lg object-contain shadow-sm logo-pop shrink-0"
            />
          ) : (
            <div className="size-7 bg-primary rounded-lg flex items-center justify-center shadow-sm logo-pop shrink-0">
              <span
                className={`size-2 bg-success rounded-full ${!wsLive ? "animate-pulse" : ""}`}
              />
            </div>
          )}
          {!collapsed && (
            <span className="font-semibold text-sm tracking-tight whitespace-nowrap">
              System Control
            </span>
          )}
        </div>

        <nav
          className={`flex-1 overflow-y-auto overflow-x-hidden sidebar-scroll py-3 space-y-0 transition-all duration-300 ${collapsed ? "px-2" : "px-3"}`}
        >
          {NAV.map((group) => {
            const isOpen = openGroups.has(group.group);
            return (
            <div key={group.group} className="mb-3">
              <button
                type="button"
                onClick={() => toggleGroup(group.group)}
                className={`w-full flex items-center justify-between px-2 pb-1.5 text-xs font-bold text-foreground/80 uppercase tracking-wide whitespace-nowrap transition-all duration-300 ${collapsed ? "opacity-0 -translate-x-2 h-0 overflow-hidden pointer-events-none" : "opacity-100 translate-x-0"}`}
              >
                <span>{group.group}</span>
                <ChevronDown
                  className={`size-3 shrink-0 transition-transform duration-300 ${isOpen ? "" : "-rotate-180"}`}
                />
              </button>
              <div
                className={`space-y-0.5 overflow-hidden transition-all duration-300 ${!collapsed && !isOpen ? "max-h-0 opacity-0" : "max-h-[1000px] opacity-100"}`}
              >
                {group.items.map((it) => {
                  const active =
                    it.to === "/"
                      ? pathname === "/"
                      : pathname.startsWith(it.to);
                  const Icon = it.icon;
                  const count =
                    it.label === "Servers" ? stats?.total : undefined;
                  return (
                    <Link
                      key={it.to}
                      to={it.to}
                      title={collapsed ? it.label : undefined}
                      className={[
                        "flex items-center w-full py-1.5 text-sm rounded-lg transition-all duration-150",
                        collapsed ? "justify-center px-0" : "gap-2.5 px-2.5",
                        active
                          ? "bg-primary text-primary-foreground font-medium shadow-sm"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      ].join(" ")}
                    >
                      <Icon
                        className="size-4 shrink-0"
                        strokeWidth={active ? 2 : 1.75}
                      />
                      {!collapsed && (
                        <span className="flex-1 truncate whitespace-nowrap">
                          {it.label}
                        </span>
                      )}
                      {!collapsed && count !== undefined && (
                        <span
                          className={`text-[10px] font-mono tabular-nums ${active ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                        >
                          {count}
                        </span>
                      )}
                      {!collapsed && it.label === "Sync" && syncing && (
                        <span className="size-1.5 bg-warning rounded-full animate-pulse" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
            );
          })}
        </nav>

        <div className="px-3 py-3 border-t border-border shrink-0">
          <div
            className={`flex items-center gap-3 rounded-lg hover:bg-muted transition-colors ${collapsed ? "justify-center px-0 py-2" : "px-2 py-2"}`}
            title={
              collapsed
                ? (user?.full_name ?? user?.username ?? "guest")
                : undefined
            }
          >
            <div className="size-8 rounded-full bg-secondary ring-1 ring-border flex items-center justify-center text-[11px] font-bold uppercase shrink-0">
              {(user?.full_name ?? user?.username)?.slice(0, 2) ?? "—"}
            </div>
            {!collapsed && (
              <>
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-xs font-medium truncate">
                    {user?.full_name ?? user?.username ?? "guest"}
                  </span>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    {user?.role ?? "no role"}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Main */}
      <div
        style={{ marginLeft: sidebarWidth }}
        className="flex flex-col min-h-screen transition-[margin-left] duration-300 ease-in-out"
      >
        <header className="h-16 border-b border-border bg-surface/80 backdrop-blur-sm flex items-center justify-between px-6 shrink-0 sticky top-0 z-10">
          <div className="flex items-center gap-4 flex-1 max-w-sm">
            <button
              onClick={() => setCollapsed((c) => !c)}
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <PanelLeftOpen className="size-4" />
              ) : (
                <PanelLeftClose className="size-4" />
              )}
            </button>
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
              className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-full transition-colors duration-500 ${wsLive ? "text-green-700 bg-green-50" : "text-amber-700 bg-amber-50"}`}
            >
              <span className={`size-1.5 rounded-full ${wsLive ? "bg-green-500" : "bg-amber-400 animate-pulse"}`} />
              {wsLive ? "Online" : "Reconnecting…"}
            </span>
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
              <RefreshCw
                className={`size-3.5 ${sync.isPending ? "animate-spin" : ""}`}
              />
              Force Sync
            </button>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Sign out"
            >
              <LogOut className="size-3.5" /> Logout
            </button>
          </div>
        </header>

        <div className="flex-1">{children}</div>
      </div>
      <ConfirmDialogHost />
    </div>
  );
}
