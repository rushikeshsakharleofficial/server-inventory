globalThis.__nitro_main__ = import.meta.url;
import { a as FastResponse, n as HTTPError, r as defineLazyEventHandler, t as H3Core } from "./_libs/h3+rou3+srvx.mjs";
import { t as HookableCore } from "./_libs/hookable.mjs";
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
//#region #nitro/virtual/public-assets-data
var public_assets_data_default = {
	"/providers/aws.png": {
		"type": "image/png",
		"etag": "\"3996-PHk9HbboojRUU8weH/gje2LBhH8\"",
		"mtime": "2026-07-01T11:09:56.367Z",
		"size": 14742,
		"path": "../public/providers/aws.png"
	},
	"/providers/azure.png": {
		"type": "image/png",
		"etag": "\"1553-oFGB8SIDw4/LXRrRLyiX/AtPqZA\"",
		"mtime": "2026-07-01T11:09:56.368Z",
		"size": 5459,
		"path": "../public/providers/azure.png"
	},
	"/providers/digitalocean.png": {
		"type": "image/png",
		"etag": "\"2064-Wgt26go1kapL0yv8/LO1+rfQYZ4\"",
		"mtime": "2026-07-01T11:09:56.367Z",
		"size": 8292,
		"path": "../public/providers/digitalocean.png"
	},
	"/providers/gcp.png": {
		"type": "image/png",
		"etag": "\"926f-fqPwH/AcIdj5FRx4bjywEd6Ddg4\"",
		"mtime": "2026-07-01T11:09:56.368Z",
		"size": 37487,
		"path": "../public/providers/gcp.png"
	},
	"/providers/hivelocity.png": {
		"type": "image/png",
		"etag": "\"248-Spb51JADl/VWsi+pfEWsBSGF+Lo\"",
		"mtime": "2026-07-01T11:09:56.370Z",
		"size": 584,
		"path": "../public/providers/hivelocity.png"
	},
	"/providers/linode.png": {
		"type": "image/png",
		"etag": "\"1c63-8NmruuGfbHfD+/isOL+WbKfO0q4\"",
		"mtime": "2026-07-01T11:09:56.369Z",
		"size": 7267,
		"path": "../public/providers/linode.png"
	},
	"/providers/ovh.png": {
		"type": "image/png",
		"etag": "\"17b41-2hESuI5jPWP7lLojwwjqTszh2Lo\"",
		"mtime": "2026-07-01T11:09:56.369Z",
		"size": 97089,
		"path": "../public/providers/ovh.png"
	},
	"/assets/_app.block-storages-n1YGih08.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a56-RQjUU3tDfwde1FHpI+oKe4cRBgA\"",
		"mtime": "2026-07-01T11:09:54.727Z",
		"size": 2646,
		"path": "../public/assets/_app.block-storages-n1YGih08.js"
	},
	"/assets/_app-CQzTcUSH.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"10c12-reGzI0Emobtf+qKfpYfykwuYBIA\"",
		"mtime": "2026-07-01T11:09:54.727Z",
		"size": 68626,
		"path": "../public/assets/_app-CQzTcUSH.js"
	},
	"/assets/_app.cloud-providers-CY62W_6c.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"277f-Iy2CGoaS768bN22UmcIQZHRAKYQ\"",
		"mtime": "2026-07-01T11:09:54.727Z",
		"size": 10111,
		"path": "../public/assets/_app.cloud-providers-CY62W_6c.js"
	},
	"/assets/_app.crons-B2ZkDYk0.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1bcd-lnLbz9JxjoDUvoqMONbH9dtLQaQ\"",
		"mtime": "2026-07-01T11:09:54.728Z",
		"size": 7117,
		"path": "../public/assets/_app.crons-B2ZkDYk0.js"
	},
	"/assets/_app.databases-BnL4LBhL.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"b1b-UPbu34UjOADFDVt6PBbvGBJ9scA\"",
		"mtime": "2026-07-01T11:09:54.728Z",
		"size": 2843,
		"path": "../public/assets/_app.databases-BnL4LBhL.js"
	},
	"/assets/_app.dashboard-CPsZA1Hd.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"b2e1-mCAiAINxdOzlW0LDrzW4DEga7wA\"",
		"mtime": "2026-07-01T11:09:54.728Z",
		"size": 45793,
		"path": "../public/assets/_app.dashboard-CPsZA1Hd.js"
	},
	"/assets/_app.kubernetes-Bo8PCacf.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"b14-G2JLVBA5Uz832l1JcskW6nHyu6Y\"",
		"mtime": "2026-07-01T11:09:54.728Z",
		"size": 2836,
		"path": "../public/assets/_app.kubernetes-Bo8PCacf.js"
	},
	"/assets/CartesianChart-Bg0j6DVW.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"525ad-FHn3wEo4tWQusKPKppkyM85M9rU\"",
		"mtime": "2026-07-01T11:09:54.726Z",
		"size": 337325,
		"path": "../public/assets/CartesianChart-Bg0j6DVW.js"
	},
	"/assets/_app.policies-BI13FyOE.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1a52-gEBUmJE284Q7CKcnqo7NKsMm6IQ\"",
		"mtime": "2026-07-01T11:09:54.728Z",
		"size": 6738,
		"path": "../public/assets/_app.policies-BI13FyOE.js"
	},
	"/assets/_app.policies._slug-Cz137KSo.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1441-4BYNdtpaJUKSXW1KW66wZG/sCRg\"",
		"mtime": "2026-07-01T11:09:54.728Z",
		"size": 5185,
		"path": "../public/assets/_app.policies._slug-Cz137KSo.js"
	},
	"/assets/_app.server-detail._id-CLqQPmmf.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"242e-EDdeVrM3pCbYLSotd7IhnRQoBq8\"",
		"mtime": "2026-07-01T11:09:54.728Z",
		"size": 9262,
		"path": "../public/assets/_app.server-detail._id-CLqQPmmf.js"
	},
	"/assets/_app.servers-CM-1LASU.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3246-LWjb7mmBFXoQx1MkHCMZDBXZDCs\"",
		"mtime": "2026-07-01T11:09:54.728Z",
		"size": 12870,
		"path": "../public/assets/_app.servers-CM-1LASU.js"
	},
	"/assets/_app.resource-map-B7Eoq6GO.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2af06-TAOqajJy5mOyGNd6LTa2v2873U4\"",
		"mtime": "2026-07-01T11:09:54.728Z",
		"size": 175878,
		"path": "../public/assets/_app.resource-map-B7Eoq6GO.js"
	},
	"/assets/_app.ssh-keys-C-NKF9nl.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1ff5-KnmxEhcY0SNgE31Qs8NZTc3Jthc\"",
		"mtime": "2026-07-01T11:09:54.729Z",
		"size": 8181,
		"path": "../public/assets/_app.ssh-keys-C-NKF9nl.js"
	},
	"/assets/_app.settings-DiDsm3HV.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5f29-HOhA7AUNqLjHsSLiTsCBofG05qg\"",
		"mtime": "2026-07-01T11:09:54.729Z",
		"size": 24361,
		"path": "../public/assets/_app.settings-DiDsm3HV.js"
	},
	"/assets/_app.stats-BpfD_cJL.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"9fa7-73HDCeJ0nqbqe0A9yv02iXw3LF8\"",
		"mtime": "2026-07-01T11:09:54.729Z",
		"size": 40871,
		"path": "../public/assets/_app.stats-BpfD_cJL.js"
	},
	"/assets/_app.sync-CceAwSgX.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"995-S3Rm6+6i2ZgKBxy0zhn3RuNKJlI\"",
		"mtime": "2026-07-01T11:09:54.729Z",
		"size": 2453,
		"path": "../public/assets/_app.sync-CceAwSgX.js"
	},
	"/assets/_app.users-CvitYsqs.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"13f8-gO/oPlZ2fdUQy1REhG3zZ3xyb3Y\"",
		"mtime": "2026-07-01T11:09:54.729Z",
		"size": 5112,
		"path": "../public/assets/_app.users-CvitYsqs.js"
	},
	"/assets/api-B8ojn3kB.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2690-/3CcfSnlhEEfEdOyHCVPp/u8HHg\"",
		"mtime": "2026-07-01T11:09:54.729Z",
		"size": 9872,
		"path": "../public/assets/api-B8ojn3kB.js"
	},
	"/assets/arrow-left-DXxNfrPH.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a5-Ht7Z6L4xe7euCRqUMAKAiDywO68\"",
		"mtime": "2026-07-01T11:09:54.729Z",
		"size": 165,
		"path": "../public/assets/arrow-left-DXxNfrPH.js"
	},
	"/assets/createLucideIcon-DfbKd86u.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"26af-4pbEvwibVpmgoBDdw9mMHC8mnJQ\"",
		"mtime": "2026-07-01T11:09:54.729Z",
		"size": 9903,
		"path": "../public/assets/createLucideIcon-DfbKd86u.js"
	},
	"/assets/dist-2qilgQUz.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7f3b-bPuS7AIL2Jg3mgz0eSFsR1/LNjg\"",
		"mtime": "2026-07-01T11:09:54.729Z",
		"size": 32571,
		"path": "../public/assets/dist-2qilgQUz.js"
	},
	"/assets/_app.users-groups-x4V9iui8.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"357e-IYAdfWQYIFIVk+7/bBcoodG+JfI\"",
		"mtime": "2026-07-01T11:09:54.729Z",
		"size": 13694,
		"path": "../public/assets/_app.users-groups-x4V9iui8.js"
	},
	"/assets/formatDistanceToNow-KEGwCsOU.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"257d-gC3Gz3IawDSs9uPxCq2Olph+cbA\"",
		"mtime": "2026-07-01T11:09:54.729Z",
		"size": 9597,
		"path": "../public/assets/formatDistanceToNow-KEGwCsOU.js"
	},
	"/assets/index-DtxX27Jz.css": {
		"type": "text/css; charset=utf-8",
		"etag": "\"3c35-GybETsF6L6PuXEMieWyMg/5Dn7o\"",
		"mtime": "2026-07-01T11:09:54.730Z",
		"size": 15413,
		"path": "../public/assets/index-DtxX27Jz.css"
	},
	"/assets/link-BJ6C5Q1z.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"52ec-GL+Donxn0HjCOFIrkObXqx2LU5c\"",
		"mtime": "2026-07-01T11:09:54.729Z",
		"size": 21228,
		"path": "../public/assets/link-BJ6C5Q1z.js"
	},
	"/assets/login-DKESctBZ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"112c-4N/a9mC/G9qfq+9/6xKUL1jY+Ik\"",
		"mtime": "2026-07-01T11:09:54.729Z",
		"size": 4396,
		"path": "../public/assets/login-DKESctBZ.js"
	},
	"/assets/pencil-BTHaatFW.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"114-1OedOiw0TmN/Dfvyclfs/MI2KEY\"",
		"mtime": "2026-07-01T11:09:54.729Z",
		"size": 276,
		"path": "../public/assets/pencil-BTHaatFW.js"
	},
	"/assets/plus-CxFvLJpY.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"99-uLMm9xwAniS/0ie8gfArtk73Z8k\"",
		"mtime": "2026-07-01T11:09:54.730Z",
		"size": 153,
		"path": "../public/assets/plus-CxFvLJpY.js"
	},
	"/assets/power-DePhFsxt.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ad-T+NpMFrs6PT7B+VsH68zbexBBA8\"",
		"mtime": "2026-07-01T11:09:54.730Z",
		"size": 173,
		"path": "../public/assets/power-DePhFsxt.js"
	},
	"/assets/react-dom-B5F4EstY.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"dd2-2ZfJKYqcWThkFS3N+SRy7FQBeZE\"",
		"mtime": "2026-07-01T11:09:54.730Z",
		"size": 3538,
		"path": "../public/assets/react-dom-B5F4EstY.js"
	},
	"/assets/refresh-cw-DDSvaVGb.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"141-TRulnnSuSBLyZeWfjmrahl8T38o\"",
		"mtime": "2026-07-01T11:09:54.730Z",
		"size": 321,
		"path": "../public/assets/refresh-cw-DDSvaVGb.js"
	},
	"/assets/index-6odEdXgW.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4d516-XWGreBvrtkY6cVgWh1Eq1rtw544\"",
		"mtime": "2026-07-01T11:09:54.725Z",
		"size": 316694,
		"path": "../public/assets/index-6odEdXgW.js"
	},
	"/assets/routes-DJ7LAi8J.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"26-SoFMfAHVJ5oqB5t+mpFRoQvFIoc\"",
		"mtime": "2026-07-01T11:09:54.730Z",
		"size": 38,
		"path": "../public/assets/routes-DJ7LAi8J.js"
	},
	"/assets/search-akxP9aHt.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ae-sm3TeAj9SO6m3ZXemqLwd/W7o0Y\"",
		"mtime": "2026-07-01T11:09:54.730Z",
		"size": 174,
		"path": "../public/assets/search-akxP9aHt.js"
	},
	"/assets/sonner-3rvZOtra.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"214-EGrFVKfjnfmHdJaCw4Uoq/UXLpM\"",
		"mtime": "2026-07-01T11:09:54.730Z",
		"size": 532,
		"path": "../public/assets/sonner-3rvZOtra.js"
	},
	"/assets/terminal-B83zqVfv.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1ed-jlMQmhbowUusGgxwPlPrLqH51as\"",
		"mtime": "2026-07-01T11:09:54.730Z",
		"size": 493,
		"path": "../public/assets/terminal-B83zqVfv.js"
	},
	"/assets/styles-b3e4L__A.css": {
		"type": "text/css; charset=utf-8",
		"etag": "\"9564-OrldpLG7xZv1ObKSKY62j+lLM74\"",
		"mtime": "2026-07-01T11:09:54.730Z",
		"size": 38244,
		"path": "../public/assets/styles-b3e4L__A.css"
	},
	"/assets/trash-2-BqfQ2Be6.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"148-qLpWUREmGArGPm1bAuUL9rNX1iA\"",
		"mtime": "2026-07-01T11:09:54.730Z",
		"size": 328,
		"path": "../public/assets/trash-2-BqfQ2Be6.js"
	},
	"/assets/ui-bits-CPp_VTZt.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"194d-QP4nbw4U0MQHY2+BWTynB0NHTmY\"",
		"mtime": "2026-07-01T11:09:54.730Z",
		"size": 6477,
		"path": "../public/assets/ui-bits-CPp_VTZt.js"
	},
	"/assets/useMatch-7SLysEPh.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4c3-lkKweNI5j4WhCXDtOCjH2THJ6kg\"",
		"mtime": "2026-07-01T11:09:54.730Z",
		"size": 1219,
		"path": "../public/assets/useMatch-7SLysEPh.js"
	},
	"/assets/useMutation-BMpuH1RZ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"8bd-NzeIZIk7iUivBQMCeYApawWZKSA\"",
		"mtime": "2026-07-01T11:09:54.730Z",
		"size": 2237,
		"path": "../public/assets/useMutation-BMpuH1RZ.js"
	},
	"/assets/useRouter-CRDlsBX2.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2aa-EUi1UQrVqotr05hzImxEFQbLyok\"",
		"mtime": "2026-07-01T11:09:54.730Z",
		"size": 682,
		"path": "../public/assets/useRouter-CRDlsBX2.js"
	},
	"/assets/with-selector-C8e8WFcI.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"652-+7RdCd7WDbv1Q+CcJePYpj0jA7U\"",
		"mtime": "2026-07-01T11:09:54.730Z",
		"size": 1618,
		"path": "../public/assets/with-selector-C8e8WFcI.js"
	},
	"/assets/x-BVPlikL0.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"9a-04PHssSR0aXSqL3tH79vFUH4AO0\"",
		"mtime": "2026-07-01T11:09:54.730Z",
		"size": 154,
		"path": "../public/assets/x-BVPlikL0.js"
	},
	"/assets/value-8xOwwyZS.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"240f-/DipoiEUn8kF+0SHdlPBgNNu6Tk\"",
		"mtime": "2026-07-01T11:09:54.730Z",
		"size": 9231,
		"path": "../public/assets/value-8xOwwyZS.js"
	}
};
//#endregion
//#region #nitro/virtual/public-assets
var publicAssetBases = {};
function isPublicAssetURL(id = "") {
	if (public_assets_data_default[id]) return true;
	for (const base in publicAssetBases) if (id.startsWith(base)) return true;
	return false;
}
//#endregion
//#region node_modules/nitro/dist/runtime/internal/route-rules.mjs
var headers = ((m) => function headersRouteRule(event) {
	for (const [key, value] of Object.entries(m.options || {})) event.res.headers.set(key, value);
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
[].filter(Boolean);
//#endregion
//#region node_modules/nitro/dist/runtime/internal/error/prod.mjs
var errorHandler = (error, event) => {
	const res = defaultHandler(error, event);
	return new FastResponse(typeof res.body === "string" ? res.body : JSON.stringify(res.body, null, 2), res);
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
	h3App["~getMiddleware"] = (event, route) => {
		const pathname = event.url.pathname;
		const method = event.req.method;
		const middleware = [];
		const routeRules = getRouteRules(method, pathname);
		event.context.routeRules = routeRules?.routeRules;
		if (routeRules?.routeRuleMiddleware.length) middleware.push(...routeRules.routeRuleMiddleware);
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
function useNitroHooks() {
	const nitroApp = useNitroApp();
	const hooks = nitroApp.hooks;
	if (hooks) return hooks;
	return nitroApp.hooks = new HookableCore();
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
//#region node_modules/nitro/dist/presets/cloudflare/runtime/_module-handler.mjs
function createHandler(hooks) {
	const nitroApp = useNitroApp();
	const nitroHooks = useNitroHooks();
	return {
		async fetch(request, env, context) {
			globalThis.__env__ = env;
			augmentReq(request, {
				env,
				context
			});
			const ctxExt = {};
			const url = new URL(request.url);
			if (hooks.fetch) {
				const res = await hooks.fetch(request, env, context, url, ctxExt);
				if (res) return res;
			}
			return await nitroApp.fetch(request);
		},
		scheduled(controller, env, context) {
			globalThis.__env__ = env;
			context.waitUntil(nitroHooks.callHook("cloudflare:scheduled", {
				controller,
				env,
				context
			}) || Promise.resolve());
		},
		email(message, env, context) {
			globalThis.__env__ = env;
			context.waitUntil(nitroHooks.callHook("cloudflare:email", {
				message,
				event: message,
				env,
				context
			}) || Promise.resolve());
		},
		queue(batch, env, context) {
			globalThis.__env__ = env;
			context.waitUntil(nitroHooks.callHook("cloudflare:queue", {
				batch,
				event: batch,
				env,
				context
			}) || Promise.resolve());
		},
		tail(traces, env, context) {
			globalThis.__env__ = env;
			context.waitUntil(nitroHooks.callHook("cloudflare:tail", {
				traces,
				env,
				context
			}) || Promise.resolve());
		},
		trace(traces, env, context) {
			globalThis.__env__ = env;
			context.waitUntil(nitroHooks.callHook("cloudflare:trace", {
				traces,
				env,
				context
			}) || Promise.resolve());
		}
	};
}
function augmentReq(cfReq, ctx) {
	const req = cfReq;
	req.ip = cfReq.headers.get("cf-connecting-ip") || void 0;
	req.runtime ??= { name: "cloudflare" };
	req.runtime.cloudflare = {
		...req.runtime.cloudflare,
		...ctx
	};
	req.waitUntil = ctx.context?.waitUntil.bind(ctx.context);
}
//#endregion
//#region node_modules/nitro/dist/presets/cloudflare/runtime/cloudflare-module.mjs
var cloudflare_module_default = createHandler({ fetch(cfRequest, env, context, url) {
	if (env.ASSETS && isPublicAssetURL(url.pathname)) return env.ASSETS.fetch(cfRequest);
} });
//#endregion
export { cloudflare_module_default as default };
