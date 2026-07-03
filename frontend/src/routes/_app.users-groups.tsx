import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type UserRow, type Group, type GroupCreate, type PermissionCatalog } from "@/lib/api";
import { Card, PageHeader, StatusPill, CustomSelect, EmptyState, confirmAsync } from "@/components/ui-bits";
import { Plus, Trash2, Pencil, Power } from "lucide-react";
import { useState, useCallback } from "react";
import { toast } from "sonner";
import { AdvancedFilter, emptyFilterState, type FilterState } from "@/components/advanced-filter";

export const Route = createFileRoute("/_app/users-groups")({
  head: () => ({ meta: [{ title: "Users & Groups — System Control" }] }),
  component: UsersGroupsPage,
});

// ─── PermissionMatrix ────────────────────────────────────────────────────────

function PermissionMatrix({
  catalog,
  value,
  onChange,
  readOnly,
}: {
  catalog: PermissionCatalog;
  value: Record<string, string[]>;
  onChange: (v: Record<string, string[]>) => void;
  readOnly?: boolean;
}) {
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
          <tr>
            <th className="text-left px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider w-32">Feature</th>
            {catalog.actions.map((action) => (
              <th key={action} className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-center">{action}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {catalog.features.map((feature) => {
            const allowed = catalog.feature_actions[feature] ?? [];
            const checked = value[feature] ?? [];
            return (
              <tr key={feature} className="hover:bg-muted/30">
                <td className="px-2 py-1.5 font-mono text-[11px] text-foreground">{feature}</td>
                {catalog.actions.map((action) => (
                  <td key={action} className="px-2 py-1.5 text-center">
                    {allowed.includes(action) ? (
                      <input
                        type="checkbox"
                        disabled={readOnly}
                        checked={checked.includes(action)}
                        onChange={() => toggle(feature, action)}
                        className="accent-primary cursor-pointer disabled:cursor-default"
                      />
                    ) : (
                      <span className="text-border">—</span>
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

// ─── Shared dialog primitives ─────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{children}</label>;
}
function Input({ label, value, onChange, required }: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
      />
    </div>
  );
}

// ─── PermissionDialog (edit user IAM) ────────────────────────────────────────

function PermissionDialog({
  user,
  catalog,
  groups,
  onClose,
}: {
  user: UserRow;
  catalog: PermissionCatalog;
  groups: Group[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [perms, setPerms] = useState<Record<string, string[]>>(user.permissions ?? {});
  const [groupIds, setGroupIds] = useState<number[]>(user.group_ids ?? []);

  const savePerms = useMutation({
    mutationFn: () =>
      api(`/api/iam/users/${user.id}/permissions`, { method: "PUT", json: { permissions: perms } }),
    onError: (e: Error) => toast.error(e.message),
  });
  const saveGroups = useMutation({
    mutationFn: () =>
      api(`/api/iam/users/${user.id}/groups`, { method: "PUT", json: { group_ids: groupIds } }),
    onSuccess: () => {
      toast.success("IAM updated");
      qc.invalidateQueries({ queryKey: ["users"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await savePerms.mutateAsync();
    saveGroups.mutate();
  };

  const toggleGroup = (id: number) =>
    setGroupIds((prev) => prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]);

  const isPending = savePerms.isPending || saveGroups.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-surface rounded-lg ring-1 ring-border shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-border shrink-0">
          <h3 className="text-sm font-semibold">Edit IAM — {user.username}</h3>
        </div>
        <form className="p-4 space-y-4 overflow-y-auto flex-1" onSubmit={handleSave}>
          {groups.length > 0 && (
            <div>
              <Label>Groups</Label>
              <div className="mt-1 flex flex-wrap gap-2">
                {groups.map((g) => (
                  <label key={g.id} className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={groupIds.includes(g.id)}
                      onChange={() => toggleGroup(g.id)}
                      className="accent-primary"
                    />
                    {g.name}
                  </label>
                ))}
              </div>
            </div>
          )}
          <div>
            <Label>Direct permissions</Label>
            <div className="mt-2 border border-border rounded-md overflow-hidden">
              <PermissionMatrix catalog={catalog} value={perms} onChange={setPerms} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm rounded-md hover:bg-muted">Cancel</button>
            <button type="submit" disabled={isPending} className="px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md disabled:opacity-60">
              {isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── GroupDialog (new + edit) ─────────────────────────────────────────────────

function GroupDialog({
  group,
  catalog,
  onClose,
}: {
  group?: Group;
  catalog: PermissionCatalog;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(group?.name ?? "");
  const [description, setDescription] = useState(group?.description ?? "");
  const [perms, setPerms] = useState<Record<string, string[]>>(group?.permissions ?? {});

  const save = useMutation({
    mutationFn: () =>
      group
        ? api(`/api/iam/groups/${group.id}`, { method: "PUT", json: { name, description, permissions: perms } })
        : api("/api/iam/groups", { method: "POST", json: { name, description, permissions: perms } as GroupCreate }),
    onSuccess: () => {
      toast.success(group ? "Group updated" : "Group created");
      qc.invalidateQueries({ queryKey: ["iam-groups"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-surface rounded-lg ring-1 ring-border shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-border shrink-0">
          <h3 className="text-sm font-semibold">{group ? `Edit group — ${group.name}` : "New group"}</h3>
        </div>
        <form className="p-4 space-y-3 overflow-y-auto flex-1" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <Input label="Name" value={name} onChange={setName} required />
          <Input label="Description" value={description} onChange={setDescription} />
          <div>
            <Label>Permissions</Label>
            <div className="mt-2 border border-border rounded-md overflow-hidden">
              <PermissionMatrix catalog={catalog} value={perms} onChange={setPerms} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm rounded-md hover:bg-muted">Cancel</button>
            <button type="submit" disabled={save.isPending} className="px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md disabled:opacity-60">
              {save.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const USER_FIELDS = [
  { key: "role",   label: "Role",   type: "multiselect" as const, options: ["admin","write","read"].map(v => ({ value: v })) },
  { key: "status", label: "Status", type: "select"      as const, options: [{ value: "active" }, { value: "inactive" }] },
];

function UsersGroupsPage() {
  const [tab, setTab] = useState<"users" | "groups">("users");
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [editProfile, setEditProfile] = useState<UserRow | null>(null);
  const [editGroup, setEditGroup] = useState<Group | null>(null);
  const [newGroup, setNewGroup] = useState(false);
  const [newUser, setNewUser] = useState(false);
  const [fs, setFs] = useState<FilterState>(emptyFilterState);

  const qc = useQueryClient();

  const { data: users } = useQuery({ queryKey: ["users"], queryFn: () => api<UserRow[]>("/api/users") });
  const { data: groups } = useQuery({ queryKey: ["iam-groups"], queryFn: () => api<Group[]>("/api/iam/groups") });
  const { data: catalog } = useQuery({ queryKey: ["iam-catalog"], queryFn: () => api<PermissionCatalog>("/api/iam/catalog") });

  const roles  = (fs.filters.role   as string[] | undefined) ?? [];
  const status = (fs.filters.status as string)  ?? "";

  const filteredUsers = (users ?? []).filter((u) => {
    if (fs.q && !u.username.toLowerCase().includes(fs.q.toLowerCase()) && !(u.full_name ?? "").toLowerCase().includes(fs.q.toLowerCase())) return false;
    if (roles.length && !roles.includes(u.role)) return false;
    if (status === "active"   && !u.is_active) return false;
    if (status === "inactive" &&  u.is_active) return false;
    return true;
  });
  const filteredGroups = (groups ?? []).filter((g) => {
    if (fs.q && !g.name.toLowerCase().includes(fs.q.toLowerCase())) return false;
    return true;
  });

  const toggleUser = useMutation({
    mutationFn: (id: number) => api(`/api/users/${id}/toggle`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const delUser = useMutation({
    mutationFn: (id: number) => api(`/api/users/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const delGroup = useMutation({
    mutationFn: (id: number) => api(`/api/iam/groups/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["iam-groups"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const tabBtn = (id: "users" | "groups", label: string) => (
    <button
      onClick={() => setTab(id)}
      className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
        tab === id ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Users & Groups"
        description="Manage operator accounts and IAM permission groups."
        actions={
          tab === "users" ? (
            <button
              onClick={() => setNewUser(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md"
            >
              <Plus className="size-3.5" /> Add User
            </button>
          ) : (
            <button
              onClick={() => setNewGroup(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md"
            >
              <Plus className="size-3.5" /> New Group
            </button>
          )
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex gap-1 p-1 bg-muted rounded-lg">
          {tabBtn("users", "Users")}
          {tabBtn("groups", "Groups")}
        </div>
        <div className="flex-1">
          <Card className="p-2.5">
            <AdvancedFilter
              fields={tab === "users" ? USER_FIELDS : []}
              state={fs}
              onChange={setFs}
              searchPlaceholder={tab === "users" ? "Search username or full name…" : "Search group name…"}
            />
          </Card>
        </div>
      </div>

      {tab === "users" && (
        <Card className="overflow-hidden">
          <table className="w-full text-left">
            <thead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider bg-surface-muted border-b border-border">
              <tr>
                <th className="px-4 py-2 font-medium">Username</th>
                <th className="px-4 py-2 font-medium">Role</th>
                <th className="px-4 py-2 font-medium">Groups</th>
                <th className="px-4 py-2 font-medium text-right">State</th>
                <th className="px-4 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredUsers.map((u) => {
                const userGroups = (groups ?? []).filter((g) => u.group_ids?.includes(g.id));
                return (
                  <tr key={u.id} className="text-sm">
                    <td className="px-4 py-2.5 font-medium">
                      {u.full_name ? (
                        <span>{u.full_name} <span className="text-muted-foreground text-xs font-normal">({u.username})</span></span>
                      ) : u.username}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs bg-muted px-1.5 py-0.5 rounded border border-border uppercase">{u.role}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {userGroups.length ? userGroups.map((g) => g.name).join(", ") : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <StatusPill status={u.is_active ? "active" : "inactive"} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="inline-flex gap-1">
                        <button onClick={() => setEditProfile(u)} className="inline-flex items-center gap-1 px-2 py-1 text-xs hover:bg-muted rounded-md" title="Edit profile">
                          <Pencil className="size-3.5" /> Edit
                        </button>
                        <button onClick={() => setEditUser(u)} className="inline-flex items-center gap-1 px-2 py-1 text-xs hover:bg-muted rounded-md" title="Edit IAM">
                          IAM
                        </button>
                        <button onClick={() => toggleUser.mutate(u.id)} className="p-1.5 hover:bg-muted rounded-md" title="Toggle active">
                          <Power className="size-3.5" />
                        </button>
                        <button onClick={async () => { if (await confirmAsync(`Delete ${u.username}?`)) delUser.mutate(u.id); }} className="p-1.5 hover:bg-muted rounded-md text-red-600" title="Delete">
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {users && filteredUsers.length === 0 && (
                <tr><td colSpan={5}><EmptyState title="No users" description='Click "Add User" to create the first operator account.' /></td></tr>
              )}
            </tbody>
          </table>
        </Card>
      )}

      {tab === "groups" && (
        <Card className="overflow-hidden">
          <table className="w-full text-left">
            <thead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider bg-surface-muted border-b border-border">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Description</th>
                <th className="px-4 py-2 font-medium">Members</th>
                <th className="px-4 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredGroups.map((g) => (
                <tr key={g.id} className="text-sm">
                  <td className="px-4 py-2.5 font-medium">{g.name}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{g.description ?? "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{g.member_count}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="inline-flex gap-1">
                      <button onClick={() => setEditGroup(g)} className="p-1.5 hover:bg-muted rounded-md" title="Edit">
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        onClick={async () => (await confirmAsync(`Delete group "${g.name}"?`)) && delGroup.mutate(g.id)}
                        className="p-1.5 hover:bg-muted rounded-md text-red-600"
                        title="Delete"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {groups && groups.length === 0 && (
                <tr><td colSpan={4}><EmptyState title="No groups" description="Create a group to bundle permissions." /></td></tr>
              )}
            </tbody>
          </table>
        </Card>
      )}

      {editProfile && (
        <EditProfileDialog user={editProfile} onClose={() => setEditProfile(null)} />
      )}
      {editUser && catalog && (
        <PermissionDialog
          user={editUser}
          catalog={catalog}
          groups={groups ?? []}
          onClose={() => setEditUser(null)}
        />
      )}
      {(newGroup || editGroup) && catalog && (
        <GroupDialog
          group={editGroup ?? undefined}
          catalog={catalog}
          onClose={() => { setNewGroup(false); setEditGroup(null); }}
        />
      )}
      {newUser && <NewUserDialog onClose={() => setNewUser(false)} />}
    </div>
  );
}

// ─── EditProfileDialog ─────────────────────────────────────────────────────────

function EditProfileDialog({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const qc = useQueryClient();
  const [username, setUsername] = useState(user.username);
  const [fullName, setFullName] = useState(user.full_name ?? "");

  const save = useMutation({
    mutationFn: () => api(`/api/users/${user.id}`, {
      method: "PATCH",
      json: { username: username || undefined, full_name: fullName || null },
    }),
    onSuccess: () => {
      toast.success("User updated");
      qc.invalidateQueries({ queryKey: ["users"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-surface rounded-lg ring-1 ring-border shadow-2xl">
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-semibold">Edit profile — {user.username}</h3>
        </div>
        <form className="p-4 space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <Input label="Username" value={username} onChange={setUsername} required />
          <Input label="Full Name (optional)" value={fullName} onChange={setFullName} />
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-muted">Cancel</button>
            <button type="submit" disabled={save.isPending} className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── NewUserDialog ─────────────────────────────────────────────────────────────

function NewUserDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"read" | "write">("read");

  const create = useMutation({
    mutationFn: () => api("/api/users", { method: "POST", json: { username, full_name: fullName || null, password, role } }),
    onSuccess: () => {
      toast.success("User created");
      qc.invalidateQueries({ queryKey: ["users"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-surface rounded-lg ring-1 ring-border shadow-2xl">
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-semibold">New user</h3>
        </div>
        <form className="p-4 space-y-3" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
          <Input label="Username" value={username} onChange={setUsername} required />
          <Input label="Full Name (optional)" value={fullName} onChange={setFullName} />
          <div>
            <Label>Password (10+ chars)</Label>
            <input
              required
              minLength={10}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
            />
          </div>
          <div>
            <Label>Role</Label>
            <CustomSelect
              value={role}
              onChange={(v) => setRole(v as "read" | "write")}
              options={[{ value: "read" }, { value: "write" }]}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm rounded-md hover:bg-muted">Cancel</button>
            <button type="submit" disabled={create.isPending} className="px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md disabled:opacity-60">
              {create.isPending ? "Saving…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
