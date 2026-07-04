import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type Page, type Credential, DNS_PROVIDERS } from "@/lib/api";
import {
  Card,
  PageHeader,
  EmptyState,
  confirmAsync,
  Modal,
} from "@/components/ui-bits";
import { Plus, Trash2, Power, Pencil, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  AdvancedFilter,
  emptyFilterState,
  filterStateToSearchParams,
  type FilterState,
} from "@/components/advanced-filter";

export const Route = createFileRoute("/_app/domain-credentials")({
  head: () => ({ meta: [{ title: "DNS Providers — System Control" }] }),
  component: DomainCredentialsPage,
});

const PROVIDERS = [
  { id: "cloudflare", name: "Cloudflare", fields: ["api_token"] },
  { id: "generic-dns", name: "Domain (no API)", fields: ["domain"] },
];

function isSecret(f: string) {
  return /secret|token|key|password|private|auth/.test(f) && f !== "endpoint";
}

function buildFields(items: Credential[]) {
  const providerOpts = [...new Set(items.map((c) => c.provider))]
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

function DomainCredentialsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editing, setEditing] = useState<Credential | null>(null);
  const [fs, setFs] = useState<FilterState>(emptyFilterState);

  const { data, isLoading } = useQuery({
    queryKey: ["dns-creds"],
    queryFn: () =>
      api<Page<Credential>>("/api/credentials", {
        query: { limit: 200, cred_type: "api" },
      }),
  });

  const providers = (fs.filters.provider as string[] | undefined) ?? [];
  const status = (fs.filters.status as string) ?? "";

  const dnsOnly = (data?.items ?? []).filter((c) =>
    (DNS_PROVIDERS as readonly string[]).includes(c.provider),
  );
  const fields = buildFields(dnsOnly);

  const items = dnsOnly.filter((c) => {
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dns-creds"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: number) =>
      api(`/api/credentials/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Credential removed");
      qc.invalidateQueries({ queryKey: ["dns-creds"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="DNS Providers"
        description="API keys used to discover and sync DNS records for your domains."
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => setBulkOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-border rounded-md hover:bg-muted"
            >
              <Upload className="size-3.5" /> Bulk import
            </button>
            <button
              onClick={() => setOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              <Plus className="size-3.5" /> Add credential
            </button>
          </div>
        }
      />

      <Card className="p-3">
        <AdvancedFilter
          fields={fields}
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
                src={`/providers/${c.provider}.svg`}
                onError={(e) => {
                  const img = e.currentTarget as HTMLImageElement;
                  if (img.src.endsWith(".svg")) {
                    img.src = `/providers/${c.provider}.png`;
                  } else if (img.src.endsWith(".png")) {
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
                <a
                  href={`/domains?${filterStateToSearchParams({ q: "", filters: { zone: [c.name] } }).toString()}`}
                  className="text-sm font-medium truncate hover:text-primary hover:underline cursor-pointer"
                >
                  {c.name}
                </a>
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
            title="No DNS credentials yet"
            description="Connect Cloudflare to start discovering domains, or bulk-import a list."
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
      {bulkOpen && <BulkImportDialog onClose={() => setBulkOpen(false)} />}
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
        isSecret(k) ? "" : String(v ?? ""),
      ]),
    ),
  );

  const update = useMutation({
    mutationFn: () => {
      const config = Object.fromEntries(
        Object.entries(values).filter(([k, v]) => !(isSecret(k) && !v)),
      );
      return api(`/api/credentials/${cred.id}`, {
        method: "PUT",
        json: { name, provider: cred.provider, config },
      });
    },
    onSuccess: () => {
      toast.success("Credential updated");
      qc.invalidateQueries({ queryKey: ["dns-creds"] });
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
          <label
            htmlFor="edit-cred-name"
            className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest"
          >
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
        {fields.map((f) => (
          <div key={f}>
            <label
              htmlFor={`edit-cred-field-${f}`}
              className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest"
            >
              {f.replaceAll("_", " ")}
            </label>
            <input
              id={`edit-cred-field-${f}`}
              type={isSecret(f) ? "password" : "text"}
              value={values[f] ?? ""}
              onChange={(e) =>
                setValues((v) => ({ ...v, [f]: e.target.value }))
              }
              placeholder={isSecret(f) ? "leave blank to keep current" : ""}
              className="mt-1 w-full px-3 py-2 text-sm font-mono bg-background border border-border rounded-md"
            />
          </div>
        ))}
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

  const create = useMutation({
    mutationFn: () =>
      api("/api/credentials", {
        method: "POST",
        json: { name, provider, cred_type: "api", config: values },
      }),
    onSuccess: () => {
      toast.success("Credential added");
      qc.invalidateQueries({ queryKey: ["dns-creds"] });
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
        <h3 className="text-sm font-semibold">Add DNS credential</h3>
      </div>
      <form
        className="p-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <div>
          <span
            id="new-cred-provider-label"
            className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest"
          >
            Provider
          </span>
          <div
            role="group"
            aria-labelledby="new-cred-provider-label"
            className="mt-1 grid grid-cols-4 gap-2"
          >
            {PROVIDERS.map((p) => (
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
                  src={`/providers/${p.id}.svg`}
                  alt={p.name}
                  className="size-6 object-contain"
                />
                {p.name}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label
            htmlFor="new-cred-name"
            className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest"
          >
            Name
          </label>
          <input
            id="new-cred-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. example.com"
            className="mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
          />
        </div>
        {def.fields.map((f) => (
          <div key={f}>
            <label
              htmlFor={`new-cred-field-${f}`}
              className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest"
            >
              {f.replaceAll("_", " ")}
            </label>
            <input
              id={`new-cred-field-${f}`}
              required
              type={isSecret(f) ? "password" : "text"}
              value={values[f] ?? ""}
              onChange={(e) =>
                setValues((v) => ({ ...v, [f]: e.target.value }))
              }
              className="mt-1 w-full px-3 py-2 text-sm font-mono bg-background border border-border rounded-md"
            />
          </div>
        ))}
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
            {create.isPending ? "Adding…" : "Add"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

type ParsedRow =
  | { provider: "cloudflare"; domain: string; email: string; token: string }
  | { provider: "generic-dns"; domain: string };

function parseBulkText(text: string): ParsedRow[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\s+/).filter(Boolean))
    .filter((parts) => parts.length === 1 || parts.length >= 3)
    .map((parts): ParsedRow =>
      parts.length === 1
        ? { provider: "generic-dns", domain: parts[0] }
        : {
            provider: "cloudflare",
            domain: parts[0],
            email: parts[1],
            token: parts[2],
          },
    );
}

function BulkImportDialog({ onClose }: Readonly<{ onClose: () => void }>) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, failed: 0 });

  const rows = parseBulkText(text);

  async function runImport() {
    setImporting(true);
    setProgress({ done: 0, total: rows.length, failed: 0 });
    let failed = 0;
    for (const row of rows) {
      try {
        await api("/api/credentials", {
          method: "POST",
          json: {
            name: row.domain,
            provider: row.provider,
            cred_type: "api",
            config:
              row.provider === "generic-dns"
                ? { domain: row.domain }
                : { api_token: row.token, email: row.email },
          },
        });
      } catch {
        failed++;
      }
      setProgress((p) => ({ ...p, done: p.done + 1, failed }));
    }
    setImporting(false);
    qc.invalidateQueries({ queryKey: ["dns-creds"] });
    if (failed === 0) {
      toast.success(`Imported ${rows.length} credentials`);
      onClose();
    } else {
      toast.error(`${failed} of ${rows.length} failed to import`);
    }
  }

  return (
    <Modal
      onClose={onClose}
      dismissible={!importing}
      className="w-full max-w-lg bg-surface rounded-lg ring-1 ring-border shadow-2xl flex flex-col max-h-[90vh]"
    >
      <div className="p-4 border-b border-border shrink-0">
        <h3 className="text-sm font-semibold">Bulk import DNS credentials</h3>
        <p className="text-xs text-muted-foreground mt-1">
          One domain per line. Use{" "}
          <code className="font-mono">domain email api_token</code> (space or
          tab separated) for a Cloudflare credential, or just{" "}
          <code className="font-mono">domain</code> alone to auto-resolve its
          DNS with no API key.
        </p>
      </div>
      <div className="p-4 space-y-3 overflow-y-auto flex-1">
        <textarea
          rows={10}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={importing}
          placeholder={
            "example.com    user@example.com    <api_token>\nexample-noapi.com"
          }
          className="w-full px-3 py-2 text-xs font-mono bg-background border border-border rounded-md"
        />
        <div className="text-xs text-muted-foreground">
          {rows.length} valid row{rows.length === 1 ? "" : "s"} detected
          {text.trim() && rows.length === 0 && " — check the format"}
        </div>
        {importing && (
          <div className="text-xs text-muted-foreground">
            Importing {progress.done} / {progress.total}
            {progress.failed > 0 && ` (${progress.failed} failed)`}
          </div>
        )}
      </div>
      <div className="p-4 border-t border-border flex justify-end gap-2 shrink-0">
        <button
          type="button"
          onClick={onClose}
          disabled={importing}
          className="px-3 py-1.5 text-sm rounded-md hover:bg-muted disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={runImport}
          disabled={importing || rows.length === 0}
          className="px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md disabled:opacity-60"
        >
          {importing ? "Importing…" : `Import ${rows.length || ""}`}
        </button>
      </div>
    </Modal>
  );
}
