import { t as api } from "./_ssr/api-DNcet4h7.mjs";
import { n as useQuery, o as require_jsx_runtime } from "./_libs/react+tanstack__react-query.mjs";
import { a as ProviderBadge, i as PageHeader, o as StatusPill, t as Card } from "./_ssr/ui-bits-BFnzf41o.mjs";
import { t as formatDistanceToNow } from "./_libs/date-fns.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/_app.sync-CUgxDVJ0.js
var import_jsx_runtime = require_jsx_runtime();
function SyncPage() {
	const { data } = useQuery({
		queryKey: ["syncLogs", "all"],
		queryFn: () => api("/api/sync/logs", { query: { limit: 100 } }),
		refetchInterval: 3e3
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "p-6 space-y-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			title: "Sync activity",
			description: "Live log of resource discovery runs across providers."
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
			className: "overflow-hidden",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
				className: "w-full text-left",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
					className: "text-[11px] font-semibold text-muted-foreground uppercase tracking-wider bg-surface-muted border-b border-border",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-4 py-2 font-medium",
							children: "Provider"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-4 py-2 font-medium",
							children: "Status"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-4 py-2 font-medium",
							children: "Added"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-4 py-2 font-medium",
							children: "Updated"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-4 py-2 font-medium",
							children: "Started"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-4 py-2 font-medium",
							children: "Duration"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-4 py-2 font-medium",
							children: "Error"
						})
					] })
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tbody", {
					className: "divide-y divide-border",
					children: [(data ?? []).map((l) => {
						const dur = l.started_at && l.completed_at ? `${Math.round((new Date(l.completed_at).getTime() - new Date(l.started_at).getTime()) / 1e3)}s` : l.status === "running" ? "…" : "—";
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: "text-sm",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-4 py-2.5",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProviderBadge, { provider: l.provider ?? "all" })
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-4 py-2.5",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusPill, { status: l.status })
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-4 py-2.5 font-mono text-xs",
									children: l.servers_added
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-4 py-2.5 font-mono text-xs",
									children: l.servers_updated
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-4 py-2.5 text-xs text-muted-foreground",
									children: l.started_at ? formatDistanceToNow(new Date(l.started_at), { addSuffix: true }) : "—"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-4 py-2.5 font-mono text-xs",
									children: dur
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-4 py-2.5 text-xs text-red-600 max-w-xs truncate",
									children: l.error_message ?? ""
								})
							]
						}, l.id);
					}), data && data.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						colSpan: 7,
						className: "px-4 py-8 text-center text-xs text-muted-foreground",
						children: "No sync runs yet."
					}) })]
				})]
			})
		})]
	});
}
//#endregion
export { SyncPage as component };
