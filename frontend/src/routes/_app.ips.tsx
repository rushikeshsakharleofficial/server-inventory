import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { Card, PageHeader, EmptyState } from "@/components/ui-bits";
import {
  AdvancedFilter,
  emptyFilterState,
  type FilterState,
} from "@/components/advanced-filter";
import { SmartTable, type SmartTableColumn } from "@/components/SmartTable";

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
  rdns?: string | null;
}

const TYPE_STYLES: Record<string, string> = {
  ipv4: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ipv6: "bg-blue-50 text-blue-700 border-blue-200",
  "link-local": "bg-yellow-50 text-yellow-700 border-yellow-200",
  loopback: "bg-zinc-100 text-zinc-500 border-zinc-200",
};

const FIELDS = [
  {
    key: "type",
    label: "Type",
    type: "multiselect" as const,
    options: ["ipv4", "ipv6", "link-local", "loopback"].map((v) => ({
      value: v,
    })),
  },
  { key: "provider", label: "Provider", type: "text" as const },
];

const COLUMNS: SmartTableColumn<IpRow>[] = [
  {
    key: "address",
    header: "Address / CIDR",
    render: (row) => <span className="font-mono">{row.cidr}</span>,
  },
  {
    key: "rdns",
    header: "RDNS",
    className: "text-muted-foreground",
    render: (row) => row.rdns ?? "—",
  },
  {
    key: "type",
    header: "Type",
    render: (row) => (
      <span
        className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${TYPE_STYLES[row.type] ?? "bg-muted text-muted-foreground border-border"}`}
      >
        {row.type}
      </span>
    ),
  },
  {
    key: "server",
    header: "Server",
    render: (row) => (
      <Link
        to="/server-detail/$id"
        params={{ id: String(row.server_id) }}
        className="text-primary hover:underline"
      >
        {row.server_name}
      </Link>
    ),
  },
  {
    key: "provider",
    header: "Provider",
    className: "text-muted-foreground",
    render: (row) => row.provider,
  },
];

function IpsPage() {
  const qc = useQueryClient();
  const [fs, setFs] = useState<FilterState>(emptyFilterState);
  const [page, setPage] = useState(1);

  const types = (fs.filters.type as string[] | undefined) ?? [];
  const prov = (fs.filters.provider as string) ?? "";

  // Backend supports q and type (single). For multi-type: fetch all, client-filter.
  const apiType = types.length === 1 ? types[0] : "";

  const { data, isLoading } = useQuery({
    queryKey: ["ip-inventory", fs.q, apiType],
    queryFn: () =>
      api<{ total: number; items: IpRow[]; rdns_enabled: boolean }>("/api/servers/ip-inventory", {
        query: { q: fs.q, type: apiType },
      }),
    staleTime: 30_000,
  });

  // RDNS is resolved server-side over real DNS round trips and can take a
  // while cold; fetched as its own fast follow-up (cached after the first
  // hit) so the table above renders immediately instead of blocking on it.
  const rdnsEnabled = data?.rdns_enabled ?? true;
  const rdnsQuery = useQuery({
    queryKey: ["ip-inventory-rdns"],
    queryFn: () => api<Record<string, string | null>>("/api/servers/ip-inventory/rdns"),
    enabled: rdnsEnabled,
    staleTime: 60 * 60 * 1000,
  });

  const syncPtr = useMutation({
    mutationFn: () => api<{ resolved: number; rdns_enabled: boolean }>("/api/servers/ip-inventory/rdns/refresh", { method: "POST" }),
    onSuccess: (res) => {
      if (!res.rdns_enabled) {
        toast.info("RDNS lookup is turned off in Settings.");
        return;
      }
      toast.success(`Resolved RDNS for ${res.resolved} address${res.resolved === 1 ? "" : "es"}.`);
      qc.invalidateQueries({ queryKey: ["ip-inventory-rdns"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const items = (data?.items ?? []).filter((row) => {
    if (types.length > 1 && !types.includes(row.type)) return false;
    if (prov && !row.provider.toLowerCase().includes(prov.toLowerCase()))
      return false;
    return true;
  }).map((row) => ({
    ...row,
    rdns: rdnsQuery.data?.[row.address] ?? row.rdns,
  }));

  const columns = rdnsEnabled ? COLUMNS : COLUMNS.filter((c) => c.key !== "rdns");

  const countSuffix = data ? ` — ${items.length} of ${data.total} total` : "";

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="IP Inventory"
        description={`All IPs discovered via SSH across your fleet${countSuffix}.`}
      />

      <Card className="p-3">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <AdvancedFilter
              fields={FIELDS}
              state={fs}
              onChange={(s) => {
                setFs(s);
                setPage(1);
              }}
              searchPlaceholder="Search IP address or server name…"
            />
          </div>
          {rdnsEnabled && (
            <button
              onClick={() => syncPtr.mutate()}
              disabled={syncPtr.isPending}
              title="Resolve reverse-DNS (PTR) for every IP now"
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-muted hover:bg-muted/80 rounded-md border border-border transition-colors disabled:opacity-60 shrink-0"
            >
              <RefreshCw className={`size-3.5 ${syncPtr.isPending ? "animate-spin" : ""}`} />
              {syncPtr.isPending ? "Syncing PTR…" : "Sync PTR"}
            </button>
          )}
        </div>
      </Card>

      <SmartTable
        columns={columns}
        rows={items}
        rowKey={(row) => `${row.server_id}-${row.address}`}
        mode="client"
        page={page}
        onPageChange={setPage}
        totalItems={items.length}
        isLoading={isLoading}
        empty={
          <EmptyState
            title="No IPs found"
            description="Run SSH Sync on servers to populate IP inventory."
          />
        }
      />
    </div>
  );
}
