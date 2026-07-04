import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type UserRow } from "@/lib/api";
import { PageHeader, StatusPill, CustomSelect, confirmAsync } from "@/components/ui-bits";
import { SmartTable, type SmartTableColumn } from "@/components/SmartTable";
import { Plus, Power, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/users")({
  head: () => ({ meta: [{ title: "Users — System Control" }] }),
  component: UsersPage,
});

function UsersPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useQuery({
    queryKey: ["users"],
    queryFn: () => api<UserRow[]>("/api/users"),
  });
  const toggle = useMutation({
    mutationFn: (id: number) => api(`/api/users/${id}/toggle`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
  const del = useMutation({
    mutationFn: (id: number) => api(`/api/users/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });

  const rows = data ?? [];
  const columns: SmartTableColumn<UserRow>[] = [
    { key: "username", header: "Username", render: (u) => <span className="font-medium">{u.username}</span> },
    {
      key: "role",
      header: "Role",
      render: (u) => (
        <span className="text-xs bg-muted px-1.5 py-0.5 rounded border border-border uppercase">{u.role}</span>
      ),
    },
    {
      key: "created",
      header: "Created",
      render: (u) => (
        <span className="text-xs text-muted-foreground">
          {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
        </span>
      ),
    },
    {
      key: "state",
      header: "State",
      className: "text-right",
      render: (u) => <StatusPill status={u.is_active ? "active" : "inactive"} />,
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (u) => (
        <div className="inline-flex gap-1">
          <button onClick={() => toggle.mutate(u.id)} className="p-1.5 hover:bg-muted rounded-md">
            <Power className="size-3.5" />
          </button>
          <button
            onClick={async () => (await confirmAsync(`Delete ${u.username}?`)) && del.mutate(u.id)}
            className="p-1.5 hover:bg-muted rounded-md text-red-600"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Users"
        description="Operators with access to this console."
        actions={
          <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md">
            <Plus className="size-3.5" /> Add user
          </button>
        }
      />
      <SmartTable
        columns={columns}
        rows={rows}
        rowKey={(u) => u.id}
        mode="client"
        page={page}
        onPageChange={setPage}
        totalItems={rows.length}
        isLoading={isLoading}
        error={error instanceof Error ? error.message : null}
      />
      {open && <NewUserDialog onClose={() => setOpen(false)} />}
    </div>
  );
}

function NewUserDialog({ onClose }: Readonly<{ onClose: () => void }>) {
  const qc = useQueryClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"read" | "write">("read");

  const create = useMutation({
    mutationFn: () => api("/api/users", { method: "POST", json: { username, password, role } }),
    onSuccess: () => {
      toast.success("User created");
      qc.invalidateQueries({ queryKey: ["users"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30"
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      role="button"
      tabIndex={0}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-surface rounded-lg ring-1 ring-border shadow-2xl"
      >
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-semibold">New user</h3>
        </div>
        <form className="p-4 space-y-3" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
          <div>
            <label htmlFor="new-user-username" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Username</label>
            <input id="new-user-username" required value={username} onChange={(e) => setUsername(e.target.value)} className="mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-md" />
          </div>
          <div>
            <label htmlFor="new-user-password" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Password (10+ chars)</label>
            <input id="new-user-password" required minLength={10} type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-md" />
          </div>
          <div>
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Role</span>
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
