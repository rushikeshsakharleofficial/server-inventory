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
	"/os/redhat.svg": {
		"type": "image/svg+xml",
		"etag": "\"a41-vXKms6+L3tdUOwKNIm6vFg/d3hU\"",
		"mtime": "2026-07-02T12:41:03.236Z",
		"size": 2625,
		"path": "../public/os/redhat.svg"
	},
	"/os/ubuntu.svg": {
		"type": "image/svg+xml",
		"etag": "\"533-vQCS5rCF7P2n9jxAi7TMeaC6lZs\"",
		"mtime": "2026-07-02T12:41:03.236Z",
		"size": 1331,
		"path": "../public/os/ubuntu.svg"
	},
	"/providers/aws.svg": {
		"type": "image/svg+xml",
		"etag": "\"ea6-QFwKMC9bcHU4zVF3wOMI2MbU550\"",
		"mtime": "2026-07-02T12:41:03.236Z",
		"size": 3750,
		"path": "../public/providers/aws.svg"
	},
	"/providers/azure.png": {
		"type": "image/png",
		"etag": "\"1553-oFGB8SIDw4/LXRrRLyiX/AtPqZA\"",
		"mtime": "2026-07-02T12:41:03.236Z",
		"size": 5459,
		"path": "../public/providers/azure.png"
	},
	"/providers/digitalocean.png": {
		"type": "image/png",
		"etag": "\"2064-Wgt26go1kapL0yv8/LO1+rfQYZ4\"",
		"mtime": "2026-07-02T12:41:03.236Z",
		"size": 8292,
		"path": "../public/providers/digitalocean.png"
	},
	"/providers/gcp.svg": {
		"type": "image/svg+xml",
		"etag": "\"30f-dlFBT4J93eg10/aLqm2A8bBkQMk\"",
		"mtime": "2026-07-02T12:41:03.237Z",
		"size": 783,
		"path": "../public/providers/gcp.svg"
	},
	"/providers/hivelocity.png": {
		"type": "image/png",
		"etag": "\"248-Spb51JADl/VWsi+pfEWsBSGF+Lo\"",
		"mtime": "2026-07-02T12:41:03.237Z",
		"size": 584,
		"path": "../public/providers/hivelocity.png"
	},
	"/providers/linode.png": {
		"type": "image/png",
		"etag": "\"1c63-8NmruuGfbHfD+/isOL+WbKfO0q4\"",
		"mtime": "2026-07-02T12:41:03.237Z",
		"size": 7267,
		"path": "../public/providers/linode.png"
	},
	"/providers/ovh.png": {
		"type": "image/png",
		"etag": "\"17b41-2hESuI5jPWP7lLojwwjqTszh2Lo\"",
		"mtime": "2026-07-02T12:41:03.237Z",
		"size": 97089,
		"path": "../public/providers/ovh.png"
	},
	"/assets/AreaChart-CXNoOBgG.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"6198-TrjzDfv6T4+K1+/JVg9cZUVJk2I\"",
		"mtime": "2026-07-02T12:40:58.264Z",
		"size": 24984,
		"path": "../public/assets/AreaChart-CXNoOBgG.js"
	},
	"/assets/ErrorBarContext-DvI2a45Q.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2a6-P4OCCpRJ0C8akZd9z/pS4qC9fJ0\"",
		"mtime": "2026-07-02T12:40:58.265Z",
		"size": 678,
		"path": "../public/assets/ErrorBarContext-DvI2a45Q.js"
	},
	"/assets/PieChart-N1mOpWyB.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4472-E4KsWHQvPb8Za/EmmsZeyLH3tiA\"",
		"mtime": "2026-07-02T12:40:58.265Z",
		"size": 17522,
		"path": "../public/assets/PieChart-N1mOpWyB.js"
	},
	"/assets/_app-C60a_34P.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"108ea-cXDwke0jxdKiu/PF1N8QrlxIAig\"",
		"mtime": "2026-07-02T12:40:58.265Z",
		"size": 67818,
		"path": "../public/assets/_app-C60a_34P.js"
	},
	"/assets/_app.block-storages-q3joADZH.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"e46-5AYdkuSsyyS56F3rj187nuv9umI\"",
		"mtime": "2026-07-02T12:40:58.265Z",
		"size": 3654,
		"path": "../public/assets/_app.block-storages-q3joADZH.js"
	},
	"/assets/_app.cloud-providers-CgR6vOMA.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2a7c-2JC58D1JI9T24uv2ST6KNCnbo9U\"",
		"mtime": "2026-07-02T12:40:58.265Z",
		"size": 10876,
		"path": "../public/assets/_app.cloud-providers-CgR6vOMA.js"
	},
	"/assets/_app.crons-BhBRuZjX.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1dd1-8Rw+U/OhqnfJp2vq2ljCTbAFv3A\"",
		"mtime": "2026-07-02T12:40:58.265Z",
		"size": 7633,
		"path": "../public/assets/_app.crons-BhBRuZjX.js"
	},
	"/assets/_app.dashboard-DUpzoWgL.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7f1e-MoQXxr6ofCZDxFUgTE129FEi+rw\"",
		"mtime": "2026-07-02T12:40:58.265Z",
		"size": 32542,
		"path": "../public/assets/_app.dashboard-DUpzoWgL.js"
	},
	"/assets/_app.databases-Dq8CmaSl.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"f5b-1js+oh2ypPNXZIEQqZw5rgN4NwA\"",
		"mtime": "2026-07-02T12:40:58.265Z",
		"size": 3931,
		"path": "../public/assets/_app.databases-Dq8CmaSl.js"
	},
	"/assets/CartesianChart-BJby2xvE.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4f227-IsrPVO5LsiTkKRPhlQ4tmJTePoE\"",
		"mtime": "2026-07-02T12:40:58.264Z",
		"size": 324135,
		"path": "../public/assets/CartesianChart-BJby2xvE.js"
	},
	"/assets/_app.ips-k0PFcnxl.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"b85-dxWD6PcGNt3g9VsU1GTQVqJCdbA\"",
		"mtime": "2026-07-02T12:40:58.266Z",
		"size": 2949,
		"path": "../public/assets/_app.ips-k0PFcnxl.js"
	},
	"/assets/_app.event-logs-Cpi3AUbh.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4f4e-U8Qr303lZl2zlATy6ZDc3yFDr8I\"",
		"mtime": "2026-07-02T12:40:58.266Z",
		"size": 20302,
		"path": "../public/assets/_app.event-logs-Cpi3AUbh.js"
	},
	"/assets/_app.kubernetes-jkRlpvzT.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ef3-JWKJGri48NUrOuDp5+7BUGnnSac\"",
		"mtime": "2026-07-02T12:40:58.266Z",
		"size": 3827,
		"path": "../public/assets/_app.kubernetes-jkRlpvzT.js"
	},
	"/assets/_app.policies-DdiUeObr.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1d95-wClz1XRNg4T1dZSqKiTXKUvDGvw\"",
		"mtime": "2026-07-02T12:40:58.266Z",
		"size": 7573,
		"path": "../public/assets/_app.policies-DdiUeObr.js"
	},
	"/assets/_app.policies._slug-DKMLsOUr.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1465-Lq+cZIOzuOqujrYevwnbWWAZPjE\"",
		"mtime": "2026-07-02T12:40:58.266Z",
		"size": 5221,
		"path": "../public/assets/_app.policies._slug-DKMLsOUr.js"
	},
	"/assets/_app.provider-credentials-CUwOzsxL.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7a7c-RhPqvOatg52sIGcckvAiIBOS6P8\"",
		"mtime": "2026-07-02T12:40:58.266Z",
		"size": 31356,
		"path": "../public/assets/_app.provider-credentials-CUwOzsxL.js"
	},
	"/assets/_app.server-detail._id-DdRiDOYB.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3ba4-/3Y9PiNEHwYlqyy3PgEQoCxtjxs\"",
		"mtime": "2026-07-02T12:40:58.266Z",
		"size": 15268,
		"path": "../public/assets/_app.server-detail._id-DdRiDOYB.js"
	},
	"/assets/_app.servers-rfr_yIZh.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3f01-zP6UzTts39RJxxzxPqug64z/Dgg\"",
		"mtime": "2026-07-02T12:40:58.266Z",
		"size": 16129,
		"path": "../public/assets/_app.servers-rfr_yIZh.js"
	},
	"/assets/_app.settings-BrSAN5ex.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5f1c-rL8wFAb6wIXr2RF+o3ny2q/M8BQ\"",
		"mtime": "2026-07-02T12:40:58.266Z",
		"size": 24348,
		"path": "../public/assets/_app.settings-BrSAN5ex.js"
	},
	"/assets/_app.ssh-keys-DhWjTale.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"25ab-YxaTTJKIFnhK+7kY6Ug94YOKypw\"",
		"mtime": "2026-07-02T12:40:58.267Z",
		"size": 9643,
		"path": "../public/assets/_app.ssh-keys-DhWjTale.js"
	},
	"/assets/_app.stats-CDHxXm3z.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"721e-KOA88vzfMczxYz/OIEVK3Iznbpw\"",
		"mtime": "2026-07-02T12:40:58.267Z",
		"size": 29214,
		"path": "../public/assets/_app.stats-CDHxXm3z.js"
	},
	"/assets/_app.sync-Cljevadc.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c42-e/EFFFPPAH3Ad60ro4U57AZ80x4\"",
		"mtime": "2026-07-02T12:40:58.267Z",
		"size": 3138,
		"path": "../public/assets/_app.sync-Cljevadc.js"
	},
	"/assets/_app.resource-map-Bal2FkGB.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2db4c-Pty8puxpFLr/28jVkYEXt7/lSDk\"",
		"mtime": "2026-07-02T12:40:58.266Z",
		"size": 187212,
		"path": "../public/assets/_app.resource-map-Bal2FkGB.js"
	},
	"/assets/_app.users-D5-y4V4Z.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"13eb-vDvThe67KjY5tqea1bNzRfB+Gr0\"",
		"mtime": "2026-07-02T12:40:58.267Z",
		"size": 5099,
		"path": "../public/assets/_app.users-D5-y4V4Z.js"
	},
	"/assets/_app.users-groups-COiU-Vga.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4096-5ozdwfOUsXAQnPkWxP9H6vEoLgE\"",
		"mtime": "2026-07-02T12:40:58.267Z",
		"size": 16534,
		"path": "../public/assets/_app.users-groups-COiU-Vga.js"
	},
	"/assets/advanced-filter-CeRhXLhj.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2618-7Zyo4zLaR7TP5LVcxkWCDIQlR/8\"",
		"mtime": "2026-07-02T12:40:58.267Z",
		"size": 9752,
		"path": "../public/assets/advanced-filter-CeRhXLhj.js"
	},
	"/assets/api-DftT4Aeq.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"26eb-9o5UFmMapHHYGxdtVG3ao86cq8o\"",
		"mtime": "2026-07-02T12:40:58.267Z",
		"size": 9963,
		"path": "../public/assets/api-DftT4Aeq.js"
	},
	"/assets/arrow-left-Be6SzkUR.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a5-41lY9NptRPezo6xiOPEqMxHR0vE\"",
		"mtime": "2026-07-02T12:40:58.267Z",
		"size": 165,
		"path": "../public/assets/arrow-left-Be6SzkUR.js"
	},
	"/assets/auth-CQIC-QXE.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1ed-EKkOOI4CvMk0n/f5kAndRXVTZnw\"",
		"mtime": "2026-07-02T12:40:58.267Z",
		"size": 493,
		"path": "../public/assets/auth-CQIC-QXE.js"
	},
	"/assets/check-Dd1jCW14.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7c-UpKupE68X4J/3UFJyQUdJ55uc78\"",
		"mtime": "2026-07-02T12:40:58.267Z",
		"size": 124,
		"path": "../public/assets/check-Dd1jCW14.js"
	},
	"/assets/circle-alert-Bhbz-uwq.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"fa-HKlUE5uT4Duf25DYdtZsHg/J3B0\"",
		"mtime": "2026-07-02T12:40:58.267Z",
		"size": 250,
		"path": "../public/assets/circle-alert-Bhbz-uwq.js"
	},
	"/assets/createLucideIcon-D3grNCvt.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4a3-cDgizY80FGFHIP3apAPfMXs/pqk\"",
		"mtime": "2026-07-02T12:40:58.267Z",
		"size": 1187,
		"path": "../public/assets/createLucideIcon-D3grNCvt.js"
	},
	"/assets/dist-C6PFjKu4.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7f3b-4RfS4VZGGprhej9wvzbSL1jDsYo\"",
		"mtime": "2026-07-02T12:40:58.267Z",
		"size": 32571,
		"path": "../public/assets/dist-C6PFjKu4.js"
	},
	"/assets/external-link-D5C4IH4P.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"fb-tWjoO3isjTamnNA+Tgjvu1xnZ4Y\"",
		"mtime": "2026-07-02T12:40:58.267Z",
		"size": 251,
		"path": "../public/assets/external-link-D5C4IH4P.js"
	},
	"/assets/formatDistanceToNow-KEGwCsOU.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"257d-gC3Gz3IawDSs9uPxCq2Olph+cbA\"",
		"mtime": "2026-07-02T12:40:58.267Z",
		"size": 9597,
		"path": "../public/assets/formatDistanceToNow-KEGwCsOU.js"
	},
	"/assets/key-round-XCDcalnH.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"163-lewTu/UVpSZbNzKPr940bJNF/bM\"",
		"mtime": "2026-07-02T12:40:58.268Z",
		"size": 355,
		"path": "../public/assets/key-round-XCDcalnH.js"
	},
	"/assets/index-DtxX27Jz.css": {
		"type": "text/css; charset=utf-8",
		"etag": "\"3c35-GybETsF6L6PuXEMieWyMg/5Dn7o\"",
		"mtime": "2026-07-02T12:40:58.269Z",
		"size": 15413,
		"path": "../public/assets/index-DtxX27Jz.css"
	},
	"/assets/link-BTlN6DhK.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"52ec-yWYIRjnufeKaxWZWnjP6sa+KpFo\"",
		"mtime": "2026-07-02T12:40:58.268Z",
		"size": 21228,
		"path": "../public/assets/link-BTlN6DhK.js"
	},
	"/assets/lock-hODjYwSg.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"308-rYqAbrhaCMITPUk30yk2J5mHPS0\"",
		"mtime": "2026-07-02T12:40:58.268Z",
		"size": 776,
		"path": "../public/assets/lock-hODjYwSg.js"
	},
	"/assets/login-CAxi2nQe.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2a68-qFDKAlsCsIapPjSh3O8jQEm+s5Q\"",
		"mtime": "2026-07-02T12:40:58.268Z",
		"size": 10856,
		"path": "../public/assets/login-CAxi2nQe.js"
	},
	"/assets/index-BKnrBwGV.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4de48-tkN0p7qGFMnrtwo+yWIwKk+fitU\"",
		"mtime": "2026-07-02T12:40:58.262Z",
		"size": 319048,
		"path": "../public/assets/index-BKnrBwGV.js"
	},
	"/assets/network-DImydCIq.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"180-5QSQPPmQzyr7YX/0xmQzVWmRV24\"",
		"mtime": "2026-07-02T12:40:58.268Z",
		"size": 384,
		"path": "../public/assets/network-DImydCIq.js"
	},
	"/assets/pencil-D3OUMN_j.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"114-mPhGXKMHc4iYhEDl4yJkV3VnzZY\"",
		"mtime": "2026-07-02T12:40:58.268Z",
		"size": 276,
		"path": "../public/assets/pencil-D3OUMN_j.js"
	},
	"/assets/play-BFE4NwmJ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"be-XdnB3P41+nb8RtPT/Pko4xvdfmg\"",
		"mtime": "2026-07-02T12:40:58.268Z",
		"size": 190,
		"path": "../public/assets/play-BFE4NwmJ.js"
	},
	"/assets/plus-CsxPQKGc.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"99-w1oRI8ybNw+ehYHKwDfZqynBZMI\"",
		"mtime": "2026-07-02T12:40:58.268Z",
		"size": 153,
		"path": "../public/assets/plus-CsxPQKGc.js"
	},
	"/assets/power-CT2ezMMm.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ad-kbRkVOs+YV+IhhUL45iYml1cP4g\"",
		"mtime": "2026-07-02T12:40:58.268Z",
		"size": 173,
		"path": "../public/assets/power-CT2ezMMm.js"
	},
	"/assets/react-dom-Cl2D-sa1.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"dd2-B7AKXot+1K177mIbTarBShgcgQs\"",
		"mtime": "2026-07-02T12:40:58.268Z",
		"size": 3538,
		"path": "../public/assets/react-dom-Cl2D-sa1.js"
	},
	"/assets/refresh-cw-Df8J2pnr.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"141-EgiH74hSs4sPem4OoQxIo8cEjnc\"",
		"mtime": "2026-07-02T12:40:58.268Z",
		"size": 321,
		"path": "../public/assets/refresh-cw-Df8J2pnr.js"
	},
	"/assets/routes-DJ7LAi8J.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"26-SoFMfAHVJ5oqB5t+mpFRoQvFIoc\"",
		"mtime": "2026-07-02T12:40:58.268Z",
		"size": 38,
		"path": "../public/assets/routes-DJ7LAi8J.js"
	},
	"/assets/scroll-text-Dc8oWp-I.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"15d-zZWQyCVX+DUNOuc/jKEcNkudg4I\"",
		"mtime": "2026-07-02T12:40:58.268Z",
		"size": 349,
		"path": "../public/assets/scroll-text-Dc8oWp-I.js"
	},
	"/assets/search-B_WYAFUB.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ae-UptIMWXBiRjh5PJwnnZ//TY+QNQ\"",
		"mtime": "2026-07-02T12:40:58.268Z",
		"size": 174,
		"path": "../public/assets/search-B_WYAFUB.js"
	},
	"/assets/server-CaMBhDsh.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"152-ZbeoYa7b4O2WbSWYSsSfP6BA1bg\"",
		"mtime": "2026-07-02T12:40:58.268Z",
		"size": 338,
		"path": "../public/assets/server-CaMBhDsh.js"
	},
	"/assets/setup-D4rv1lZw.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"19a7-XPl5ppQ6q5mXHU1Eal7XUQwSl18\"",
		"mtime": "2026-07-02T12:40:58.268Z",
		"size": 6567,
		"path": "../public/assets/setup-D4rv1lZw.js"
	},
	"/assets/shield-BaRQIkdt.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"110-e9OQcFEwpRCYXbYqW0Fn+CYGUXk\"",
		"mtime": "2026-07-02T12:40:58.268Z",
		"size": 272,
		"path": "../public/assets/shield-BaRQIkdt.js"
	},
	"/assets/shield-check-Ddbt-8WF.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"140-QP+lmKxiV72JLWOIwWZSzW61WJI\"",
		"mtime": "2026-07-02T12:40:58.268Z",
		"size": 320,
		"path": "../public/assets/shield-check-Ddbt-8WF.js"
	},
	"/assets/sonner-DHq-5-Fb.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"214-8VyDpfp9orynPH03m6CDDYPA7O4\"",
		"mtime": "2026-07-02T12:40:58.268Z",
		"size": 532,
		"path": "../public/assets/sonner-DHq-5-Fb.js"
	},
	"/assets/terminal-Bn19LRzl.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a2-fgN6jRJRiSqTdq3J8tez7U9Y9H4\"",
		"mtime": "2026-07-02T12:40:58.269Z",
		"size": 162,
		"path": "../public/assets/terminal-Bn19LRzl.js"
	},
	"/assets/styles-PzyPJm4O.css": {
		"type": "text/css; charset=utf-8",
		"etag": "\"b98f-YwmlAeCjszDdE6SkA/yvBNU8OoY\"",
		"mtime": "2026-07-02T12:40:58.269Z",
		"size": 47503,
		"path": "../public/assets/styles-PzyPJm4O.css"
	},
	"/assets/trash-2-zQHUKpM6.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"148-X3BDTZ/dXXQwzpZYvedni686igU\"",
		"mtime": "2026-07-02T12:40:58.269Z",
		"size": 328,
		"path": "../public/assets/trash-2-zQHUKpM6.js"
	},
	"/assets/triangle-alert-CWjPUx9K.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"109-CCsaq/cvTZx0KuH+bc2YCwMYT7c\"",
		"mtime": "2026-07-02T12:40:58.269Z",
		"size": 265,
		"path": "../public/assets/triangle-alert-CWjPUx9K.js"
	},
	"/assets/ui-bits-C9nbCBnV.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1f14-qyCLkfRDyKT4QC/0gdNCHZ+ZPbY\"",
		"mtime": "2026-07-02T12:40:58.269Z",
		"size": 7956,
		"path": "../public/assets/ui-bits-C9nbCBnV.js"
	},
	"/assets/useMatch-Dg36rGyA.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4c3-KdIe2owUul6mMAihkJMTTUFdnxU\"",
		"mtime": "2026-07-02T12:40:58.269Z",
		"size": 1219,
		"path": "../public/assets/useMatch-Dg36rGyA.js"
	},
	"/assets/useMutation-DO-5PRZI.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"8c2-5n2MyilPlXG9LLl/HB6Hi1ISC8M\"",
		"mtime": "2026-07-02T12:40:58.269Z",
		"size": 2242,
		"path": "../public/assets/useMutation-DO-5PRZI.js"
	},
	"/assets/useQuery-BE0nFMUe.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"224a-PehWs4Hk+khbVnYyYfDaHsCNfx0\"",
		"mtime": "2026-07-02T12:40:58.269Z",
		"size": 8778,
		"path": "../public/assets/useQuery-BE0nFMUe.js"
	},
	"/assets/useRouter-CiDGC6AP.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2aa-eOxhauAXDPpkN7KjCtJlfS5jdR0\"",
		"mtime": "2026-07-02T12:40:58.269Z",
		"size": 682,
		"path": "../public/assets/useRouter-CiDGC6AP.js"
	},
	"/assets/user-KI-WQM1F.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c4-WBR29rM27gg8PEk24XCtHAIUo9w\"",
		"mtime": "2026-07-02T12:40:58.269Z",
		"size": 196,
		"path": "../public/assets/user-KI-WQM1F.js"
	},
	"/assets/wifi-CQGk_map.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"31b-yzSLdS52NvoLQv0mmxGbYipgvNE\"",
		"mtime": "2026-07-02T12:40:58.269Z",
		"size": 795,
		"path": "../public/assets/wifi-CQGk_map.js"
	},
	"/assets/with-selector-DtW0n3nP.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"652-Qv7nUdBCyTNFvrkcDVhBmHlXZ9o\"",
		"mtime": "2026-07-02T12:40:58.269Z",
		"size": 1618,
		"path": "../public/assets/with-selector-DtW0n3nP.js"
	},
	"/assets/x-6mSEx55J.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"9a-ePt8cT2QaS+3dfL08R64z4xbZoo\"",
		"mtime": "2026-07-02T12:40:58.269Z",
		"size": 154,
		"path": "../public/assets/x-6mSEx55J.js"
	},
	"/assets/value-8xOwwyZS.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"240f-/DipoiEUn8kF+0SHdlPBgNNu6Tk\"",
		"mtime": "2026-07-02T12:40:58.269Z",
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
