globalThis.__nitro_main__ = import.meta.url;
import { a as toEventHandler, c as NodeResponse, i as defineLazyEventHandler, l as serve, n as HTTPError, r as defineHandler, t as H3Core } from "./_libs/h3+rou3+srvx.mjs";
import { i as withoutTrailingSlash, n as joinURL, r as withLeadingSlash, t as decodePath } from "./_libs/ufo.mjs";
import { promises } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
//#region #nitro-vite-setup
function lazyService(loader) {
	let promise, mod;
	return { fetch(req) {
		if (mod) return mod.fetch(req);
		if (!promise) promise = loader().then((_mod) => mod = _mod.default || _mod);
		return promise.then((mod) => mod.fetch(req));
	} };
}
var services = { ["ssr"]: lazyService(() => import("./_ssr/ssr.mjs")) };
globalThis.__nitro_vite_envs__ = services;
//#endregion
//#region node_modules/nitro/dist/runtime/internal/route-rules.mjs
var headers = ((m) => function headersRouteRule(event) {
	for (const [key, value] of Object.entries(m.options || {})) event.res.headers.set(key, value);
});
//#endregion
//#region #nitro/virtual/public-assets-data
var public_assets_data_default = {
	"/assets/_app-DvBZmTJ8.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2338-lSIQ9w74z18vb//+R5P0gRgq6cc\"",
		"mtime": "2026-06-30T12:48:47.176Z",
		"size": 9016,
		"path": "../public/assets/_app-DvBZmTJ8.js"
	},
	"/assets/_app.block-storages-q_paMqxs.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a4f-yg3XC++pNjCAP5s7Yd00d/D6lho\"",
		"mtime": "2026-06-30T12:48:47.177Z",
		"size": 2639,
		"path": "../public/assets/_app.block-storages-q_paMqxs.js"
	},
	"/assets/_app.credentials-CfXJ0WI9.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"18b5-zFT+iQ4EonBussoB7w0FBjmNqd4\"",
		"mtime": "2026-06-30T12:48:47.177Z",
		"size": 6325,
		"path": "../public/assets/_app.credentials-CfXJ0WI9.js"
	},
	"/assets/_app.crons-CdUIozQN.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"e61-EcL2edzmCVEVOec0D4uQLl/PGXs\"",
		"mtime": "2026-06-30T12:48:47.177Z",
		"size": 3681,
		"path": "../public/assets/_app.crons-CdUIozQN.js"
	},
	"/assets/_app.dashboard-BZy-ZbJK.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1569-KjJUUsGN96dOSWMZu6WXSvbX0Nw\"",
		"mtime": "2026-06-30T12:48:47.177Z",
		"size": 5481,
		"path": "../public/assets/_app.dashboard-BZy-ZbJK.js"
	},
	"/assets/_app.databases-BKrJ9JK7.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ae5-fBRnwuIKoSRjap7dx4F3NOorow8\"",
		"mtime": "2026-06-30T12:48:47.177Z",
		"size": 2789,
		"path": "../public/assets/_app.databases-BKrJ9JK7.js"
	},
	"/assets/_app.kubernetes-R4ocSKkB.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a5f-Q2qqH5ocZrQEgDw3Kh2KrKUhofk\"",
		"mtime": "2026-06-30T12:48:47.177Z",
		"size": 2655,
		"path": "../public/assets/_app.kubernetes-R4ocSKkB.js"
	},
	"/assets/_app.resource-map-EVbl-Q1Y.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"b31-QtxDg54tBwd1I4AiiytyEP6m4gc\"",
		"mtime": "2026-06-30T12:48:47.177Z",
		"size": 2865,
		"path": "../public/assets/_app.resource-map-EVbl-Q1Y.js"
	},
	"/assets/_app.servers-CuWBiUli.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"258f-7vQJV8M5ewAeRPTk0HbsYBzFC7I\"",
		"mtime": "2026-06-30T12:48:47.177Z",
		"size": 9615,
		"path": "../public/assets/_app.servers-CuWBiUli.js"
	},
	"/assets/_app.settings-D4TVOgzd.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ad6-h1OsiMHb0T2sf7lsc+Ml2K0Z6pY\"",
		"mtime": "2026-06-30T12:48:47.178Z",
		"size": 2774,
		"path": "../public/assets/_app.settings-D4TVOgzd.js"
	},
	"/assets/_app.ssh-keys-Dgg1k710.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1a0f-Sd3uzH7ZAbDyDBvBvTa33xSt0k0\"",
		"mtime": "2026-06-30T12:48:47.178Z",
		"size": 6671,
		"path": "../public/assets/_app.ssh-keys-Dgg1k710.js"
	},
	"/assets/_app.sync-CH3fO0Zd.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"99c-s+wYc2sdnJ5r3I6CAz+TpfKThqw\"",
		"mtime": "2026-06-30T12:48:47.178Z",
		"size": 2460,
		"path": "../public/assets/_app.sync-CH3fO0Zd.js"
	},
	"/assets/_app.users-BsyoJrEz.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"14a5-mOj7i72WX8wa9vvnyaGSonO/wNs\"",
		"mtime": "2026-06-30T12:48:47.178Z",
		"size": 5285,
		"path": "../public/assets/_app.users-BsyoJrEz.js"
	},
	"/assets/api-DMDcz0EY.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"260a-h8zWul8LQuZAj2c/pF/WrHYlqsw\"",
		"mtime": "2026-06-30T12:48:47.178Z",
		"size": 9738,
		"path": "../public/assets/api-DMDcz0EY.js"
	},
	"/assets/createLucideIcon-CUzezwZM.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4a3-0+wDEkORfvpdxALbolX1ORxZOKU\"",
		"mtime": "2026-06-30T12:48:47.178Z",
		"size": 1187,
		"path": "../public/assets/createLucideIcon-CUzezwZM.js"
	},
	"/assets/dist-DKXig8Tg.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7f37-8JEuBFFdWEZrQYkjwAr2hxCfY5Q\"",
		"mtime": "2026-06-30T12:48:47.178Z",
		"size": 32567,
		"path": "../public/assets/dist-DKXig8Tg.js"
	},
	"/assets/formatDistanceToNow-KEGwCsOU.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"257d-gC3Gz3IawDSs9uPxCq2Olph+cbA\"",
		"mtime": "2026-06-30T12:48:47.178Z",
		"size": 9597,
		"path": "../public/assets/formatDistanceToNow-KEGwCsOU.js"
	},
	"/assets/login-Bx02-B1L.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"faf-o3vXCgEYpcVD91ot5VgNpLFOOe4\"",
		"mtime": "2026-06-30T12:48:47.178Z",
		"size": 4015,
		"path": "../public/assets/login-Bx02-B1L.js"
	},
	"/assets/plus-DW6EwzOH.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"99-tDNU10fIxQ4T5Y7VXJ7mjqIy7N8\"",
		"mtime": "2026-06-30T12:48:47.178Z",
		"size": 153,
		"path": "../public/assets/plus-DW6EwzOH.js"
	},
	"/assets/power-CavRjOPv.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ad-wRb3p47kWO876BRqpt8GCFdPibY\"",
		"mtime": "2026-06-30T12:48:47.178Z",
		"size": 173,
		"path": "../public/assets/power-CavRjOPv.js"
	},
	"/assets/refresh-cw-C4rxkooA.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"141-CVyuezxhrDzB2r8PtR25JaGa2Ew\"",
		"mtime": "2026-06-30T12:48:47.178Z",
		"size": 321,
		"path": "../public/assets/refresh-cw-C4rxkooA.js"
	},
	"/assets/index-DmXax9Vv.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5367a-EJ3t123d5fMXWakmJQuwmQ7OQSI\"",
		"mtime": "2026-06-30T12:48:47.175Z",
		"size": 341626,
		"path": "../public/assets/index-DmXax9Vv.js"
	},
	"/assets/routes-DJ7LAi8J.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"26-SoFMfAHVJ5oqB5t+mpFRoQvFIoc\"",
		"mtime": "2026-06-30T12:48:47.178Z",
		"size": 38,
		"path": "../public/assets/routes-DJ7LAi8J.js"
	},
	"/assets/sonner-CQC0v3Df.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"214-ia4Sdln5Nn09DrUkZRHNM85xlB4\"",
		"mtime": "2026-06-30T12:48:47.178Z",
		"size": 532,
		"path": "../public/assets/sonner-CQC0v3Df.js"
	},
	"/assets/styles-FVOKeTrS.css": {
		"type": "text/css; charset=utf-8",
		"etag": "\"1223a-9klCQy/ua4boBbhlNFHlv6sYI2s\"",
		"mtime": "2026-06-30T12:48:47.179Z",
		"size": 74298,
		"path": "../public/assets/styles-FVOKeTrS.css"
	},
	"/assets/terminal-B8dc5eIH.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"11b-8sytULm/TOzfWsJUvCWu4+TEMUw\"",
		"mtime": "2026-06-30T12:48:47.178Z",
		"size": 283,
		"path": "../public/assets/terminal-B8dc5eIH.js"
	},
	"/assets/trash-2-DNFDkZcq.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"148-lMKWh0xS8LcUS6mQKYUe8jb60mQ\"",
		"mtime": "2026-06-30T12:48:47.179Z",
		"size": 328,
		"path": "../public/assets/trash-2-DNFDkZcq.js"
	},
	"/assets/ui-bits-BxbbUAod.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"e4f-lqt5jyV1zScSoNRgXCb48atZVAQ\"",
		"mtime": "2026-06-30T12:48:47.179Z",
		"size": 3663,
		"path": "../public/assets/ui-bits-BxbbUAod.js"
	},
	"/assets/useMutation-aYFlMplS.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"8c2-ETbbUMpiu+tbTjOu5HF05NMQ7IE\"",
		"mtime": "2026-06-30T12:48:47.179Z",
		"size": 2242,
		"path": "../public/assets/useMutation-aYFlMplS.js"
	},
	"/assets/useQuery-F3UWe7wr.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"224f-N65tEqa8+yh8ANJQDUM2Btsm3CY\"",
		"mtime": "2026-06-30T12:48:47.179Z",
		"size": 8783,
		"path": "../public/assets/useQuery-F3UWe7wr.js"
	}
};
//#endregion
//#region #nitro/virtual/public-assets-node
function readAsset(id) {
	const serverDir = dirname(fileURLToPath(globalThis.__nitro_main__));
	return promises.readFile(resolve(serverDir, public_assets_data_default[id].path));
}
//#endregion
//#region #nitro/virtual/public-assets
var publicAssetBases = {};
function isPublicAssetURL(id = "") {
	if (public_assets_data_default[id]) return true;
	for (const base in publicAssetBases) if (id.startsWith(base)) return true;
	return false;
}
function getAsset(id) {
	return public_assets_data_default[id];
}
//#endregion
//#region node_modules/nitro/dist/runtime/internal/static.mjs
var METHODS = /* @__PURE__ */ new Set(["HEAD", "GET"]);
var EncodingMap = {
	gzip: ".gz",
	br: ".br",
	zstd: ".zst"
};
var static_default = defineHandler((event) => {
	if (event.req.method && !METHODS.has(event.req.method)) return;
	let id = decodePath(withLeadingSlash(withoutTrailingSlash(event.url.pathname)));
	let asset;
	const encodings = [...(event.req.headers.get("accept-encoding") || "").split(",").map((e) => EncodingMap[e.trim()]).filter(Boolean).sort(), ""];
	for (const encoding of encodings) for (const _id of [id + encoding, joinURL(id, "index.html" + encoding)]) {
		const _asset = getAsset(_id);
		if (_asset) {
			asset = _asset;
			id = _id;
			break;
		}
	}
	if (!asset) {
		if (isPublicAssetURL(id)) {
			event.res.headers.delete("Cache-Control");
			throw new HTTPError({ status: 404 });
		}
		return;
	}
	if (encodings.length > 1) event.res.headers.append("Vary", "Accept-Encoding");
	if (event.req.headers.get("if-none-match") === asset.etag) {
		event.res.status = 304;
		event.res.statusText = "Not Modified";
		return "";
	}
	const ifModifiedSinceH = event.req.headers.get("if-modified-since");
	const mtimeDate = new Date(asset.mtime);
	if (ifModifiedSinceH && asset.mtime && new Date(ifModifiedSinceH) >= mtimeDate) {
		event.res.status = 304;
		event.res.statusText = "Not Modified";
		return "";
	}
	if (asset.type) event.res.headers.set("Content-Type", asset.type);
	if (asset.etag && !event.res.headers.has("ETag")) event.res.headers.set("ETag", asset.etag);
	if (asset.mtime && !event.res.headers.has("Last-Modified")) event.res.headers.set("Last-Modified", mtimeDate.toUTCString());
	if (asset.encoding && !event.res.headers.has("Content-Encoding")) event.res.headers.set("Content-Encoding", asset.encoding);
	if (asset.size > 0 && !event.res.headers.has("Content-Length")) event.res.headers.set("Content-Length", asset.size.toString());
	return readAsset(id);
});
//#endregion
//#region #nitro/virtual/routing
var findRouteRules = /* @__PURE__ */ (() => {
	const $0 = [{
		name: "headers",
		route: "/assets/**",
		handler: headers,
		options: { "cache-control": "public, max-age=31536000, immutable" }
	}];
	return (m, p) => {
		let r = [];
		if (p.charCodeAt(p.length - 1) === 47) p = p.slice(0, -1) || "/";
		let s = p.split("/");
		if (s.length > 1) {
			if (s[1] === "assets") r.unshift({
				data: $0,
				params: { "_": s.slice(2).join("/") }
			});
		}
		return r;
	};
})();
var _lazy_l5pLs0 = defineLazyEventHandler(() => import("./_chunks/ssr-renderer.mjs"));
var findRoute = /* @__PURE__ */ (() => {
	const data = {
		route: "/**",
		handler: _lazy_l5pLs0
	};
	return ((_m, p) => {
		return {
			data,
			params: { "_": p.slice(1) }
		};
	});
})();
var globalMiddleware = [toEventHandler(static_default)].filter(Boolean);
//#endregion
//#region node_modules/nitro/dist/runtime/internal/error/prod.mjs
var errorHandler = (error, event) => {
	const res = defaultHandler(error, event);
	return new NodeResponse(typeof res.body === "string" ? res.body : JSON.stringify(res.body, null, 2), res);
};
function defaultHandler(error, event) {
	const unhandled = error.unhandled ?? !HTTPError.isError(error);
	const { status = 500, statusText = "" } = unhandled ? {} : error;
	if (status === 404) {
		const url = event.url || new URL(event.req.url);
		const baseURL = "/";
		if (/^\/[^/]/.test(baseURL) && !url.pathname.startsWith(baseURL)) return {
			status: 302,
			headers: new Headers({ location: `${baseURL}${url.pathname.slice(1)}${url.search}` })
		};
	}
	const headers = new Headers(unhandled ? {} : error.headers);
	headers.set("content-type", "application/json; charset=utf-8");
	return {
		status,
		statusText,
		headers,
		body: {
			error: true,
			...unhandled ? {
				status,
				unhandled: true
			} : typeof error.toJSON === "function" ? error.toJSON() : {
				status,
				statusText,
				message: error.message
			}
		}
	};
}
//#endregion
//#region #nitro/virtual/error-handler
var errorHandlers = [errorHandler];
async function error_handler_default(error, event) {
	for (const handler of errorHandlers) try {
		const response = await handler(error, event, { defaultHandler });
		if (response) return response;
	} catch (error) {
		console.error(error);
	}
}
//#endregion
//#region #nitro/virtual/app
function createNitroApp() {
	const captureError = (error, errorCtx) => {
		if (errorCtx?.event) {
			const errors = errorCtx.event.req.context?.nitro?.errors;
			if (errors) errors.push({
				error,
				context: errorCtx
			});
		}
	};
	const h3App = createH3App({ onError(error, event) {
		return error_handler_default(error, event);
	} });
	let appHandler = (req) => {
		req.context ||= {};
		req.context.nitro = req.context.nitro || { errors: [] };
		return h3App.fetch(req);
	};
	return {
		fetch: appHandler,
		h3: h3App,
		hooks: void 0,
		captureError
	};
}
function createH3App(config) {
	const h3App = new H3Core(config);
	h3App["~findRoute"] = (event) => findRoute(event.req.method, event.url.pathname);
	h3App["~middleware"].push(...globalMiddleware);
	h3App["~getMiddleware"] = (event, route) => {
		const pathname = event.url.pathname;
		const method = event.req.method;
		const middleware = [];
		const routeRules = getRouteRules(method, pathname);
		event.context.routeRules = routeRules?.routeRules;
		if (routeRules?.routeRuleMiddleware.length) middleware.push(...routeRules.routeRuleMiddleware);
		middleware.push(...h3App["~middleware"]);
		if (route?.data?.middleware?.length) middleware.push(...route.data.middleware);
		return middleware;
	};
	return h3App;
}
//#endregion
//#region node_modules/nitro/dist/runtime/internal/app.mjs
var APP_ID = "default";
function useNitroApp() {
	let instance = useNitroApp._instance;
	if (instance) return instance;
	instance = useNitroApp._instance = createNitroApp();
	globalThis.__nitro__ = globalThis.__nitro__ || {};
	globalThis.__nitro__[APP_ID] = instance;
	return instance;
}
function getRouteRules(method, pathname) {
	const m = findRouteRules(method, pathname);
	if (!m?.length) return { routeRuleMiddleware: [] };
	const routeRules = {};
	for (const layer of m) for (const rule of layer.data) {
		const currentRule = routeRules[rule.name];
		if (currentRule) {
			if (rule.options === false) {
				delete routeRules[rule.name];
				continue;
			}
			if (typeof currentRule.options === "object" && typeof rule.options === "object") currentRule.options = {
				...currentRule.options,
				...rule.options
			};
			else currentRule.options = rule.options;
			currentRule.route = rule.route;
			currentRule.params = {
				...currentRule.params,
				...layer.params
			};
		} else if (rule.options !== false) routeRules[rule.name] = {
			...rule,
			params: layer.params
		};
	}
	const middleware = [];
	const orderedRules = Object.values(routeRules).sort((a, b) => (a.handler?.order || 0) - (b.handler?.order || 0));
	for (const rule of orderedRules) {
		if (rule.options === false || !rule.handler) continue;
		middleware.push(rule.handler(rule));
	}
	return {
		routeRules,
		routeRuleMiddleware: middleware
	};
}
//#endregion
//#region node_modules/nitro/dist/runtime/internal/error/hooks.mjs
function _captureError(error, type) {
	console.error(`[${type}]`, error);
	useNitroApp().captureError?.(error, { tags: [type] });
}
function trapUnhandledErrors() {
	process.on("unhandledRejection", (error) => _captureError(error, "unhandledRejection"));
	process.on("uncaughtException", (error) => _captureError(error, "uncaughtException"));
}
//#endregion
//#region #nitro/virtual/tracing
var tracingSrvxPlugins = [];
//#endregion
//#region node_modules/nitro/dist/presets/node/runtime/node-server.mjs
var _parsedPort = Number.parseInt(process.env.NITRO_PORT ?? process.env.PORT ?? "");
var port = Number.isNaN(_parsedPort) ? 3e3 : _parsedPort;
var host = process.env.NITRO_HOST || process.env.HOST;
var cert = process.env.NITRO_SSL_CERT;
var key = process.env.NITRO_SSL_KEY;
var nitroApp = useNitroApp();
serve({
	port,
	hostname: host,
	tls: cert && key ? {
		cert,
		key
	} : void 0,
	fetch: nitroApp.fetch,
	plugins: [...tracingSrvxPlugins]
});
trapUnhandledErrors();
var node_server_default = {};
//#endregion
export { node_server_default as default };
