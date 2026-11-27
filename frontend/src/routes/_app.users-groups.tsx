import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type UserRow, type Group, type GroupCreate, type PermissionCatalog } from "@/lib/api";
import { Card, PageHeader, StatusPill, CustomSelect, EmptyState, confirmAsync, Modal } from "@/components/ui-bits";
import { Plus, Trash2, Pencil, Power } from "lucide-react";
import { useState, useCallback } from "react";
import { toast } from "sonner";
import { AdvancedFilter, emptyFilterState, type FilterState } from "@/components/advanced-filter";

export const Route = createFileRoute("/_app/users-groups")({
  head: () => ({ meta: [{ title: "Users & Groups — System Control" }] }),
  component: UsersGroupsPage,
});

// api.ts UserRow does not declare the LDAP fields the users list returns.
type LdapUserRow = UserRow & { auth_source?: "local" | "ldap"; ldap_group_ids?: number[] };
type LdapMapping = { id: number; ldap_group_dn: string; group_id: number; group_name: string };

// ─── PermissionMatrix ────────────────────────────────────────────────────────

function PermissionMatrix({
  catalog,
  value,
  onChange,
  readOnly,
}: Readonly<{
  catalog: PermissionCatalog;
  value: Record<string, string[]>;
  onChange: (v: Record<string, string[]>) => void;
  readOnly?: boolean;
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

function Label({ children }: Readonly<{ children: React.ReactNode }>) {
  return <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{children}</label>;
}
function Input({ label, value, onChange, required }: Readonly<{ label: string; value: string; onChange: (v: string) => void; required?: boolean }>) {
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
}: Readonly<{
  user: LdapUserRow;
  catalog: PermissionCatalog;
  groups: Group[];
  onClose: () => void;
}>) {
  const qc = useQueryClient();
  const [perms, setPerms] = useState<Record<string, string[]>>(user.permissions ?? {});
  const [groupIds, setGroupIds] = useState<number[]>(user.group_ids ?? []);

  const savePerms = useMutation({
    mutationFn: () =>
      api(`/api/iam/users/${user.id}/permissions`, { method: "PUT", json: { permissions: perms } }),
    onError: (e: Error) => toast.error(e.message),
  });
  const ldapIds = user.ldap_group_ids ?? [];
  const saveGroups = useMutation({
    mutationFn: () =>
      api(`/api/iam/users/${user.id}/groups`, { method: "PUT", json: { group_ids: groupIds.filter((g) => !ldapIds.includes(g)) } }),
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
    <Modal onClose={onClose} className="w-full max-w-lg bg-surface rounded-lg ring-1 ring-border shadow-2xl flex flex-col max-h-[90vh]">
      <div className="p-4 border-b border-border shrink-0">
        <h3 className="text-sm font-semibold">Edit IAM — {user.username}</h3>
      </div>
      <form className="p-4 space-y-4 overflow-y-auto flex-1" onSubmit={handleSave}>
        {groups.length > 0 && (
          <div>
            <Label>Groups</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              {groups.map((g) => {
                const locked = ldapIds.includes(g.id);
                return (
                  <label key={g.id} title={locked ? "Assigned by LDAP" : undefined} className={`inline-flex items-center gap-1.5 text-xs ${locked ? "opacity-60" : "cursor-pointer"}`}>
                    <input
                      type="checkbox"
                      disabled={locked}
                      checked={locked || groupIds.includes(g.id)}
                      onChange={() => toggleGroup(g.id)}
                      className="accent-primary"
                    />
                    {g.name}
                    {locked && <span className="text-[10px] text-muted-foreground">(LDAP)</span>}
                  </label>
                );
              })}
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
    </Modal>
  );
}

// ─── GroupDialog (new + edit) ─────────────────────────────────────────────────

function GroupDialog({
  group,
  catalog,
  onClose,
}: Readonly<{
  group?: Group;
  catalog: PermissionCatalog;
  onClose: () => void;
}>) {
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
      qc.invalidateQueries({ queryKey: ["ldap-mappings"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Modal onClose={onClose} className="w-full max-w-lg bg-surface rounded-lg ring-1 ring-border shadow-2xl flex flex-col max-h-[90vh]">
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
    </Modal>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const USER_FIELDS = [
  { key: "role",   label: "Role",   type: "multiselect" as const, options: ["admin","write","read"].map(v => ({ value: v })) },
  { key: "status", label: "Status", type: "select"      as const, options: [{ value: "active" }, { value: "inactive" }] },
];

function UsersGroupsPage() {
  const [tab, setTab] = useState<"users" | "groups">("users");
  const [editUser, setEditUser] = useState<LdapUserRow | null>(null);
  const [editProfile, setEditProfile] = useState<LdapUserRow | null>(null);
  const [editGroup, setEditGroup] = useState<Group | null>(null);
  const [newGroup, setNewGroup] = useState(false);
  const [newUser, setNewUser] = useState(false);
  const [localSwitch, setLocalSwitch] = useState<LdapUserRow | null>(null);
  const [fs, setFs] = useState<FilterState>(emptyFilterState);

  const qc = useQueryClient();

  const { data: users } = useQuery({ queryKey: ["users"], queryFn: () => api<LdapUserRow[]>("/api/users") });
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["iam-groups"] });
      qc.invalidateQueries({ queryKey: ["ldap-mappings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toLdap = useMutation({
    mutationFn: (id: number) => api(`/api/users/${id}`, { method: "PATCH", json: { auth_source: "ldap" } }),
    onSuccess: () => {
      toast.success("User switched to LDAP");
      qc.invalidateQueries({ queryKey: ["users"] });
    },
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
                      <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded border border-border">
                        {u.auth_source === "ldap" ? "LDAP" : "Local"}
                      </span>
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
                        {u.auth_source === "ldap" ? (
                          <button onClick={() => setLocalSwitch(u)} className="px-2 py-1 text-xs hover:bg-muted rounded-md">
                            Make local
                          </button>
                        ) : u.role !== "admin" && (
                          <button
                            onClick={async () => (await confirmAsync(`Switch ${u.username} to LDAP sign-in?`)) && toLdap.mutate(u.id)}
                            className="px-2 py-1 text-xs hover:bg-muted rounded-md"
                          >
                            Use LDAP
                          </button>
                        )}
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
              {groups?.length === 0 && (
                <tr><td colSpan={4}><EmptyState title="No groups" description="Create a group to bundle permissions." /></td></tr>
              )}
            </tbody>
          </table>
        </Card>
      )}

      {tab === "groups" && <LdapMappings groups={groups ?? []} />}

      {localSwitch && <SwitchToLocalDialog user={localSwitch} onClose={() => setLocalSwitch(null)} />}
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

function EditProfileDialog({ user, onClose }: Readonly<{ user: LdapUserRow; onClose: () => void }>) {
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
    <Modal
      onClose={onClose}
      className="w-full max-w-md bg-surface rounded-lg ring-1 ring-border shadow-2xl"
      backdropClassName="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
    >
      <div className="p-4 border-b border-border">
        <h3 className="text-sm font-semibold">Edit profile — {user.username}</h3>
      </div>
      <form className="p-4 space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        {user.auth_source === "ldap" ? (
          <p className="text-xs text-muted-foreground">Username is managed by LDAP.</p>
        ) : (
          <Input label="Username" value={username} onChange={setUsername} required />
        )}
        <Input label="Full Name (optional)" value={fullName} onChange={setFullName} />
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-muted">Cancel</button>
          <button type="submit" disabled={save.isPending} className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">Save</button>
        </div>
      </form>
    </Modal>
  );
}

// ─── NewUserDialog ─────────────────────────────────────────────────────────────

function NewUserDialog({ onClose }: Readonly<{ onClose: () => void }>) {
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
    <Modal onClose={onClose} className="w-full max-w-md bg-surface rounded-lg ring-1 ring-border shadow-2xl">
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
    </Modal>
  );
}

// ─── SwitchToLocalDialog ───────────────────────────────────────────────────────

function SwitchToLocalDialog({ user, onClose }: Readonly<{ user: UserRow; onClose: () => void }>) {
  const qc = useQueryClient();
  const [password, setPassword] = useState("");

  const save = useMutation({
    mutationFn: () => api(`/api/users/${user.id}`, {
      method: "PATCH",
      json: { auth_source: "local", password: password || undefined },
    }),
    onSuccess: () => {
      toast.success("User switched to local");
      qc.invalidateQueries({ queryKey: ["users"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Modal onClose={onClose} className="w-full max-w-md bg-surface rounded-lg ring-1 ring-border shadow-2xl">
      <div className="p-4 border-b border-border">
        <h3 className="text-sm font-semibold">Switch to local — {user.username}</h3>
      </div>
      <form className="p-4 space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <div>
          <Label>New password (optional, 10+ chars)</Label>
          <input
            aria-label="New password"
            minLength={10}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
          />
          <p className="mt-1 text-xs text-muted-foreground">Leave empty to keep the last password used to sign in.</p>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm rounded-md hover:bg-muted">Cancel</button>
          <button type="submit" disabled={save.isPending} className="px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md disabled:opacity-60">
            {save.isPending ? "Saving…" : "Switch"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── LdapMappings ──────────────────────────────────────────────────────────────

function LdapMappings({ groups }: Readonly<{ groups: Group[] }>) {
  const qc = useQueryClient();
  const [dn, setDn] = useState("");
  const [groupId, setGroupId] = useState("");
  const { data: mappings, error } = useQuery({ queryKey: ["ldap-mappings"], queryFn: () => api<LdapMapping[]>("/api/ldap/mappings") });

  const add = useMutation({
    mutationFn: () => api("/api/ldap/mappings", { method: "POST", json: { ldap_group_dn: dn.trim(), group_id: Number(groupId) } }),
    onSuccess: () => {
      toast.success("Mapping added");
      setDn("");
      setGroupId("");
      qc.invalidateQueries({ queryKey: ["ldap-mappings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: number) => api(`/api/ldap/mappings/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ldap-mappings"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="overflow-hidden">
      <div className="px-4 py-3 border-b border-border space-y-2">
        <h3 className="text-sm font-semibold">LDAP group mappings</h3>
        <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (dn.trim() && groupId) add.mutate(); }}>
          <input
            aria-label="LDAP group DN"
            placeholder="cn=ops,ou=groups,dc=example,dc=com"
            value={dn}
            onChange={(e) => setDn(e.target.value)}
            className="flex-1 min-w-60 px-3 py-2 text-sm bg-background border border-border rounded-md"
          />
          <CustomSelect
            value={groupId}
            onChange={setGroupId}
            options={groups.map((g) => ({ value: String(g.id), label: g.name }))}
            placeholder="IAM group"
            className="w-48"
          />
          <button type="submit" disabled={!dn.trim() || !groupId || add.isPending} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md disabled:opacity-60">
            <Plus className="size-3.5" /> Add mapping
          </button>
        </form>
      </div>
      {error ? (
        <p className="px-4 py-3 text-sm text-red-600">{error.message}</p>
      ) : (
        <table className="w-full text-left">
          <thead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider bg-surface-muted border-b border-border">
            <tr>
              <th className="px-4 py-2 font-medium">LDAP group DN</th>
              <th className="px-4 py-2 font-medium">IAM group</th>
              <th className="px-4 py-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {mappings?.map((m) => (
              <tr key={m.id} className="text-sm">
                <td className="px-4 py-2.5 font-mono text-xs break-all">{m.ldap_group_dn}</td>
                <td className="px-4 py-2.5">{m.group_name}</td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    onClick={async () => (await confirmAsync(`Delete mapping to "${m.group_name}"?`)) && del.mutate(m.id)}
                    className="p-1.5 hover:bg-muted rounded-md text-red-600"
                    title="Delete"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {mappings?.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-3 text-xs text-muted-foreground">No LDAP group mappings.</td></tr>
            )}
          </tbody>
        </table>
      )}
    </Card>
  );
}
