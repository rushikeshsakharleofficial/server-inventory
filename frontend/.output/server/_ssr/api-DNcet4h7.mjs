//#region node_modules/.nitro/vite/services/ssr/assets/api-DNcet4h7.js
var API_BASE = "http://localhost:8000".replace(/\/+$/, "");
var TOKEN_KEY = "sic.token";
var USER_KEY = "sic.user";
var tokenStore = {
	get: () => typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY),
	set: (t) => localStorage.setItem(TOKEN_KEY, t),
	clear: () => {
		localStorage.removeItem(TOKEN_KEY);
		localStorage.removeItem(USER_KEY);
	}
};
var userStore = {
	get: () => {
		if (typeof window === "undefined") return null;
		const raw = localStorage.getItem(USER_KEY);
		return raw ? JSON.parse(raw) : null;
	},
	set: (u) => localStorage.setItem(USER_KEY, JSON.stringify(u))
};
var ApiError = class extends Error {
	status;
	body;
	constructor(status, message, body) {
		super(message);
		this.status = status;
		this.body = body;
	}
};
async function api(path, init = {}) {
	const { json, query, headers, ...rest } = init;
	let url = `${API_BASE}${path}`;
	if (query) {
		const qs = new URLSearchParams();
		for (const [k, v] of Object.entries(query)) {
			if (v === void 0 || v === null || v === "") continue;
			qs.append(k, String(v));
		}
		const s = qs.toString();
		if (s) url += `?${s}`;
	}
	const token = tokenStore.get();
	const h = {
		Accept: "application/json",
		...headers
	};
	if (json !== void 0) h["Content-Type"] = "application/json";
	if (token) h["Authorization"] = `Bearer ${token}`;
	const res = await fetch(url, {
		...rest,
		headers: h,
		body: json !== void 0 ? JSON.stringify(json) : rest.body
	});
	if (res.status === 204) return void 0;
	const data = (res.headers.get("content-type") ?? "").includes("application/json") ? await res.json() : await res.text();
	if (!res.ok) {
		if (res.status === 401) {
			tokenStore.clear();
			if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) window.location.assign("/login");
		}
		const msg = (typeof data === "object" && data && "detail" in data ? String(data.detail) : typeof data === "string" ? data : res.statusText) || "Request failed";
		throw new ApiError(res.status, msg, data);
	}
	return data;
}
//#endregion
export { tokenStore as n, userStore as r, api as t };
