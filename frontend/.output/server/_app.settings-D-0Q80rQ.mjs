import { r as __toESM } from "./_runtime.mjs";
import { t as api } from "./_ssr/api-DNcet4h7.mjs";
import { a as require_react, i as useQueryClient, n as useQuery, o as require_jsx_runtime, t as useMutation } from "./_libs/react+tanstack__react-query.mjs";
import { n as toast } from "./_libs/sonner.mjs";
import { i as PageHeader, t as Card } from "./_ssr/ui-bits-BFnzf41o.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/_app.settings-D-0Q80rQ.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function SettingsPage() {
	const qc = useQueryClient();
	const { data } = useQuery({
		queryKey: ["settings"],
		queryFn: () => api("/api/settings")
	});
	const [draft, setDraft] = (0, import_react.useState)({});
	(0, import_react.useEffect)(() => {
		if (data) setDraft(data);
	}, [data]);
	const update = useMutation({
		mutationFn: async (entries) => {
			for (const [k, v] of entries) await api(`/api/settings/${encodeURIComponent(k)}`, {
				method: "PUT",
				json: { value: v }
			});
		},
		onSuccess: () => {
			toast.success("Settings saved");
			qc.invalidateQueries({ queryKey: ["settings"] });
		},
		onError: (e) => toast.error(e.message)
	});
	const mfaStatus = useQuery({
		queryKey: ["mfaStatus"],
		queryFn: () => api("/api/auth/mfa/status")
	});
	function save() {
		if (!data) return;
		const changed = Object.entries(draft).filter(([k, v]) => data[k] !== v);
		if (changed.length === 0) {
			toast.info("Nothing to save");
			return;
		}
		update.mutate(changed);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "p-6 space-y-6 max-w-3xl",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
				title: "Settings",
				description: "Application preferences and defaults."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "overflow-hidden",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "px-4 py-3 border-b border-border bg-surface-muted",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "text-sm font-semibold",
						children: "Application"
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "p-4 space-y-4",
					children: [Object.entries(draft).map(([k, v]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid grid-cols-3 gap-4 items-center",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
							className: "text-xs font-mono text-muted-foreground",
							children: k
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							value: v,
							onChange: (e) => setDraft((d) => ({
								...d,
								[k]: e.target.value
							})),
							className: "col-span-2 px-3 py-1.5 text-sm bg-background border border-border rounded-md font-mono"
						})]
					}, k)), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "pt-2",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: save,
							disabled: update.isPending,
							className: "px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md disabled:opacity-60",
							children: update.isPending ? "Saving…" : "Save changes"
						})
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "overflow-hidden",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "px-4 py-3 border-b border-border bg-surface-muted",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "text-sm font-semibold",
						children: "Two-factor authentication"
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "p-4 flex items-center justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm font-medium",
						children: mfaStatus.data?.enabled ? "Enabled" : "Disabled"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-muted-foreground",
						children: "Use an authenticator app (e.g. 1Password, Authy) to add a second factor."
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
						href: "https://github.com/google/google-authenticator/wiki",
						target: "_blank",
						rel: "noreferrer",
						className: "text-xs text-muted-foreground hover:text-foreground underline",
						children: "Setup guide"
					})]
				})]
			})
		]
	});
}
//#endregion
export { SettingsPage as component };
