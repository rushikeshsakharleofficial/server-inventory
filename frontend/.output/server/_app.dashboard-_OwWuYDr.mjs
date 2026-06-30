import { t as api } from "./_ssr/api-DNcet4h7.mjs";
import { n as useQuery, o as require_jsx_runtime } from "./_libs/react+tanstack__react-query.mjs";
import { a as ProviderBadge, i as PageHeader, o as StatusPill, r as KpiTile, t as Card } from "./_ssr/ui-bits-BFnzf41o.mjs";
import { t as formatDistanceToNow } from "./_libs/date-fns.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/_app.dashboard-_OwWuYDr.js
var import_jsx_runtime = require_jsx_runtime();
function Dashboard() {
	const stats = useQuery({
		queryKey: ["stats"],
		queryFn: () => api("/api/servers/stats"),
		refetchInterval: 15e3
	});
	const logs = useQuery({
		queryKey: ["syncLogs", "dash"],
		queryFn: () => api("/api/sync/logs", { query: { limit: 6 } }),
		refetchInterval: 5e3
	});
	const creds = useQuery({
		queryKey: ["creds"],
		queryFn: () => api("/api/credentials", { query: { limit: 20 } })
	});
	const running = logs.data?.find((l) => l.status === "running");
	const data = stats.data;
	const providers = data ? Object.entries(data.by_provider) : [];
	const regions = data ? Object.entries(data.by_region).slice(0, 8) : [];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "p-6 space-y-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
				title: "Fleet overview",
				description: "Live state of all managed compute, storage, and orchestration resources."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-1 md:grid-cols-4 gap-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(KpiTile, {
						label: "Total Instances",
						value: data?.total ?? "—"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(KpiTile, {
						label: "Running",
						value: data?.running ?? "—",
						hint: "active",
						tone: "success"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(KpiTile, {
						label: "Stopped",
						value: data?.stopped ?? "—",
						hint: "idle"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(KpiTile, {
						label: "Connected Providers",
						value: creds.data?.items.filter((c) => c.is_active).length ?? "—",
						hint: `${creds.data?.total ?? 0} total`
					})
				]
			}),
			running && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "p-4 flex items-center gap-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-3 shrink-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-4 border-2 border-warning border-t-transparent rounded-full animate-spin" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-sm font-medium",
							children: [
								"Syncing ",
								running.provider ?? "all providers",
								"…"
							]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex-1 h-1.5 bg-muted rounded-full overflow-hidden",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-1/2 h-full bg-warning animate-pulse" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-[10px] font-mono text-muted-foreground",
						children: "IN PROGRESS"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-1 lg:grid-cols-3 gap-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "lg:col-span-2 overflow-hidden",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "px-4 py-3 border-b border-border bg-surface-muted",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "text-sm font-semibold",
							children: "Distribution by provider"
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "p-4 space-y-3",
						children: [providers.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-muted-foreground",
							children: "No data yet."
						}), providers.map(([prov, count]) => {
							const pct = data ? count / Math.max(1, data.total) * 100 : 0;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center justify-between text-xs",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProviderBadge, { provider: prov }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "font-mono text-muted-foreground tabular-nums",
										children: [
											count,
											" · ",
											pct.toFixed(0),
											"%"
										]
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "h-1.5 bg-muted rounded-full overflow-hidden",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "h-full bg-primary",
										style: { width: `${pct}%` }
									})
								})]
							}, prov);
						})]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "overflow-hidden",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "px-4 py-3 border-b border-border bg-surface-muted",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "text-sm font-semibold",
							children: "Top regions"
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "p-4 space-y-2",
						children: [regions.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-muted-foreground",
							children: "No data yet."
						}), regions.map(([r, c]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between text-xs",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono text-muted-foreground",
								children: r
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono tabular-nums",
								children: c
							})]
						}, r))]
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "overflow-hidden",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "px-4 py-3 border-b border-border bg-surface-muted flex items-center justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "text-sm font-semibold",
						children: "Recent sync activity"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "text-xs text-muted-foreground",
						children: [
							"last ",
							logs.data?.length ?? 0,
							" jobs"
						]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
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
								children: "Error"
							})
						] })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tbody", {
						className: "divide-y divide-border",
						children: [(logs.data ?? []).map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
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
									className: "px-4 py-2.5 text-xs text-red-600 max-w-xs truncate",
									children: l.error_message ?? ""
								})
							]
						}, l.id)), logs.data && logs.data.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							colSpan: 6,
							className: "px-4 py-8 text-center text-xs text-muted-foreground",
							children: "No sync runs yet — trigger one from the top bar."
						}) })]
					})]
				})]
			})
		]
	});
}
//#endregion
export { Dashboard as component };
