import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { Card, PageHeader, EmptyState } from "@/components/ui-bits";
import { AdvancedFilter, emptyFilterState, type FilterState } from "@/components/advanced-filter";

export const Route = createFileRoute("/_app/ips")({
  head: () => ({ meta: [{ title: "IP Inventory — System Control" }] }),
  component: IpsPage,
});

interface IpRow {
  server_id: number;
  server_name: string;
  provider: string;
  cidr: string;
  address: string;
  type: "ipv4" | "ipv6" | "link-local" | "loopback";
}

const TYPE_STYLES: Record<string, string> = {
  ipv4:         "bg-emerald-50 text-emerald-700 border-emerald-200",
  ipv6:         "bg-blue-50 text-blue-700 border-blue-200",
  "link-local": "bg-yellow-50 text-yellow-700 border-yellow-200",
  loopback:     "bg-zinc-100 text-zinc-500 border-zinc-200",
};

const FIELDS = [
  { key: "type", label: "Type", type: "multiselect" as const, options: ["ipv4","ipv6","link-local","loopback"].map(v => ({ value: v })) },
  { key: "provider", label: "Provider", type: "text" as const },
];

function IpsPage() {
  const [fs, setFs] = useState<FilterState>(emptyFilterState);

  const types  = (fs.filters.type     as string[] | undefined) ?? [];
  const prov   = (fs.filters.provider as string)  ?? "";

  // Backend supports q and type (single). For multi-type: fetch all, client-filter.
  const apiType = types.length === 1 ? types[0] : "";

  const { data, isLoading } = useQuery({
    queryKey: ["ip-inventory", fs.q, apiType],
    queryFn: () => api<{ total: number; items: IpRow[] }>("/api/servers/ip-inventory", {
      query: { q: fs.q, type: apiType },
    }),
    staleTime: 30_000,
  });

  const items = (data?.items ?? []).filter((row) => {
    if (types.length > 1 && !types.includes(row.type)) return false;
    if (prov && !row.provider.toLowerCase().includes(prov.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="IP Inventory"
        description={`All IPs discovered via SSH across your fleet${data ? ` — ${items.length} of ${data.total} total` : ""}.`}
      />

      <Card className="p-3">
        <AdvancedFilter
          fields={FIELDS}
          state={fs}
          onChange={setFs}
          searchPlaceholder="Search IP address or server name…"
        />
      </Card>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : items.length === 0 ? (
          <EmptyState title="No IPs found" description="Run SSH Sync on servers to populate IP inventory." />
        ) : (
          <table className="w-full text-left">
            <thead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider bg-surface-muted border-b border-border">
              <tr>
                <th className="px-4 py-2.5 font-medium">Address / CIDR</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Server</th>
                <th className="px-4 py-2.5 font-medium">Provider</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border [&>tr:last-child]:border-b-0">
              {items.map((row, i) => (
                <tr key={i} className="text-sm hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-2.5 font-mono">{row.cidr}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${TYPE_STYLES[row.type] ?? "bg-muted text-muted-foreground border-border"}`}>
                      {row.type}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <Link to="/server-detail/$id" params={{ id: String(row.server_id) }} className="text-primary hover:underline">
                      {row.server_name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{row.provider}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
