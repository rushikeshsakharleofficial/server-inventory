import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type Page, type DatabaseInstance } from "@/lib/api";
import { Card, PageHeader, ProviderBadge, StatusPill, EmptyState } from "@/components/ui-bits";
import { SmartTable, type SmartTableColumn } from "@/components/SmartTable";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { AdvancedFilter, emptyFilterState, type FilterState } from "@/components/advanced-filter";

export const Route = createFileRoute("/_app/databases")({
  head: () => ({ meta: [{ title: "Databases — System Control" }] }),
  component: DatabasesPage,
});

function match(s: string, q: string) { return s.toLowerCase().includes(q.toLowerCase()); }

function buildFields(items: DatabaseInstance[]) {
  const uniq = (vals: (string | undefined | null)[]) => [...new Set(vals.filter((v): v is string => !!v))].sort();
  return [
    { key: "provider", label: "Provider", type: "multiselect" as const, options: uniq(items.map(d => d.provider)).map(v => ({ value: v })) },
    { key: "status",   label: "Status",   type: "multiselect" as const, options: uniq(items.map(d => d.status)).map(v => ({ value: v })) },
    { key: "engine",   label: "Engine",   type: "select" as const, options: uniq(items.map(d => d.engine)).map(v => ({ value: v })) },
    { key: "region",   label: "Region",   type: "multiselect" as const, options: uniq(items.map(d => d.region)).map(v => ({ value: v })) },
  ];
}

function DatabasesPage() {
  const qc = useQueryClient();
  const [fs, setFs] = useState<FilterState>(emptyFilterState);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { data, isLoading, error } = useQuery({
    queryKey: ["dbs", { page, pageSize }],
    queryFn: () =>
      api<Page<DatabaseInstance>>("/api/databases", {
        query: { limit: pageSize, offset: (page - 1) * pageSize },
      }),
    placeholderData: (prev) => prev,
  });

  const sync = useMutation({
    mutationFn: () => api("/api/databases/sync", { method: "POST" }),
    onSuccess: () => { toast.success("Database sync started"); qc.invalidateQueries({ queryKey: ["dbs"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const providers  = (fs.filters.provider as string[] | undefined) ?? [];
  const statuses   = (fs.filters.status   as string[] | undefined) ?? [];
  const engine     = (fs.filters.engine   as string)  ?? "";
  const regions    = (fs.filters.region   as string[] | undefined) ?? [];

  const fields = buildFields(data?.items ?? []);

  const items = (data?.items ?? []).filter((d) => {
    if (fs.q && !match(d.name, fs.q) && !match(d.endpoint ?? "", fs.q) && !match(d.region ?? "", fs.q)) return false;
    if (providers.length && !providers.includes(d.provider)) return false;
    if (statuses.length  && !statuses.includes(d.status))   return false;
    if (engine && !match(d.engine ?? "", engine)) return false;
    if (regions.length && !regions.includes(d.region ?? "")) return false;
    return true;
  });

  const columns: SmartTableColumn<DatabaseInstance>[] = [
    { key: "name", header: "Name", render: (d) => <span className="font-medium">{d.name}</span> },
    {
      key: "engine",
      header: "Engine",
      render: (d) => (
        <span className="text-xs bg-muted px-1.5 py-0.5 rounded border border-border">
          {d.engine ?? "—"}{d.engine_version ? ` ${d.engine_version}` : ""}
        </span>
      ),
    },
    {
      key: "provider",
      header: "Provider / Region",
      render: (d) => (
        <div className="flex items-center gap-2">
          <ProviderBadge provider={d.provider} />
          <span className="text-xs text-muted-foreground">{d.region ?? "—"}</span>
        </div>
      ),
    },
    {
      key: "endpoint",
      header: "Endpoint",
      className: "font-mono text-xs text-muted-foreground truncate max-w-xs",
      render: (d) => `${d.endpoint ?? "—"}${d.port ? `:${d.port}` : ""}`,
    },
    {
      key: "status",
      header: "Status",
      className: "text-right",
      render: (d) => <StatusPill status={d.status} />,
    },
  ];

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Databases"
        description={`${items.length} of ${data?.total ?? 0} managed database instances`}
        actions={
          <button onClick={() => sync.mutate()} disabled={sync.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md disabled:opacity-60">
            <RefreshCw className="size-3.5" /> Sync databases
          </button>
        }
      />

      <Card className="p-3">
        <AdvancedFilter
          fields={fields}
          state={fs}
          onChange={(s) => { setFs(s); setPage(1); }}
          searchPlaceholder="Search name, endpoint, region…"
        />
      </Card>

      <SmartTable
        columns={columns}
        rows={items}
        rowKey={(d) => d.id}
        mode="server"
        page={page}
        onPageChange={setPage}
        totalItems={data?.total ?? 0}
        onPageSizeChange={setPageSize}
        isLoading={isLoading}
        error={error ? (error as Error).message : null}
        empty={<EmptyState title="No databases match" description="Adjust filters or run a sync." />}
      />
    </div>
  );
}
