import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type SshCredential } from "@/lib/api";
import { Card, PageHeader, EmptyState, CustomSelect, confirmAsync } from "@/components/ui-bits";
import { SmartTable, type SmartTableColumn } from "@/components/SmartTable";
import { Plus, Star, Trash2, Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AdvancedFilter, emptyFilterState, type FilterState } from "@/components/advanced-filter";

export const Route = createFileRoute("/_app/ssh-keys")({
  head: () => ({ meta: [{ title: "SSH Keys — System Control" }] }),
  component: SshPage,
});

const SSH_FIELDS = [
  { key: "auth", label: "Auth method", type: "multiselect" as const, options: [{ value: "key", label: "Private key" }, { value: "password", label: "Password" }] },
  { key: "hasProxy", label: "Has proxy", type: "select" as const, options: [{ value: "yes", label: "With proxy" }, { value: "no", label: "Direct" }] },
];

function SshPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SshCredential | null>(null);
  const [fs, setFs] = useState<FilterState>(emptyFilterState);
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ["ssh"],
    queryFn: () => api<SshCredential[]>("/api/ssh-credentials"),
  });

  const authMethods = (fs.filters.auth     as string[] | undefined) ?? [];
  const hasProxy    = (fs.filters.hasProxy  as string)  ?? "";

  const items = (data ?? []).filter((c) => {
    if (fs.q && !c.name.toLowerCase().includes(fs.q.toLowerCase()) && !c.username.toLowerCase().includes(fs.q.toLowerCase())) return false;
    if (authMethods.length && !authMethods.includes(c.auth_method)) return false;
    if (hasProxy === "yes" && !c.proxy_host) return false;
    if (hasProxy === "no"  &&  c.proxy_host) return false;
    return true;
  });

  const setDefault = useMutation({
    mutationFn: (id: number) => api(`/api/ssh-credentials/${id}/set-default`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ssh"] }),
  });
  const del = useMutation({
    mutationFn: (id: number) => api(`/api/ssh-credentials/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ssh"] }),
  });

  const columns: SmartTableColumn<SshCredential>[] = [
    {
      key: "name",
      header: "Name",
      render: (c) => (
        <div className="flex items-center gap-2 font-medium">
          {c.is_default && <Star className="size-3.5 text-amber-500 fill-amber-500 shrink-0" />}
          {c.name}
        </div>
      ),
    },
    { key: "username", header: "User", render: (c) => <span className="font-mono text-xs">{c.username}</span> },
    {
      key: "auth",
      header: "Auth",
      render: (c) => (
        <span className="text-xs bg-muted px-1.5 py-0.5 rounded border border-border">{c.auth_method}</span>
      ),
    },
    { key: "port", header: "Port", render: (c) => <span className="font-mono text-xs">{c.port}</span> },
    {
      key: "proxy",
      header: "Proxy",
      render: (c) => (
        <span className="font-mono text-xs text-muted-foreground">
          {c.proxy_host ? `${c.proxy_host}:${c.proxy_port ?? 22}` : "—"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (c) => (
        <div className="inline-flex gap-1">
          {!c.is_default && (
            <button onClick={() => setDefault.mutate(c.id)} className="p-1.5 hover:bg-muted rounded-md" title="Set default">
              <Star className="size-3.5" />
            </button>
          )}
          <button onClick={() => setEditing(c)} className="p-1.5 hover:bg-muted rounded-md" title="Edit">
            <Pencil className="size-3.5" />
          </button>
          <button
            onClick={async () => (await confirmAsync(`Delete ${c.name}?`)) && del.mutate(c.id)}
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
        title="SSH credentials"
        description="Used to fetch live IPs and OS info from your servers."
        actions={
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md"
          >
            <Plus className="size-3.5" /> Add SSH credential
          </button>
        }
      />
      <Card className="p-3">
        <AdvancedFilter
          fields={SSH_FIELDS}
          state={fs}
          onChange={(next) => { setFs(next); setPage(1); }}
          searchPlaceholder="Search by name or username…"
        />
      </Card>

      <SmartTable
        columns={columns}
        rows={items}
        rowKey={(c) => c.id}
        mode="client"
        page={page}
        onPageChange={setPage}
        totalItems={items.length}
        isLoading={isLoading}
        error={error ? (error as Error).message : null}
        empty={<EmptyState title="No SSH credentials match" description="Add one to enable SSH-based IP discovery." />}
      />
      {open && <SshDialog onClose={() => setOpen(false)} />}
      {editing && <SshDialog onClose={() => setEditing(null)} credential={editing} />}
    </div>
  );
}

function SshDialog({ onClose, credential }: Readonly<{ onClose: () => void; credential?: SshCredential }>) {
  const qc = useQueryClient();
  const isEdit = !!credential;
  const [name, setName] = useState(credential?.name ?? "");
  const [username, setUsername] = useState(credential?.username ?? "root");
  const [authMethod, setAuthMethod] = useState<"password" | "key">((credential?.auth_method as "password" | "key") ?? "key");
  const [password, setPassword] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [port, setPort] = useState(credential?.port ?? 22);
  const [showProxy, setShowProxy] = useState(!!(credential?.proxy_host));
  const [proxyHost, setProxyHost] = useState(credential?.proxy_host ?? "");
  const [proxyPort, setProxyPort] = useState(credential?.proxy_port ?? 22);
  const [proxyUsername, setProxyUsername] = useState(credential?.proxy_username ?? "root");
  const [proxyAuthMethod, setProxyAuthMethod] = useState<"password" | "key">((credential?.proxy_auth_method as "password" | "key") ?? "password");
  const [proxyPassword, setProxyPassword] = useState("");
  const [proxyKey, setProxyKey] = useState("");

  // Editing: blank secret = keep existing (omit field). Adding: blank = clear/unused method (send null).
  const secretField = (isActive: boolean, val: string) => {
    if (isActive) return val || undefined;
    return isEdit ? undefined : null;
  };

  const body = () => {
    let proxyFields: Record<string, unknown>;
    if (showProxy && proxyHost) {
      proxyFields = {
        proxy_host: proxyHost,
        proxy_port: proxyPort,
        proxy_username: proxyUsername,
        proxy_auth_method: proxyAuthMethod,
        proxy_password: secretField(proxyAuthMethod === "password", proxyPassword),
        proxy_private_key: secretField(proxyAuthMethod === "key", proxyKey),
      };
    } else {
      proxyFields = isEdit ? {} : { proxy_host: null };
    }

    return {
      name,
      username,
      auth_method: authMethod,
      password: secretField(authMethod === "password", password),
      private_key: secretField(authMethod === "key", privateKey),
      port,
      ...proxyFields,
    };
  };

  const save = useMutation({
    mutationFn: () => isEdit
      ? api(`/api/ssh-credentials/${credential.id}`, { method: "PUT", json: body() })
      : api("/api/ssh-credentials", { method: "POST", json: { ...body(), is_default: false } }),
    onSuccess: () => {
      toast.success(isEdit ? "SSH credential updated" : "SSH credential added");
      qc.invalidateQueries({ queryKey: ["ssh"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-surface rounded-lg ring-1 ring-border shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="p-4 border-b border-border shrink-0">
          <h3 className="text-sm font-semibold">{isEdit ? "Edit SSH credential" : "New SSH credential"}</h3>
        </div>
        <form className="p-4 space-y-3 overflow-y-auto flex-1" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <Input label="Name" value={name} onChange={setName} required />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Username" value={username} onChange={setUsername} required />
            <Input label="Port" value={String(port)} onChange={(v) => setPort(Number(v) || 22)} />
          </div>
          <div>
            <Label>Auth method</Label>
            <CustomSelect
              value={authMethod}
              onChange={(v) => setAuthMethod(v as "password" | "key")}
              options={[{ value: "key", label: "Private key" }, { value: "password", label: "Password" }]}
            />
          </div>
          {authMethod === "password" ? (
            <Input label="Password" value={password} onChange={setPassword} type="password" required={!isEdit}
              placeholder={isEdit ? "Leave blank to keep existing" : undefined} />
          ) : (
            <div>
              <Label>Private key</Label>
              <textarea
                required={!isEdit}
                rows={5}
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                placeholder={isEdit ? "Leave blank to keep existing" : "-----BEGIN OPENSSH PRIVATE KEY-----"}
                className="mt-1 w-full px-3 py-2 text-xs font-mono bg-background border border-border rounded-md"
              />
            </div>
          )}
          <button type="button" onClick={() => setShowProxy(v => !v)} className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 underline">
            {showProxy ? "− Hide proxy" : "+ Add jump host / proxy"}
          </button>
          {showProxy && (
            <div className="border border-border rounded-md p-3 space-y-3 bg-muted/30">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Jump host / proxy</div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Proxy host" value={proxyHost} onChange={setProxyHost} />
                <Input label="Proxy port" value={String(proxyPort)} onChange={(v) => setProxyPort(Number(v) || 22)} />
              </div>
              <Input label="Proxy username" value={proxyUsername} onChange={setProxyUsername} />
              <div>
                <Label>Proxy auth</Label>
                <CustomSelect
                  value={proxyAuthMethod}
                  onChange={(v) => setProxyAuthMethod(v as "password" | "key")}
                  options={[{ value: "password", label: "Password" }, { value: "key", label: "Private key" }]}
                />
              </div>
              {proxyAuthMethod === "password"
                ? <Input label="Proxy password" value={proxyPassword} onChange={setProxyPassword} type="password" />
                : <div>
                    <Label>Proxy private key</Label>
                    <textarea rows={3} value={proxyKey} onChange={e => setProxyKey(e.target.value)}
                      placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                      className="mt-1 w-full px-3 py-2 text-xs font-mono bg-background border border-border rounded-md" />
                  </div>
              }
            </div>
          )}
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

function Label({ children }: Readonly<{ children: React.ReactNode }>) {
  return <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{children}</label>;
}
function Input({ label, value, onChange, type = "text", required, placeholder }: Readonly<{ label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean; placeholder?: string }>) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        required={required}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
      />
    </div>
  );
}
