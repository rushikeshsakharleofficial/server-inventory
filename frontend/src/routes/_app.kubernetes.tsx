import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type Page, type KubernetesCluster } from "@/lib/api";
import { Card, PageHeader, ProviderBadge, StatusPill, EmptyState } from "@/components/ui-bits";
import { SmartTable, type SmartTableColumn } from "@/components/SmartTable";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { AdvancedFilter, emptyFilterState, type FilterState } from "@/components/advanced-filter";

export const Route = createFileRoute("/_app/kubernetes")({
  head: () => ({ meta: [{ title: "Kubernetes — System Control" }] }),
  component: KubernetesPage,
});

function match(s: string, q: string) { return s.toLowerCase().includes(q.toLowerCase()); }

function buildFields(items: KubernetesCluster[]) {
  const uniq = (vals: (string | undefined | null)[]) => [...new Set(vals.filter((v): v is string => !!v))].sort();
  return [
    { key: "provider", label: "Provider", type: "multiselect" as const, options: uniq(items.map(c => c.provider)).map(v => ({ value: v })) },
    { key: "status",   label: "Status",   type: "multiselect" as const, options: uniq(items.map(c => c.status)).map(v => ({ value: v })) },
    { key: "region",   label: "Region",   type: "multiselect" as const, options: uniq(items.map(c => c.region)).map(v => ({ value: v })) },
    { key: "version",  label: "Version",  type: "text" as const },
  ];
}

function KubernetesPage() {
  const qc = useQueryClient();
  const [fs, setFs] = useState<FilterState>(emptyFilterState);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { data, isLoading, error } = useQuery({
    queryKey: ["k8s", { page, pageSize }],
    queryFn: () =>
      api<Page<KubernetesCluster>>("/api/kubernetes", {
        query: { limit: pageSize, offset: (page - 1) * pageSize },
      }),
    placeholderData: (prev) => prev,
  });

  const sync = useMutation({
    mutationFn: () => api("/api/kubernetes/sync", { method: "POST" }),
    onSuccess: () => { toast.success("Kubernetes sync started"); qc.invalidateQueries({ queryKey: ["k8s"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const providers = (fs.filters.provider as string[] | undefined) ?? [];
  const statuses  = (fs.filters.status   as string[] | undefined) ?? [];
  const regions   = (fs.filters.region   as string[] | undefined) ?? [];
  const version   = (fs.filters.version  as string)  ?? "";

  const fields = buildFields(data?.items ?? []);

  const items = (data?.items ?? []).filter((c) => {
    if (fs.q && !match(c.name, fs.q) && !match(c.endpoint ?? "", fs.q) && !match(c.region ?? "", fs.q) && !match(c.version ?? "", fs.q)) return false;
    if (providers.length && !providers.includes(c.provider)) return false;
    if (statuses.length  && !statuses.includes(c.status))   return false;
    if (regions.length && !regions.includes(c.region ?? "")) return false;
    if (version && !match(c.version ?? "", version)) return false;
    return true;
  });

  const columns: SmartTableColumn<KubernetesCluster>[] = [
    {
      key: "name",
      header: "Cluster",
      render: (c) => (
        <>
          <div className="font-medium">{c.name}</div>
          {c.endpoint && <div className="font-mono text-[11px] text-muted-foreground truncate max-w-[200px]">{c.endpoint}</div>}
        </>
      ),
    },
    { key: "version", header: "Version", className: "font-mono text-xs", render: (c) => c.version ?? "—" },
    {
      key: "provider",
      header: "Provider / Region",
      render: (c) => (
        <div className="flex items-center gap-2">
          <ProviderBadge provider={c.provider} />
          <span className="text-xs text-muted-foreground">{c.region ?? "—"}</span>
        </div>
      ),
    },
    { key: "nodes", header: "Nodes", className: "font-mono text-xs", render: (c) => c.node_count ?? "—" },
    {
      key: "status",
      header: "Status",
      className: "text-right",
      render: (c) => <StatusPill status={c.status} />,
    },
  ];

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Kubernetes clusters"
        description={`${items.length} of ${data?.total ?? 0} clusters across providers`}
        actions={
          <button onClick={() => sync.mutate()} disabled={sync.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md disabled:opacity-60">
            <RefreshCw className="size-3.5" /> Sync clusters
          </button>
        }
      />

      <Card className="p-3">
        <AdvancedFilter
          fields={fields}
          state={fs}
          onChange={(s) => { setFs(s); setPage(1); }}
          searchPlaceholder="Search name, endpoint, region, version…"
        />
      </Card>

      <SmartTable
        columns={columns}
        rows={items}
        rowKey={(c) => c.id}
        mode="server"
        page={page}
        onPageChange={setPage}
        totalItems={data?.total ?? 0}
        onPageSizeChange={setPageSize}
        isLoading={isLoading}
        error={error ? (error as Error).message : null}
        empty={<EmptyState title="No clusters match" description="Adjust filters or run a sync." />}
      />
    </div>
  );
}
