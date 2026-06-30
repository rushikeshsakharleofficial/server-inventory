import { r as __toESM } from "./_runtime.mjs";
import { t as api } from "./_ssr/api-DNcet4h7.mjs";
import { a as require_react, i as useQueryClient, n as useQuery, o as require_jsx_runtime, t as useMutation } from "./_libs/react+tanstack__react-query.mjs";
import { n as toast } from "./_libs/sonner.mjs";
import { c as Search, i as Terminal, l as RefreshCw, r as Trash2, t as X } from "./_libs/lucide-react.mjs";
import { a as ProviderBadge, i as PageHeader, n as EmptyState, o as StatusPill, t as Card } from "./_ssr/ui-bits-BFnzf41o.mjs";
import { t as formatDistanceToNow } from "./_libs/date-fns.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/_app.servers-DRDO0rf_.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function ServersPage() {
	const qc = useQueryClient();
	const [q, setQ] = (0, import_react.useState)("");
	const [provider, setProvider] = (0, import_react.useState)("");
	const [status, setStatus] = (0, import_react.useState)("");
	const [offset, setOffset] = (0, import_react.useState)(0);
	const [selected, setSelected] = (0, import_react.useState)(null);
	const limit = 50;
	const { data, isLoading } = useQuery({
		queryKey: ["servers", {
			q,
			provider,
			status,
			offset
		}],
		queryFn: () => api("/api/servers", { query: {
			search: q,
			provider,
			status,
			limit,
			offset
		} }),
		placeholderData: (prev) => prev
	});
	const sshSync = useMutation({
		mutationFn: (id) => api(`/api/servers/${id}/ssh-sync`, { method: "POST" }),
		onSuccess: () => {
			toast.success("SSH sync queued");
			qc.invalidateQueries({ queryKey: ["servers"] });
		},
		onError: (e) => toast.error(e.message)
	});
	const del = useMutation({
		mutationFn: (id) => api(`/api/servers/${id}`, { method: "DELETE" }),
		onSuccess: () => {
			toast.success("Server deleted");
			setSelected(null);
			qc.invalidateQueries({ queryKey: ["servers"] });
		},
		onError: (e) => toast.error(e.message)
	});
	const items = data?.items ?? [];
	const total = data?.total ?? 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "p-6 space-y-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
				title: "Servers",
				description: `${total.toLocaleString()} instances across all providers`
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "p-3 flex flex-wrap gap-2 items-center",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "relative flex-1 min-w-[200px]",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							value: q,
							onChange: (e) => {
								setQ(e.target.value);
								setOffset(0);
							},
							placeholder: "Search by name, IP, hostname…",
							className: "w-full pl-9 pr-3 py-1.5 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
						value: provider,
						onChange: (e) => {
							setProvider(e.target.value);
							setOffset(0);
						},
						className: "px-3 py-1.5 text-sm bg-background border border-border rounded-md",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "",
							children: "All providers"
						}), [
							"aws",
							"gcp",
							"azure",
							"digitalocean",
							"linode",
							"ovh",
							"hivelocity"
						].map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: p }, p))]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
						value: status,
						onChange: (e) => {
							setStatus(e.target.value);
							setOffset(0);
						},
						className: "px-3 py-1.5 text-sm bg-background border border-border rounded-md",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "",
							children: "All statuses"
						}), [
							"running",
							"stopped",
							"pending",
							"unknown"
						].map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: s }, s))]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "overflow-hidden",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
					className: "w-full text-left",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
						className: "text-[11px] font-semibold text-muted-foreground uppercase tracking-wider bg-surface-muted border-b border-border",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-4 py-2 font-medium",
								children: "Instance"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-4 py-2 font-medium",
								children: "Provider / Region"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-4 py-2 font-medium",
								children: "Public IP"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-4 py-2 font-medium",
								children: "Type"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-4 py-2 font-medium",
								children: "Synced"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-4 py-2 font-medium text-right",
								children: "Status"
							})
						] })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tbody", {
						className: "divide-y divide-border",
						children: [items.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							onClick: () => setSelected(s),
							className: `cursor-pointer hover:bg-muted/50 transition-colors ${selected?.id === s.id ? "bg-muted ring-1 ring-inset ring-border" : ""}`,
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-4 py-2.5",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex flex-col",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-sm font-medium",
											children: s.name
										}), s.cloud_id && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[10px] text-muted-foreground font-mono",
											children: s.cloud_id
										})]
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-4 py-2.5",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProviderBadge, { provider: s.provider }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-xs text-muted-foreground",
											children: s.region ?? "—"
										})]
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-4 py-2.5 font-mono text-xs text-muted-foreground",
									children: s.public_ip ?? "—"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-4 py-2.5",
									children: s.instance_type ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-xs bg-muted px-1.5 py-0.5 rounded border border-border",
										children: s.instance_type
									}) : "—"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-4 py-2.5 text-xs text-muted-foreground",
									children: s.last_synced ? formatDistanceToNow(new Date(s.last_synced), { addSuffix: true }) : "never"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-4 py-2.5 text-right",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusPill, { status: s.status })
								})
							]
						}, s.id)), !isLoading && items.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							colSpan: 6,
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, {
								title: "No servers match",
								description: "Add cloud credentials and run a sync to discover instances."
							})
						}) })]
					})]
				}), total > limit && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "px-4 py-3 border-t border-border flex items-center justify-between text-xs",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "text-muted-foreground",
						children: [
							offset + 1,
							"–",
							Math.min(offset + limit, total),
							" of ",
							total.toLocaleString()
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex gap-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							disabled: offset === 0,
							onClick: () => setOffset(Math.max(0, offset - limit)),
							className: "px-3 py-1 border border-border rounded-md disabled:opacity-40",
							children: "Prev"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							disabled: offset + limit >= total,
							onClick: () => setOffset(offset + limit),
							className: "px-3 py-1 border border-border rounded-md disabled:opacity-40",
							children: "Next"
						})]
					})]
				})]
			}),
			selected && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "fixed inset-0 z-40",
				onClick: () => setSelected(null),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-0 bg-black/20" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					onClick: (e) => e.stopPropagation(),
					className: "absolute top-0 right-0 bottom-0 w-[440px] bg-surface border-l border-border shadow-2xl flex flex-col",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "p-4 border-b border-border flex items-center justify-between bg-surface-muted",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-3 min-w-0",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusPill, { status: selected.status }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
									className: "font-semibold text-sm truncate",
									children: selected.name
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setSelected(null),
								className: "p-1 hover:bg-muted rounded-md",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4 text-muted-foreground" })
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex-1 overflow-y-auto p-6 space-y-6",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
									className: "space-y-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[10px] font-semibold text-muted-foreground uppercase tracking-widest",
										children: "Resource summary"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "grid grid-cols-2 gap-px bg-border ring-1 ring-border rounded-lg overflow-hidden",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
												label: "vCPU",
												value: selected.vcpu ?? "—"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
												label: "Memory",
												value: selected.memory_gb ? `${selected.memory_gb} GB` : "—"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
												label: "Storage",
												value: selected.storage_gb ? `${selected.storage_gb} GB` : "—"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
												label: "OS",
												value: selected.os ?? "—"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
												label: "Region",
												value: selected.region ?? "—"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
												label: "Zone",
												value: selected.zone ?? "—"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
												label: "Type",
												value: selected.instance_type ?? "—"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
												label: "DC",
												value: selected.datacenter ?? "—"
											})
										]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
									className: "space-y-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[10px] font-semibold text-muted-foreground uppercase tracking-widest",
										children: "Network"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "bg-background rounded-md border border-border p-3 space-y-2 text-xs font-mono",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
												k: "Public IP",
												v: selected.public_ip ?? "—"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
												k: "Private IP",
												v: selected.private_ip ?? "—"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
												k: "Hostname",
												v: selected.hostname ?? "—"
											})
										]
									})]
								}),
								selected.tags && Object.keys(selected.tags).length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
									className: "space-y-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[10px] font-semibold text-muted-foreground uppercase tracking-widest",
										children: "Tags"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "flex flex-wrap gap-1.5",
										children: Object.entries(selected.tags).map(([k, v]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "text-[10px] bg-muted px-1.5 py-0.5 rounded border border-border font-mono",
											children: [
												k,
												": ",
												String(v)
											]
										}, k))
									})]
								}),
								selected.notes && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
									className: "space-y-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[10px] font-semibold text-muted-foreground uppercase tracking-widest",
										children: "Notes"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-xs text-muted-foreground",
										children: selected.notes
									})]
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "p-4 border-t border-border flex gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									onClick: () => sshSync.mutate(selected.id),
									disabled: sshSync.isPending,
									className: "flex-1 py-2 text-xs font-medium bg-primary text-primary-foreground rounded-md inline-flex items-center justify-center gap-1.5 disabled:opacity-50",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: "size-3.5" }), " SSH Sync"]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									className: "flex-1 py-2 text-xs font-medium bg-surface ring-1 ring-border rounded-md inline-flex items-center justify-center gap-1.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Terminal, { className: "size-3.5" }), " Connect"]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => {
										if (confirm(`Delete ${selected.name}?`)) del.mutate(selected.id);
									},
									className: "px-3 py-2 text-xs font-medium bg-surface ring-1 ring-border text-red-600 rounded-md",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" })
								})
							]
						})
					]
				})]
			})
		]
	});
}
function Field({ label, value }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "bg-surface p-3",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "text-[10px] text-muted-foreground",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "text-sm font-mono mt-0.5",
			children: value
		})]
	});
}
function Row({ k, v }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex justify-between gap-3",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "text-muted-foreground",
			children: k
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "text-foreground truncate",
			children: v
		})]
	});
}
//#endregion
export { ServersPage as component };
