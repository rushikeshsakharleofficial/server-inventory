import { r as __toESM } from "./_runtime.mjs";
import { n as tokenStore, r as userStore, t as api } from "./_ssr/api-DNcet4h7.mjs";
import { a as require_react, i as useQueryClient, n as useQuery, o as require_jsx_runtime, t as useMutation } from "./_libs/react+tanstack__react-query.mjs";
import { f as Outlet, g as Link, l as useRouterState } from "./_libs/@tanstack/react-router+[...].mjs";
import { n as toast } from "./_libs/sonner.mjs";
import { t as Toaster$1 } from "./_ssr/sonner-DoFKumIW.mjs";
import { _ as HardDrive, b as Boxes, c as Search, g as KeyRound, h as LayoutDashboard, i as Terminal, l as RefreshCw, m as LogOut, n as Users, o as Settings, p as Network, s as Server, v as Database, y as Clock } from "./_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/_app-CHGQ5Cp_.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function useCurrentUser() {
	const [user, setUser] = (0, import_react.useState)(() => userStore.get());
	(0, import_react.useEffect)(() => {
		const onStorage = () => setUser(userStore.get());
		window.addEventListener("storage", onStorage);
		return () => window.removeEventListener("storage", onStorage);
	}, []);
	return user;
}
function logout() {
	tokenStore.clear();
	window.location.assign("/login");
}
var NAV = [
	{
		group: "Compute",
		items: [
			{
				to: "/",
				label: "Dashboard",
				icon: LayoutDashboard
			},
			{
				to: "/servers",
				label: "Servers",
				icon: Server
			},
			{
				to: "/kubernetes",
				label: "Kubernetes",
				icon: Boxes
			},
			{
				to: "/databases",
				label: "Databases",
				icon: Database
			},
			{
				to: "/block-storages",
				label: "Block Storage",
				icon: HardDrive
			}
		]
	},
	{
		group: "Infrastructure",
		items: [
			{
				to: "/resource-map",
				label: "Resource Map",
				icon: Network
			},
			{
				to: "/sync",
				label: "Sync",
				icon: RefreshCw
			},
			{
				to: "/crons",
				label: "Crons",
				icon: Clock
			}
		]
	},
	{
		group: "Access",
		items: [
			{
				to: "/credentials",
				label: "Credentials",
				icon: KeyRound
			},
			{
				to: "/ssh-keys",
				label: "SSH Keys",
				icon: Terminal
			},
			{
				to: "/users",
				label: "Users",
				icon: Users
			},
			{
				to: "/settings",
				label: "Settings",
				icon: Settings
			}
		]
	}
];
function AppShell({ children }) {
	const user = useCurrentUser();
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const qc = useQueryClient();
	const { data: stats } = useQuery({
		queryKey: ["stats"],
		queryFn: () => api("/api/servers/stats"),
		staleTime: 3e4
	});
	const { data: syncLogs } = useQuery({
		queryKey: ["syncLogs", "head"],
		queryFn: () => api("/api/sync/logs", { query: { limit: 5 } }),
		refetchInterval: 5e3
	});
	const syncing = syncLogs?.some((l) => l.status === "running") ?? false;
	const sync = useMutation({
		mutationFn: () => api("/api/sync", { method: "POST" }),
		onSuccess: () => {
			toast.success("Sync started");
			qc.invalidateQueries({ queryKey: ["syncLogs"] });
		},
		onError: (e) => toast.error(e.message)
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-screen flex bg-background text-foreground",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
			className: "w-64 border-r border-border bg-surface flex flex-col shrink-0 sticky top-0 h-screen",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "p-4 border-b border-border flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "size-6 bg-primary rounded flex items-center justify-center",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-2 bg-success rounded-full" })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-medium text-sm tracking-tight",
						children: "System Control"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
					className: "flex-1 overflow-y-auto p-3 space-y-0.5",
					children: NAV.map((group) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mb-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider",
							children: group.group
						}), group.items.map((it) => {
							const active = it.to === "/" ? pathname === "/" : pathname.startsWith(it.to);
							const Icon = it.icon;
							const count = it.label === "Servers" ? stats?.total : void 0;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
								to: it.to,
								className: ["flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors", active ? "bg-secondary text-foreground font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground"].join(" "),
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
										className: "size-4 shrink-0",
										strokeWidth: 1.75
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "flex-1",
										children: it.label
									}),
									count !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[10px] font-mono text-muted-foreground",
										children: count
									}),
									it.label === "Sync" && syncing && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-1.5 bg-warning rounded-full animate-pulse" })
								]
							}, it.to);
						})]
					}, group.group))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "p-4 border-t border-border flex items-center gap-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "size-8 rounded-full bg-secondary ring-1 ring-border flex items-center justify-center text-[10px] font-semibold uppercase",
							children: user?.username?.slice(0, 2) ?? "—"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-col flex-1 min-w-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-xs font-medium truncate",
								children: user?.username ?? "guest"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[10px] text-muted-foreground uppercase tracking-tight",
								children: user?.role ?? "no role"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: logout,
							className: "p-1.5 rounded-md hover:bg-muted text-muted-foreground",
							title: "Sign out",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LogOut, { className: "size-3.5" })
						})
					]
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
			className: "flex-1 flex flex-col min-w-0",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "h-14 border-b border-border bg-surface flex items-center justify-between px-6 shrink-0 sticky top-0 z-10",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex items-center gap-4 flex-1 max-w-md",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "relative w-full",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "text",
							placeholder: "Search fleet…",
							className: "w-full pl-9 pr-4 py-1.5 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
						})]
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-3",
					children: [syncing && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "inline-flex items-center gap-2 text-[11px] text-muted-foreground",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-3 border-2 border-warning border-t-transparent rounded-full animate-spin" }), "Sync in progress"]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						onClick: () => sync.mutate(),
						disabled: sync.isPending,
						className: "flex items-center text-sm font-medium py-1.5 px-3 gap-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-60",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: "size-3.5" }), "Force Sync"]
					})]
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex-1 overflow-y-auto",
				children
			})]
		})]
	});
}
function AppLayout() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toaster$1, {
		position: "top-right",
		richColors: true
	})] });
}
//#endregion
export { AppLayout as component };
