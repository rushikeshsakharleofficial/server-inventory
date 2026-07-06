import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Default staleTime is 0 — every route navigation and window focus
        // refetches everything from scratch, even data fetched seconds ago.
        // 30s means switching between pages you've already visited recently
        // shows cached data instantly instead of waiting on a fresh
        // round trip every time. Routes needing fresher data (ip-inventory,
        // resource-map) already set their own staleTime, which wins over this.
        staleTime: 30_000,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
