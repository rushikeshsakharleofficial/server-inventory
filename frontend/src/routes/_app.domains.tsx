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
    [...new Set(vals.filter((v): v is string => !!v))].sort();
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

const PAGE_SIZE = 25;

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
  const [offset, setOffset] = useState(0);

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

  const { data } = useQuery({
    queryKey: [
      "domains",
      {
        q: fs.q,
        provider: apiProvider,
        status: apiStatus,
        zone: apiZone,
        rectype,
        offset,
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
          limit: anyMultiOverflow ? 500 : PAGE_SIZE,
          offset: anyMultiOverflow ? 0 : offset,
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

  const total = data?.total ?? 0;

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
            setOffset(0);
          }}
          searchPlaceholder="Search name…"
        />
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full text-left">
          <thead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider bg-surface-muted border-b border-border">
            <tr>
              <th className="px-4 py-2 font-medium">Record</th>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium">Content</th>
              <th className="px-4 py-2 font-medium">Provider / Zone</th>
              <th className="px-4 py-2 font-medium">TTL</th>
              <th className="px-4 py-2 font-medium">Proxied</th>
              <th className="px-4 py-2 font-medium text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((v) => (
              <tr key={v.id} className="text-sm">
                <td className="px-4 py-2.5 font-medium">{v.name}</td>
                <td className="px-4 py-2.5">
                  <span className="text-xs bg-muted px-1.5 py-0.5 rounded border border-border">
                    {v.record_type ?? "—"}
                  </span>
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground truncate max-w-xs">
                  {v.content ?? "—"}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <ProviderBadge provider={v.provider} />
                    <span className="text-xs text-muted-foreground">
                      {v.zone ?? "—"}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-2.5 font-mono text-xs">
                  {v.ttl ?? "—"}
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">
                  {v.proxied === null || v.proxied === undefined
                    ? "—"
                    : v.proxied
                      ? "Yes"
                      : "No"}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <StatusPill status={v.status} />
                </td>
              </tr>
            ))}
            {data && items.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <EmptyState
                    title="No records match"
                    description="Adjust filters or run a sync."
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {!anyMultiOverflow && total > PAGE_SIZE && (
          <div className="px-4 py-3 border-t border-border flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of{" "}
              {total.toLocaleString()}
            </span>
            <div className="flex gap-1">
              <button
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                className="px-3 py-1 border border-border rounded-md disabled:opacity-40"
              >
                Prev
              </button>
              <button
                disabled={offset + PAGE_SIZE >= total}
                onClick={() => setOffset(offset + PAGE_SIZE)}
                className="px-3 py-1 border border-border rounded-md disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
