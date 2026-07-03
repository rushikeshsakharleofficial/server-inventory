import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type Page, type BlockStorage } from "@/lib/api";
import { Card, PageHeader, ProviderBadge, StatusPill, EmptyState } from "@/components/ui-bits";
import { SmartTable, type SmartTableColumn } from "@/components/SmartTable";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { AdvancedFilter, emptyFilterState, type FilterState } from "@/components/advanced-filter";

export const Route = createFileRoute("/_app/block-storages")({
  head: () => ({ meta: [{ title: "Block Storage — System Control" }] }),
  component: BlockStoragePage,
});

function match(s: string, q: string) { return s.toLowerCase().includes(q.toLowerCase()); }

function buildFields(items: BlockStorage[]) {
  const uniq = (vals: (string | undefined | null)[]) => [...new Set(vals.filter((v): v is string => !!v))].sort();
  return [
    { key: "provider", label: "Provider", type: "multiselect" as const, options: uniq(items.map(v => v.provider)).map(v => ({ value: v })) },
    { key: "status",   label: "Status",   type: "multiselect" as const, options: uniq(items.map(v => v.status)).map(v => ({ value: v })) },
    { key: "region",   label: "Region",   type: "multiselect" as const, options: uniq(items.map(v => v.region)).map(v => ({ value: v })) },
    { key: "type",     label: "Vol type", type: "text" as const },
  ];
}

function BlockStoragePage() {
  const qc = useQueryClient();
  const [fs, setFs] = useState<FilterState>(emptyFilterState);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { data, isLoading, error } = useQuery({
    queryKey: ["bs", { page, pageSize }],
    queryFn: () =>
      api<Page<BlockStorage>>("/api/block-storages", {
        query: { limit: pageSize, offset: (page - 1) * pageSize },
      }),
    placeholderData: (prev) => prev,
  });

  const sync = useMutation({
    mutationFn: () => api("/api/block-storages/sync", { method: "POST" }),
    onSuccess: () => { toast.success("Block storage sync started"); qc.invalidateQueries({ queryKey: ["bs"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const providers = (fs.filters.provider as string[] | undefined) ?? [];
  const statuses  = (fs.filters.status   as string[] | undefined) ?? [];
  const regions   = (fs.filters.region   as string[] | undefined) ?? [];
  const voltype   = (fs.filters.type     as string)  ?? "";

  const fields = buildFields(data?.items ?? []);

  const items = (data?.items ?? []).filter((v) => {
    if (fs.q && !match(v.name, fs.q) && !match(v.region ?? "", fs.q) && !match(v.attachment ?? "", fs.q)) return false;
    if (providers.length && !providers.includes(v.provider)) return false;
    if (statuses.length  && !statuses.includes(v.status))   return false;
    if (regions.length && !regions.includes(v.region ?? "")) return false;
    if (voltype && !match(v.volume_type ?? "", voltype)) return false;
    return true;
  });

  const columns: SmartTableColumn<BlockStorage>[] = [
    { key: "name", header: "Volume", render: (v) => <span className="font-medium">{v.name}</span> },
    { key: "size", header: "Size", className: "font-mono text-xs", render: (v) => (v.size_gb ? `${v.size_gb} GB` : "—") },
    {
      key: "provider",
      header: "Provider / Region",
      render: (v) => (
        <div className="flex items-center gap-2">
          <ProviderBadge provider={v.provider} />
          <span className="text-xs text-muted-foreground">{v.region ?? "—"}</span>
        </div>
      ),
    },
    {
      key: "attachment",
      header: "Attached",
      className: "font-mono text-xs text-muted-foreground",
      render: (v) => v.attachment ?? "—",
    },
    {
      key: "status",
      header: "Status",
      className: "text-right",
      render: (v) => <StatusPill status={v.status} />,
    },
  ];

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Block storage"
        description={`${items.length} of ${data?.total ?? 0} volumes`}
        actions={
          <button onClick={() => sync.mutate()} disabled={sync.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md disabled:opacity-60">
            <RefreshCw className="size-3.5" /> Sync volumes
          </button>
        }
      />

      <Card className="p-3">
        <AdvancedFilter
          fields={fields}
          state={fs}
          onChange={(s) => { setFs(s); setPage(1); }}
          searchPlaceholder="Search name, region, attachment…"
        />
      </Card>

      <SmartTable
        columns={columns}
        rows={items}
        rowKey={(v) => v.id}
        mode="server"
        page={page}
        onPageChange={setPage}
        totalItems={data?.total ?? 0}
        onPageSizeChange={setPageSize}
        isLoading={isLoading}
        error={error ? (error as Error).message : null}
        empty={<EmptyState title="No volumes match" description="Adjust filters or run a sync." />}
      />
    </div>
  );
}
