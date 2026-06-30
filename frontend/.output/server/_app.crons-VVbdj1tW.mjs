import { t as api } from "./_ssr/api-DNcet4h7.mjs";
import { i as useQueryClient, n as useQuery, o as require_jsx_runtime, t as useMutation } from "./_libs/react+tanstack__react-query.mjs";
import { n as toast } from "./_libs/sonner.mjs";
import { f as Play, r as Trash2, u as Power } from "./_libs/lucide-react.mjs";
import { i as PageHeader, n as EmptyState, o as StatusPill, t as Card } from "./_ssr/ui-bits-BFnzf41o.mjs";
import { t as formatDistanceToNow } from "./_libs/date-fns.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/_app.crons-VVbdj1tW.js
var import_jsx_runtime = require_jsx_runtime();
function CronsPage() {
	const qc = useQueryClient();
	const { data } = useQuery({
		queryKey: ["crons"],
		queryFn: () => api("/api/crons"),
		refetchInterval: 1e4
	});
	const toggle = useMutation({
		mutationFn: (id) => api(`/api/crons/${id}/toggle`, { method: "PATCH" }),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["crons"] })
	});
	const run = useMutation({
		mutationFn: (id) => api(`/api/crons/${id}/run-now`, { method: "POST" }),
		onSuccess: () => {
			toast.success("Job triggered");
			qc.invalidateQueries({ queryKey: ["crons"] });
		},
		onError: (e) => toast.error(e.message)
	});
	const del = useMutation({
		mutationFn: (id) => api(`/api/crons/${id}`, { method: "DELETE" }),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["crons"] })
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "p-6 space-y-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			title: "Scheduled jobs",
			description: "Sync schedules and recurring automation."
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
							children: "Schedule"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-4 py-2 font-medium",
							children: "Type"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-4 py-2 font-medium",
							children: "Last run"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-4 py-2 font-medium",
							children: "Next run"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-4 py-2 font-medium text-right",
							children: "State"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-4 py-2 font-medium text-right",
							children: "Actions"
						})
					] })
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tbody", {
					className: "divide-y divide-border",
					children: [(data ?? []).map((j) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
						className: "text-sm",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-4 py-2.5 font-medium",
								children: j.name
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-4 py-2.5 font-mono text-xs",
								children: j.schedule
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-4 py-2.5",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-xs bg-muted px-1.5 py-0.5 rounded border border-border",
									children: j.job_type
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-4 py-2.5 text-xs text-muted-foreground",
								children: j.last_run ? formatDistanceToNow(new Date(j.last_run), { addSuffix: true }) : "—"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-4 py-2.5 text-xs text-muted-foreground",
								children: j.next_run ? formatDistanceToNow(new Date(j.next_run), { addSuffix: true }) : "—"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-4 py-2.5 text-right",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusPill, { status: j.enabled ? "active" : "inactive" })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-4 py-2.5 text-right",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "inline-flex gap-1",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											onClick: () => run.mutate(j.id),
											className: "p-1.5 hover:bg-muted rounded-md",
											title: "Run now",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "size-3.5" })
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											onClick: () => toggle.mutate(j.id),
											className: "p-1.5 hover:bg-muted rounded-md",
											title: "Toggle",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Power, { className: "size-3.5" })
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											onClick: () => confirm(`Delete ${j.name}?`) && del.mutate(j.id),
											className: "p-1.5 hover:bg-muted rounded-md text-red-600",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" })
										})
									]
								})
							})
						]
					}, j.id)), data && data.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						colSpan: 7,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, { title: "No scheduled jobs" })
					}) })]
				})]
			})
		})]
	});
}
//#endregion
export { CronsPage as component };
