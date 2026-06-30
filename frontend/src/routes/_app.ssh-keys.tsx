import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type SshCredential } from "@/lib/api";
import { Card, PageHeader, EmptyState, CustomSelect } from "@/components/ui-bits";
import { Plus, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/ssh-keys")({
  head: () => ({ meta: [{ title: "SSH Keys — System Control" }] }),
  component: SshPage,
});

function SshPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ["ssh"],
    queryFn: () => api<SshCredential[]>("/api/ssh-credentials"),
  });

  const setDefault = useMutation({
    mutationFn: (id: number) => api(`/api/ssh-credentials/${id}/set-default`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ssh"] }),
  });
  const del = useMutation({
    mutationFn: (id: number) => api(`/api/ssh-credentials/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ssh"] }),
  });

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
      <Card className="overflow-hidden">
        <table className="w-full text-left">
          <thead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider bg-surface-muted border-b border-border">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">User</th>
              <th className="px-4 py-2 font-medium">Auth</th>
              <th className="px-4 py-2 font-medium">Port</th>
              <th className="px-4 py-2 font-medium">Proxy</th>
              <th className="px-4 py-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(data ?? []).map((c) => (
              <tr key={c.id} className="text-sm">
                <td className="px-4 py-2.5 font-medium flex items-center gap-2">
                  {c.is_default && <Star className="size-3.5 text-amber-500 fill-amber-500" />}
                  {c.name}
                </td>
                <td className="px-4 py-2.5 font-mono text-xs">{c.username}</td>
                <td className="px-4 py-2.5">
                  <span className="text-xs bg-muted px-1.5 py-0.5 rounded border border-border">{c.auth_method}</span>
                </td>
                <td className="px-4 py-2.5 font-mono text-xs">{c.port}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                  {c.proxy_host ? `${c.proxy_host}:${c.proxy_port ?? 22}` : "—"}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="inline-flex gap-1">
                    {!c.is_default && (
                      <button onClick={() => setDefault.mutate(c.id)} className="p-1.5 hover:bg-muted rounded-md" title="Set default">
                        <Star className="size-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => confirm(`Delete ${c.name}?`) && del.mutate(c.id)}
                      className="p-1.5 hover:bg-muted rounded-md text-red-600"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {data && data.length === 0 && (
              <tr><td colSpan={6}><EmptyState title="No SSH credentials" description="Add one to enable SSH-based IP discovery." /></td></tr>
            )}
          </tbody>
        </table>
      </Card>

      {open && <SshDialog onClose={() => setOpen(false)} />}
    </div>
  );
}

function SshDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("root");
  const [authMethod, setAuthMethod] = useState<"password" | "key">("key");
  const [password, setPassword] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [port, setPort] = useState(22);
  const [showProxy, setShowProxy] = useState(false);
  const [proxyHost, setProxyHost] = useState("");
  const [proxyPort, setProxyPort] = useState(22);
  const [proxyUsername, setProxyUsername] = useState("root");
  const [proxyAuthMethod, setProxyAuthMethod] = useState<"password" | "key">("password");
  const [proxyPassword, setProxyPassword] = useState("");
  const [proxyKey, setProxyKey] = useState("");

  const create = useMutation({
    mutationFn: () =>
      api("/api/ssh-credentials", {
        method: "POST",
        json: {
          name,
          username,
          auth_method: authMethod,
          password: authMethod === "password" ? password : null,
          private_key: authMethod === "key" ? privateKey : null,
          port,
          is_default: false,
          ...(showProxy && proxyHost ? {
            proxy_host: proxyHost,
            proxy_port: proxyPort,
            proxy_username: proxyUsername,
            proxy_auth_method: proxyAuthMethod,
            proxy_password: proxyAuthMethod === "password" ? proxyPassword : null,
            proxy_private_key: proxyAuthMethod === "key" ? proxyKey : null,
          } : {}),
        },
      }),
    onSuccess: () => {
      toast.success("SSH credential added");
      qc.invalidateQueries({ queryKey: ["ssh"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-surface rounded-lg ring-1 ring-border shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-border shrink-0">
          <h3 className="text-sm font-semibold">New SSH credential</h3>
        </div>
        <form className="p-4 space-y-3 overflow-y-auto flex-1" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
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
            <Input label="Password" value={password} onChange={setPassword} type="password" required />
          ) : (
            <div>
              <Label>Private key</Label>
              <textarea
                required
                rows={5}
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
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
            <button type="submit" disabled={create.isPending} className="px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md disabled:opacity-60">
              {create.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{children}</label>;
}
function Input({ label, value, onChange, type = "text", required }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        required={required}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
      />
    </div>
  );
}
