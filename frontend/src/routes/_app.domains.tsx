import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type Page, type DnsRecord } from "@/lib/api";
import {
  Card,
  PageHeader,
  ProviderBadge,
  StatusPill,
  EmptyState,
} from "@/components/ui-bits";
import { SmartTable, type SmartTableColumn } from "@/components/SmartTable";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  AdvancedFilter,
  emptyFilterState,
  searchParamsToFilterState,
  type FilterState,
} from "@/components/advanced-filter";

export const Route = createFileRoute("/_app/domains")({
  head: () => ({ meta: [{ title: "Domain Inventory — System Control" }] }),
  component: DomainsPage,
});

function buildFields(items: DnsRecord[]) {
  const uniq = (vals: (string | undefined | null)[]) =>
    [...new Set(vals.filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b));
  return [
    {
      key: "provider",
      label: "Provider",
      type: "multiselect" as const,
      options: uniq(items.map((v) => v.provider)).map((v) => ({ value: v })),
    },
    {
      key: "status",
      label: "Status",
      type: "multiselect" as const,
      options: uniq(items.map((v) => v.status)).map((v) => ({ value: v })),
    },
    {
      key: "zone",
      label: "Zone",
      type: "multiselect" as const,
      options: uniq(items.map((v) => v.zone)).map((v) => ({ value: v })),
    },
    { key: "type", label: "Record type", type: "text" as const },
  ];
}

function DomainsPage() {
  const qc = useQueryClient();
  const [fs, setFs] = useState<FilterState>(() =>
    typeof window === "undefined"
      ? emptyFilterState()
      : searchParamsToFilterState(window.location.search, [
          "provider",
          "status",
          "zone",
        ]),
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const providers = (fs.filters.provider as string[] | undefined) ?? [];
  const statuses = (fs.filters.status as string[] | undefined) ?? [];
  const zones = (fs.filters.zone as string[] | undefined) ?? [];
  const rectype = (fs.filters.type as string) ?? "";

  // Backend supports provider/status/zone/record_type as single values.
  // Multi-select: send the first value to the backend, client-side filter
  // the rest — same fallback pattern as _app.servers.tsx.
  const apiProvider = providers.length === 1 ? providers[0] : "";
  const apiStatus = statuses.length === 1 ? statuses[0] : "";
  const apiZone = zones.length === 1 ? zones[0] : "";
  const anyMultiOverflow =
    providers.length > 1 || statuses.length > 1 || zones.length > 1;

  const { data, isLoading, error } = useQuery({
    queryKey: [
      "domains",
      {
        q: fs.q,
        provider: apiProvider,
        status: apiStatus,
        zone: apiZone,
        rectype,
        page,
        pageSize,
      },
    ],
    queryFn: () =>
      api<Page<DnsRecord>>("/api/domains", {
        query: {
          search: fs.q,
          provider: apiProvider,
          status: apiStatus,
          zone: apiZone,
          record_type: rectype,
          limit: anyMultiOverflow ? 500 : pageSize,
          offset: anyMultiOverflow ? 0 : (page - 1) * pageSize,
        },
      }),
    placeholderData: (prev) => prev,
  });

  const sync = useMutation({
    mutationFn: () => api("/api/domains/sync", { method: "POST" }),
    onSuccess: () => {
      toast.success("Domain sync started");
      qc.invalidateQueries({ queryKey: ["domains"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const fields = buildFields(data?.items ?? []);

  const items = (data?.items ?? []).filter((v) => {
    if (providers.length > 1 && !providers.includes(v.provider)) return false;
    if (statuses.length > 1 && !statuses.includes(v.status)) return false;
    if (zones.length > 1 && !zones.includes(v.zone ?? "")) return false;
    return true;
  });

  const total = anyMultiOverflow ? items.length : (data?.total ?? 0);

  const columns: SmartTableColumn<DnsRecord>[] = [
    {
      key: "record",
      header: "Record",
      render: (v) => <span className="font-medium">{v.name}</span>,
    },
    {
      key: "type",
      header: "Type",
      render: (v) => (
        <span className="text-xs bg-muted px-1.5 py-0.5 rounded border border-border">
          {v.record_type ?? "—"}
        </span>
      ),
    },
    {
      key: "content",
      header: "Content",
      render: (v) => (
        <span className="font-mono text-xs text-muted-foreground truncate max-w-xs block">
          {v.content ?? "—"}
        </span>
      ),
    },
    {
      key: "provider_zone",
      header: "Provider / Zone",
      render: (v) => (
        <div className="flex items-center gap-2">
          <ProviderBadge provider={v.provider} />
          <span className="text-xs text-muted-foreground">{v.zone ?? "—"}</span>
        </div>
      ),
    },
    {
      key: "ttl",
      header: "TTL",
      render: (v) => <span className="font-mono text-xs">{v.ttl ?? "—"}</span>,
    },
    {
      key: "proxied",
      header: "Proxied",
      render: (v) => (
        <span className="text-xs text-muted-foreground">
          {v.proxied === null || v.proxied === undefined ? "—" : v.proxied ? "Yes" : "No"}
        </span>
      ),
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
        title="Domain inventory"
        description={`${total.toLocaleString()} DNS records`}
        actions={
          <button
            onClick={() => sync.mutate()}
            disabled={sync.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md disabled:opacity-60"
          >
            <RefreshCw className="size-3.5" /> Sync domains
          </button>
        }
      />

      <Card className="p-3">
        <AdvancedFilter
          fields={fields}
          state={fs}
          onChange={(s) => {
            setFs(s);
            setPage(1);
          }}
          searchPlaceholder="Search name…"
        />
      </Card>

      <SmartTable<DnsRecord>
        columns={columns}
        rows={anyMultiOverflow ? items : (data?.items ?? [])}
        rowKey={(v) => v.id}
        mode={anyMultiOverflow ? "client" : "server"}
        page={page}
        onPageChange={setPage}
        totalItems={total}
        onPageSizeChange={setPageSize}
        isLoading={isLoading}
        error={error instanceof Error ? error.message : null}
        empty={
          <EmptyState
            title="No records match"
            description="Adjust filters or run a sync."
          />
        }
      />
    </div>
  );
}
