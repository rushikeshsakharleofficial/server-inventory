import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Group, type PermissionCatalog } from "@/lib/api";
import { Card, PageHeader } from "@/components/ui-bits";
import { ArrowLeft, Save, ShieldCheck } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/policies_/$slug")({
  head: () => ({ meta: [{ title: "Edit Policy — System Control" }] }),
  component: PolicyEditPage,
});

function PermissionMatrix({
  catalog,
  value,
  onChange,
}: Readonly<{
  catalog: PermissionCatalog;
  value: Record<string, string[]>;
  onChange: (v: Record<string, string[]>) => void;
}>) {
  const toggle = useCallback(
    (feature: string, action: string) => {
      const current = value[feature] ?? [];
      const next = current.includes(action)
        ? current.filter((a) => a !== action)
        : [...current, action];
      onChange({ ...value, [feature]: next });
    },
    [value, onChange],
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-surface-muted">
            <th className="text-left px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider w-40">Feature</th>
            {catalog.actions.map((action) => (
              <th key={action} className="px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-center">{action}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {catalog.features.map((feature) => {
            const allowed = catalog.feature_actions[feature] ?? [];
            const checked = value[feature] ?? [];
            return (
              <tr key={feature} className="hover:bg-muted/30">
                <td className="px-3 py-2 font-mono text-[11px] text-foreground">{feature}</td>
                {catalog.actions.map((action) => (
                  <td key={action} className="px-3 py-2 text-center">
                    {allowed.includes(action) ? (
                      <input
                        type="checkbox"
                        checked={checked.includes(action)}
                        onChange={() => toggle(feature, action)}
                        className="accent-primary cursor-pointer size-3.5"
                      />
                    ) : (
                      <span className="text-border text-[10px]">·</span>
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PolicyEditPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  // slug is "group-{id}"
  const groupId = slug.startsWith("group-") ? Number.parseInt(slug.replace("group-", ""), 10) : Number.NaN;

  const { data: groups, isLoading: groupsLoading } = useQuery<Group[]>({
    queryKey: ["iam-groups"],
    queryFn: () => api("/api/iam/groups"),
  });
  const { data: catalog, isLoading: catalogLoading } = useQuery<PermissionCatalog>({
    queryKey: ["iam-catalog"],
    queryFn: () => api("/api/iam/catalog"),
  });

  const group = groups?.find((g) => g.id === groupId) ?? null;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [permissions, setPermissions] = useState<Record<string, string[]>>({});
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (group) {
      setName(group.name);
      setDescription(group.description ?? "");
      setPermissions(group.permissions ?? {});
      setIsSuperAdmin(group.is_super_admin ?? false);
      setDirty(false);
    }
  }, [group]);

  const update = useMutation({
    mutationFn: () =>
      api(`/api/iam/groups/${groupId}`, {
        method: "PUT",
        json: { name, description, permissions, is_super_admin: isSuperAdmin },
      }),
    onSuccess: () => {
      toast.success("Policy saved");
      qc.invalidateQueries({ queryKey: ["iam-groups"] });
      setDirty(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const loading = groupsLoading || catalogLoading;

  if (loading) {
    return (
      <div className="p-6 text-sm text-muted-foreground">Loading…</div>
    );
  }

  if (Number.isNaN(groupId) || (!groupsLoading && !group)) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-500">Group not found.</p>
        <button onClick={() => navigate({ to: "/policies" })} className="mt-3 text-sm text-primary underline">
          Back to policies
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={`Edit: ${group?.name ?? "…"}`}
        description="Modify group permissions. Changes take effect on next login."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate({ to: "/policies" })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-border hover:bg-muted"
            >
              <ArrowLeft className="size-3.5" /> Back
            </button>
            <button
              onClick={() => update.mutate()}
              disabled={update.isPending || !dirty}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md disabled:opacity-60"
            >
              <Save className="size-3.5" />
              {update.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        }
      />

      {/* Group metadata */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-surface-muted">
          <h3 className="text-sm font-semibold">Group details</h3>
        </div>
        <div className="p-4 space-y-4 max-w-lg">
          <div>
            <label htmlFor="policy-name" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Name</label>
            <input
              id="policy-name"
              value={name}
              onChange={(e) => { setName(e.target.value); setDirty(true); }}
              className="mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
            />
          </div>
          <div>
            <label htmlFor="policy-description" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Description</label>
            <input
              id="policy-description"
              value={description}
              onChange={(e) => { setDescription(e.target.value); setDirty(true); }}
              className="mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
            />
          </div>
          <label htmlFor="policy-super-admin" aria-label="Super admin" className="flex items-start gap-3 p-3 rounded-md border border-border bg-surface-muted cursor-pointer">
            <input
              id="policy-super-admin"
              type="checkbox"
              checked={isSuperAdmin}
              onChange={(e) => { setIsSuperAdmin(e.target.checked); setDirty(true); }}
              className="mt-0.5 accent-primary cursor-pointer size-4"
            />
            <span>
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <ShieldCheck className="size-3.5 text-primary" /> Super admin
              </span>
              <span className="block text-xs text-muted-foreground mt-0.5">
                Members get every action on every feature, always — computed live, not
                from the checkboxes below. Stays fully granted even as new features are
                added, so it never needs manual re-syncing.
              </span>
            </span>
          </label>
        </div>
      </Card>

      {/* Permission matrix */}
      {catalog && (
        <Card className={`overflow-hidden ${isSuperAdmin ? "opacity-50 pointer-events-none" : ""}`}>
          <div className="px-4 py-3 border-b border-border bg-surface-muted flex items-center justify-between">
            <h3 className="text-sm font-semibold">Permissions</h3>
            <span className="text-[10px] text-muted-foreground">
              {isSuperAdmin ? "Ignored — super admin grants all" : `${Object.values(permissions).reduce((n, acts) => n + acts.length, 0)} grants`}
            </span>
          </div>
          <div className="p-2">
            <PermissionMatrix
              catalog={catalog}
              value={permissions}
              onChange={(v) => { setPermissions(v); setDirty(true); }}
            />
          </div>
        </Card>
      )}
    </div>
  );
}
