import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type Page, type Server, type ServerGroup, type ServerGroupCreate, type SshCredential } from "@/lib/api";
import { PageHeader, EmptyState, confirmAsync } from "@/components/ui-bits";
import { SmartTable, type SmartTableColumn } from "@/components/SmartTable";
import { Plus, Trash2, Pencil, Users, KeyRound, Cloud } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/server-groups")({
  head: () => ({ meta: [{ title: "Server Groups — System Control" }] }),
  component: ServerGroupsPage,
});

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

// ─── Create/Edit dialog ─────────────────────────────────────────────────────────

function GroupDialog({ group, onClose }: Readonly<{ group?: ServerGroup; onClose: () => void }>) {
  const qc = useQueryClient();
  const [name, setName] = useState(group?.name ?? "");
  const [description, setDescription] = useState(group?.description ?? "");

  const save = useMutation({
    mutationFn: () =>
      group
        ? api(`/api/server-groups/${group.id}`, { method: "PUT", json: { name, description } })
        : api("/api/server-groups", { method: "POST", json: { name, description } as ServerGroupCreate }),
    onSuccess: () => {
      toast.success(group ? "Group updated" : "Group created");
      qc.invalidateQueries({ queryKey: ["server-groups"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div
      role="button"
      tabIndex={0}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClose(); }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-surface rounded-lg ring-1 ring-border shadow-2xl"
      >
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-semibold">{group ? `Edit group — ${group.name}` : "New server group"}</h3>
        </div>
        <form className="p-4 space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <Input label="Name" value={name} onChange={setName} required />
          <Input label="Description" value={description} onChange={setDescription} />
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

// ─── Members dialog ─────────────────────────────────────────────────────────────

function MembersDialog({ group, onClose }: Readonly<{ group: ServerGroup; onClose: () => void }>) {
  const qc = useQueryClient();
  const { data: serversPage } = useQuery({
    queryKey: ["servers", "all-for-group"],
    queryFn: () => api<Page<Server>>("/api/servers", { query: { limit: 500 } }),
  });
  const { data: memberIds } = useQuery({
    queryKey: ["server-group-members", group.id],
    queryFn: () => api<number[]>(`/api/server-groups/${group.id}/members`),
  });
  const [active, setActive] = useState<Set<number> | null>(null);
  const [search, setSearch] = useState("");
  const selected = active ?? new Set(memberIds ?? []);

  const servers = serversPage?.items ?? [];
  const filtered = search
    ? servers.filter(s => s.name.toLowerCase().includes(search.toLowerCase()))
    : servers;

  const save = useMutation({
    mutationFn: (server_ids: number[]) =>
      api(`/api/server-groups/${group.id}/members`, { method: "PUT", json: { server_ids } }),
    onSuccess: () => {
      toast.success("Members updated");
      qc.invalidateQueries({ queryKey: ["server-groups"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div
      role="button"
      tabIndex={0}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClose(); }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-surface rounded-lg ring-1 ring-border shadow-2xl flex flex-col max-h-[85vh]"
      >
        <div className="p-4 border-b border-border shrink-0">
          <h3 className="text-sm font-semibold">Members — {group.name}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Select every server that belongs to this group. Saving replaces the full membership list.</p>
        </div>
        <div className="p-3 border-b border-border shrink-0">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search servers…"
            className="w-full px-3 py-1.5 text-sm bg-background border border-border rounded-md"
          />
        </div>
        <div className="overflow-y-auto flex-1 p-2">
          {filtered.map(s => (
            <label key={s.id} className="flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted cursor-pointer">
              <input
                type="checkbox"
                checked={selected.has(s.id)}
                onChange={e => {
                  const next = new Set(selected);
                  e.target.checked ? next.add(s.id) : next.delete(s.id);
                  setActive(next);
                }}
              />
              <span className="truncate">{s.name}</span>
              <span className="text-xs text-muted-foreground ml-auto shrink-0">{s.provider}</span>
            </label>
          ))}
          {filtered.length === 0 && <div className="text-sm text-muted-foreground p-4 text-center">No servers match.</div>}
        </div>
        <div className="flex justify-end gap-2 p-3 border-t border-border shrink-0">
          <button onClick={onClose} className="px-3 py-1.5 text-sm rounded-md hover:bg-muted">Cancel</button>
          <button
            onClick={() => save.mutate(Array.from(selected))}
            disabled={save.isPending}
            className="px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md disabled:opacity-60"
          >
            {save.isPending ? "Saving…" : "Save members"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function ServerGroupsPage() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editGroup, setEditGroup] = useState<ServerGroup | null>(null);
  const [membersGroup, setMembersGroup] = useState<ServerGroup | null>(null);
  const [sshFor, setSshFor] = useState<number | null>(null);
  const [page, setPage] = useState(1);

  const { data: groups = [] } = useQuery({
    queryKey: ["server-groups"],
    queryFn: () => api<ServerGroup[]>("/api/server-groups"),
  });
  const { data: sshCreds = [] } = useQuery<SshCredential[]>({
    queryKey: ["sshCredentials"],
    queryFn: () => api("/api/ssh-credentials"),
    staleTime: 60_000,
  });

  const delGroup = useMutation({
    mutationFn: (id: number) => api(`/api/server-groups/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast.success("Group deleted"); qc.invalidateQueries({ queryKey: ["server-groups"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const assignSSH = useMutation({
    mutationFn: ({ id, sshCredentialId }: { id: number; sshCredentialId: number }) =>
      api(`/api/server-groups/${id}/assign-ssh`, { method: "POST", json: { ssh_credential_id: sshCredentialId } }),
    onSuccess: (res: { updated: number }) => {
      toast.success(`SSH key assigned to ${res.updated} servers`);
      qc.invalidateQueries({ queryKey: ["servers"] });
      setSshFor(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const columns: SmartTableColumn<ServerGroup>[] = [
    {
      key: "name",
      header: "Name",
      className: "font-medium",
      render: (g) => (
        <div className="flex items-center gap-1.5">
          {g.is_auto && <Cloud className="size-3.5 text-muted-foreground" title="Provider auto-group" />}
          {g.name}
        </div>
      ),
    },
    {
      key: "description",
      header: "Description",
      className: "text-xs text-muted-foreground",
      render: (g) => g.description ?? (g.is_auto ? "Auto-maintained by provider" : "—"),
    },
    {
      key: "servers",
      header: "Servers",
      className: "text-xs text-muted-foreground",
      render: (g) => g.server_count,
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (g) => (
        <div className="inline-flex items-center gap-0.5">
          {sshFor === g.id ? (
            <select
              autoFocus
              className="text-xs px-1.5 py-0.5 border border-border rounded bg-background"
              onChange={e => e.target.value && assignSSH.mutate({ id: g.id, sshCredentialId: Number(e.target.value) })}
              onBlur={() => setSshFor(null)}
              defaultValue=""
            >
              <option value="">Select SSH key…</option>
              {sshCreds.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          ) : (
            <button onClick={() => setSshFor(g.id)} className="icon-btn" title="Assign SSH key to group">
              <KeyRound className="size-3.5" />
            </button>
          )}
          {!g.is_auto && (
            <>
              <button onClick={() => setMembersGroup(g)} className="icon-btn" title="Manage members">
                <Users className="size-3.5" />
              </button>
              <button onClick={() => setEditGroup(g)} className="icon-btn" title="Edit">
                <Pencil className="size-3.5" />
              </button>
              <button
                onClick={async () => (await confirmAsync(`Delete group "${g.name}"?`)) && delGroup.mutate(g.id)}
                className="icon-btn hover:text-red-600 hover:bg-red-50" title="Delete"
              >
                <Trash2 className="size-3.5" />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-4">
      {showAdd && <GroupDialog onClose={() => setShowAdd(false)} />}
      {editGroup && <GroupDialog group={editGroup} onClose={() => setEditGroup(null)} />}
      {membersGroup && <MembersDialog group={membersGroup} onClose={() => setMembersGroup(null)} />}

      <div className="flex items-center justify-between">
        <PageHeader title="Server Groups" description="Organize servers into named groups for bulk operations like SSH key assignment." />
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md text-white btn-press"
          style={{ background: "#18181b" }}
        >
          <Plus className="size-3.5" /> New Group
        </button>
      </div>

      <SmartTable
        columns={columns}
        rows={groups}
        rowKey={(g) => g.id}
        mode="client"
        page={page}
        onPageChange={setPage}
        totalItems={groups.length}
        empty={<EmptyState title="No server groups" description='Click "New Group" to create the first one.' />}
      />
    </div>
  );
}
