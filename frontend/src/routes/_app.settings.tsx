import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, API_BASE } from "@/lib/api";
import { Card, PageHeader, CustomSelect } from "@/components/ui-bits";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { Upload, RotateCcw } from "lucide-react";

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
    const changed = Object.entries(draft).filter(([k, v]) => !k.startsWith("branding_") && data[k] !== v);
    if (changed.length === 0) {
      toast.info("Nothing to save");
      return;
    }
    update.mutate(changed);
  }

  // branding_* keys hold base64 image blobs — internal to the Branding card's
  // own upload endpoint, not generic user-editable preferences.
  const genericEntries = Object.entries(draft).filter(([k]) => !k.startsWith("branding_"));

  return (
    <div className="p-6 space-y-4">
      <PageHeader title="Settings" description="Application preferences and defaults." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2 space-y-4">
          <Card className="overflow-hidden">
            <div className="px-3 py-2 border-b border-border bg-surface-muted">
              <h3 className="text-sm font-semibold">Application</h3>
            </div>
            <div className="p-3 space-y-3">
              {genericEntries.map(([k, v]) => (
                <div key={k} className="grid grid-cols-3 gap-4 items-center">
                  <label className="text-xs font-mono text-muted-foreground">{k}</label>
                  <div className="col-span-2">
                    {k === "appearance_compact" ? (
                      <CustomSelect
                        value={v}
                        onChange={(val) => setDraft((d) => ({ ...d, [k]: val }))}
                        options={[
                          { value: "false", label: "Off (default)" },
                          { value: "true",  label: "On" },
                        ]}
                      />
                    ) : k === "ssh_default_port" ? (
                      <CustomSelect
                        value={v}
                        onChange={(val) => setDraft((d) => ({ ...d, [k]: val }))}
                        options={[
                          { value: "22",    label: "22 (standard)" },
                          { value: "2222",  label: "2222" },
                          { value: "2200",  label: "2200" },
                          { value: "22222", label: "22222" },
                        ]}
                      />
                    ) : k === "sync_timeout" ? (
                      <CustomSelect
                        value={v}
                        onChange={(val) => setDraft((d) => ({ ...d, [k]: val }))}
                        options={[
                          { value: "60",  label: "1 min" },
                          { value: "120", label: "2 min" },
                          { value: "300", label: "5 min (default)" },
                          { value: "600", label: "10 min" },
                          { value: "900", label: "15 min" },
                        ]}
                      />
                    ) : (
                      <input
                        value={v}
                        onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
                        className="w-full px-3 py-1.5 text-sm bg-background border border-border rounded-md font-mono"
                      />
                    )}
                  </div>
                </div>
              ))}
              <div className="pt-1">
                <button onClick={save} disabled={update.isPending} className="px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md disabled:opacity-60">
                  {update.isPending ? "Saving…" : "Save changes"}
                </button>
              </div>
            </div>
          </Card>

          <BrandingCard />
          <ChangePasswordCard />
        </div>

        <div className="space-y-4">
          <MfaCard />
        </div>
      </div>
    </div>
  );
}

// Bust the browser's cached /api/branding/{slot} image after upload/reset —
// query param forces a fresh fetch since the URL itself never changes.
function brandingUrl(slot: "logo" | "favicon", version: number) {
  return `${API_BASE}/api/branding/${slot}?v=${version}`;
}

function BrandingSlot({ slot, label, hint }: { slot: "logo" | "favicon"; label: string; hint: string }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [version, setVersion] = useState(0);
  const [exists, setExists] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(brandingUrl(slot, version)).then((r) => {
      if (!cancelled) setExists(r.ok);
    });
    return () => { cancelled = true; };
  }, [slot, version]);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      await api(`/api/branding/${slot}`, { method: "POST", body: form });
    },
    onSuccess: () => {
      toast.success(`${label} updated`);
      setVersion((v) => v + 1);
      qc.invalidateQueries({ queryKey: ["branding"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reset = useMutation({
    mutationFn: () => api(`/api/branding/${slot}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success(`${label} reset to default`);
      setVersion((v) => v + 1);
      qc.invalidateQueries({ queryKey: ["branding"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex items-center gap-3">
      <div className="size-10 rounded-lg border border-border bg-muted/30 flex items-center justify-center overflow-hidden shrink-0">
        {exists ? (
          <img src={brandingUrl(slot, version)} alt={label} className="max-w-full max-h-full object-contain" />
        ) : (
          <span className="text-[10px] text-muted-foreground">Default</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/x-icon"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload.mutate(file);
          e.target.value = "";
        }}
      />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={upload.isPending}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted disabled:opacity-50"
      >
        <Upload className="size-3.5" /> {upload.isPending ? "Uploading…" : "Upload"}
      </button>
      {exists && (
        <button
          onClick={() => reset.mutate()}
          disabled={reset.isPending}
          title="Reset to default"
          className="p-1.5 border border-border rounded-md hover:bg-muted text-muted-foreground disabled:opacity-50"
        >
          <RotateCcw className="size-3.5" />
        </button>
      )}
    </div>
  );
}

function BrandingCard() {
  return (
    <Card className="overflow-hidden">
      <div className="px-3 py-2 border-b border-border bg-surface-muted">
        <h3 className="text-sm font-semibold">Branding</h3>
      </div>
      <div className="p-3 space-y-3">
        <BrandingSlot slot="logo" label="Logo" hint="Shown in the sidebar. PNG, JPG, WEBP, or animated GIF." />
        <BrandingSlot slot="favicon" label="Favicon" hint="Shown in the browser tab. Animated GIFs display as a static frame in the tab." />
      </div>
    </Card>
  );
}

function MfaCard() {
  const qc = useQueryClient();
  const [step, setStep] = useState<"idle" | "setup" | "disable">("idle");
  const [setupData, setSetupData] = useState<{ secret: string; uri: string } | null>(null);
  const [code, setCode] = useState("");

  const status = useQuery({ queryKey: ["mfaStatus"], queryFn: () => api<{ enabled: boolean }>("/api/auth/mfa/status") });
  const enabled = status.data?.enabled ?? false;

  const setup = useMutation({
    mutationFn: () => api<{ secret: string; uri: string }>("/api/auth/mfa/setup", { method: "POST" }),
    onSuccess: (d) => { setSetupData(d); setStep("setup"); setCode(""); },
    onError: (e: Error) => toast.error(e.message),
  });
  const enable = useMutation({
    mutationFn: () => api("/api/auth/mfa/enable", { method: "POST", json: { code } }),
    onSuccess: () => { toast.success("MFA enabled"); setStep("idle"); setCode(""); qc.invalidateQueries({ queryKey: ["mfaStatus"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const disable = useMutation({
    mutationFn: () => api("/api/auth/mfa/disable", { method: "POST", json: { code } }),
    onSuccess: () => { toast.success("MFA disabled"); setStep("idle"); setCode(""); qc.invalidateQueries({ queryKey: ["mfaStatus"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const inp = "w-full px-3 py-1.5 text-sm border border-border rounded-md bg-background font-mono tracking-widest focus:outline-none focus:ring-1 focus:ring-ring";

  return (
    <Card className="overflow-hidden">
      <div className="px-3 py-2 border-b border-border bg-surface-muted">
        <h3 className="text-sm font-semibold">Two-factor authentication</h3>
      </div>
      <div className="p-3 space-y-3">
        <div className="flex flex-col gap-2">
          <div>
            <p className="text-sm font-medium">{enabled ? "Enabled" : "Disabled"}</p>
            <p className="text-xs text-muted-foreground">Authenticator app (1Password, Authy, Google Authenticator).</p>
          </div>
          {!enabled && step === "idle" && (
            <button onClick={() => setup.mutate()} disabled={setup.isPending}
              className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50">
              {setup.isPending ? "…" : "Enable MFA"}
            </button>
          )}
          {enabled && step === "idle" && (
            <button onClick={() => { setStep("disable"); setCode(""); }}
              className="px-3 py-1.5 text-sm border border-red-300 text-red-600 rounded-md hover:bg-red-50">
              Disable MFA
            </button>
          )}
        </div>

        {step === "setup" && setupData && (
          <div className="space-y-3 border border-border rounded-md p-4 bg-muted/30">
            <p className="text-xs text-muted-foreground">Scan the QR code or enter the secret manually in your authenticator app, then enter the 6-digit code to confirm.</p>
            <QRCodeSVG
              value={setupData.uri}
              size={176}
              level="M"
              includeMargin
              className="rounded-md border border-border bg-white p-2"
            />
            <div className="font-mono text-xs bg-background border border-border rounded px-3 py-2 break-all select-all">{setupData.secret}</div>
            <input className={inp} placeholder="6-digit code" maxLength={6} value={code} onChange={e => setCode(e.target.value)} />
            <div className="flex gap-2">
              <button onClick={() => enable.mutate()} disabled={code.length < 6 || enable.isPending}
                className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md disabled:opacity-50">
                {enable.isPending ? "Verifying…" : "Confirm & enable"}
              </button>
              <button onClick={() => setStep("idle")} className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted">Cancel</button>
            </div>
          </div>
        )}

        {step === "disable" && (
          <div className="space-y-3 border border-red-200 rounded-md p-4 bg-red-50/30">
            <p className="text-xs text-muted-foreground">Enter your current 6-digit code to disable MFA.</p>
            <input className={inp} placeholder="6-digit code" maxLength={6} value={code} onChange={e => setCode(e.target.value)} />
            <div className="flex gap-2">
              <button onClick={() => disable.mutate()} disabled={code.length < 6 || disable.isPending}
                className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-md disabled:opacity-50">
                {disable.isPending ? "Disabling…" : "Disable MFA"}
              </button>
              <button onClick={() => setStep("idle")} className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function ChangePasswordCard() {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  const change = useMutation({
    mutationFn: () => api("/api/auth/change-password", { method: "PUT", json: { current_password: cur, new_password: next } }),
    onSuccess: () => { toast.success("Password changed"); setCur(""); setNext(""); setConfirm(""); },
    onError: (e: Error) => toast.error(e.message),
  });

  const inp = "w-full px-3 py-1.5 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring";
  const valid = cur && next && next === confirm && next.length >= 8;

  return (
    <Card className="overflow-hidden">
      <div className="px-3 py-2 border-b border-border bg-surface-muted">
        <h3 className="text-sm font-semibold">Change password</h3>
      </div>
      <div className="p-3 space-y-3 max-w-sm">
        <div>
          <label className="text-xs text-muted-foreground font-medium block mb-1">Current password</label>
          <input type="password" className={inp} value={cur} onChange={e => setCur(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground font-medium block mb-1">New password</label>
          <input type="password" className={inp} value={next} onChange={e => setNext(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground font-medium block mb-1">Confirm new password</label>
          <input type="password" className={inp} value={confirm} onChange={e => setConfirm(e.target.value)} />
          {confirm && next !== confirm && <p className="text-xs text-red-500 mt-1">Passwords don't match</p>}
          {next && next.length < 8 && <p className="text-xs text-red-500 mt-1">Min 8 characters</p>}
        </div>
        <button onClick={() => change.mutate()} disabled={!valid || change.isPending}
          className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md disabled:opacity-50">
          {change.isPending ? "Saving…" : "Change password"}
        </button>
      </div>
    </Card>
  );
}
