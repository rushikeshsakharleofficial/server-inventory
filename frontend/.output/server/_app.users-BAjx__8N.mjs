import { r as __toESM } from "./_runtime.mjs";
import { t as api } from "./_ssr/api-DNcet4h7.mjs";
import { a as require_react, i as useQueryClient, n as useQuery, o as require_jsx_runtime, t as useMutation } from "./_libs/react+tanstack__react-query.mjs";
import { n as toast } from "./_libs/sonner.mjs";
import { d as Plus, r as Trash2, u as Power } from "./_libs/lucide-react.mjs";
import { i as PageHeader, o as StatusPill, t as Card } from "./_ssr/ui-bits-BFnzf41o.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/_app.users-BAjx__8N.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function UsersPage() {
	const qc = useQueryClient();
	const [open, setOpen] = (0, import_react.useState)(false);
	const { data } = useQuery({
		queryKey: ["users"],
		queryFn: () => api("/api/users")
	});
	const toggle = useMutation({
		mutationFn: (id) => api(`/api/users/${id}/toggle`, { method: "PATCH" }),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] })
	});
	const del = useMutation({
		mutationFn: (id) => api(`/api/users/${id}`, { method: "DELETE" }),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] })
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "p-6 space-y-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
				title: "Users",
				description: "Operators with access to this console.",
				actions: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					onClick: () => setOpen(true),
					className: "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3.5" }), " Add user"]
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
								children: "Username"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-4 py-2 font-medium",
								children: "Role"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-4 py-2 font-medium",
								children: "Created"
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
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", {
						className: "divide-y divide-border",
						children: (data ?? []).map((u) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: "text-sm",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-4 py-2.5 font-medium",
									children: u.username
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-4 py-2.5",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-xs bg-muted px-1.5 py-0.5 rounded border border-border uppercase",
										children: u.role
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-4 py-2.5 text-xs text-muted-foreground",
									children: u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-4 py-2.5 text-right",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusPill, { status: u.is_active ? "active" : "inactive" })
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-4 py-2.5 text-right",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "inline-flex gap-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											onClick: () => toggle.mutate(u.id),
											className: "p-1.5 hover:bg-muted rounded-md",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Power, { className: "size-3.5" })
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											onClick: () => confirm(`Delete ${u.username}?`) && del.mutate(u.id),
											className: "p-1.5 hover:bg-muted rounded-md text-red-600",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" })
										})]
									})
								})
							]
						}, u.id))
					})]
				})
			}),
			open && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NewUserDialog, { onClose: () => setOpen(false) })
		]
	});
}
function NewUserDialog({ onClose }) {
	const qc = useQueryClient();
	const [username, setUsername] = (0, import_react.useState)("");
	const [password, setPassword] = (0, import_react.useState)("");
	const [role, setRole] = (0, import_react.useState)("read");
	const create = useMutation({
		mutationFn: () => api("/api/users", {
			method: "POST",
			json: {
				username,
				password,
				role
			}
		}),
		onSuccess: () => {
			toast.success("User created");
			qc.invalidateQueries({ queryKey: ["users"] });
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
					children: "New user"
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
						children: "Username"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						required: true,
						value: username,
						onChange: (e) => setUsername(e.target.value),
						className: "mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
						className: "text-[10px] font-semibold text-muted-foreground uppercase tracking-widest",
						children: "Password (10+ chars)"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						required: true,
						minLength: 10,
						type: "password",
						value: password,
						onChange: (e) => setPassword(e.target.value),
						className: "mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
						className: "text-[10px] font-semibold text-muted-foreground uppercase tracking-widest",
						children: "Role"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
						value: role,
						onChange: (e) => setRole(e.target.value),
						className: "mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-md",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "read",
							children: "read"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "write",
							children: "write"
						})]
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
							children: create.isPending ? "Saving…" : "Create"
						})]
					})
				]
			})]
		})
	});
}
//#endregion
export { UsersPage as component };
