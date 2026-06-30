import { r as __toESM } from "./_runtime.mjs";
import { t as api } from "./_ssr/api-DNcet4h7.mjs";
import { a as require_react, i as useQueryClient, n as useQuery, o as require_jsx_runtime, t as useMutation } from "./_libs/react+tanstack__react-query.mjs";
import { n as toast } from "./_libs/sonner.mjs";
import { a as Star, d as Plus, r as Trash2 } from "./_libs/lucide-react.mjs";
import { i as PageHeader, n as EmptyState, t as Card } from "./_ssr/ui-bits-BFnzf41o.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/_app.ssh-keys-CLDaOHpe.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function SshPage() {
	const qc = useQueryClient();
	const [open, setOpen] = (0, import_react.useState)(false);
	const { data } = useQuery({
		queryKey: ["ssh"],
		queryFn: () => api("/api/ssh-credentials")
	});
	const setDefault = useMutation({
		mutationFn: (id) => api(`/api/ssh-credentials/${id}/set-default`, { method: "PATCH" }),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["ssh"] })
	});
	const del = useMutation({
		mutationFn: (id) => api(`/api/ssh-credentials/${id}`, { method: "DELETE" }),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["ssh"] })
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "p-6 space-y-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
				title: "SSH credentials",
				description: "Used to fetch live IPs and OS info from your servers.",
				actions: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					onClick: () => setOpen(true),
					className: "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3.5" }), " Add SSH credential"]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
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
								children: "User"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-4 py-2 font-medium",
								children: "Auth"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-4 py-2 font-medium",
								children: "Port"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-4 py-2 font-medium",
								children: "Proxy"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-4 py-2 font-medium text-right",
								children: "Actions"
							})
						] })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tbody", {
						className: "divide-y divide-border",
						children: [(data ?? []).map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: "text-sm",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
									className: "px-4 py-2.5 font-medium flex items-center gap-2",
									children: [c.is_default && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Star, { className: "size-3.5 text-amber-500 fill-amber-500" }), c.name]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-4 py-2.5 font-mono text-xs",
									children: c.username
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-4 py-2.5",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-xs bg-muted px-1.5 py-0.5 rounded border border-border",
										children: c.auth_method
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-4 py-2.5 font-mono text-xs",
									children: c.port
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-4 py-2.5 font-mono text-xs text-muted-foreground",
									children: c.proxy_host ?? "—"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-4 py-2.5 text-right",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "inline-flex gap-1",
										children: [!c.is_default && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											onClick: () => setDefault.mutate(c.id),
											className: "p-1.5 hover:bg-muted rounded-md",
											title: "Set default",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Star, { className: "size-3.5" })
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											onClick: () => confirm(`Delete ${c.name}?`) && del.mutate(c.id),
											className: "p-1.5 hover:bg-muted rounded-md text-red-600",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" })
										})]
									})
								})
							]
						}, c.id)), data && data.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							colSpan: 6,
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, {
								title: "No SSH credentials",
								description: "Add one to enable SSH-based IP discovery."
							})
						}) })]
					})]
				})
			}),
			open && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SshDialog, { onClose: () => setOpen(false) })
		]
	});
}
function SshDialog({ onClose }) {
	const qc = useQueryClient();
	const [name, setName] = (0, import_react.useState)("");
	const [username, setUsername] = (0, import_react.useState)("root");
	const [authMethod, setAuthMethod] = (0, import_react.useState)("key");
	const [password, setPassword] = (0, import_react.useState)("");
	const [privateKey, setPrivateKey] = (0, import_react.useState)("");
	const [port, setPort] = (0, import_react.useState)(22);
	const create = useMutation({
		mutationFn: () => api("/api/ssh-credentials", {
			method: "POST",
			json: {
				name,
				username,
				auth_method: authMethod,
				password: authMethod === "password" ? password : null,
				private_key: authMethod === "key" ? privateKey : null,
				port,
				is_default: false
			}
		}),
		onSuccess: () => {
			toast.success("SSH credential added");
			qc.invalidateQueries({ queryKey: ["ssh"] });
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
					children: "New SSH credential"
				})
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "p-4 space-y-3",
				onSubmit: (e) => {
					e.preventDefault();
					create.mutate();
				},
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						label: "Name",
						value: name,
						onChange: setName,
						required: true
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid grid-cols-2 gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							label: "Username",
							value: username,
							onChange: setUsername,
							required: true
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							label: "Port",
							value: String(port),
							onChange: (v) => setPort(Number(v) || 22)
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Auth method" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
						value: authMethod,
						onChange: (e) => setAuthMethod(e.target.value),
						className: "mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-md",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "key",
							children: "Private key"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "password",
							children: "Password"
						})]
					})] }),
					authMethod === "password" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						label: "Password",
						value: password,
						onChange: setPassword,
						type: "password",
						required: true
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Private key" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
						required: true,
						rows: 5,
						value: privateKey,
						onChange: (e) => setPrivateKey(e.target.value),
						placeholder: "-----BEGIN OPENSSH PRIVATE KEY-----",
						className: "mt-1 w-full px-3 py-2 text-xs font-mono bg-background border border-border rounded-md"
					})] }),
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
function Label({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
		className: "text-[10px] font-semibold text-muted-foreground uppercase tracking-widest",
		children
	});
}
function Input({ label, value, onChange, type = "text", required }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: label }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
		required,
		type,
		value,
		onChange: (e) => onChange(e.target.value),
		className: "mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
	})] });
}
//#endregion
export { SshPage as component };
