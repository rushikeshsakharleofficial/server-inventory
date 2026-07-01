import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, PageHeader, CustomSelect } from "@/components/ui-bits";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";

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
    <div className="p-6 space-y-6">
      <PageHeader title="Settings" description="Application preferences and defaults." />

      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-surface-muted">
          <h3 className="text-sm font-semibold">Application</h3>
        </div>
        <div className="p-4 space-y-4">
          {Object.entries(draft).map(([k, v]) => (
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
          <div className="pt-2">
            <button onClick={save} disabled={update.isPending} className="px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md disabled:opacity-60">
              {update.isPending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </Card>

      <MfaCard />
      <ChangePasswordCard />
    </div>
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
      <div className="px-4 py-3 border-b border-border bg-surface-muted">
        <h3 className="text-sm font-semibold">Two-factor authentication</h3>
      </div>
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
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
      <div className="px-4 py-3 border-b border-border bg-surface-muted">
        <h3 className="text-sm font-semibold">Change password</h3>
      </div>
      <div className="p-4 space-y-3 max-w-sm">
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
