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
	"/providers/azure.png": {
		"type": "image/png",
		"etag": "\"1553-oFGB8SIDw4/LXRrRLyiX/AtPqZA\"",
		"mtime": "2026-07-02T12:17:03.351Z",
		"size": 5459,
		"path": "../public/providers/azure.png"
	},
	"/providers/digitalocean.png": {
		"type": "image/png",
		"etag": "\"2064-Wgt26go1kapL0yv8/LO1+rfQYZ4\"",
		"mtime": "2026-07-02T12:17:03.353Z",
		"size": 8292,
		"path": "../public/providers/digitalocean.png"
	},
	"/providers/gcp.png": {
		"type": "image/png",
		"etag": "\"926f-fqPwH/AcIdj5FRx4bjywEd6Ddg4\"",
		"mtime": "2026-07-02T12:17:03.351Z",
		"size": 37487,
		"path": "../public/providers/gcp.png"
	},
	"/providers/hivelocity.png": {
		"type": "image/png",
		"etag": "\"248-Spb51JADl/VWsi+pfEWsBSGF+Lo\"",
		"mtime": "2026-07-02T12:17:03.351Z",
		"size": 584,
		"path": "../public/providers/hivelocity.png"
	},
	"/providers/linode.png": {
		"type": "image/png",
		"etag": "\"1c63-8NmruuGfbHfD+/isOL+WbKfO0q4\"",
		"mtime": "2026-07-02T12:17:03.352Z",
		"size": 7267,
		"path": "../public/providers/linode.png"
	},
	"/providers/ovh.png": {
		"type": "image/png",
		"etag": "\"17b41-2hESuI5jPWP7lLojwwjqTszh2Lo\"",
		"mtime": "2026-07-02T12:17:03.353Z",
		"size": 97089,
		"path": "../public/providers/ovh.png"
	},
	"/assets/AreaChart-CXNoOBgG.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"6198-TrjzDfv6T4+K1+/JVg9cZUVJk2I\"",
		"mtime": "2026-07-02T12:16:58.712Z",
		"size": 24984,
		"path": "../public/assets/AreaChart-CXNoOBgG.js"
	},
	"/assets/CartesianChart-BJby2xvE.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4f227-IsrPVO5LsiTkKRPhlQ4tmJTePoE\"",
		"mtime": "2026-07-02T12:16:58.713Z",
		"size": 324135,
		"path": "../public/assets/CartesianChart-BJby2xvE.js"
	},
	"/assets/ErrorBarContext-DvI2a45Q.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2a6-P4OCCpRJ0C8akZd9z/pS4qC9fJ0\"",
		"mtime": "2026-07-02T12:16:58.714Z",
		"size": 678,
		"path": "../public/assets/ErrorBarContext-DvI2a45Q.js"
	},
	"/assets/PieChart-N1mOpWyB.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4472-E4KsWHQvPb8Za/EmmsZeyLH3tiA\"",
		"mtime": "2026-07-02T12:16:58.714Z",
		"size": 17522,
		"path": "../public/assets/PieChart-N1mOpWyB.js"
	},
	"/assets/_app-DKkSRnTh.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"108ea-McJ0JCAJLdzn8ZnjqFfth0bzWKE\"",
		"mtime": "2026-07-02T12:16:58.715Z",
		"size": 67818,
		"path": "../public/assets/_app-DKkSRnTh.js"
	},
	"/assets/_app.block-storages-CC9mk9Ji.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"e46-o1LAQmrvWZ2gNdDv1Rgcl0fpA9w\"",
		"mtime": "2026-07-02T12:16:58.715Z",
		"size": 3654,
		"path": "../public/assets/_app.block-storages-CC9mk9Ji.js"
	},
	"/assets/_app.cloud-providers-B2ad7TWm.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2a7c-PfNigqSWlYbs5ax3QQv73dGWSz0\"",
		"mtime": "2026-07-02T12:16:58.715Z",
		"size": 10876,
		"path": "../public/assets/_app.cloud-providers-B2ad7TWm.js"
	},
	"/assets/_app.crons-C2f_Lh7H.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1dd1-lhQKOGDbqV2v8wNHSF+GiW4wTS8\"",
		"mtime": "2026-07-02T12:16:58.715Z",
		"size": 7633,
		"path": "../public/assets/_app.crons-C2f_Lh7H.js"
	},
	"/assets/_app.dashboard-CB-jRgO3.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7f1e-lfsGmE6Icqs0GhijbuBe98zI/5g\"",
		"mtime": "2026-07-02T12:16:58.715Z",
		"size": 32542,
		"path": "../public/assets/_app.dashboard-CB-jRgO3.js"
	},
	"/assets/_app.databases-wV8B0d5T.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"f5b-4E1W9U9DZC7K2C/uA+IcW6bPnmg\"",
		"mtime": "2026-07-02T12:16:58.715Z",
		"size": 3931,
		"path": "../public/assets/_app.databases-wV8B0d5T.js"
	},
	"/assets/_app.event-logs-DSFmdYTk.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4f4e-HzArwDbBYlKEhGu9Bu/MUK8op0w\"",
		"mtime": "2026-07-02T12:16:58.715Z",
		"size": 20302,
		"path": "../public/assets/_app.event-logs-DSFmdYTk.js"
	},
	"/assets/_app.ips-yJBFHnSY.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"b85-yT3SlL3l1/XApxgVtZsnvK/5yS4\"",
		"mtime": "2026-07-02T12:16:58.727Z",
		"size": 2949,
		"path": "../public/assets/_app.ips-yJBFHnSY.js"
	},
	"/assets/_app.kubernetes-Cxy48GK6.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ef3-Rws0Mb7jGnyBXHvYFbJrAkkwlkc\"",
		"mtime": "2026-07-02T12:16:58.728Z",
		"size": 3827,
		"path": "../public/assets/_app.kubernetes-Cxy48GK6.js"
	},
	"/assets/_app.policies-Dd8PC4xu.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1d95-O3aTfBvf2H4zaG6EHlEVMvmKwtI\"",
		"mtime": "2026-07-02T12:16:58.728Z",
		"size": 7573,
		"path": "../public/assets/_app.policies-Dd8PC4xu.js"
	},
	"/assets/_app.policies._slug-BRm16_QR.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1465-/MZ+RHg8zuiqvyQf2trGBodeSVY\"",
		"mtime": "2026-07-02T12:16:58.728Z",
		"size": 5221,
		"path": "../public/assets/_app.policies._slug-BRm16_QR.js"
	},
	"/assets/_app.provider-credentials-BdrSDzkB.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7a7c-HkI4833gacOfFWlQr/2+qAScSb0\"",
		"mtime": "2026-07-02T12:16:58.728Z",
		"size": 31356,
		"path": "../public/assets/_app.provider-credentials-BdrSDzkB.js"
	},
	"/assets/_app.resource-map-WJOjQ1EH.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2db4c-p7OJ3pxQAEhXN7trZBW85z/cVq4\"",
		"mtime": "2026-07-02T12:16:58.728Z",
		"size": 187212,
		"path": "../public/assets/_app.resource-map-WJOjQ1EH.js"
	},
	"/assets/_app.server-detail._id-BxWQMuOF.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3ba4-TeTELMPhKCXZXU8wMgfAcPoYWxI\"",
		"mtime": "2026-07-02T12:16:58.729Z",
		"size": 15268,
		"path": "../public/assets/_app.server-detail._id-BxWQMuOF.js"
	},
	"/providers/aws.png": {
		"type": "image/png",
		"etag": "\"3996-PHk9HbboojRUU8weH/gje2LBhH8\"",
		"mtime": "2026-07-02T12:17:03.351Z",
		"size": 14742,
		"path": "../public/providers/aws.png"
	},
	"/assets/_app.servers-CLmDiAmP.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3f01-VmwJH8ftpydpdNLNxwxsvHWVRT0\"",
		"mtime": "2026-07-02T12:16:58.729Z",
		"size": 16129,
		"path": "../public/assets/_app.servers-CLmDiAmP.js"
	},
	"/assets/_app.settings-BZNuHheO.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5f1c-4L1r8ZVL3KgeW3YaNa6w8j4X4pU\"",
		"mtime": "2026-07-02T12:16:58.729Z",
		"size": 24348,
		"path": "../public/assets/_app.settings-BZNuHheO.js"
	},
	"/assets/_app.stats-BiFYPFBm.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"721e-IAynVH34pUlATeFGizcoEw8+6ms\"",
		"mtime": "2026-07-02T12:16:58.729Z",
		"size": 29214,
		"path": "../public/assets/_app.stats-BiFYPFBm.js"
	},
	"/assets/_app.ssh-keys-cK3VSx11.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"25ab-YctlZM391Ec7ofQ37hYClxgN2tI\"",
		"mtime": "2026-07-02T12:16:58.729Z",
		"size": 9643,
		"path": "../public/assets/_app.ssh-keys-cK3VSx11.js"
	},
	"/assets/_app.sync-DLnzl5C_.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c42-l5/zOCql7997IBc4mgHXAezyk90\"",
		"mtime": "2026-07-02T12:16:58.730Z",
		"size": 3138,
		"path": "../public/assets/_app.sync-DLnzl5C_.js"
	},
	"/assets/_app.users-CLYtgd5H.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"13eb-YRb1Dpb6UmYLAzpce9oqwyyXO1w\"",
		"mtime": "2026-07-02T12:16:58.730Z",
		"size": 5099,
		"path": "../public/assets/_app.users-CLYtgd5H.js"
	},
	"/assets/_app.users-groups-erf6WyVM.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4096-sUYRUuqR430Kkut7q7L/NwWqOQ0\"",
		"mtime": "2026-07-02T12:16:58.730Z",
		"size": 16534,
		"path": "../public/assets/_app.users-groups-erf6WyVM.js"
	},
	"/assets/advanced-filter-Bk4EPpjj.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2618-fHCZCEjWZG3wvHADKxmmr6JhJJg\"",
		"mtime": "2026-07-02T12:16:58.730Z",
		"size": 9752,
		"path": "../public/assets/advanced-filter-Bk4EPpjj.js"
	},
	"/assets/arrow-left-Be6SzkUR.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a5-41lY9NptRPezo6xiOPEqMxHR0vE\"",
		"mtime": "2026-07-02T12:16:58.730Z",
		"size": 165,
		"path": "../public/assets/arrow-left-Be6SzkUR.js"
	},
	"/assets/api-DftT4Aeq.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"26eb-9o5UFmMapHHYGxdtVG3ao86cq8o\"",
		"mtime": "2026-07-02T12:16:58.730Z",
		"size": 9963,
		"path": "../public/assets/api-DftT4Aeq.js"
	},
	"/assets/auth-CQIC-QXE.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1ed-EKkOOI4CvMk0n/f5kAndRXVTZnw\"",
		"mtime": "2026-07-02T12:16:58.730Z",
		"size": 493,
		"path": "../public/assets/auth-CQIC-QXE.js"
	},
	"/assets/check-Dd1jCW14.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7c-UpKupE68X4J/3UFJyQUdJ55uc78\"",
		"mtime": "2026-07-02T12:16:58.730Z",
		"size": 124,
		"path": "../public/assets/check-Dd1jCW14.js"
	},
	"/assets/circle-alert-Bhbz-uwq.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"fa-HKlUE5uT4Duf25DYdtZsHg/J3B0\"",
		"mtime": "2026-07-02T12:16:58.730Z",
		"size": 250,
		"path": "../public/assets/circle-alert-Bhbz-uwq.js"
	},
	"/assets/createLucideIcon-D3grNCvt.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4a3-cDgizY80FGFHIP3apAPfMXs/pqk\"",
		"mtime": "2026-07-02T12:16:58.730Z",
		"size": 1187,
		"path": "../public/assets/createLucideIcon-D3grNCvt.js"
	},
	"/assets/external-link-D5C4IH4P.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"fb-tWjoO3isjTamnNA+Tgjvu1xnZ4Y\"",
		"mtime": "2026-07-02T12:16:58.743Z",
		"size": 251,
		"path": "../public/assets/external-link-D5C4IH4P.js"
	},
	"/assets/dist-C6PFjKu4.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7f3b-4RfS4VZGGprhej9wvzbSL1jDsYo\"",
		"mtime": "2026-07-02T12:16:58.742Z",
		"size": 32571,
		"path": "../public/assets/dist-C6PFjKu4.js"
	},
	"/assets/index-DtxX27Jz.css": {
		"type": "text/css; charset=utf-8",
		"etag": "\"3c35-GybETsF6L6PuXEMieWyMg/5Dn7o\"",
		"mtime": "2026-07-02T12:16:58.761Z",
		"size": 15413,
		"path": "../public/assets/index-DtxX27Jz.css"
	},
	"/assets/key-round-XCDcalnH.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"163-lewTu/UVpSZbNzKPr940bJNF/bM\"",
		"mtime": "2026-07-02T12:16:58.743Z",
		"size": 355,
		"path": "../public/assets/key-round-XCDcalnH.js"
	},
	"/assets/formatDistanceToNow-KEGwCsOU.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"257d-gC3Gz3IawDSs9uPxCq2Olph+cbA\"",
		"mtime": "2026-07-02T12:16:58.743Z",
		"size": 9597,
		"path": "../public/assets/formatDistanceToNow-KEGwCsOU.js"
	},
	"/assets/link-BTlN6DhK.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"52ec-yWYIRjnufeKaxWZWnjP6sa+KpFo\"",
		"mtime": "2026-07-02T12:16:58.743Z",
		"size": 21228,
		"path": "../public/assets/link-BTlN6DhK.js"
	},
	"/assets/lock-hODjYwSg.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"308-rYqAbrhaCMITPUk30yk2J5mHPS0\"",
		"mtime": "2026-07-02T12:16:58.743Z",
		"size": 776,
		"path": "../public/assets/lock-hODjYwSg.js"
	},
	"/assets/login-BATecdqe.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2a68-F1kIGLjg+yE/FIJ8ETlUhSkD670\"",
		"mtime": "2026-07-02T12:16:58.744Z",
		"size": 10856,
		"path": "../public/assets/login-BATecdqe.js"
	},
	"/assets/network-DImydCIq.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"180-5QSQPPmQzyr7YX/0xmQzVWmRV24\"",
		"mtime": "2026-07-02T12:16:58.748Z",
		"size": 384,
		"path": "../public/assets/network-DImydCIq.js"
	},
	"/assets/pencil-D3OUMN_j.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"114-mPhGXKMHc4iYhEDl4yJkV3VnzZY\"",
		"mtime": "2026-07-02T12:16:58.749Z",
		"size": 276,
		"path": "../public/assets/pencil-D3OUMN_j.js"
	},
	"/assets/index-inn8e5bR.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4de48-N7ZbuIdGdZdu09CZRE0Q23Hg9yQ\"",
		"mtime": "2026-07-02T12:16:58.712Z",
		"size": 319048,
		"path": "../public/assets/index-inn8e5bR.js"
	},
	"/assets/play-BFE4NwmJ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"be-XdnB3P41+nb8RtPT/Pko4xvdfmg\"",
		"mtime": "2026-07-02T12:16:58.749Z",
		"size": 190,
		"path": "../public/assets/play-BFE4NwmJ.js"
	},
	"/assets/power-CT2ezMMm.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ad-kbRkVOs+YV+IhhUL45iYml1cP4g\"",
		"mtime": "2026-07-02T12:16:58.749Z",
		"size": 173,
		"path": "../public/assets/power-CT2ezMMm.js"
	},
	"/assets/plus-CsxPQKGc.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"99-w1oRI8ybNw+ehYHKwDfZqynBZMI\"",
		"mtime": "2026-07-02T12:16:58.749Z",
		"size": 153,
		"path": "../public/assets/plus-CsxPQKGc.js"
	},
	"/assets/react-dom-Cl2D-sa1.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"dd2-B7AKXot+1K177mIbTarBShgcgQs\"",
		"mtime": "2026-07-02T12:16:58.749Z",
		"size": 3538,
		"path": "../public/assets/react-dom-Cl2D-sa1.js"
	},
	"/assets/refresh-cw-Df8J2pnr.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"141-EgiH74hSs4sPem4OoQxIo8cEjnc\"",
		"mtime": "2026-07-02T12:16:58.749Z",
		"size": 321,
		"path": "../public/assets/refresh-cw-Df8J2pnr.js"
	},
	"/assets/routes-DJ7LAi8J.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"26-SoFMfAHVJ5oqB5t+mpFRoQvFIoc\"",
		"mtime": "2026-07-02T12:16:58.749Z",
		"size": 38,
		"path": "../public/assets/routes-DJ7LAi8J.js"
	},
	"/assets/scroll-text-Dc8oWp-I.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"15d-zZWQyCVX+DUNOuc/jKEcNkudg4I\"",
		"mtime": "2026-07-02T12:16:58.749Z",
		"size": 349,
		"path": "../public/assets/scroll-text-Dc8oWp-I.js"
	},
	"/assets/search-B_WYAFUB.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ae-UptIMWXBiRjh5PJwnnZ//TY+QNQ\"",
		"mtime": "2026-07-02T12:16:58.749Z",
		"size": 174,
		"path": "../public/assets/search-B_WYAFUB.js"
	},
	"/assets/server-CaMBhDsh.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"152-ZbeoYa7b4O2WbSWYSsSfP6BA1bg\"",
		"mtime": "2026-07-02T12:16:58.749Z",
		"size": 338,
		"path": "../public/assets/server-CaMBhDsh.js"
	},
	"/assets/setup-CdW1gl5c.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"19a7-4x1fBxngt9n1WaLtXZc1W7QFxfo\"",
		"mtime": "2026-07-02T12:16:58.750Z",
		"size": 6567,
		"path": "../public/assets/setup-CdW1gl5c.js"
	},
	"/assets/shield-BaRQIkdt.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"110-e9OQcFEwpRCYXbYqW0Fn+CYGUXk\"",
		"mtime": "2026-07-02T12:16:58.750Z",
		"size": 272,
		"path": "../public/assets/shield-BaRQIkdt.js"
	},
	"/assets/shield-check-Ddbt-8WF.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"140-QP+lmKxiV72JLWOIwWZSzW61WJI\"",
		"mtime": "2026-07-02T12:16:58.750Z",
		"size": 320,
		"path": "../public/assets/shield-check-Ddbt-8WF.js"
	},
	"/assets/sonner-DHq-5-Fb.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"214-8VyDpfp9orynPH03m6CDDYPA7O4\"",
		"mtime": "2026-07-02T12:16:58.750Z",
		"size": 532,
		"path": "../public/assets/sonner-DHq-5-Fb.js"
	},
	"/assets/styles-6UcjlFmc.css": {
		"type": "text/css; charset=utf-8",
		"etag": "\"b8d9-DaqJe6mo7OnsqaE1Duqc5AIMbwM\"",
		"mtime": "2026-07-02T12:16:58.761Z",
		"size": 47321,
		"path": "../public/assets/styles-6UcjlFmc.css"
	},
	"/assets/terminal-Bn19LRzl.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a2-fgN6jRJRiSqTdq3J8tez7U9Y9H4\"",
		"mtime": "2026-07-02T12:16:58.750Z",
		"size": 162,
		"path": "../public/assets/terminal-Bn19LRzl.js"
	},
	"/assets/trash-2-zQHUKpM6.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"148-X3BDTZ/dXXQwzpZYvedni686igU\"",
		"mtime": "2026-07-02T12:16:58.750Z",
		"size": 328,
		"path": "../public/assets/trash-2-zQHUKpM6.js"
	},
	"/assets/triangle-alert-CWjPUx9K.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"109-CCsaq/cvTZx0KuH+bc2YCwMYT7c\"",
		"mtime": "2026-07-02T12:16:58.750Z",
		"size": 265,
		"path": "../public/assets/triangle-alert-CWjPUx9K.js"
	},
	"/assets/ui-bits-BwHRE-Tj.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1ea2-bzPLDPP1nAiyJkJiZ2440aC1RaU\"",
		"mtime": "2026-07-02T12:16:58.750Z",
		"size": 7842,
		"path": "../public/assets/ui-bits-BwHRE-Tj.js"
	},
	"/assets/useMatch-Dg36rGyA.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4c3-KdIe2owUul6mMAihkJMTTUFdnxU\"",
		"mtime": "2026-07-02T12:16:58.750Z",
		"size": 1219,
		"path": "../public/assets/useMatch-Dg36rGyA.js"
	},
	"/assets/useMutation-LMkHjZLL.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"8c2-NPAp6n+3lX/XDm3tk5CGf0HvQJU\"",
		"mtime": "2026-07-02T12:16:58.750Z",
		"size": 2242,
		"path": "../public/assets/useMutation-LMkHjZLL.js"
	},
	"/assets/useQuery-Cr_e2Nf1.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"224a-+inaBZCr/jYBrkV6RlsnTda9iXE\"",
		"mtime": "2026-07-02T12:16:58.760Z",
		"size": 8778,
		"path": "../public/assets/useQuery-Cr_e2Nf1.js"
	},
	"/assets/useRouter-CiDGC6AP.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2aa-eOxhauAXDPpkN7KjCtJlfS5jdR0\"",
		"mtime": "2026-07-02T12:16:58.760Z",
		"size": 682,
		"path": "../public/assets/useRouter-CiDGC6AP.js"
	},
	"/assets/value-8xOwwyZS.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"240f-/DipoiEUn8kF+0SHdlPBgNNu6Tk\"",
		"mtime": "2026-07-02T12:16:58.761Z",
		"size": 9231,
		"path": "../public/assets/value-8xOwwyZS.js"
	},
	"/assets/wifi-CQGk_map.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"31b-yzSLdS52NvoLQv0mmxGbYipgvNE\"",
		"mtime": "2026-07-02T12:16:58.761Z",
		"size": 795,
		"path": "../public/assets/wifi-CQGk_map.js"
	},
	"/assets/user-KI-WQM1F.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c4-WBR29rM27gg8PEk24XCtHAIUo9w\"",
		"mtime": "2026-07-02T12:16:58.761Z",
		"size": 196,
		"path": "../public/assets/user-KI-WQM1F.js"
	},
	"/assets/with-selector-DtW0n3nP.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"652-Qv7nUdBCyTNFvrkcDVhBmHlXZ9o\"",
		"mtime": "2026-07-02T12:16:58.761Z",
		"size": 1618,
		"path": "../public/assets/with-selector-DtW0n3nP.js"
	},
	"/assets/x-6mSEx55J.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"9a-ePt8cT2QaS+3dfL08R64z4xbZoo\"",
		"mtime": "2026-07-02T12:16:58.761Z",
		"size": 154,
		"path": "../public/assets/x-6mSEx55J.js"
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
