import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api, type UserRow, type Group, type PermissionCatalog } from "@/lib/api";
import { Card, PageHeader, EmptyState } from "@/components/ui-bits";
import { useState } from "react";
import { Pencil, Plus, Search, X } from "lucide-react";

export const Route = createFileRoute("/_app/policies")({
  head: () => ({ meta: [{ title: "IAM Policies — System Control" }] }),
  component: PoliciesPage,
});

function PoliciesPage() {
  const { data: catalog } = useQuery<PermissionCatalog>({
    queryKey: ["iam-catalog"],
    queryFn: () => api("/api/iam/catalog"),
  });
  const { data: groups } = useQuery<Group[]>({
    queryKey: ["iam-groups"],
    queryFn: () => api("/api/iam/groups"),
  });
  const { data: users } = useQuery<UserRow[]>({
    queryKey: ["users"],
    queryFn: () => api("/api/users"),
  });

  const [q, setQ] = useState("");
  const filteredUsers  = (users  ?? []).filter(u => !q || u.username.toLowerCase().includes(q.toLowerCase()) || (u.full_name ?? "").toLowerCase().includes(q.toLowerCase()));
  const filteredGroups = (groups ?? []).filter(g => !q || g.name.toLowerCase().includes(q.toLowerCase()));
  const visibleUsers = filteredUsers.slice(0, 20);
  const truncated = filteredUsers.length > 20;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="IAM Policies"
        description="Permission matrix per group and user."
        actions={
          <Link
            to="/users-groups"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            <Plus className="size-3.5" /> New Group
          </Link>
        }
      />

      {/* Search bar */}
      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search groups or users…"
          className="w-full pl-8 pr-8 py-1.5 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-ring" />
        {q && <button onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 hover:text-red-500"><X className="size-3.5" /></button>}
      </div>

      {/* Groups grid */}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Groups</h2>
          <span className="text-[11px] bg-muted px-1.5 py-0.5 rounded border border-border text-muted-foreground">{filteredGroups.length}</span>
        </div>
        {filteredGroups.length === 0 ? (
          <Card className="py-10"><EmptyState title="No groups match." description="Create one on the Users & Groups page." /></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredGroups.map((g) => (
              <GroupCard key={g.id} group={g} catalog={catalog} />
            ))}
          </div>
        )}
      </section>

      {/* Users grid */}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Users</h2>
          <span className="text-[11px] bg-muted px-1.5 py-0.5 rounded border border-border text-muted-foreground">{filteredUsers.length}</span>
        </div>
        {filteredUsers.length === 0 ? (
          <Card className="py-10"><EmptyState title="No users match." description="Add one on the Users & Groups page." /></Card>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleUsers.map((u) => (
                <UserCard key={u.id} user={u} catalog={catalog} />
              ))}
            </div>
            {truncated && (
              <p className="text-xs text-muted-foreground">Showing 20 of {filteredUsers.length} matching users.</p>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function GroupCard({ group, catalog }: { group: Group; catalog?: PermissionCatalog }) {
  const [open, setOpen] = useState(false);
  const features = catalog?.features ?? Object.keys(group.permissions);
  const grantCount = Object.values(group.permissions).reduce((n, acts) => n + acts.length, 0);

  return (
    <Card className="overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-surface-muted flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">{group.name}</div>
          {group.description && (
            <div className="text-[11px] text-muted-foreground truncate">{group.description}</div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {group.is_super_admin ? (
            <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/30 font-medium">
              Super admin
            </span>
          ) : (
            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded border border-border text-muted-foreground">
              {grantCount} grants
            </span>
          )}
          <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded border border-border text-muted-foreground">
            {group.member_count} members
          </span>
          <Link
            to="/policies/$slug"
            params={{ slug: `group-${group.id}` }}
            className="p-1.5 hover:bg-muted rounded-md text-muted-foreground"
            title="Edit group policy"
          >
            <Pencil className="size-3.5" />
          </Link>
        </div>
      </div>

      <div className="p-4 space-y-2">
        {/* Feature chips */}
        <div className="flex flex-wrap gap-1.5">
          {features.filter(f => (group.permissions[f]?.length ?? 0) > 0).map(feat => (
            <span key={feat} className="inline-flex items-center gap-1 text-[11px] bg-muted border border-border rounded px-1.5 py-0.5">
              <span className="font-mono text-muted-foreground">{feat}:</span>
              <span className="text-foreground">{(group.permissions[feat] ?? []).join(" ")}</span>
            </span>
          ))}
          {features.filter(f => (group.permissions[f]?.length ?? 0) > 0).length === 0 && (
            <span className="text-[11px] text-muted-foreground">No permissions assigned</span>
          )}
        </div>

        {/* Expandable matrix */}
        <button
          onClick={() => setOpen(o => !o)}
          className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 mt-1"
        >
          {open ? "Hide matrix" : "Show full matrix"}
        </button>

        {open && catalog && (
          <div className="overflow-x-auto rounded-md border border-border mt-2">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-surface-muted">
                  <th className="py-1.5 px-2 font-medium w-36">Feature</th>
                  {catalog.actions.map(a => (
                    <th key={a} className="py-1.5 px-1.5 font-medium text-center">{a}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {features.map(feat => {
                  const allowed = catalog.feature_actions[feat] ?? catalog.actions;
                  const granted = new Set(group.permissions[feat] ?? []);
                  return (
                    <tr key={feat} className="text-xs">
                      <td className="py-1 px-2 font-mono text-[10px]">{feat}</td>
                      {catalog.actions.map(a => (
                        <td key={a} className="py-1 px-1.5 text-center">
                          {!allowed.includes(a) ? (
                            <span className="text-border text-[10px]">·</span>
                          ) : granted.has(a) ? (
                            <span className="text-emerald-600 font-bold">✓</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}

function UserCard({ user, catalog }: { user: UserRow; catalog?: PermissionCatalog }) {
  const baseline: Record<string, string[]> = catalog?.role_baseline?.[user.role] ?? {};
  const merged: Record<string, string[]> = { ...baseline };
  for (const [feat, actions] of Object.entries(user.permissions ?? {})) {
    merged[feat] = Array.from(new Set([...(merged[feat] ?? []), ...actions]));
  }
  const features = Object.keys(merged).filter(f => merged[f].length > 0);

  const ROLE_COLOR: Record<string, string> = {
    admin: "bg-red-50 text-red-700 border-red-200",
    write: "bg-amber-50 text-amber-700 border-amber-200",
    read:  "bg-zinc-100 text-zinc-600 border-zinc-200",
  };
  const roleClass = ROLE_COLOR[user.role] ?? ROLE_COLOR.read;

  return (
    <Card className="overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-surface-muted flex items-center justify-between">
        <span className="text-sm font-semibold">{user.username}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold uppercase ${roleClass}`}>
          {user.role}
        </span>
      </div>
      <div className="p-4">
        <div className="flex flex-wrap gap-1.5">
          {features.length === 0 ? (
            <span className="text-[11px] text-muted-foreground">No permissions</span>
          ) : (
            features.map(feat => (
              <span key={feat} className="inline-flex items-center gap-1 text-[11px] bg-muted border border-border rounded px-1.5 py-0.5">
                <span className="font-mono text-muted-foreground">{feat}:</span>
                <span className="text-foreground">{merged[feat].join(" ")}</span>
              </span>
            ))
          )}
        </div>
      </div>
    </Card>
  );
}
