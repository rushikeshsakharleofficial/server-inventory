import { r as __toESM } from "./_runtime.mjs";
import { t as api } from "./_ssr/api-DNcet4h7.mjs";
import { a as require_react, i as useQueryClient, n as useQuery, o as require_jsx_runtime, t as useMutation } from "./_libs/react+tanstack__react-query.mjs";
import { n as toast } from "./_libs/sonner.mjs";
import { d as Plus, r as Trash2, u as Power } from "./_libs/lucide-react.mjs";
import { i as PageHeader, n as EmptyState, t as Card } from "./_ssr/ui-bits-BFnzf41o.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/_app.credentials-BC8vOIvm.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var PROVIDERS = [
	{
		id: "aws",
		name: "Amazon Web Services",
		fields: [
			"access_key_id",
			"secret_access_key",
			"region"
		]
	},
	{
		id: "gcp",
		name: "Google Cloud",
		fields: ["service_account_json"]
	},
	{
		id: "azure",
		name: "Microsoft Azure",
		fields: [
			"tenant_id",
			"client_id",
			"client_secret",
			"subscription_id"
		]
	},
	{
		id: "digitalocean",
		name: "DigitalOcean",
		fields: ["api_token"]
	},
	{
		id: "linode",
		name: "Linode",
		fields: ["api_token"]
	},
	{
		id: "ovh",
		name: "OVH",
		fields: [
			"application_key",
			"application_secret",
			"consumer_key"
		]
	},
	{
		id: "hivelocity",
		name: "Hivelocity",
		fields: ["api_key"]
	}
];
function CredentialsPage() {
	const qc = useQueryClient();
	const [open, setOpen] = (0, import_react.useState)(false);
	const { data, isLoading } = useQuery({
		queryKey: ["creds"],
		queryFn: () => api("/api/credentials", { query: { limit: 100 } })
	});
	const toggle = useMutation({
		mutationFn: (id) => api(`/api/credentials/${id}/toggle`, { method: "PATCH" }),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["creds"] }),
		onError: (e) => toast.error(e.message)
	});
	const del = useMutation({
		mutationFn: (id) => api(`/api/credentials/${id}`, { method: "DELETE" }),
		onSuccess: () => {
			toast.success("Credential removed");
			qc.invalidateQueries({ queryKey: ["creds"] });
		},
		onError: (e) => toast.error(e.message)
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "p-6 space-y-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
				title: "Cloud credentials",
				description: "API keys used to discover and sync resources from your providers.",
				actions: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					onClick: () => setOpen(true),
					className: "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3.5" }), " Add credential"]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4",
				children: (data?.items ?? []).map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "p-4 flex items-start gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "size-10 bg-background ring-1 ring-border rounded grid place-items-center font-bold text-[10px]",
						children: (c.provider === "digitalocean" ? "DO" : c.provider.slice(0, 3)).toUpperCase()
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex-1 min-w-0",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-sm font-medium truncate",
									children: c.name
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: `text-[10px] ${c.is_active ? "text-emerald-600" : "text-muted-foreground"}`,
									children: c.is_active ? "Connected" : "Disabled"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-xs text-muted-foreground mt-0.5 capitalize",
								children: c.provider
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex gap-1 mt-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => toggle.mutate(c.id),
									className: "p-1.5 hover:bg-muted rounded-md text-muted-foreground",
									title: c.is_active ? "Disable" : "Enable",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Power, { className: "size-3.5" })
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => confirm(`Delete ${c.name}?`) && del.mutate(c.id),
									className: "p-1.5 hover:bg-muted rounded-md text-red-600",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" })
								})]
							})
						]
					})]
				}, c.id))
			}),
			!isLoading && (data?.items.length ?? 0) === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
				className: "py-12",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, {
					title: "No credentials yet",
					description: "Connect a cloud provider to start discovering servers.",
					action: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						onClick: () => setOpen(true),
						className: "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3.5" }), " Add credential"]
					})
				})
			}),
			open && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NewCredentialDialog, { onClose: () => setOpen(false) })
		]
	});
}
function NewCredentialDialog({ onClose }) {
	const qc = useQueryClient();
	const [provider, setProvider] = (0, import_react.useState)(PROVIDERS[0].id);
	const [name, setName] = (0, import_react.useState)("");
	const [values, setValues] = (0, import_react.useState)({});
	const def = PROVIDERS.find((p) => p.id === provider);
	const create = useMutation({
		mutationFn: () => api("/api/credentials", {
			method: "POST",
			json: {
				name,
				provider,
				config: values
			}
		}),
		onSuccess: () => {
			toast.success("Credential added");
			qc.invalidateQueries({ queryKey: ["creds"] });
			onClose();
		},
		onError: (e) => toast.error(e.message)
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30",
		onClick: onClose,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			onClick: (e) => e.stopPropagation(),
			className: "w-full max-w-md bg-surface rounded-lg ring-1 ring-border shadow-2xl",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "p-4 border-b border-border",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
					className: "text-sm font-semibold",
					children: "Add cloud credential"
				})
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "p-4 space-y-3",
				onSubmit: (e) => {
					e.preventDefault();
					create.mutate();
				},
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
						className: "text-[10px] font-semibold text-muted-foreground uppercase tracking-widest",
						children: "Provider"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
						value: provider,
						onChange: (e) => {
							setProvider(e.target.value);
							setValues({});
						},
						className: "mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-md",
						children: PROVIDERS.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: p.id,
							children: p.name
						}, p.id))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
						className: "text-[10px] font-semibold text-muted-foreground uppercase tracking-widest",
						children: "Name"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						required: true,
						value: name,
						onChange: (e) => setName(e.target.value),
						placeholder: "Production account",
						className: "mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
					})] }),
					def.fields.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
						className: "text-[10px] font-semibold text-muted-foreground uppercase tracking-widest",
						children: f.replace(/_/g, " ")
					}), f.includes("json") ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
						required: true,
						rows: 4,
						value: values[f] ?? "",
						onChange: (e) => setValues((v) => ({
							...v,
							[f]: e.target.value
						})),
						className: "mt-1 w-full px-3 py-2 text-xs font-mono bg-background border border-border rounded-md"
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						required: true,
						type: f.includes("secret") || f.includes("token") || f.includes("key") ? "password" : "text",
						value: values[f] ?? "",
						onChange: (e) => setValues((v) => ({
							...v,
							[f]: e.target.value
						})),
						className: "mt-1 w-full px-3 py-2 text-sm font-mono bg-background border border-border rounded-md"
					})] }, f)),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex justify-end gap-2 pt-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: onClose,
							className: "px-3 py-1.5 text-sm rounded-md hover:bg-muted",
							children: "Cancel"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "submit",
							disabled: create.isPending,
							className: "px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md disabled:opacity-60",
							children: create.isPending ? "Saving…" : "Save"
						})]
					})
				]
			})]
		})
	});
}
//#endregion
export { CredentialsPage as component };
