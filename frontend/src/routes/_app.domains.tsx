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
  type FilterState,
} from "@/components/advanced-filter";

export const Route = createFileRoute("/_app/domains")({
  head: () => ({ meta: [{ title: "Domain Inventory — System Control" }] }),
  component: DomainsPage,
});

function match(s: string, q: string) {
  return s.toLowerCase().includes(q.toLowerCase());
}

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

function DomainsPage() {
  const qc = useQueryClient();
  const [fs, setFs] = useState<FilterState>(emptyFilterState);

  const { data } = useQuery({
    queryKey: ["domains"],
    queryFn: () =>
      api<Page<DnsRecord>>("/api/domains", { query: { limit: 500 } }),
  });

  const sync = useMutation({
    mutationFn: () => api("/api/domains/sync", { method: "POST" }),
    onSuccess: () => {
      toast.success("Domain sync started");
      qc.invalidateQueries({ queryKey: ["domains"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const providers = (fs.filters.provider as string[] | undefined) ?? [];
  const statuses = (fs.filters.status as string[] | undefined) ?? [];
  const zones = (fs.filters.zone as string[] | undefined) ?? [];
  const rectype = (fs.filters.type as string) ?? "";

  const fields = buildFields(data?.items ?? []);

  const items = (data?.items ?? []).filter((v) => {
    if (
      fs.q &&
      !match(v.name, fs.q) &&
      !match(v.zone ?? "", fs.q) &&
      !match(v.content ?? "", fs.q)
    )
      return false;
    if (providers.length && !providers.includes(v.provider)) return false;
    if (statuses.length && !statuses.includes(v.status)) return false;
    if (zones.length && !zones.includes(v.zone ?? "")) return false;
    if (rectype && !match(v.record_type ?? "", rectype)) return false;
    return true;
  });

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Domain inventory"
        description={`${items.length} of ${data?.total ?? 0} DNS records`}
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
          onChange={setFs}
          searchPlaceholder="Search name, zone, content…"
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
      </Card>
    </div>
  );
}
