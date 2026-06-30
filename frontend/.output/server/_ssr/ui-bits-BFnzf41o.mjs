import { o as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ui-bits-BFnzf41o.js
var import_jsx_runtime = require_jsx_runtime();
function PageHeader({ title, description, actions }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-start justify-between mb-6",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
			className: "text-xl font-semibold tracking-tight",
			children: title
		}), description && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-sm text-muted-foreground mt-1",
			children: description
		})] }), actions && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex items-center gap-2",
			children: actions
		})]
	});
}
function Card({ children, className = "" }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: `bg-surface ring-1 ring-black/5 rounded-lg ${className}`,
		children
	});
}
var STATUS_STYLES = {
	running: "bg-emerald-50 text-emerald-700",
	online: "bg-emerald-50 text-emerald-700",
	active: "bg-emerald-50 text-emerald-700",
	healthy: "bg-emerald-50 text-emerald-700",
	available: "bg-emerald-50 text-emerald-700",
	ready: "bg-emerald-50 text-emerald-700",
	in_use: "bg-emerald-50 text-emerald-700",
	syncing: "bg-amber-50 text-amber-700",
	pending: "bg-amber-50 text-amber-700",
	starting: "bg-amber-50 text-amber-700",
	rebooting: "bg-amber-50 text-amber-700",
	creating: "bg-amber-50 text-amber-700",
	stopped: "bg-zinc-100 text-zinc-600",
	off: "bg-zinc-100 text-zinc-600",
	inactive: "bg-zinc-100 text-zinc-600",
	unknown: "bg-zinc-100 text-zinc-600",
	failed: "bg-red-50 text-red-700",
	error: "bg-red-50 text-red-700"
};
var DOT_STYLES = {
	running: "bg-emerald-500",
	online: "bg-emerald-500",
	active: "bg-emerald-500",
	healthy: "bg-emerald-500",
	available: "bg-emerald-500",
	ready: "bg-emerald-500",
	in_use: "bg-emerald-500",
	syncing: "bg-amber-500",
	pending: "bg-amber-500",
	starting: "bg-amber-500",
	rebooting: "bg-amber-500",
	creating: "bg-amber-500",
	stopped: "bg-zinc-400",
	off: "bg-zinc-400",
	inactive: "bg-zinc-400",
	unknown: "bg-zinc-400",
	failed: "bg-red-500",
	error: "bg-red-500"
};
function StatusPill({ status }) {
	const key = (status || "unknown").toLowerCase();
	const cls = STATUS_STYLES[key] ?? "bg-zinc-100 text-zinc-600";
	const dot = DOT_STYLES[key] ?? "bg-zinc-400";
	const pulse = [
		"syncing",
		"pending",
		"starting",
		"creating",
		"rebooting"
	].includes(key);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
		className: `pill ${cls}`,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `size-1.5 rounded-full ${dot} ${pulse ? "animate-pulse" : ""}` }), status.toUpperCase()]
	});
}
var PROVIDER_COLORS = {
	aws: "text-orange-600",
	gcp: "text-blue-600",
	azure: "text-sky-600",
	digitalocean: "text-blue-500",
	do: "text-blue-500",
	linode: "text-green-600",
	ovh: "text-indigo-600",
	hivelocity: "text-amber-600"
};
function ProviderBadge({ provider }) {
	const p = (provider || "").toLowerCase();
	const short = p === "digitalocean" ? "DO" : p === "kubernetes" ? "K8S" : p.slice(0, 3).toUpperCase();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center gap-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: `size-5 bg-secondary rounded-sm flex items-center justify-center text-[9px] font-bold ${PROVIDER_COLORS[p] ?? "text-zinc-600"}`,
			children: short
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "text-sm text-muted-foreground",
			children: provider || "—"
		})]
	});
}
function EmptyState({ title, description, action }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col items-center justify-center py-16 text-center",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				className: "text-sm font-semibold",
				children: title
			}),
			description && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs text-muted-foreground mt-1 max-w-sm",
				children: description
			}),
			action && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-4",
				children: action
			})
		]
	});
}
function KpiTile({ label, value, hint, tone = "muted" }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "bg-surface p-4 ring-1 ring-black/5 rounded-lg",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-baseline gap-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-2xl font-semibold tracking-tight tabular-nums",
				children: value
			}), hint && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: `text-xs font-medium ${tone === "success" ? "text-emerald-600" : tone === "warning" ? "text-amber-600" : tone === "danger" ? "text-red-600" : "text-muted-foreground"}`,
				children: hint
			})]
		})]
	});
}
//#endregion
export { ProviderBadge as a, PageHeader as i, EmptyState as n, StatusPill as o, KpiTile as r, Card as t };
