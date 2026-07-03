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
	"/favicon.svg": {
		"type": "image/svg+xml",
		"etag": "\"a5-bub5qXVFwlArTHVYMcqQ8iEuzzA\"",
		"mtime": "2026-07-03T07:45:46.006Z",
		"size": 165,
		"path": "../public/favicon.svg"
	},
	"/os/redhat.svg": {
		"type": "image/svg+xml",
		"etag": "\"a41-vXKms6+L3tdUOwKNIm6vFg/d3hU\"",
		"mtime": "2026-07-03T07:45:46.000Z",
		"size": 2625,
		"path": "../public/os/redhat.svg"
	},
	"/os/ubuntu.svg": {
		"type": "image/svg+xml",
		"etag": "\"533-vQCS5rCF7P2n9jxAi7TMeaC6lZs\"",
		"mtime": "2026-07-03T07:45:46.000Z",
		"size": 1331,
		"path": "../public/os/ubuntu.svg"
	},
	"/assets/AreaChart-CXNoOBgG.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"6198-TrjzDfv6T4+K1+/JVg9cZUVJk2I\"",
		"mtime": "2026-07-03T07:45:40.086Z",
		"size": 24984,
		"path": "../public/assets/AreaChart-CXNoOBgG.js"
	},
	"/assets/ErrorBarContext-DvI2a45Q.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2a6-P4OCCpRJ0C8akZd9z/pS4qC9fJ0\"",
		"mtime": "2026-07-03T07:45:40.088Z",
		"size": 678,
		"path": "../public/assets/ErrorBarContext-DvI2a45Q.js"
	},
	"/assets/PieChart-N1mOpWyB.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4472-E4KsWHQvPb8Za/EmmsZeyLH3tiA\"",
		"mtime": "2026-07-03T07:45:40.088Z",
		"size": 17522,
		"path": "../public/assets/PieChart-N1mOpWyB.js"
	},
	"/assets/_app.block-storages-ClE__AlK.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"e46-38sUNKg0gUsFi5lMTUVqCSg0z7g\"",
		"mtime": "2026-07-03T07:45:40.088Z",
		"size": 3654,
		"path": "../public/assets/_app.block-storages-ClE__AlK.js"
	},
	"/assets/_app-CRV-ny7v.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"10983-nK6nZfbDQ1GgmVZcZKBeBg+OIbE\"",
		"mtime": "2026-07-03T07:45:40.088Z",
		"size": 67971,
		"path": "../public/assets/_app-CRV-ny7v.js"
	},
	"/assets/_app.cloud-providers-5WgXe7Aq.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2a88-aEH+jMx6oOpMLH1ZqG9Mf2kVjMc\"",
		"mtime": "2026-07-03T07:45:40.088Z",
		"size": 10888,
		"path": "../public/assets/_app.cloud-providers-5WgXe7Aq.js"
	},
	"/assets/_app.crons-CNjgy-0p.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1dd1-io4EMUvTx1cHbJ9YNpYM8XpYyyQ\"",
		"mtime": "2026-07-03T07:45:40.088Z",
		"size": 7633,
		"path": "../public/assets/_app.crons-CNjgy-0p.js"
	},
	"/assets/CartesianChart-BJby2xvE.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4f227-IsrPVO5LsiTkKRPhlQ4tmJTePoE\"",
		"mtime": "2026-07-03T07:45:40.087Z",
		"size": 324135,
		"path": "../public/assets/CartesianChart-BJby2xvE.js"
	},
	"/assets/_app.dashboard-CBiZbwB6.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7f1e-x5UCfDcb78OpziFMFXRLbbR5G0A\"",
		"mtime": "2026-07-03T07:45:40.088Z",
		"size": 32542,
		"path": "../public/assets/_app.dashboard-CBiZbwB6.js"
	},
	"/assets/_app.databases-CDN9MvDg.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"f5b-w8O8bktcUBwtFlqLhow8zvFyA4M\"",
		"mtime": "2026-07-03T07:45:40.089Z",
		"size": 3931,
		"path": "../public/assets/_app.databases-CDN9MvDg.js"
	},
	"/assets/_app.event-logs-TBmH-5TN.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4f4e-l6x6p8oakx5uTpck1Fd/HMuSZ8U\"",
		"mtime": "2026-07-03T07:45:40.089Z",
		"size": 20302,
		"path": "../public/assets/_app.event-logs-TBmH-5TN.js"
	},
	"/assets/_app.ips-B8A-BBP1.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"b85-Y15PkGs1FR3ts4Hd4a+ZsaL6eiM\"",
		"mtime": "2026-07-03T07:45:40.089Z",
		"size": 2949,
		"path": "../public/assets/_app.ips-B8A-BBP1.js"
	},
	"/assets/_app.kubernetes-B5-4geqw.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ef3-lZkU0C5AAomOvqVVdAm21x1U3jU\"",
		"mtime": "2026-07-03T07:45:40.089Z",
		"size": 3827,
		"path": "../public/assets/_app.kubernetes-B5-4geqw.js"
	},
	"/assets/_app.policies-Ge2jLrA3.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1d95-avaVtB/aeESo7X4Gu5HEIOLTmmg\"",
		"mtime": "2026-07-03T07:45:40.089Z",
		"size": 7573,
		"path": "../public/assets/_app.policies-Ge2jLrA3.js"
	},
	"/assets/_app.policies._slug-Cd0lbEIa.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1465-n4YOpSbFWMqibDYU4KP8eKLue/c\"",
		"mtime": "2026-07-03T07:45:40.089Z",
		"size": 5221,
		"path": "../public/assets/_app.policies._slug-Cd0lbEIa.js"
	},
	"/assets/_app.provider-credentials-qF8DSMnD.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7b78-MyEz4h7DnOEJKsAG5+tTyr3sthw\"",
		"mtime": "2026-07-03T07:45:40.089Z",
		"size": 31608,
		"path": "../public/assets/_app.provider-credentials-qF8DSMnD.js"
	},
	"/assets/_app.server-detail._id-B6mYNtwy.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3bb0-ZPSCI+NB0e+vfus4iFnA2eW2PmY\"",
		"mtime": "2026-07-03T07:45:40.090Z",
		"size": 15280,
		"path": "../public/assets/_app.server-detail._id-B6mYNtwy.js"
	},
	"/assets/_app.server-groups-DGxbjVRT.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2417-xyaHm6Qy0XplrYLOr0x0VDhFJjI\"",
		"mtime": "2026-07-03T07:45:40.090Z",
		"size": 9239,
		"path": "../public/assets/_app.server-groups-DGxbjVRT.js"
	},
	"/assets/_app.servers-DbHhbRk8.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4eb2-X406vpjUY3GVo6WbS81LnUL6wj4\"",
		"mtime": "2026-07-03T07:45:40.090Z",
		"size": 20146,
		"path": "../public/assets/_app.servers-DbHhbRk8.js"
	},
	"/assets/_app.settings-D9X24zmC.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5f1c-oAAPILycpxKfu13lt47kslGcgCk\"",
		"mtime": "2026-07-03T07:45:40.090Z",
		"size": 24348,
		"path": "../public/assets/_app.settings-D9X24zmC.js"
	},
	"/assets/_app.ssh-keys-BpzMoiEF.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"25b7-1GQarMmOwC+wK8wjJ0K7ItndMkw\"",
		"mtime": "2026-07-03T07:45:40.090Z",
		"size": 9655,
		"path": "../public/assets/_app.ssh-keys-BpzMoiEF.js"
	},
	"/assets/_app.resource-map-aIUfvIFz.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2d9ef-fJ0eQvrlOSuR4COyiccxjfesKDI\"",
		"mtime": "2026-07-03T07:45:40.089Z",
		"size": 186863,
		"path": "../public/assets/_app.resource-map-aIUfvIFz.js"
	},
	"/assets/_app.stats-CbWprBL7.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"721e-lpX8CbEl3XTl32ebepo+ngMdVEc\"",
		"mtime": "2026-07-03T07:45:40.090Z",
		"size": 29214,
		"path": "../public/assets/_app.stats-CbWprBL7.js"
	},
	"/assets/_app.sync-CWL8-Z82.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c42-l9y6g75ElxRd4Mghf6w9WDduE10\"",
		"mtime": "2026-07-03T07:45:40.102Z",
		"size": 3138,
		"path": "../public/assets/_app.sync-CWL8-Z82.js"
	},
	"/assets/_app.users-C74EQwF8.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"13f7-YTpkhTbcmWn75SROY2VQSiaZHpo\"",
		"mtime": "2026-07-03T07:45:40.103Z",
		"size": 5111,
		"path": "../public/assets/_app.users-C74EQwF8.js"
	},
	"/assets/_app.users-groups-CqLHAeCT.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"40a7-vPRBrFIvkimrADQ6SLXO27UbZ/g\"",
		"mtime": "2026-07-03T07:45:40.103Z",
		"size": 16551,
		"path": "../public/assets/_app.users-groups-CqLHAeCT.js"
	},
	"/assets/advanced-filter-DJmeRnlz.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"25f7-sqPebZYXaQH7GQzvB76nDWXpIqU\"",
		"mtime": "2026-07-03T07:45:40.103Z",
		"size": 9719,
		"path": "../public/assets/advanced-filter-DJmeRnlz.js"
	},
	"/assets/api-DftT4Aeq.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"26eb-9o5UFmMapHHYGxdtVG3ao86cq8o\"",
		"mtime": "2026-07-03T07:45:40.103Z",
		"size": 9963,
		"path": "../public/assets/api-DftT4Aeq.js"
	},
	"/assets/arrow-left-Be6SzkUR.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a5-41lY9NptRPezo6xiOPEqMxHR0vE\"",
		"mtime": "2026-07-03T07:45:40.103Z",
		"size": 165,
		"path": "../public/assets/arrow-left-Be6SzkUR.js"
	},
	"/assets/auth-XCMLEYI4.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"158-cm/oOMUXZqnFlgoVal3k+ipBQSg\"",
		"mtime": "2026-07-03T07:45:40.103Z",
		"size": 344,
		"path": "../public/assets/auth-XCMLEYI4.js"
	},
	"/assets/circle-alert-Bhbz-uwq.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"fa-HKlUE5uT4Duf25DYdtZsHg/J3B0\"",
		"mtime": "2026-07-03T07:45:40.103Z",
		"size": 250,
		"path": "../public/assets/circle-alert-Bhbz-uwq.js"
	},
	"/assets/cloud-BORtZf24.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a0-zXpa0ukTj737wwpP+c+FobedApI\"",
		"mtime": "2026-07-03T07:45:40.103Z",
		"size": 160,
		"path": "../public/assets/cloud-BORtZf24.js"
	},
	"/assets/copy-BKi-xaAc.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ec-4CSU6/Yf1GWcCX2Ct8RxFr9C/bo\"",
		"mtime": "2026-07-03T07:45:40.103Z",
		"size": 236,
		"path": "../public/assets/copy-BKi-xaAc.js"
	},
	"/assets/dist-C6PFjKu4.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7f3b-4RfS4VZGGprhej9wvzbSL1jDsYo\"",
		"mtime": "2026-07-03T07:45:40.103Z",
		"size": 32571,
		"path": "../public/assets/dist-C6PFjKu4.js"
	},
	"/assets/createLucideIcon-D3grNCvt.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4a3-cDgizY80FGFHIP3apAPfMXs/pqk\"",
		"mtime": "2026-07-03T07:45:40.103Z",
		"size": 1187,
		"path": "../public/assets/createLucideIcon-D3grNCvt.js"
	},
	"/assets/external-link-D5C4IH4P.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"fb-tWjoO3isjTamnNA+Tgjvu1xnZ4Y\"",
		"mtime": "2026-07-03T07:45:40.103Z",
		"size": 251,
		"path": "../public/assets/external-link-D5C4IH4P.js"
	},
	"/assets/eye-B1Wsb_l9.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"279-iPfHfXaF01Kx37vK3atd+OIapXc\"",
		"mtime": "2026-07-03T07:45:40.104Z",
		"size": 633,
		"path": "../public/assets/eye-B1Wsb_l9.js"
	},
	"/assets/formatDistanceToNow-KEGwCsOU.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"257d-gC3Gz3IawDSs9uPxCq2Olph+cbA\"",
		"mtime": "2026-07-03T07:45:40.104Z",
		"size": 9597,
		"path": "../public/assets/formatDistanceToNow-KEGwCsOU.js"
	},
	"/assets/index-BYu-noAe.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4e00c-HX0mTT2sGeeQrR96bnF01No5D94\"",
		"mtime": "2026-07-03T07:45:40.085Z",
		"size": 319500,
		"path": "../public/assets/index-BYu-noAe.js"
	},
	"/assets/key-round-XCDcalnH.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"163-lewTu/UVpSZbNzKPr940bJNF/bM\"",
		"mtime": "2026-07-03T07:45:40.104Z",
		"size": 355,
		"path": "../public/assets/key-round-XCDcalnH.js"
	},
	"/assets/index-DtxX27Jz.css": {
		"type": "text/css; charset=utf-8",
		"etag": "\"3c35-GybETsF6L6PuXEMieWyMg/5Dn7o\"",
		"mtime": "2026-07-03T07:45:40.106Z",
		"size": 15413,
		"path": "../public/assets/index-DtxX27Jz.css"
	},
	"/assets/link-BTlN6DhK.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"52ec-yWYIRjnufeKaxWZWnjP6sa+KpFo\"",
		"mtime": "2026-07-03T07:45:40.104Z",
		"size": 21228,
		"path": "../public/assets/link-BTlN6DhK.js"
	},
	"/assets/lock-BMWrlw-o.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ce-KlZySBbSoaONgl4S0d9BFPbjolU\"",
		"mtime": "2026-07-03T07:45:40.104Z",
		"size": 206,
		"path": "../public/assets/lock-BMWrlw-o.js"
	},
	"/assets/network-DImydCIq.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"180-5QSQPPmQzyr7YX/0xmQzVWmRV24\"",
		"mtime": "2026-07-03T07:45:40.104Z",
		"size": 384,
		"path": "../public/assets/network-DImydCIq.js"
	},
	"/assets/login-DatOjOgP.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2a74-L2lWLO1Jea7kjPtiwBWW1I5gmtg\"",
		"mtime": "2026-07-03T07:45:40.104Z",
		"size": 10868,
		"path": "../public/assets/login-DatOjOgP.js"
	},
	"/assets/pencil-D3OUMN_j.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"114-mPhGXKMHc4iYhEDl4yJkV3VnzZY\"",
		"mtime": "2026-07-03T07:45:40.104Z",
		"size": 276,
		"path": "../public/assets/pencil-D3OUMN_j.js"
	},
	"/assets/play-BFE4NwmJ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"be-XdnB3P41+nb8RtPT/Pko4xvdfmg\"",
		"mtime": "2026-07-03T07:45:40.104Z",
		"size": 190,
		"path": "../public/assets/play-BFE4NwmJ.js"
	},
	"/assets/plus-CsxPQKGc.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"99-w1oRI8ybNw+ehYHKwDfZqynBZMI\"",
		"mtime": "2026-07-03T07:45:40.104Z",
		"size": 153,
		"path": "../public/assets/plus-CsxPQKGc.js"
	},
	"/assets/power-CT2ezMMm.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ad-kbRkVOs+YV+IhhUL45iYml1cP4g\"",
		"mtime": "2026-07-03T07:45:40.104Z",
		"size": 173,
		"path": "../public/assets/power-CT2ezMMm.js"
	},
	"/assets/react-dom-Cl2D-sa1.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"dd2-B7AKXot+1K177mIbTarBShgcgQs\"",
		"mtime": "2026-07-03T07:45:40.104Z",
		"size": 3538,
		"path": "../public/assets/react-dom-Cl2D-sa1.js"
	},
	"/assets/refresh-cw-Df8J2pnr.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"141-EgiH74hSs4sPem4OoQxIo8cEjnc\"",
		"mtime": "2026-07-03T07:45:40.104Z",
		"size": 321,
		"path": "../public/assets/refresh-cw-Df8J2pnr.js"
	},
	"/assets/routes-DJ7LAi8J.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"26-SoFMfAHVJ5oqB5t+mpFRoQvFIoc\"",
		"mtime": "2026-07-03T07:45:40.105Z",
		"size": 38,
		"path": "../public/assets/routes-DJ7LAi8J.js"
	},
	"/assets/scroll-text-Dc8oWp-I.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"15d-zZWQyCVX+DUNOuc/jKEcNkudg4I\"",
		"mtime": "2026-07-03T07:45:40.105Z",
		"size": 349,
		"path": "../public/assets/scroll-text-Dc8oWp-I.js"
	},
	"/assets/search-B_WYAFUB.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ae-UptIMWXBiRjh5PJwnnZ//TY+QNQ\"",
		"mtime": "2026-07-03T07:45:40.105Z",
		"size": 174,
		"path": "../public/assets/search-B_WYAFUB.js"
	},
	"/assets/server-CaMBhDsh.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"152-ZbeoYa7b4O2WbSWYSsSfP6BA1bg\"",
		"mtime": "2026-07-03T07:45:40.105Z",
		"size": 338,
		"path": "../public/assets/server-CaMBhDsh.js"
	},
	"/assets/shield-BaRQIkdt.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"110-e9OQcFEwpRCYXbYqW0Fn+CYGUXk\"",
		"mtime": "2026-07-03T07:45:40.105Z",
		"size": 272,
		"path": "../public/assets/shield-BaRQIkdt.js"
	},
	"/assets/setup-CrPjvlXh.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"19a7-2koxjYhxOgew71gYSr/nhmlq3f0\"",
		"mtime": "2026-07-03T07:45:40.105Z",
		"size": 6567,
		"path": "../public/assets/setup-CrPjvlXh.js"
	},
	"/assets/shield-check-Ddbt-8WF.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"140-QP+lmKxiV72JLWOIwWZSzW61WJI\"",
		"mtime": "2026-07-03T07:45:40.105Z",
		"size": 320,
		"path": "../public/assets/shield-check-Ddbt-8WF.js"
	},
	"/assets/sonner-DHq-5-Fb.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"214-8VyDpfp9orynPH03m6CDDYPA7O4\"",
		"mtime": "2026-07-03T07:45:40.105Z",
		"size": 532,
		"path": "../public/assets/sonner-DHq-5-Fb.js"
	},
	"/assets/terminal-Bn19LRzl.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a2-fgN6jRJRiSqTdq3J8tez7U9Y9H4\"",
		"mtime": "2026-07-03T07:45:40.105Z",
		"size": 162,
		"path": "../public/assets/terminal-Bn19LRzl.js"
	},
	"/assets/styles-o42fEQM2.css": {
		"type": "text/css; charset=utf-8",
		"etag": "\"b9c6-6BHyHP3PtuLqiapKJX+rWTXHMlc\"",
		"mtime": "2026-07-03T07:45:40.107Z",
		"size": 47558,
		"path": "../public/assets/styles-o42fEQM2.css"
	},
	"/assets/trash-2-zQHUKpM6.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"148-X3BDTZ/dXXQwzpZYvedni686igU\"",
		"mtime": "2026-07-03T07:45:40.105Z",
		"size": 328,
		"path": "../public/assets/trash-2-zQHUKpM6.js"
	},
	"/assets/triangle-alert-CWjPUx9K.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"109-CCsaq/cvTZx0KuH+bc2YCwMYT7c\"",
		"mtime": "2026-07-03T07:45:40.105Z",
		"size": 265,
		"path": "../public/assets/triangle-alert-CWjPUx9K.js"
	},
	"/assets/ui-bits-CjvNiYlC.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"22f2-MKvvBAtZ2g/QDg9exiCG0frM3H8\"",
		"mtime": "2026-07-03T07:45:40.105Z",
		"size": 8946,
		"path": "../public/assets/ui-bits-CjvNiYlC.js"
	},
	"/assets/useMatch-Dg36rGyA.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4c3-KdIe2owUul6mMAihkJMTTUFdnxU\"",
		"mtime": "2026-07-03T07:45:40.106Z",
		"size": 1219,
		"path": "../public/assets/useMatch-Dg36rGyA.js"
	},
	"/assets/useMutation-BN2HtmzO.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"8c2-jZSpE2r7NYS47kjPvRzaRabOWhc\"",
		"mtime": "2026-07-03T07:45:40.106Z",
		"size": 2242,
		"path": "../public/assets/useMutation-BN2HtmzO.js"
	},
	"/assets/useQuery-p99bNoyH.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"224a-uGaBzKnecL7u2sbvm5HnvXloew8\"",
		"mtime": "2026-07-03T07:45:40.106Z",
		"size": 8778,
		"path": "../public/assets/useQuery-p99bNoyH.js"
	},
	"/assets/useRouter-CiDGC6AP.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2aa-eOxhauAXDPpkN7KjCtJlfS5jdR0\"",
		"mtime": "2026-07-03T07:45:40.106Z",
		"size": 682,
		"path": "../public/assets/useRouter-CiDGC6AP.js"
	},
	"/assets/user-KI-WQM1F.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c4-WBR29rM27gg8PEk24XCtHAIUo9w\"",
		"mtime": "2026-07-03T07:45:40.106Z",
		"size": 196,
		"path": "../public/assets/user-KI-WQM1F.js"
	},
	"/assets/value-8xOwwyZS.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"240f-/DipoiEUn8kF+0SHdlPBgNNu6Tk\"",
		"mtime": "2026-07-03T07:45:40.106Z",
		"size": 9231,
		"path": "../public/assets/value-8xOwwyZS.js"
	},
	"/assets/wifi-_9dZJu_6.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"48b-GC0PnJx2/zqBvfdKczL5kIa9u24\"",
		"mtime": "2026-07-03T07:45:40.106Z",
		"size": 1163,
		"path": "../public/assets/wifi-_9dZJu_6.js"
	},
	"/assets/with-selector-DtW0n3nP.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"652-Qv7nUdBCyTNFvrkcDVhBmHlXZ9o\"",
		"mtime": "2026-07-03T07:45:40.106Z",
		"size": 1618,
		"path": "../public/assets/with-selector-DtW0n3nP.js"
	},
	"/assets/x-6mSEx55J.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"9a-ePt8cT2QaS+3dfL08R64z4xbZoo\"",
		"mtime": "2026-07-03T07:45:40.106Z",
		"size": 154,
		"path": "../public/assets/x-6mSEx55J.js"
	},
	"/providers/aws.svg": {
		"type": "image/svg+xml",
		"etag": "\"ea6-QFwKMC9bcHU4zVF3wOMI2MbU550\"",
		"mtime": "2026-07-03T07:45:46.000Z",
		"size": 3750,
		"path": "../public/providers/aws.svg"
	},
	"/providers/azure.png": {
		"type": "image/png",
		"etag": "\"1553-oFGB8SIDw4/LXRrRLyiX/AtPqZA\"",
		"mtime": "2026-07-03T07:45:46.001Z",
		"size": 5459,
		"path": "../public/providers/azure.png"
	},
	"/providers/digitalocean.png": {
		"type": "image/png",
		"etag": "\"2064-Wgt26go1kapL0yv8/LO1+rfQYZ4\"",
		"mtime": "2026-07-03T07:45:46.001Z",
		"size": 8292,
		"path": "../public/providers/digitalocean.png"
	},
	"/providers/gcp.svg": {
		"type": "image/svg+xml",
		"etag": "\"30f-dlFBT4J93eg10/aLqm2A8bBkQMk\"",
		"mtime": "2026-07-03T07:45:46.001Z",
		"size": 783,
		"path": "../public/providers/gcp.svg"
	},
	"/providers/hivelocity.png": {
		"type": "image/png",
		"etag": "\"248-Spb51JADl/VWsi+pfEWsBSGF+Lo\"",
		"mtime": "2026-07-03T07:45:46.001Z",
		"size": 584,
		"path": "../public/providers/hivelocity.png"
	},
	"/providers/linode.png": {
		"type": "image/png",
		"etag": "\"1c63-8NmruuGfbHfD+/isOL+WbKfO0q4\"",
		"mtime": "2026-07-03T07:45:46.005Z",
		"size": 7267,
		"path": "../public/providers/linode.png"
	},
	"/providers/ovh.png": {
		"type": "image/png",
		"etag": "\"17b41-2hESuI5jPWP7lLojwwjqTszh2Lo\"",
		"mtime": "2026-07-03T07:45:46.005Z",
		"size": 97089,
		"path": "../public/providers/ovh.png"
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
