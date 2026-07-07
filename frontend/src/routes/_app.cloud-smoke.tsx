import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { Card, PageHeader, EmptyState, StatusPill } from "@/components/ui-bits";

export const Route = createFileRoute("/_app/cloud-smoke")({
  head: () => ({ meta: [{ title: "Cloud API Verification — System Control" }] }),
  component: CloudSmokePage,
});

interface SmokeResult {
  provider: string;
  credential_name: string | null;
  status: string;
  servers_checked: number;
  databases_checked: number;
  kubernetes_checked: number;
  block_storage_checked: number;
  api_calls: number;
  warnings: string[];
  errors: { asset_type: string; error: string }[];
}

function CloudSmokePage() {
  const qc = useQueryClient();

  const { data: statusData } = useQuery({
    queryKey: ["cloud-smoke-status"],
    queryFn: () => api<{ enabled: boolean }>("/api/cloud-smoke/status"),
  });

  const { data: report, isLoading } = useQuery({
    queryKey: ["cloud-smoke-report"],
    queryFn: () => api<{ results: SmokeResult[] }>("/api/cloud-smoke/report/latest"),
    enabled: !!statusData?.enabled,
    retry: false,
  });

  const run = useMutation({
    mutationFn: () => api<{ results: SmokeResult[] }>("/api/cloud-smoke/run-readonly", { method: "POST" }),
    onSuccess: () => {
      toast.success("Read-only cloud verification finished.");
      qc.invalidateQueries({ queryKey: ["cloud-smoke-report"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const results = report?.results ?? [];

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Cloud API Verification"
        description="Read-only real-provider connectivity check. Never creates or modifies cloud resources."
      />

      {statusData && !statusData.enabled && (
        <Card className="p-4 text-sm text-muted-foreground">
          Disabled — set <code className="font-mono">ENABLE_REAL_CLOUD_SMOKE=true</code> on the backend to use this page.
        </Card>
      )}

      {statusData?.enabled && (
        <>
          <Card className="p-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Runs read-only list/describe calls against every active credential.</span>
            <button
              onClick={() => run.mutate()}
              disabled={run.isPending}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              <RefreshCw className={`size-3.5 ${run.isPending ? "animate-spin" : ""}`} />
              {run.isPending ? "Verifying…" : "Run Verification"}
            </button>
          </Card>

          {!isLoading && results.length === 0 && (
            <EmptyState title="No report yet" description="Run verification to see results." />
          )}

          {results.map((r) => (
            <Card key={`${r.provider}-${r.credential_name}`} className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">{r.provider}{r.credential_name ? ` — ${r.credential_name}` : ""}</span>
                <StatusPill status={r.status} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs text-muted-foreground">
                <span>Servers: {r.servers_checked}</span>
                <span>Databases: {r.databases_checked}</span>
                <span>Kubernetes: {r.kubernetes_checked}</span>
                <span>Block Storage: {r.block_storage_checked}</span>
                <span>API calls: {r.api_calls}</span>
              </div>
              {r.warnings.length > 0 && (
                <ul className="text-xs text-amber-600 list-disc list-inside">
                  {r.warnings.map((w) => <li key={w}>{w}</li>)}
                </ul>
              )}
              {r.errors.length > 0 && (
                <ul className="text-xs text-red-600 list-disc list-inside">
                  {r.errors.map((e) => <li key={`${e.asset_type}-${e.error}`}>{e.asset_type}: {e.error}</li>)}
                </ul>
              )}
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
