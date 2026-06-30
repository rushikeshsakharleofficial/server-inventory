import { r as __toESM } from "./_runtime.mjs";
import { t as api } from "./_ssr/api-DNcet4h7.mjs";
import { a as require_react, n as useQuery, o as require_jsx_runtime } from "./_libs/react+tanstack__react-query.mjs";
import { a as ProviderBadge, i as PageHeader, o as StatusPill, t as Card } from "./_ssr/ui-bits-BFnzf41o.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/_app.resource-map-DrU0L_2i.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function ResourceMapPage() {
	const [selected, setSelected] = (0, import_react.useState)(null);
	const { data } = useQuery({
		queryKey: ["servers", "map"],
		queryFn: () => api("/api/servers", { query: { limit: 200 } })
	});
	const tree = /* @__PURE__ */ new Map();
	for (const s of data?.items ?? []) {
		const p = s.provider || "unknown";
		const r = s.region || "—";
		if (!tree.has(p)) tree.set(p, /* @__PURE__ */ new Map());
		const sub = tree.get(p);
		if (!sub.has(r)) sub.set(r, []);
		sub.get(r).push(s);
	}
	const detail = useQuery({
		queryKey: ["resourceMap", selected?.id],
		queryFn: () => api(`/api/resource-map/server/${selected.id}`),
		enabled: !!selected
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "p-6 space-y-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			title: "Resource map",
			description: "Topology of every discovered resource grouped by provider and region."
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid grid-cols-1 lg:grid-cols-3 gap-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "lg:col-span-2 p-4 space-y-6 overflow-auto max-h-[75vh]",
				children: [[...tree.entries()].map(([prov, regions]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between mb-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProviderBadge, { provider: prov }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "text-[10px] font-mono text-muted-foreground",
						children: [[...regions.values()].reduce((a, b) => a + b.length, 0), " resources"]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "ml-2 pl-4 border-l border-dashed border-border space-y-3",
					children: [...regions.entries()].map(([r, servers]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-xs font-mono text-muted-foreground mb-1.5",
						children: r
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex flex-wrap gap-2",
						children: servers.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => setSelected(s),
							className: `px-2 py-1 text-xs rounded-md border transition-colors text-left ${selected?.id === s.id ? "bg-secondary border-foreground" : "bg-surface border-border hover:border-muted-foreground/40"}`,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-1.5 rounded-full bg-emerald-500" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-medium",
									children: s.name
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[10px] text-muted-foreground font-mono",
								children: s.public_ip ?? "—"
							})]
						}, s.id))
					})] }, r))
				})] }, prov)), tree.size === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted-foreground text-center py-8",
					children: "No resources to map yet."
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
				className: "p-4 overflow-auto max-h-[75vh]",
				children: selected ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between mb-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "text-sm font-semibold",
						children: selected.name
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusPill, { status: selected.status })]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
					className: "text-[10px] font-mono bg-background border border-border rounded-md p-3 overflow-auto whitespace-pre-wrap",
					children: JSON.stringify(detail.data ?? {}, null, 2)
				})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted-foreground text-center py-8",
					children: "Select a resource to inspect its relationships."
				})
			})]
		})]
	});
}
//#endregion
export { ResourceMapPage as component };
