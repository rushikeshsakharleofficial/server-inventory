import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { tokenStore } from "@/lib/api";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/_app")({
  beforeLoad: () => {
    if (typeof globalThis.window !== "undefined" && !tokenStore.get()) {
      throw redirect({ to: "/login" });
    }
  },
  component: AppLayout,
});

function AppLayout() {
  return (
    <>
      <AppShell>
        <Outlet />
      </AppShell>
      <Toaster position="top-right" richColors />
    </>
  );
}
