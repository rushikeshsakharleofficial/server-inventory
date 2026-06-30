import { t as api } from "./_ssr/api-DNcet4h7.mjs";
import { i as useQueryClient, n as useQuery, o as require_jsx_runtime, t as useMutation } from "./_libs/react+tanstack__react-query.mjs";
import { n as toast } from "./_libs/sonner.mjs";
import { l as RefreshCw } from "./_libs/lucide-react.mjs";
import { a as ProviderBadge, i as PageHeader, n as EmptyState, o as StatusPill, t as Card } from "./_ssr/ui-bits-BFnzf41o.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/_app.databases-eWMqJoNM.js
var import_jsx_runtime = require_jsx_runtime();
function DatabasesPage() {
	const qc = useQueryClient();
	const { data } = useQuery({
		queryKey: ["dbs"],
		queryFn: () => api("/api/databases", { query: { limit: 200 } })
	});
	const sync = useMutation({
		mutationFn: () => api("/api/databases/sync", { method: "POST" }),
		onSuccess: () => {
			toast.success("Database sync started");
			qc.invalidateQueries({ queryKey: ["dbs"] });
		},
		onError: (e) => toast.error(e.message)
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "p-6 space-y-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			title: "Databases",
			description: `${data?.total ?? 0} managed database instances`,
			actions: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				onClick: () => sync.mutate(),
				disabled: sync.isPending,
				className: "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md disabled:opacity-60",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: "size-3.5" }), " Sync databases"]
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
			className: "overflow-hidden",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
				className: "w-full text-left",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
					className: "text-[11px] font-semibold text-muted-foreground uppercase tracking-wider bg-surface-muted border-b border-border",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-4 py-2 font-medium",
							children: "Name"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-4 py-2 font-medium",
							children: "Engine"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-4 py-2 font-medium",
							children: "Provider / Region"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-4 py-2 font-medium",
							children: "Endpoint"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-4 py-2 font-medium text-right",
							children: "Status"
						})
					] })
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tbody", {
					className: "divide-y divide-border",
					children: [(data?.items ?? []).map((d) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
						className: "text-sm",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-4 py-2.5 font-medium",
								children: d.name
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-4 py-2.5",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-xs bg-muted px-1.5 py-0.5 rounded border border-border",
									children: d.engine ?? "—"
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-4 py-2.5",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProviderBadge, { provider: d.provider }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-xs text-muted-foreground",
										children: d.region ?? "—"
									})]
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
								className: "px-4 py-2.5 font-mono text-xs text-muted-foreground truncate max-w-xs",
								children: [d.endpoint ?? "—", d.port ? `:${d.port}` : ""]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-4 py-2.5 text-right",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusPill, { status: d.status })
							})
						]
					}, d.id)), data && data.items.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						colSpan: 5,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, {
							title: "No databases discovered",
							description: "Run a sync to populate."
						})
					}) })]
				})]
			})
		})]
	});
}
//#endregion
export { DatabasesPage as component };
