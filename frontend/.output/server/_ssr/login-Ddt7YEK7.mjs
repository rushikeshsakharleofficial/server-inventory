import { r as __toESM } from "../_runtime.mjs";
import { n as tokenStore, r as userStore, t as api } from "./api-DNcet4h7.mjs";
import { a as require_react, o as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { P as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as Toaster$1 } from "./sonner-DoFKumIW.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/login-Ddt7YEK7.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function LoginPage() {
	const navigate = useNavigate();
	const [username, setUsername] = (0, import_react.useState)("admin");
	const [password, setPassword] = (0, import_react.useState)("");
	const [mfaToken, setMfaToken] = (0, import_react.useState)(null);
	const [code, setCode] = (0, import_react.useState)("");
	const [loading, setLoading] = (0, import_react.useState)(false);
	async function onSubmit(e) {
		e.preventDefault();
		setLoading(true);
		try {
			if (mfaToken) finalize(await api("/api/auth/mfa/verify", {
				method: "POST",
				json: {
					mfa_token: mfaToken,
					code
				}
			}));
			else {
				const form = new URLSearchParams();
				form.append("username", username);
				form.append("password", password);
				const res = await fetch(`http://localhost:8000/api/auth/login`, {
					method: "POST",
					headers: { "Content-Type": "application/x-www-form-urlencoded" },
					body: form
				});
				if (!res.ok) {
					const body = await res.json().catch(() => ({}));
					throw new Error(body.detail || "Login failed");
				}
				const data = await res.json();
				if (data.mfa_required && data.mfa_token) {
					setMfaToken(data.mfa_token);
					toast.info("Enter your authenticator code");
				} else finalize(data);
			}
		} catch (err) {
			toast.error(err.message);
		} finally {
			setLoading(false);
		}
	}
	function finalize(res) {
		if (!res.access_token) {
			toast.error("Missing token");
			return;
		}
		tokenStore.set(res.access_token);
		userStore.set({
			username: res.username ?? username,
			role: res.role ?? "read"
		});
		toast.success("Signed in");
		navigate({ to: "/dashboard" });
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-screen flex items-center justify-center bg-background px-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "w-full max-w-sm",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2 mb-8",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "size-7 bg-primary rounded flex items-center justify-center",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-2 bg-success rounded-full" })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-medium tracking-tight",
						children: "System Control"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "bg-surface ring-1 ring-black/5 rounded-lg p-6",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "text-base font-semibold",
							children: mfaToken ? "Two-factor verification" : "Sign in to your console"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-muted-foreground mt-1",
							children: mfaToken ? "Enter the 6-digit code from your authenticator app." : "Operator credentials only. Sessions expire on idle."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
							onSubmit,
							className: "mt-6 space-y-3",
							children: [
								!mfaToken && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
									className: "text-[10px] font-semibold text-muted-foreground uppercase tracking-widest",
									children: "Username"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									className: "mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-ring",
									value: username,
									onChange: (e) => setUsername(e.target.value),
									autoComplete: "username",
									required: true
								})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
									className: "text-[10px] font-semibold text-muted-foreground uppercase tracking-widest",
									children: "Password"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "password",
									className: "mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-ring",
									value: password,
									onChange: (e) => setPassword(e.target.value),
									autoComplete: "current-password",
									required: true
								})] })] }),
								mfaToken && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
									className: "text-[10px] font-semibold text-muted-foreground uppercase tracking-widest",
									children: "Authenticator code"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									inputMode: "numeric",
									pattern: "[0-9]*",
									maxLength: 6,
									className: "mt-1 w-full px-3 py-2 text-lg font-mono tracking-[0.5em] text-center bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-ring",
									value: code,
									onChange: (e) => setCode(e.target.value.replace(/\D/g, "")),
									required: true,
									autoFocus: true
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "submit",
									disabled: loading,
									className: "w-full py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-60",
									children: loading ? "Verifying…" : mfaToken ? "Verify" : "Sign in"
								}),
								mfaToken && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => {
										setMfaToken(null);
										setCode("");
									},
									className: "w-full py-1.5 text-xs text-muted-foreground hover:text-foreground",
									children: "Back to password"
								})
							]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-[10px] text-muted-foreground text-center mt-6",
					children: ["API: ", "http://localhost:8000"]
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toaster$1, {
			position: "top-right",
			richColors: true
		})]
	});
}
//#endregion
export { LoginPage as component };
