import { r as __toESM } from "../_runtime.mjs";
import { n as tokenStore } from "./api-DNcet4h7.mjs";
import { a as require_react, o as require_jsx_runtime, r as QueryClientProvider } from "../_libs/react+tanstack__react-query.mjs";
import { F as useRouter, O as redirect, c as HeadContent, d as createRouter, f as Outlet, h as createRootRouteWithContext, m as createFileRoute, p as lazyRouteComponent, s as Scripts } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as QueryClient } from "../_libs/tanstack__query-core.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/router-Q55tjUSA.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var styles_default = "/assets/styles-FVOKeTrS.css";
function reportLovableError(error, context = {}) {
	if (typeof window === "undefined") return;
	window.__lovableEvents?.captureException?.(error, {
		source: "react_error_boundary",
		route: window.location.pathname,
		...context
	}, {
		mechanism: "react_error_boundary",
		handled: false,
		severity: "error"
	});
}
function NotFoundComponent() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex min-h-screen items-center justify-center bg-background px-4",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "max-w-md text-center",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "text-7xl font-bold text-foreground",
					children: "404"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "mt-4 text-xl font-semibold text-foreground",
					children: "Page not found"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-muted-foreground",
					children: "The route you're looking for doesn't exist."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-6",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
						href: "/",
						className: "inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90",
						children: "Go home"
					})
				})
			]
		})
	});
}
function ErrorComponent({ error, reset }) {
	console.error(error);
	const router = useRouter();
	(0, import_react.useEffect)(() => {
		reportLovableError(error, { boundary: "tanstack_root_error_component" });
	}, [error]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex min-h-screen items-center justify-center bg-background px-4",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "max-w-md text-center",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "text-xl font-semibold tracking-tight text-foreground",
					children: "This page didn't load"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-muted-foreground",
					children: error.message
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-6 flex flex-wrap justify-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: () => {
							router.invalidate();
							reset();
						},
						className: "inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90",
						children: "Try again"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
						href: "/",
						className: "inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent",
						children: "Go home"
					})]
				})
			]
		})
	});
}
var Route$15 = createRootRouteWithContext()({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1"
			},
			{ title: "System Control — Multi-cloud server inventory" },
			{
				name: "description",
				content: "Operator console for managing servers, databases, Kubernetes, and storage across cloud providers."
			},
			{
				property: "og:title",
				content: "System Control — Multi-cloud server inventory"
			},
			{
				name: "twitter:title",
				content: "System Control — Multi-cloud server inventory"
			},
			{
				property: "og:description",
				content: "Operator console for managing servers, databases, Kubernetes, and storage across cloud providers."
			},
			{
				name: "twitter:description",
				content: "Operator console for managing servers, databases, Kubernetes, and storage across cloud providers."
			},
			{
				property: "og:image",
				content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/5a3bbf29-bbf5-424a-9ff0-9fa99979bc14/id-preview-45b98e1a--fd2d5ef4-6a05-491c-94fa-c6f7173492d8.lovable.app-1782822396383.png"
			},
			{
				name: "twitter:image",
				content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/5a3bbf29-bbf5-424a-9ff0-9fa99979bc14/id-preview-45b98e1a--fd2d5ef4-6a05-491c-94fa-c6f7173492d8.lovable.app-1782822396383.png"
			},
			{
				name: "twitter:card",
				content: "summary_large_image"
			},
			{
				property: "og:type",
				content: "website"
			}
		],
		links: [
			{
				rel: "stylesheet",
				href: styles_default
			},
			{
				rel: "preconnect",
				href: "https://fonts.googleapis.com"
			},
			{
				rel: "preconnect",
				href: "https://fonts.gstatic.com",
				crossOrigin: "anonymous"
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&family=Inter:wght@400;500;600;700&display=swap"
			}
		]
	}),
	shellComponent: RootShell,
	component: RootComponent,
	notFoundComponent: NotFoundComponent,
	errorComponent: ErrorComponent
});
function RootShell({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("html", {
		lang: "en",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("head", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeadContent, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("body", { children: [children, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scripts, {})] })]
	});
}
function RootComponent() {
	const { queryClient } = Route$15.useRouteContext();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QueryClientProvider, {
		client: queryClient,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {})
	});
}
var $$splitComponentImporter$14 = () => import("./login-Ddt7YEK7.mjs");
var Route$14 = createFileRoute("/login")({
	head: () => ({ meta: [{ title: "Sign in — System Control" }] }),
	component: lazyRouteComponent($$splitComponentImporter$14, "component")
});
var $$splitComponentImporter$13 = () => import("../_app-CHGQ5Cp_.mjs");
var Route$13 = createFileRoute("/_app")({
	beforeLoad: () => {
		if (typeof window !== "undefined" && !tokenStore.get()) throw redirect({ to: "/login" });
	},
	component: lazyRouteComponent($$splitComponentImporter$13, "component")
});
var $$splitComponentImporter$12 = () => import("./routes-DTEZEvkE.mjs");
var Route$12 = createFileRoute("/")({
	beforeLoad: () => {
		throw redirect({ to: tokenStore.get() ? "/dashboard" : "/login" });
	},
	component: lazyRouteComponent($$splitComponentImporter$12, "component")
});
var $$splitComponentImporter$11 = () => import("../_app.users-BAjx__8N.mjs");
var Route$11 = createFileRoute("/_app/users")({
	head: () => ({ meta: [{ title: "Users — System Control" }] }),
	component: lazyRouteComponent($$splitComponentImporter$11, "component")
});
var $$splitComponentImporter$10 = () => import("../_app.sync-CUgxDVJ0.mjs");
var Route$10 = createFileRoute("/_app/sync")({
	head: () => ({ meta: [{ title: "Sync — System Control" }] }),
	component: lazyRouteComponent($$splitComponentImporter$10, "component")
});
var $$splitComponentImporter$9 = () => import("../_app.ssh-keys-CLDaOHpe.mjs");
var Route$9 = createFileRoute("/_app/ssh-keys")({
	head: () => ({ meta: [{ title: "SSH Keys — System Control" }] }),
	component: lazyRouteComponent($$splitComponentImporter$9, "component")
});
var $$splitComponentImporter$8 = () => import("../_app.settings-D-0Q80rQ.mjs");
var Route$8 = createFileRoute("/_app/settings")({
	head: () => ({ meta: [{ title: "Settings — System Control" }] }),
	component: lazyRouteComponent($$splitComponentImporter$8, "component")
});
var $$splitComponentImporter$7 = () => import("../_app.servers-DRDO0rf_.mjs");
var Route$7 = createFileRoute("/_app/servers")({
	head: () => ({ meta: [{ title: "Servers — System Control" }] }),
	component: lazyRouteComponent($$splitComponentImporter$7, "component")
});
var $$splitComponentImporter$6 = () => import("../_app.resource-map-DrU0L_2i.mjs");
var Route$6 = createFileRoute("/_app/resource-map")({
	head: () => ({ meta: [{ title: "Resource Map — System Control" }] }),
	component: lazyRouteComponent($$splitComponentImporter$6, "component")
});
var $$splitComponentImporter$5 = () => import("../_app.kubernetes-DoCNEjP1.mjs");
var Route$5 = createFileRoute("/_app/kubernetes")({
	head: () => ({ meta: [{ title: "Kubernetes — System Control" }] }),
	component: lazyRouteComponent($$splitComponentImporter$5, "component")
});
var $$splitComponentImporter$4 = () => import("../_app.databases-eWMqJoNM.mjs");
var Route$4 = createFileRoute("/_app/databases")({
	head: () => ({ meta: [{ title: "Databases — System Control" }] }),
	component: lazyRouteComponent($$splitComponentImporter$4, "component")
});
var $$splitComponentImporter$3 = () => import("../_app.dashboard-_OwWuYDr.mjs");
var Route$3 = createFileRoute("/_app/dashboard")({
	head: () => ({ meta: [{ title: "Dashboard — System Control" }] }),
	component: lazyRouteComponent($$splitComponentImporter$3, "component")
});
var $$splitComponentImporter$2 = () => import("../_app.crons-VVbdj1tW.mjs");
var Route$2 = createFileRoute("/_app/crons")({
	head: () => ({ meta: [{ title: "Crons — System Control" }] }),
	component: lazyRouteComponent($$splitComponentImporter$2, "component")
});
var $$splitComponentImporter$1 = () => import("../_app.credentials-BC8vOIvm.mjs");
var Route$1 = createFileRoute("/_app/credentials")({
	head: () => ({ meta: [{ title: "Credentials — System Control" }] }),
	component: lazyRouteComponent($$splitComponentImporter$1, "component")
});
var $$splitComponentImporter = () => import("../_app.block-storages-Cx9pgFgF.mjs");
var Route = createFileRoute("/_app/block-storages")({
	head: () => ({ meta: [{ title: "Block Storage — System Control" }] }),
	component: lazyRouteComponent($$splitComponentImporter, "component")
});
var LoginRoute = Route$14.update({
	id: "/login",
	path: "/login",
	getParentRoute: () => Route$15
});
var AppRoute = Route$13.update({
	id: "/_app",
	getParentRoute: () => Route$15
});
var IndexRoute = Route$12.update({
	id: "/",
	path: "/",
	getParentRoute: () => Route$15
});
var AppUsersRoute = Route$11.update({
	id: "/users",
	path: "/users",
	getParentRoute: () => AppRoute
});
var AppSyncRoute = Route$10.update({
	id: "/sync",
	path: "/sync",
	getParentRoute: () => AppRoute
});
var AppSshKeysRoute = Route$9.update({
	id: "/ssh-keys",
	path: "/ssh-keys",
	getParentRoute: () => AppRoute
});
var AppSettingsRoute = Route$8.update({
	id: "/settings",
	path: "/settings",
	getParentRoute: () => AppRoute
});
var AppServersRoute = Route$7.update({
	id: "/servers",
	path: "/servers",
	getParentRoute: () => AppRoute
});
var AppResourceMapRoute = Route$6.update({
	id: "/resource-map",
	path: "/resource-map",
	getParentRoute: () => AppRoute
});
var AppKubernetesRoute = Route$5.update({
	id: "/kubernetes",
	path: "/kubernetes",
	getParentRoute: () => AppRoute
});
var AppDatabasesRoute = Route$4.update({
	id: "/databases",
	path: "/databases",
	getParentRoute: () => AppRoute
});
var AppDashboardRoute = Route$3.update({
	id: "/dashboard",
	path: "/dashboard",
	getParentRoute: () => AppRoute
});
var AppCronsRoute = Route$2.update({
	id: "/crons",
	path: "/crons",
	getParentRoute: () => AppRoute
});
var AppCredentialsRoute = Route$1.update({
	id: "/credentials",
	path: "/credentials",
	getParentRoute: () => AppRoute
});
var AppRouteChildren = {
	AppBlockStoragesRoute: Route.update({
		id: "/block-storages",
		path: "/block-storages",
		getParentRoute: () => AppRoute
	}),
	AppCredentialsRoute,
	AppCronsRoute,
	AppDashboardRoute,
	AppDatabasesRoute,
	AppKubernetesRoute,
	AppResourceMapRoute,
	AppServersRoute,
	AppSettingsRoute,
	AppSshKeysRoute,
	AppSyncRoute,
	AppUsersRoute
};
var rootRouteChildren = {
	IndexRoute,
	AppRoute: AppRoute._addFileChildren(AppRouteChildren),
	LoginRoute
};
var routeTree = Route$15._addFileChildren(rootRouteChildren)._addFileTypes();
var getRouter = () => {
	return createRouter({
		routeTree,
		context: { queryClient: new QueryClient() },
		scrollRestoration: true,
		defaultPreloadStaleTime: 0
	});
};
//#endregion
export { getRouter };
