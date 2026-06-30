import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type Page, type Credential } from "@/lib/api";
import { Card, PageHeader, ProviderBadge, EmptyState, CustomSelect } from "@/components/ui-bits";
import { useState } from "react";
import { Plus, Trash2, Power, Pencil } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/credentials")({
  head: () => ({ meta: [{ title: "Credentials — System Control" }] }),
  component: CredentialsPage,
});

const PROVIDERS = [
  { id: "aws", name: "Amazon Web Services", fields: ["access_key_id", "secret_access_key", "region"] },
  { id: "gcp", name: "Google Cloud", fields: ["service_account_json"] },
  { id: "azure", name: "Microsoft Azure", fields: ["tenant_id", "client_id", "client_secret", "subscription_id"] },
  { id: "digitalocean", name: "DigitalOcean", fields: ["api_token"] },
  { id: "linode", name: "Linode", fields: ["api_token"] },
  { id: "ovh", name: "OVH", fields: ["endpoint", "application_key", "application_secret", "consumer_key"] },
  { id: "hivelocity", name: "Hivelocity", fields: ["api_key"] },
];

const FIELD_OPTIONS: Record<string, string[]> = {
  endpoint: ["ovh-eu", "ovh-us", "ovh-ca"],
  region: ["us-east-1", "us-west-2", "eu-west-1", "ap-southeast-1"],
};

function isSecret(f: string) {
  return /secret|token|key|password|private|auth/.test(f) && f !== "endpoint";
}

function CredentialsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Credential | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["creds"],
    queryFn: () => api<Page<Credential>>("/api/credentials", { query: { limit: 100 } }),
  });

  const toggle = useMutation({
    mutationFn: (id: number) => api(`/api/credentials/${id}/toggle`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["creds"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: number) => api(`/api/credentials/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Credential removed");
      qc.invalidateQueries({ queryKey: ["creds"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Cloud credentials"
        description="API keys used to discover and sync resources from your providers."
        actions={
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            <Plus className="size-3.5" /> Add credential
          </button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(data?.items ?? []).map((c) => (
          <Card key={c.id} className="p-4 flex items-start gap-3">
            <div className="size-10 bg-background ring-1 ring-border rounded grid place-items-center overflow-hidden p-1">
              <img
                src={`/providers/${c.provider === "digitalocean" ? "digitalocean" : c.provider}.png`}
                onError={e => { (e.currentTarget as HTMLImageElement).src = `/providers/${c.provider}.webp`; (e.currentTarget as HTMLImageElement).onerror = null; }}
                alt={c.provider}
                className="size-full object-contain"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium truncate">{c.name}</span>
                <span className={`text-[10px] ${c.is_active ? "text-emerald-600" : "text-muted-foreground"}`}>
                  {c.is_active ? "Connected" : "Disabled"}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 capitalize">{c.provider}</div>
              <div className="flex gap-1 mt-3">
                <button
                  onClick={() => toggle.mutate(c.id)}
                  className="p-1.5 hover:bg-muted rounded-md text-muted-foreground"
                  title={c.is_active ? "Disable" : "Enable"}
                >
                  <Power className="size-3.5" />
                </button>
                <button
                  onClick={() => setEditing(c)}
                  className="p-1.5 hover:bg-muted rounded-md text-muted-foreground"
                  title="Edit"
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  onClick={() => confirm(`Delete ${c.name}?`) && del.mutate(c.id)}
                  className="p-1.5 hover:bg-muted rounded-md text-red-600"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {!isLoading && (data?.items.length ?? 0) === 0 && (
        <Card className="py-12">
          <EmptyState
            title="No credentials yet"
            description="Connect a cloud provider to start discovering servers."
            action={
              <button
                onClick={() => setOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md"
              >
                <Plus className="size-3.5" /> Add credential
              </button>
            }
          />
        </Card>
      )}

      {open && <NewCredentialDialog onClose={() => setOpen(false)} />}
      {editing && <EditCredentialDialog cred={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function EditCredentialDialog({ cred, onClose }: { cred: Credential; onClose: () => void }) {
  const qc = useQueryClient();
  const def = PROVIDERS.find(p => p.id === cred.provider);
  const [name, setName] = useState(cred.name);
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(cred.config ?? {}).map(([k, v]) => [k, String(v ?? "")]))
  );

  const update = useMutation({
    mutationFn: () => api(`/api/credentials/${cred.id}`, { method: "PUT", json: { name, provider: cred.provider, config: values } }),
    onSuccess: () => { toast.success("Credential updated"); qc.invalidateQueries({ queryKey: ["creds"] }); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const fields = def?.fields ?? Object.keys(cred.config ?? {});

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-full max-w-md bg-surface rounded-lg ring-1 ring-border shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-border shrink-0">
          <h3 className="text-sm font-semibold">Edit credential — {cred.provider}</h3>
        </div>
        <form className="p-4 space-y-3 overflow-y-auto flex-1" onSubmit={e => { e.preventDefault(); update.mutate(); }}>
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Name</label>
            <input required value={name} onChange={e => setName(e.target.value)}
              className="mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-md" />
          </div>
          {fields.map(f => (
            <div key={f}>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                {f.replace(/_/g, " ")}
              </label>
              {f.includes("json") ? (
                <textarea rows={4} value={values[f] ?? ""} onChange={e => setValues(v => ({ ...v, [f]: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 text-xs font-mono bg-background border border-border rounded-md" />
              ) : FIELD_OPTIONS[f] ? (
                <CustomSelect
                  value={values[f] ?? ""}
                  onChange={(v) => setValues(prev => ({ ...prev, [f]: v }))}
                  options={FIELD_OPTIONS[f].map(o => ({ value: o }))}
                  placeholder="— select —"
                />
              ) : (
                <input
                  type={isSecret(f) ? "password" : "text"}
                  value={values[f] ?? ""}
                  onChange={e => setValues(v => ({ ...v, [f]: e.target.value }))}
                  placeholder={isSecret(f) && values[f] ? "leave blank to keep current" : ""}
                  className="mt-1 w-full px-3 py-2 text-sm font-mono bg-background border border-border rounded-md"
                />
              )}
            </div>
          ))}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm rounded-md hover:bg-muted">Cancel</button>
            <button type="submit" disabled={update.isPending}
              className="px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md disabled:opacity-60">
              {update.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NewCredentialDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [provider, setProvider] = useState(PROVIDERS[0].id);
  const [name, setName] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const def = PROVIDERS.find((p) => p.id === provider)!;

  const create = useMutation({
    mutationFn: () =>
      api("/api/credentials", {
        method: "POST",
        json: { name, provider, config: values },
      }),
    onSuccess: () => {
      toast.success("Credential added");
      qc.invalidateQueries({ queryKey: ["creds"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-surface rounded-lg ring-1 ring-border shadow-2xl">
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-semibold">Add cloud credential</h3>
        </div>
        <form
          className="p-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
              Provider
            </label>
            <div className="mt-1 grid grid-cols-4 gap-2">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => { setProvider(p.id); setValues({}); }}
                  className={`flex flex-col items-center gap-1 p-2 rounded-md border text-[10px] transition-colors ${
                    provider === p.id
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border hover:border-muted-foreground/40 text-muted-foreground"
                  }`}
                >
                  <img
                    src={`/providers/${p.id}.png`}
                    onError={e => { (e.currentTarget as HTMLImageElement).src = `/providers/${p.id}.webp`; (e.currentTarget as HTMLImageElement).onerror = null; }}
                    alt={p.name}
                    className="size-6 object-contain"
                  />
                  <span className="truncate w-full text-center leading-tight">{p.id === "digitalocean" ? "DO" : p.id === "hivelocity" ? "HV" : p.id.toUpperCase()}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
              Name
            </label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Production account"
              className="mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
            />
          </div>
          {def.fields.map((f) => (
            <div key={f}>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                {f.replace(/_/g, " ")}
              </label>
              {f.includes("json") ? (
                <textarea required rows={4} value={values[f] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f]: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 text-xs font-mono bg-background border border-border rounded-md" />
              ) : FIELD_OPTIONS[f] ? (
                <CustomSelect
                  value={values[f] ?? ""}
                  onChange={(v) => setValues(prev => ({ ...prev, [f]: v }))}
                  options={FIELD_OPTIONS[f].map(o => ({ value: o }))}
                  placeholder="— select —"
                />
              ) : (
                <input required type={isSecret(f) ? "password" : "text"}
                  value={values[f] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f]: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 text-sm font-mono bg-background border border-border rounded-md" />
              )}
            </div>
          ))}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm rounded-md hover:bg-muted">
              Cancel
            </button>
            <button
              type="submit"
              disabled={create.isPending}
              className="px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md disabled:opacity-60"
            >
              {create.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
