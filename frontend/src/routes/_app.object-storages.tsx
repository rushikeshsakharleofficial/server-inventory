import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type Page, type ObjectStorage, type ObjectStorageUser } from "@/lib/api";
import { Card, PageHeader, ProviderBadge, StatusPill, EmptyState } from "@/components/ui-bits";
import { SmartTable, type SmartTableColumn } from "@/components/SmartTable";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { AdvancedFilter, emptyFilterState, type FilterState } from "@/components/advanced-filter";

export const Route = createFileRoute("/_app/object-storages")({
  head: () => ({ meta: [{ title: "Object Storage — System Control" }] }),
  component: ObjectStoragePage,
});

function match(s: string, q: string) { return s.toLowerCase().includes(q.toLowerCase()); }

function buildFields(items: ObjectStorage[]) {
  const uniq = (vals: (string | undefined | null)[]) => [...new Set(vals.filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b));
  return [
    { key: "provider", label: "Provider", type: "multiselect" as const, options: uniq(items.map(v => v.provider)).map(v => ({ value: v })) },
    { key: "status",   label: "Status",   type: "multiselect" as const, options: uniq(items.map(v => v.status)).map(v => ({ value: v })) },
  ];
}

export function UsersPanel({ store, onClose }: { store: ObjectStorage; onClose: () => void }) {
  const qc = useQueryClient();
  const key = ["os-users", store.id];
  const { data, isError } = useQuery({ queryKey: key, queryFn: () => api<ObjectStorageUser[]>(`/api/object-storages/${store.id}/users`) });
  const [draft, setDraft] = useState<ObjectStorageUser>({ username: "", access: "read", quota_gb: null });
  const save = useMutation({
    mutationFn: (users: ObjectStorageUser[]) => api(`/api/object-storages/${store.id}/users`, { method: "PUT", json: users }),
    onSuccess: () => { setDraft({ username: "", access: "read", quota_gb: null }); return qc.invalidateQueries({ queryKey: key }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const users = data ?? [];
  const ready = data !== undefined && !isError && !save.isPending;
  const inp = "px-2 py-1 text-sm border rounded-md bg-background";
  return (
    <Card className="p-4 space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="font-medium">Users with access to {store.name}</h3>
        <button onClick={onClose} className="text-sm text-muted-foreground">Close</button>
      </div>
      {isError && <p className="text-sm text-red-500">Failed to load users.</p>}
      <table className="w-full text-sm">
        <thead className="text-left text-muted-foreground"><tr><th>User</th><th>Access</th><th>Quota</th><th>Used</th><th /></tr></thead>
        <tbody>
          {users.map((u) => {
            const pct = u.quota_gb ? Math.min(100, ((u.used_gb ?? 0) / u.quota_gb) * 100) : 0;
            return (
              <tr key={u.username} className="border-t">
                <td className="py-1.5 font-medium">{u.username}</td>
                <td>{u.access}</td>
                <td>{u.quota_gb != null ? `${u.quota_gb} GB` : "Unlimited"}</td>
                <td>
                  {u.used_gb ?? 0} GB
                  {u.quota_gb ? <div className="h-1.5 w-24 bg-muted rounded"><div className={`h-full rounded ${pct >= 90 ? "bg-red-500" : "bg-primary"}`} style={{ width: `${pct}%` }} /></div> : null}
                </td>
                <td className="text-right"><button className="text-red-500 disabled:opacity-60" disabled={!ready} onClick={() => save.mutate(users.filter((x) => x.username !== u.username))}>Remove</button></td>
              </tr>
            );
          })}
          {!users.length && <tr><td colSpan={5} className="py-3 text-muted-foreground">No users assigned.</td></tr>}
        </tbody>
      </table>
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); save.mutate([...users.filter((x) => x.username !== draft.username), draft]); }}>
        <input required className={inp} placeholder="Username" value={draft.username} onChange={(e) => setDraft({ ...draft, username: e.target.value })} />
        <select className={inp} value={draft.access} onChange={(e) => setDraft({ ...draft, access: e.target.value as ObjectStorageUser["access"] })}>
          <option value="read">read</option><option value="write">write</option><option value="admin">admin</option>
        </select>
        <input className={`${inp} w-28`} type="number" min={0} step="any" placeholder="Quota GB" value={draft.quota_gb ?? ""} onChange={(e) => setDraft({ ...draft, quota_gb: e.target.value === "" ? null : Number(e.target.value) })} />
        <input className={`${inp} w-28`} type="number" min={0} step="any" placeholder="Used GB" value={draft.used_gb ?? ""} onChange={(e) => setDraft({ ...draft, used_gb: e.target.value === "" ? null : Number(e.target.value) })} />
        <button disabled={!ready} className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded-md disabled:opacity-60">Add / update</button>
      </form>
    </Card>
  );
}

function ObjectStoragePage() {
  const [selected, setSelected] = useState<ObjectStorage | null>(null);
  const qc = useQueryClient();
  const [fs, setFs] = useState<FilterState>(emptyFilterState);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { data, isLoading, error } = useQuery({
    queryKey: ["os", { page, pageSize }],
    queryFn: () =>
      api<Page<ObjectStorage>>("/api/object-storages", {
        query: { limit: pageSize, offset: (page - 1) * pageSize },
      }),
    placeholderData: (prev) => prev,
  });

  const sync = useMutation({
    mutationFn: () => api("/api/object-storages/sync", { method: "POST" }),
    onSuccess: () => { toast.success("Object storage sync started"); qc.invalidateQueries({ queryKey: ["os"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const providers = (fs.filters.provider as string[] | undefined) ?? [];
  const statuses  = (fs.filters.status   as string[] | undefined) ?? [];

  const items = (data?.items ?? []).filter((v) => {
    if (fs.q && !match(v.name, fs.q) && !match(v.endpoint ?? "", fs.q)) return false;
    if (providers.length && !providers.includes(v.provider)) return false;
    if (statuses.length  && !statuses.includes(v.status))   return false;
    return true;
  });

  const columns: SmartTableColumn<ObjectStorage>[] = [
    { key: "name", header: "Object store", render: (v) => <span className="font-medium">{v.name}</span> },
    { key: "provider", header: "Provider", render: (v) => <ProviderBadge provider={v.provider} /> },
    { key: "endpoint", header: "Endpoint", className: "font-mono text-xs text-muted-foreground", render: (v) => v.endpoint ?? "—" },
    {
      key: "state",
      header: "Provider state",
      className: "font-mono text-xs text-muted-foreground",
      render: (v) => String(v.extra?.state ?? "—"),
    },
    { key: "users", header: "Users", render: (v) => v.user_count ?? 0 },
    { key: "status", header: "Status", className: "text-right", render: (v) => <StatusPill status={v.status} /> },
  ];

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Object storage"
        description={`${items.length} of ${data?.total ?? 0} object stores`}
        actions={
          <button onClick={() => sync.mutate()} disabled={sync.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md disabled:opacity-60">
            <RefreshCw className="size-3.5" /> Sync object stores
          </button>
        }
      />

      <Card className="p-3">
        <AdvancedFilter
          fields={buildFields(data?.items ?? [])}
          state={fs}
          onChange={(s) => { setFs(s); setPage(1); }}
          searchPlaceholder="Search name, endpoint…"
        />
      </Card>

      <SmartTable
        columns={columns}
        rows={items}
        rowKey={(v) => v.id}
        onRowClick={setSelected}
        mode="server"
        page={page}
        onPageChange={setPage}
        totalItems={data?.total ?? 0}
        onPageSizeChange={setPageSize}
        isLoading={isLoading}
        error={error ? (error as Error).message : null}
        empty={<EmptyState title="No object stores" description="Add a provider with Objects enabled, then run a sync." />}
      />
      {selected && <UsersPanel store={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
