import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type Page, type Credential, DNS_PROVIDERS } from "@/lib/api";
import {
  Card,
  PageHeader,
  EmptyState,
  CustomSelect,
  confirmAsync,
  Modal,
} from "@/components/ui-bits";
import { useState, type ReactNode } from "react";
import { Plus, Trash2, Power, Pencil, Lock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  AdvancedFilter,
  emptyFilterState,
  type FilterState,
} from "@/components/advanced-filter";

export const Route = createFileRoute("/_app/cloud-providers")({
  head: () => ({ meta: [{ title: "Cloud Providers — System Control" }] }),
  component: CredentialsPage,
});

const PROVIDERS = [
  {
    id: "aws",
    name: "Amazon Web Services",
    fields: ["access_key_id", "secret_access_key", "region"],
  },
  { id: "gcp", name: "Google Cloud", fields: ["service_account_json"] },
  {
    id: "azure",
    name: "Microsoft Azure",
    fields: ["tenant_id", "client_id", "client_secret", "subscription_id"],
  },
  { id: "digitalocean", name: "DigitalOcean", fields: ["api_token"] },
  { id: "linode", name: "Linode", fields: ["api_token"] },
  {
    id: "ovh",
    name: "OVH",
    fields: [
      "endpoint",
      "application_key",
      "application_secret",
      "consumer_key",
    ],
  },
  { id: "hivelocity", name: "Hivelocity", fields: ["api_key"] },
];

const FIELD_OPTIONS: Record<string, string[]> = {
  endpoint: ["ovh-eu", "ovh-us", "ovh-ca"],
  region: ["us-east-1", "us-west-2", "eu-west-1", "ap-southeast-1"],
};

function isSecret(f: string) {
  return /secret|token|key|password|private|auth/.test(f) && f !== "endpoint";
}

function buildCpFields(items: Credential[]) {
  const providerOpts = [
    ...new Set(
      items
        .map((c) => c.provider)
        .filter((p) => !(DNS_PROVIDERS as readonly string[]).includes(p)),
    ),
  ]
    .sort((a, b) => a.localeCompare(b))
    .map((v) => ({ value: v }));
  return [
    {
      key: "provider",
      label: "Provider",
      type: "multiselect" as const,
      options: providerOpts,
    },
    {
      key: "status",
      label: "Status",
      type: "select" as const,
      options: [
        { value: "active", label: "Active" },
        { value: "disabled", label: "Disabled" },
      ],
    },
  ];
}

function CredentialsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Credential | null>(null);
  const [fs, setFs] = useState<FilterState>(emptyFilterState);

  const { data, isLoading } = useQuery({
    queryKey: ["creds"],
    queryFn: () =>
      api<Page<Credential>>("/api/credentials", {
        query: { limit: 100, cred_type: "api" },
      }),
  });

  const providers = (fs.filters.provider as string[] | undefined) ?? [];
  const status = (fs.filters.status as string) ?? "";
  const cpFields = buildCpFields(data?.items ?? []);

  const items = (data?.items ?? []).filter((c) => {
    if ((DNS_PROVIDERS as readonly string[]).includes(c.provider)) return false;
    if (
      fs.q &&
      !c.name.toLowerCase().includes(fs.q.toLowerCase()) &&
      !c.provider.toLowerCase().includes(fs.q.toLowerCase())
    )
      return false;
    if (providers.length && !providers.includes(c.provider)) return false;
    if (status === "active" && !c.is_active) return false;
    if (status === "disabled" && c.is_active) return false;
    return true;
  });

  const toggle = useMutation({
    mutationFn: (id: number) =>
      api(`/api/credentials/${id}/toggle`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["creds"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: number) =>
      api(`/api/credentials/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Credential removed");
      qc.invalidateQueries({ queryKey: ["creds"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Cloud Providers"
        description="API keys used to discover and sync resources from your cloud providers."
        actions={
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            <Plus className="size-3.5" /> Add credential
          </button>
        }
      />

      <Card className="p-3">
        <AdvancedFilter
          fields={cpFields}
          state={fs}
          onChange={setFs}
          searchPlaceholder="Search by name or provider…"
        />
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((c) => (
          <Card key={c.id} className="p-4 flex items-start gap-3">
            <div className="size-10 bg-background ring-1 ring-border rounded grid place-items-center overflow-hidden p-1">
              <img
                src={`/providers/${c.provider}.png`}
                onError={(e) => {
                  const img = e.currentTarget as HTMLImageElement;
                  if (img.src.endsWith(".png")) {
                    img.src = `/providers/${c.provider}.svg`;
                  } else if (img.src.endsWith(".svg")) {
                    img.src = `/providers/${c.provider}.webp`;
                  } else {
                    img.onerror = null;
                  }
                }}
                alt={c.provider}
                className="size-full object-contain"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium truncate">{c.name}</span>
                <span
                  className={`text-[10px] ${c.is_active ? "text-emerald-600" : "text-muted-foreground"}`}
                >
                  {c.is_active ? "Connected" : "Disabled"}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 capitalize">
                {c.provider}
              </div>
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
                  onClick={async () =>
                    (await confirmAsync(`Delete ${c.name}?`)) &&
                    del.mutate(c.id)
                  }
                  className="p-1.5 hover:bg-muted rounded-md text-red-600"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {!isLoading && items.length === 0 && (
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
      {editing && (
        <EditCredentialDialog cred={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function EditCredentialDialog({
  cred,
  onClose,
}: Readonly<{
  cred: Credential;
  onClose: () => void;
}>) {
  const qc = useQueryClient();
  const def = PROVIDERS.find((p) => p.id === cred.provider);
  const [name, setName] = useState(cred.name);
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(
      Object.entries(cred.config ?? {}).map(([k, v]) => [
        k,
        isSecret(k) ? "" : v == null ? "" : String(v),
      ]),
    ),
  );
  const setField = (f: string, value: string) =>
    setValues((v) => ({ ...v, [f]: value }));
  // Which secret fields already have a real stored value — drives the locked/
  // configured indicator, since blanking on open (above) loses that info.
  const configuredSecrets = new Set(
    Object.entries(cred.config ?? {})
      .filter(([k, v]) => isSecret(k) && v)
      .map(([k]) => k),
  );

  const update = useMutation({
    mutationFn: () => {
      // Blank secret fields mean "keep existing" — never resend the masked "***" placeholder.
      const config = Object.fromEntries(
        Object.entries(values).filter(([k, v]) => !(isSecret(k) && !v)),
      );
      return api(`/api/credentials/${String(cred.id)}`, {
        method: "PUT",
        json: { name, provider: cred.provider, config },
      });
    },
    onSuccess: () => {
      toast.success("Credential updated");
      qc.invalidateQueries({ queryKey: ["creds"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const fields = def?.fields ?? Object.keys(cred.config ?? {});

  return (
    <Modal
      onClose={onClose}
      className="w-full max-w-md bg-surface rounded-lg ring-1 ring-border shadow-2xl flex flex-col max-h-[90vh]"
    >
        <div className="p-4 border-b border-border shrink-0">
          <h3 className="text-sm font-semibold">
            Edit credential — {cred.provider}
          </h3>
        </div>
        <form
          className="p-4 space-y-3 overflow-y-auto flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            update.mutate();
          }}
        >
          <div>
            <label htmlFor="edit-cred-name" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
              Name
            </label>
            <input
              id="edit-cred-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
            />
          </div>
          {fields.map((f) => {
            const fieldId = `edit-cred-field-${f}`;
            const isReplacingSecret = isSecret(f) && configuredSecrets.has(f);
            let secretHint: ReactNode = null;
            if (isReplacingSecret) {
              secretHint = values[f] ? (
                <p className="mt-1 text-[11px] text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="size-3" /> This will replace the existing value — cannot be undone.
                </p>
              ) : (
                <p className="mt-1 text-[11px] text-muted-foreground flex items-center gap-1">
                  <Lock className="size-3" /> Already configured. Leave blank to keep it.
                </p>
              );
            }
            return (
              <div key={f}>
                <label htmlFor={fieldId} className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                  {f.replaceAll("_", " ")}
                </label>
                {(() => {
                  if (f.includes("json")) {
                    return (
                      <textarea
                        id={fieldId}
                        rows={4}
                        value={values[f] ?? ""}
                        onChange={(e) => setField(f, e.target.value)}
                        className="mt-1 w-full px-3 py-2 text-xs font-mono bg-background border border-border rounded-md"
                      />
                    );
                  }
                  if (FIELD_OPTIONS[f]) {
                    return (
                      <CustomSelect
                        value={values[f] ?? ""}
                        onChange={(v) => setField(f, v)}
                        options={FIELD_OPTIONS[f].map((o) => ({ value: o }))}
                        placeholder="— select —"
                      />
                    );
                  }
                  return (
                    <>
                      <input
                        id={fieldId}
                        type={isSecret(f) ? "password" : "text"}
                        value={values[f] ?? ""}
                        onChange={(e) => setField(f, e.target.value)}
                        placeholder={
                          isReplacingSecret
                            ? "•••••••••••• (locked — type to replace)"
                            : ""
                        }
                        className="mt-1 w-full px-3 py-2 text-sm font-mono bg-background border border-border rounded-md"
                      />
                      {secretHint}
                    </>
                  );
                })()}
              </div>
            );
          })}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm rounded-md hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={update.isPending}
              className="px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md disabled:opacity-60"
            >
              {update.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
    </Modal>
  );
}

function NewCredentialDialog({ onClose }: Readonly<{ onClose: () => void }>) {
  const qc = useQueryClient();
  const [provider, setProvider] = useState(PROVIDERS[0].id);
  const [name, setName] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const def = PROVIDERS.find((p) => p.id === provider)!;
  const setField = (f: string, value: string) =>
    setValues((v) => ({ ...v, [f]: value }));

  const create = useMutation({
    mutationFn: () =>
      api("/api/credentials", {
        method: "POST",
        json: { name, provider, cred_type: "api", config: values },
      }),
    onSuccess: () => {
      toast.success("Credential added");
      qc.invalidateQueries({ queryKey: ["creds"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Modal
      onClose={onClose}
      className="w-full max-w-md bg-surface rounded-lg ring-1 ring-border shadow-2xl"
    >
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
          <fieldset className="m-0 p-0 border-0">
            <legend className="p-0 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
              Provider
            </legend>
            <div className="mt-1 grid grid-cols-4 gap-2">
              {PROVIDERS.map((p) => {
                let label = p.id.toUpperCase();
                if (p.id === "digitalocean") label = "DO";
                else if (p.id === "hivelocity") label = "HV";
                return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setProvider(p.id);
                    setValues({});
                  }}
                  className={`flex flex-col items-center gap-1 p-2 rounded-md border text-[10px] transition-colors ${
                    provider === p.id
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border hover:border-muted-foreground/40 text-muted-foreground"
                  }`}
                >
                  <img
                    src={`/providers/${p.id}.png`}
                    onError={(e) => {
                      const img = e.currentTarget as HTMLImageElement;
                      if (img.src.endsWith(".png")) {
                        img.src = `/providers/${p.id}.svg`;
                      } else if (img.src.endsWith(".svg")) {
                        img.src = `/providers/${p.id}.webp`;
                      } else {
                        img.onerror = null;
                      }
                    }}
                    alt={p.name}
                    className="size-6 object-contain"
                  />
                  <span className="truncate w-full text-center leading-tight">
                    {label}
                  </span>
                </button>
                );
              })}
            </div>
          </fieldset>
          <div>
            <label htmlFor="new-cred-name" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
              Name
            </label>
            <input
              id="new-cred-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Production account"
              className="mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
            />
          </div>
          {def.fields.map((f) => {
            const fieldId = `new-cred-field-${f}`;
            return (
            <div key={f}>
              <label htmlFor={fieldId} className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                {f.replaceAll("_", " ")}
              </label>
              {(() => {
                if (f.includes("json")) {
                  return (
                    <textarea
                      id={fieldId}
                      required
                      rows={4}
                      value={values[f] ?? ""}
                      onChange={(e) => setField(f, e.target.value)}
                      className="mt-1 w-full px-3 py-2 text-xs font-mono bg-background border border-border rounded-md"
                    />
                  );
                }
                if (FIELD_OPTIONS[f]) {
                  return (
                    <CustomSelect
                      value={values[f] ?? ""}
                      onChange={(v) => setField(f, v)}
                      options={FIELD_OPTIONS[f].map((o) => ({ value: o }))}
                      placeholder="— select —"
                    />
                  );
                }
                return (
                  <input
                    id={fieldId}
                    required
                    type={isSecret(f) ? "password" : "text"}
                    value={values[f] ?? ""}
                    onChange={(e) => setField(f, e.target.value)}
                    className="mt-1 w-full px-3 py-2 text-sm font-mono bg-background border border-border rounded-md"
                  />
                );
              })()}
            </div>
            );
          })}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm rounded-md hover:bg-muted"
            >
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
    </Modal>
  );
}
