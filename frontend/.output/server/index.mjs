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
		"mtime": "2026-07-02T10:23:56.094Z",
		"size": 14742,
		"path": "../public/providers/aws.png"
	},
	"/providers/azure.png": {
		"type": "image/png",
		"etag": "\"1553-oFGB8SIDw4/LXRrRLyiX/AtPqZA\"",
		"mtime": "2026-07-02T10:23:56.094Z",
		"size": 5459,
		"path": "../public/providers/azure.png"
	},
	"/providers/digitalocean.png": {
		"type": "image/png",
		"etag": "\"2064-Wgt26go1kapL0yv8/LO1+rfQYZ4\"",
		"mtime": "2026-07-02T10:23:56.094Z",
		"size": 8292,
		"path": "../public/providers/digitalocean.png"
	},
	"/providers/gcp.png": {
		"type": "image/png",
		"etag": "\"926f-fqPwH/AcIdj5FRx4bjywEd6Ddg4\"",
		"mtime": "2026-07-02T10:23:56.097Z",
		"size": 37487,
		"path": "../public/providers/gcp.png"
	},
	"/providers/hivelocity.png": {
		"type": "image/png",
		"etag": "\"248-Spb51JADl/VWsi+pfEWsBSGF+Lo\"",
		"mtime": "2026-07-02T10:23:56.094Z",
		"size": 584,
		"path": "../public/providers/hivelocity.png"
	},
	"/providers/linode.png": {
		"type": "image/png",
		"etag": "\"1c63-8NmruuGfbHfD+/isOL+WbKfO0q4\"",
		"mtime": "2026-07-02T10:23:56.095Z",
		"size": 7267,
		"path": "../public/providers/linode.png"
	},
	"/assets/AreaChart-CFEw9_n_.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"6198-voF7j8l124ilsMFFhoAkP2rrMY0\"",
		"mtime": "2026-07-02T10:23:52.747Z",
		"size": 24984,
		"path": "../public/assets/AreaChart-CFEw9_n_.js"
	},
	"/providers/ovh.png": {
		"type": "image/png",
		"etag": "\"17b41-2hESuI5jPWP7lLojwwjqTszh2Lo\"",
		"mtime": "2026-07-02T10:23:56.097Z",
		"size": 97089,
		"path": "../public/providers/ovh.png"
	},
	"/assets/ErrorBarContext-Tp5zzmMB.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2a6-fXEeUs85B8W8/TREq5blBXtUONA\"",
		"mtime": "2026-07-02T10:23:52.749Z",
		"size": 678,
		"path": "../public/assets/ErrorBarContext-Tp5zzmMB.js"
	},
	"/assets/PieChart-DTOZxQRU.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4472-kypH7ebfa7nVs1Ny+EYdUhcjx+A\"",
		"mtime": "2026-07-02T10:23:52.749Z",
		"size": 17522,
		"path": "../public/assets/PieChart-DTOZxQRU.js"
	},
	"/assets/CartesianChart-DVwvIu9g.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4f227-L+hmWYmmamtI1LVt2Lqt1qQ4+Ig\"",
		"mtime": "2026-07-02T10:23:52.748Z",
		"size": 324135,
		"path": "../public/assets/CartesianChart-DVwvIu9g.js"
	},
	"/assets/_app.cloud-providers-BSaz-aei.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2a81-GA6l5A0oR7YYqVqv2JH/5vRHEFo\"",
		"mtime": "2026-07-02T10:23:52.750Z",
		"size": 10881,
		"path": "../public/assets/_app.cloud-providers-BSaz-aei.js"
	},
	"/assets/_app.crons-_d8bK4Mn.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1dd6-4p3MiEReNIwixMwc3R1qPMBWppo\"",
		"mtime": "2026-07-02T10:23:52.750Z",
		"size": 7638,
		"path": "../public/assets/_app.crons-_d8bK4Mn.js"
	},
	"/assets/_app-B9HOkKJ3.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"108c2-NVEISRlIdU0hxrFYZYGKTJ9KaZY\"",
		"mtime": "2026-07-02T10:23:52.749Z",
		"size": 67778,
		"path": "../public/assets/_app-B9HOkKJ3.js"
	},
	"/assets/_app.block-storages-B7nQDGlA.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"e4b-dEhEyNgMoHVOmuTYSkCtBtFDxww\"",
		"mtime": "2026-07-02T10:23:52.750Z",
		"size": 3659,
		"path": "../public/assets/_app.block-storages-B7nQDGlA.js"
	},
	"/assets/_app.dashboard-BLqKldf4.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7f1e-/0CFDzu3q4u6Z8RbWDxEViFtc+c\"",
		"mtime": "2026-07-02T10:23:52.750Z",
		"size": 32542,
		"path": "../public/assets/_app.dashboard-BLqKldf4.js"
	},
	"/assets/_app.databases-BuUt4s5c.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"f60-4F0SPu7nAP9z3BaOqHf/ES685GU\"",
		"mtime": "2026-07-02T10:23:52.750Z",
		"size": 3936,
		"path": "../public/assets/_app.databases-BuUt4s5c.js"
	},
	"/assets/_app.event-logs-swMtEpil.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4f5f-fsP2XfB++oHdw6SyNTBP2AF6lvE\"",
		"mtime": "2026-07-02T10:23:52.750Z",
		"size": 20319,
		"path": "../public/assets/_app.event-logs-swMtEpil.js"
	},
	"/assets/_app.ips-CiPiQwUq.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"b85-Ced0E+Asf03l6bkTeirtskYw+3k\"",
		"mtime": "2026-07-02T10:23:52.750Z",
		"size": 2949,
		"path": "../public/assets/_app.ips-CiPiQwUq.js"
	},
	"/assets/_app.kubernetes-BBngbcd6.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ef8-FmZFBinJbr2+Iw5uBlFUxgB1d54\"",
		"mtime": "2026-07-02T10:23:52.750Z",
		"size": 3832,
		"path": "../public/assets/_app.kubernetes-BBngbcd6.js"
	},
	"/assets/_app.policies._slug-DEWXMC2_.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1465-ET8PWnYxip1SDDoNc5TnvVx6oJ0\"",
		"mtime": "2026-07-02T10:23:52.751Z",
		"size": 5221,
		"path": "../public/assets/_app.policies._slug-DEWXMC2_.js"
	},
	"/assets/_app.policies-Ce4YRNvR.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1d95-EefIOu8qs5VY3PMfxk/0JkQCeFs\"",
		"mtime": "2026-07-02T10:23:52.750Z",
		"size": 7573,
		"path": "../public/assets/_app.policies-Ce4YRNvR.js"
	},
	"/assets/_app.provider-credentials-6Jt6Hzq9.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7af6-yFjIxzPZMcb27E5sJTlI4/KzeV8\"",
		"mtime": "2026-07-02T10:23:52.751Z",
		"size": 31478,
		"path": "../public/assets/_app.provider-credentials-6Jt6Hzq9.js"
	},
	"/assets/_app.resource-map-BA7S2fyu.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2dbb3-GIUW3Yv+UPXNA2+jYecl3IJ5lDk\"",
		"mtime": "2026-07-02T10:23:52.751Z",
		"size": 187315,
		"path": "../public/assets/_app.resource-map-BA7S2fyu.js"
	},
	"/assets/_app.server-detail._id-YRve3Ea-.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3b8a-DrGI+p/Utq93nT3lEklTm228xVw\"",
		"mtime": "2026-07-02T10:23:52.751Z",
		"size": 15242,
		"path": "../public/assets/_app.server-detail._id-YRve3Ea-.js"
	},
	"/assets/_app.servers-Cj9CHe-I.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3f01-Ele/GOd6YWfSRrH0UbAA1hYvCa8\"",
		"mtime": "2026-07-02T10:23:52.751Z",
		"size": 16129,
		"path": "../public/assets/_app.servers-Cj9CHe-I.js"
	},
	"/assets/_app.settings-Dr169hjR.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5f21-cc3Xw2VW29xsTBRaoTYBxCAHdvU\"",
		"mtime": "2026-07-02T10:23:52.751Z",
		"size": 24353,
		"path": "../public/assets/_app.settings-Dr169hjR.js"
	},
	"/assets/_app.ssh-keys-BRHNUsOF.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"25b0-KxjNK6MTc5BwcMkE8Lap/HoxeWk\"",
		"mtime": "2026-07-02T10:23:52.751Z",
		"size": 9648,
		"path": "../public/assets/_app.ssh-keys-BRHNUsOF.js"
	},
	"/assets/_app.stats-BNK7CkHc.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"721e-Lv8qCCufRwCmXFvdQrTkcCtFq7w\"",
		"mtime": "2026-07-02T10:23:52.752Z",
		"size": 29214,
		"path": "../public/assets/_app.stats-BNK7CkHc.js"
	},
	"/assets/_app.sync-UyJ4qjrl.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c42-K9PHuovS5X+ZBKzs28pfi/loQyM\"",
		"mtime": "2026-07-02T10:23:52.752Z",
		"size": 3138,
		"path": "../public/assets/_app.sync-UyJ4qjrl.js"
	},
	"/assets/_app.users-Co0LeD15.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"13f0-RJtlx2/oROgAR7LAA66JMpQ9q+k\"",
		"mtime": "2026-07-02T10:23:52.752Z",
		"size": 5104,
		"path": "../public/assets/_app.users-Co0LeD15.js"
	},
	"/assets/_app.users-groups-BGABjC9s.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"409b-oozVm9Peqq+pp0Nf8rtOlUcNznc\"",
		"mtime": "2026-07-02T10:23:52.752Z",
		"size": 16539,
		"path": "../public/assets/_app.users-groups-BGABjC9s.js"
	},
	"/assets/advanced-filter-BmlQ3kjh.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2618-7cdtvvH0zl46x+hIiVpEZuh4oJc\"",
		"mtime": "2026-07-02T10:23:52.752Z",
		"size": 9752,
		"path": "../public/assets/advanced-filter-BmlQ3kjh.js"
	},
	"/assets/api-B8ojn3kB.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2690-/3CcfSnlhEEfEdOyHCVPp/u8HHg\"",
		"mtime": "2026-07-02T10:23:52.752Z",
		"size": 9872,
		"path": "../public/assets/api-B8ojn3kB.js"
	},
	"/assets/arrow-left-BLRTPKZ1.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a5-ssvBHYAE7/CEg1cBrFn6/TffRJo\"",
		"mtime": "2026-07-02T10:23:52.752Z",
		"size": 165,
		"path": "../public/assets/arrow-left-BLRTPKZ1.js"
	},
	"/assets/auth-D6XG4pgq.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1ed-ZwBBPiR8NxJ1X5kfBA/xzgEOeRE\"",
		"mtime": "2026-07-02T10:23:52.752Z",
		"size": 493,
		"path": "../public/assets/auth-D6XG4pgq.js"
	},
	"/assets/check-CRDTyYVU.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7c-iPgP8zgtgpX8VpOlahPKhS1HmwA\"",
		"mtime": "2026-07-02T10:23:52.752Z",
		"size": 124,
		"path": "../public/assets/check-CRDTyYVU.js"
	},
	"/assets/circle-alert-1VfGQxKg.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"fa-yGqEVNaaCbRFiIKypY0pMsr6yHg\"",
		"mtime": "2026-07-02T10:23:52.752Z",
		"size": 250,
		"path": "../public/assets/circle-alert-1VfGQxKg.js"
	},
	"/assets/createLucideIcon-CBUgpw2Q.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4a3-DfGy/9r3p1Rb2cv3HkLRbxml6lc\"",
		"mtime": "2026-07-02T10:23:52.752Z",
		"size": 1187,
		"path": "../public/assets/createLucideIcon-CBUgpw2Q.js"
	},
	"/assets/dist-2qilgQUz.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7f3b-bPuS7AIL2Jg3mgz0eSFsR1/LNjg\"",
		"mtime": "2026-07-02T10:23:52.752Z",
		"size": 32571,
		"path": "../public/assets/dist-2qilgQUz.js"
	},
	"/assets/external-link-DHlcyY5u.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"fb-2kUPNZBrqqOqCKudqHza3dYN69o\"",
		"mtime": "2026-07-02T10:23:52.753Z",
		"size": 251,
		"path": "../public/assets/external-link-DHlcyY5u.js"
	},
	"/assets/formatDistanceToNow-KEGwCsOU.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"257d-gC3Gz3IawDSs9uPxCq2Olph+cbA\"",
		"mtime": "2026-07-02T10:23:52.753Z",
		"size": 9597,
		"path": "../public/assets/formatDistanceToNow-KEGwCsOU.js"
	},
	"/assets/index-DtxX27Jz.css": {
		"type": "text/css; charset=utf-8",
		"etag": "\"3c35-GybETsF6L6PuXEMieWyMg/5Dn7o\"",
		"mtime": "2026-07-02T10:23:52.765Z",
		"size": 15413,
		"path": "../public/assets/index-DtxX27Jz.css"
	},
	"/assets/key-round-UFY3flwB.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"163-bxcdQCb79tqvv4DAoQ6tuXWvR+k\"",
		"mtime": "2026-07-02T10:23:52.753Z",
		"size": 355,
		"path": "../public/assets/key-round-UFY3flwB.js"
	},
	"/assets/link-BJ6C5Q1z.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"52ec-GL+Donxn0HjCOFIrkObXqx2LU5c\"",
		"mtime": "2026-07-02T10:23:52.753Z",
		"size": 21228,
		"path": "../public/assets/link-BJ6C5Q1z.js"
	},
	"/assets/lock-DCfl2eJm.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"308-YKftuvXE8yhoGiuIFzIJUK1X8Tg\"",
		"mtime": "2026-07-02T10:23:52.753Z",
		"size": 776,
		"path": "../public/assets/lock-DCfl2eJm.js"
	},
	"/assets/login-DrF-xwMw.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2aeb-f/4vkZ4YvQ6qhhcDD7rg+zJMI54\"",
		"mtime": "2026-07-02T10:23:52.753Z",
		"size": 10987,
		"path": "../public/assets/login-DrF-xwMw.js"
	},
	"/assets/network-Dr6HLdJ_.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"180-qlGfs/g/8GWrFIIcLy254ZsYbAg\"",
		"mtime": "2026-07-02T10:23:52.753Z",
		"size": 384,
		"path": "../public/assets/network-Dr6HLdJ_.js"
	},
	"/assets/pencil-BjvQuPWH.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"114-t58WF0w/P9gGe4KnfgcMwKoUrdU\"",
		"mtime": "2026-07-02T10:23:52.753Z",
		"size": 276,
		"path": "../public/assets/pencil-BjvQuPWH.js"
	},
	"/assets/index-DGGwgK8j.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4de02-nfAk0Ia+YVmVYeRL4E/gyaybPPM\"",
		"mtime": "2026-07-02T10:23:52.746Z",
		"size": 318978,
		"path": "../public/assets/index-DGGwgK8j.js"
	},
	"/assets/play-GPzwiTnl.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"be-KD0xH5dxA1aDhlZVO8p2IgkMYKQ\"",
		"mtime": "2026-07-02T10:23:52.753Z",
		"size": 190,
		"path": "../public/assets/play-GPzwiTnl.js"
	},
	"/assets/plus-A9ndmWfz.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"99-BfuTaWZcKtMcP6aSJmJesuODp2Y\"",
		"mtime": "2026-07-02T10:23:52.753Z",
		"size": 153,
		"path": "../public/assets/plus-A9ndmWfz.js"
	},
	"/assets/power-D21hbtN2.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ad-MlzwGXaNDSfHJTs4oF6r/z64q0Q\"",
		"mtime": "2026-07-02T10:23:52.753Z",
		"size": 173,
		"path": "../public/assets/power-D21hbtN2.js"
	},
	"/assets/react-dom-B5F4EstY.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"dd2-2ZfJKYqcWThkFS3N+SRy7FQBeZE\"",
		"mtime": "2026-07-02T10:23:52.753Z",
		"size": 3538,
		"path": "../public/assets/react-dom-B5F4EstY.js"
	},
	"/assets/refresh-cw-B1xdvQol.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"141-DGDF5FnENr9gmI7AD2RQax2MDOM\"",
		"mtime": "2026-07-02T10:23:52.753Z",
		"size": 321,
		"path": "../public/assets/refresh-cw-B1xdvQol.js"
	},
	"/assets/routes-DJ7LAi8J.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"26-SoFMfAHVJ5oqB5t+mpFRoQvFIoc\"",
		"mtime": "2026-07-02T10:23:52.753Z",
		"size": 38,
		"path": "../public/assets/routes-DJ7LAi8J.js"
	},
	"/assets/scroll-text-BlKroznr.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"15d-PHBSgz0Udb54+hIOwDzx8BYi8U0\"",
		"mtime": "2026-07-02T10:23:52.753Z",
		"size": 349,
		"path": "../public/assets/scroll-text-BlKroznr.js"
	},
	"/assets/search-Dxkjm7FM.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ae-EU2r1mx1czJBOWL6v62TWAuCwKo\"",
		"mtime": "2026-07-02T10:23:52.754Z",
		"size": 174,
		"path": "../public/assets/search-Dxkjm7FM.js"
	},
	"/assets/server-D7KASwLy.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"152-9KKgBeAcbWJzunglF4UShrjpqM8\"",
		"mtime": "2026-07-02T10:23:52.754Z",
		"size": 338,
		"path": "../public/assets/server-D7KASwLy.js"
	},
	"/assets/setup-obRfo96U.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"19a7-LtFDtTcpTIblgl+onqeoAammDxA\"",
		"mtime": "2026-07-02T10:23:52.763Z",
		"size": 6567,
		"path": "../public/assets/setup-obRfo96U.js"
	},
	"/assets/shield-BzMq7bOQ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"110-Sb4qzqMW3gzMwCdT0Zc6dBrCPgU\"",
		"mtime": "2026-07-02T10:23:52.764Z",
		"size": 272,
		"path": "../public/assets/shield-BzMq7bOQ.js"
	},
	"/assets/shield-check-CZSJTBk2.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"140-PrOXdYorW3kIsjqiSDmr5+QFrHk\"",
		"mtime": "2026-07-02T10:23:52.764Z",
		"size": 320,
		"path": "../public/assets/shield-check-CZSJTBk2.js"
	},
	"/assets/sonner-3rvZOtra.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"214-EGrFVKfjnfmHdJaCw4Uoq/UXLpM\"",
		"mtime": "2026-07-02T10:23:52.764Z",
		"size": 532,
		"path": "../public/assets/sonner-3rvZOtra.js"
	},
	"/assets/terminal-KjiHurmW.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a2-mOQkYCGazjX+NF+OpRAbmgUQVOQ\"",
		"mtime": "2026-07-02T10:23:52.764Z",
		"size": 162,
		"path": "../public/assets/terminal-KjiHurmW.js"
	},
	"/assets/styles-C6jUxsQ8.css": {
		"type": "text/css; charset=utf-8",
		"etag": "\"b62f-9n2nucWbaRvyAYkO2e5/wW8KrMQ\"",
		"mtime": "2026-07-02T10:23:52.766Z",
		"size": 46639,
		"path": "../public/assets/styles-C6jUxsQ8.css"
	},
	"/assets/trash-2-CXB6D2RK.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"148-eid84AI1T7qa/gJtB+uDV3tqN18\"",
		"mtime": "2026-07-02T10:23:52.764Z",
		"size": 328,
		"path": "../public/assets/trash-2-CXB6D2RK.js"
	},
	"/assets/triangle-alert-DVB54scs.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"109-ARuhz/wu9SBI8J2WS0b4QHIGB3E\"",
		"mtime": "2026-07-02T10:23:52.765Z",
		"size": 265,
		"path": "../public/assets/triangle-alert-DVB54scs.js"
	},
	"/assets/ui-bits-BAzloaBv.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1d8b-qs58iljXMdKsLxoe02kPgKBG29s\"",
		"mtime": "2026-07-02T10:23:52.765Z",
		"size": 7563,
		"path": "../public/assets/ui-bits-BAzloaBv.js"
	},
	"/assets/useMatch-7SLysEPh.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4c3-lkKweNI5j4WhCXDtOCjH2THJ6kg\"",
		"mtime": "2026-07-02T10:23:52.765Z",
		"size": 1219,
		"path": "../public/assets/useMatch-7SLysEPh.js"
	},
	"/assets/useMutation-DnHuvFkD.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"8bd-CB33oaH78Fo7pIA9m9mEo+Mi/qE\"",
		"mtime": "2026-07-02T10:23:52.765Z",
		"size": 2237,
		"path": "../public/assets/useMutation-DnHuvFkD.js"
	},
	"/assets/useQuery-DjtcdAvA.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"224a-nFyh6S3LHy8Bxn6jwZ7x73r9xHg\"",
		"mtime": "2026-07-02T10:23:52.765Z",
		"size": 8778,
		"path": "../public/assets/useQuery-DjtcdAvA.js"
	},
	"/assets/useRouter-CRDlsBX2.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2aa-EUi1UQrVqotr05hzImxEFQbLyok\"",
		"mtime": "2026-07-02T10:23:52.765Z",
		"size": 682,
		"path": "../public/assets/useRouter-CRDlsBX2.js"
	},
	"/assets/user-Cgq92neD.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c4-P7fLqxv6Av41LMnDze7WWzo3R8k\"",
		"mtime": "2026-07-02T10:23:52.765Z",
		"size": 196,
		"path": "../public/assets/user-Cgq92neD.js"
	},
	"/assets/value-8xOwwyZS.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"240f-/DipoiEUn8kF+0SHdlPBgNNu6Tk\"",
		"mtime": "2026-07-02T10:23:52.765Z",
		"size": 9231,
		"path": "../public/assets/value-8xOwwyZS.js"
	},
	"/assets/wifi-DPpgjyrg.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"31b-/ueVS/dw+k9NQpw/rN+mtemFKO8\"",
		"mtime": "2026-07-02T10:23:52.765Z",
		"size": 795,
		"path": "../public/assets/wifi-DPpgjyrg.js"
	},
	"/assets/with-selector-C8e8WFcI.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"652-+7RdCd7WDbv1Q+CcJePYpj0jA7U\"",
		"mtime": "2026-07-02T10:23:52.765Z",
		"size": 1618,
		"path": "../public/assets/with-selector-C8e8WFcI.js"
	},
	"/assets/x-CIlbv9QU.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"9a-tHKqBQDgRbelrXVbbx94dXznHME\"",
		"mtime": "2026-07-02T10:23:52.765Z",
		"size": 154,
		"path": "../public/assets/x-CIlbv9QU.js"
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
