import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, PageHeader } from "@/components/ui-bits";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({ meta: [{ title: "Settings — System Control" }] }),
  component: SettingsPage,
});

interface SettingsMap { [key: string]: string }

function SettingsPage() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api<SettingsMap>("/api/settings"),
  });
  const [draft, setDraft] = useState<SettingsMap>({});
  useEffect(() => { if (data) setDraft(data); }, [data]);

  const update = useMutation({
    mutationFn: async (entries: [string, string][]) => {
      for (const [k, v] of entries) {
        await api(`/api/settings/${encodeURIComponent(k)}`, { method: "PUT", json: { value: v } });
      }
    },
    onSuccess: () => {
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mfaStatus = useQuery({
    queryKey: ["mfaStatus"],
    queryFn: () => api<{ enabled: boolean }>("/api/auth/mfa/status"),
  });

  function save() {
    if (!data) return;
    const changed = Object.entries(draft).filter(([k, v]) => data[k] !== v);
    if (changed.length === 0) {
      toast.info("Nothing to save");
      return;
    }
    update.mutate(changed);
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <PageHeader title="Settings" description="Application preferences and defaults." />

      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-surface-muted">
          <h3 className="text-sm font-semibold">Application</h3>
        </div>
        <div className="p-4 space-y-4">
          {Object.entries(draft).map(([k, v]) => (
            <div key={k} className="grid grid-cols-3 gap-4 items-center">
              <label className="text-xs font-mono text-muted-foreground">{k}</label>
              <input
                value={v}
                onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
                className="col-span-2 px-3 py-1.5 text-sm bg-background border border-border rounded-md font-mono"
              />
            </div>
          ))}
          <div className="pt-2">
            <button onClick={save} disabled={update.isPending} className="px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md disabled:opacity-60">
              {update.isPending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-surface-muted">
          <h3 className="text-sm font-semibold">Two-factor authentication</h3>
        </div>
        <div className="p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">
              {mfaStatus.data?.enabled ? "Enabled" : "Disabled"}
            </p>
            <p className="text-xs text-muted-foreground">
              Use an authenticator app (e.g. 1Password, Authy) to add a second factor.
            </p>
          </div>
          <a
            href="https://github.com/google/google-authenticator/wiki"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Setup guide
          </a>
        </div>
      </Card>
    </div>
  );
}
