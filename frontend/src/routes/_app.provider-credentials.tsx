import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth";
import { toast } from "sonner";
import {
  Copy, Eye, EyeOff, ExternalLink, Shield, KeyRound,
  Search, Plus, X, Check, MoreHorizontal, History,
  Lock, AlertTriangle, RefreshCw, Cloud,
} from "lucide-react";

export const Route = createFileRoute("/_app/provider-credentials")({
  head: () => ({ meta: [{ title: "Provider Credentials — System Control" }] }),
  component: ProviderCredentialsPage,
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface Cred {
  id: number;
  name: string;
  provider: string;
  is_active: boolean;
  config: Record<string, string>;
  created_at: string | null;
}

// ─── Provider meta ────────────────────────────────────────────────────────────

const PROVIDER_META: Record<string, { type: string; color: string; bg: string; initials: string }> = {
  ovh:          { type: "Cloud",       color: "#1565c0", bg: "#e3f2fd", initials: "OVH" },
  contabo:      { type: "VPS",         color: "#6a1b9a", bg: "#f3e5f5", initials: "CO" },
  hetzner:      { type: "Cloud",       color: "#d32f2f", bg: "#ffebee", initials: "HZ" },
  wavecom:      { type: "Hosting",     color: "#00796b", bg: "#e0f2f1", initials: "WC" },
  linode:       { type: "Cloud",       color: "#00897b", bg: "#e0f2f1", initials: "LN" },
  hivelocity:   { type: "IP / DC",     color: "#e65100", bg: "#fff3e0", initials: "HV" },
  racknerd:     { type: "VPS",         color: "#1565c0", bg: "#e3f2fd", initials: "RN" },
  hostkey:      { type: "Hosting",     color: "#37474f", bg: "#eceff1", initials: "HK" },
  ipxo:         { type: "IP Lease",    color: "#6d4c41", bg: "#efebe9", initials: "IX" },
  hostwind:     { type: "Cloud",       color: "#0277bd", bg: "#e1f5fe", initials: "HW" },
  rackzar:      { type: "VPS",         color: "#558b2f", bg: "#f1f8e9", initials: "RZ" },
  colocrossing: { type: "Colocation",  color: "#00acc1", bg: "#e0f7fa", initials: "CC" },
  aws:          { type: "Cloud",       color: "#ff9900", bg: "#fff8e1", initials: "AWS" },
  gcp:          { type: "Cloud",       color: "#1a73e8", bg: "#e8f0fe", initials: "GCP" },
  azure:        { type: "Cloud",       color: "#0078d4", bg: "#e3f2fd", initials: "AZ" },
  digitalocean: { type: "Cloud",       color: "#0080ff", bg: "#e3f2fd", initials: "DO" },
};
const provMeta = (p: string) => PROVIDER_META[p.toLowerCase()] ?? { type: "Provider", color: "#6b7280", bg: "#f3f4f6", initials: p.slice(0, 2).toUpperCase() };

// ─── Seed demo credentials if table empty ────────────────────────────────────

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(ts: string | null): string {
  if (!ts) return "—";
  const diff = Date.now() - new Date(ts).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "Just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return `${Math.floor(d / 7)}w ago`;
}

function TagBadge({ tag }: { tag: string }) {
  const colors: Record<string, string> = {
    production: "#16a34a", cloud: "#2563eb", vps: "#7c3aed", hosting: "#d97706",
    email: "#0891b2", "ip-provider": "#dc2626", dc: "#374151", us: "#1d4ed8",
    europe: "#0369a1", india: "#b45309", global: "#047857", "ip-lease": "#7c3aed",
    colocation: "#0e7490",
  };
  const c = colors[tag] ?? "#6b7280";
  return (
    <span style={{ fontSize: 10, fontWeight: 600, color: c, background: c + "15", border: `1px solid ${c}30`, borderRadius: 5, padding: "1px 7px", whiteSpace: "nowrap" }}>
      {tag}
    </span>
  );
}

function MfaBadge({ enabled }: { enabled: boolean }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color: enabled ? "#16a34a" : "#dc2626", background: enabled ? "#f0fdf4" : "#fef2f2", border: `1px solid ${enabled ? "#bbf7d0" : "#fecaca"}`, borderRadius: 5, padding: "2px 8px" }}>
      {enabled ? "Yes" : "No"}
    </span>
  );
}

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyBtn({ value, label, title, isSecret = false, credId, field, isAdmin, small = false }: {
  value?: string; label?: string; title: string;
  isSecret?: boolean; credId?: number; field?: string; isAdmin?: boolean; small?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (isSecret && credId && field) {
      if (!isAdmin) { toast.error("Admin role required to copy passwords"); return; }
      try {
        const res = await api<{ value: string }>(`/api/credentials/${credId}/copy-secret`, {
          method: "POST", json: { field },
        });
        await navigator.clipboard.writeText(res.value);
        toast.success(`${title} copied`);
        setCopied(true); setTimeout(() => setCopied(false), 2000);
      } catch { toast.error("Failed to copy"); }
      return;
    }
    if (!value) return;
    await navigator.clipboard.writeText(value);
    toast.success(`${title} copied`);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  const sz = small ? 11 : 12;
  return (
    <button onClick={handleCopy} title={title}
      style={{ padding: small ? "2px 4px" : "3px 6px", borderRadius: 5, border: "1px solid #e5e7eb", background: copied ? "#f0fdf4" : "#fff", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3, color: copied ? "#16a34a" : "#6b7280", transition: "all 0.15s" }}>
      {copied ? <Check style={{ width: sz, height: sz }} /> : <Copy style={{ width: sz, height: sz }} />}
      {label && <span style={{ fontSize: 10, fontWeight: 600 }}>{label}</span>}
    </button>
  );
}

// ─── Reveal button ────────────────────────────────────────────────────────────

function RevealBtn({ credId, field = "password", onReveal }: {
  credId: number; field?: string; onReveal: (val: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  async function handle() {
    if (!confirm("Reveal password? This action will be audit logged.")) return;
    setLoading(true);
    try {
      const res = await api<{ value: string }>(`/api/credentials/${credId}/reveal-secret`, {
        method: "POST", json: { field },
      });
      onReveal(res.value);
    } catch { toast.error("Reveal failed — admin role required"); }
    finally { setLoading(false); }
  }
  return (
    <button onClick={handle} title="Reveal password" style={{ padding: "3px 5px", borderRadius: 5, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", color: "#6b7280" }}>
      {loading ? <RefreshCw style={{ width: 11, height: 11, animation: "spin 1s linear infinite" }} /> : <Eye style={{ width: 11, height: 11 }} />}
    </button>
  );
}

// ─── Password cell ────────────────────────────────────────────────────────────

function PasswordCell({ cred, isAdmin }: { cred: Cred; isAdmin: boolean }) {
  const [revealed, setRevealed] = useState<string | null>(null);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <span style={{ fontFamily: "monospace", fontSize: 12, letterSpacing: "0.1em", color: "#374151" }}>
        {revealed ?? "••••••••••••"}
      </span>
      {revealed && (
        <button onClick={() => setRevealed(null)} title="Hide" style={{ padding: "2px 4px", borderRadius: 4, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", color: "#6b7280" }}>
          <EyeOff style={{ width: 11, height: 11 }} />
        </button>
      )}
      {!revealed && isAdmin && (
        <RevealBtn credId={cred.id} onReveal={setRevealed} />
      )}
      <CopyBtn title="Copy Password" isSecret credId={cred.id} field="password" isAdmin={isAdmin} label="Copy" small />
    </div>
  );
}

// ─── Details Drawer ───────────────────────────────────────────────────────────

function DetailsDrawer({ cred, isAdmin, onClose, onEdit }: {
  cred: Cred; isAdmin: boolean; onClose: () => void; onEdit: (c: Cred) => void;
}) {
  const [tab, setTab] = useState<"details" | "audit" | "notes">("details");
  const [revealed, setRevealed] = useState<string | null>(null);
  const m = provMeta(cred.provider);
  const cfg = cred.config;
  const tags = (cfg.tags ?? "").split(",").map(t => t.trim()).filter(Boolean);
  const mfaOn = cfg.mfa_enabled === "true";

  return (
    <div style={{ width: 340, height: "100%", display: "flex", flexDirection: "column", background: "#fff", borderLeft: "1px solid #f1f5f9" }}>
      {/* Header */}
      <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: m.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
          {(cred.config.logo_data || cred.config.logo_url)
            ? <img src={cred.config.logo_data || cred.config.logo_url} alt={cred.name} style={{ width: 36, height: 36, objectFit: "contain" }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
            : <span style={{ fontSize: 11, fontWeight: 800, color: m.color }}>{m.initials}</span>
          }
        </div>
        <div className="flex-1 min-w-0">
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{cred.name}</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: cred.is_active ? "#16a34a" : "#6b7280", background: cred.is_active ? "#f0fdf4" : "#f9fafb", border: `1px solid ${cred.is_active ? "#bbf7d0" : "#e5e7eb"}`, borderRadius: 5, padding: "1px 6px" }}>
              {cred.is_active ? "Active" : "Inactive"}
            </span>
          </div>
          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 1 }}>{m.type}</div>
        </div>
        <button onClick={onClose} style={{ padding: 4, borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", color: "#9ca3af" }}>
          <X style={{ width: 15, height: 15 }} />
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid #f1f5f9", padding: "0 20px" }}>
        {(["details", "audit", "notes"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: "8px 12px", fontSize: 12, fontWeight: 600, border: "none", background: "transparent", cursor: "pointer", borderBottom: `2px solid ${tab === t ? "#3b82f6" : "transparent"}`, color: tab === t ? "#3b82f6" : "#6b7280", textTransform: "capitalize" }}>
            {t === "audit" ? "Audit Log" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
        {tab === "details" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <DrawerRow label="Login URL">
              <a href={cfg.login_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#3b82f6", textDecoration: "none" }}>{cfg.login_url}</a>
              <div style={{ display: "flex", gap: 4 }}>
                <CopyBtn value={cfg.login_url} title="Copy URL" small />
                <a href={cfg.login_url} target="_blank" rel="noreferrer" style={{ padding: "2px 4px", borderRadius: 4, border: "1px solid #e5e7eb", background: "#fff", color: "#6b7280", display: "inline-flex" }}>
                  <ExternalLink style={{ width: 11, height: 11 }} />
                </a>
              </div>
            </DrawerRow>
            <DrawerRow label="Username / Email">
              <span style={{ fontSize: 12, color: "#374151" }}>{cfg.username ?? "—"}</span>
              <CopyBtn value={cfg.username} title="Copy Username" small />
            </DrawerRow>
            <DrawerRow label="Password">
              <span style={{ fontFamily: "monospace", fontSize: 12, color: "#374151" }}>{revealed ?? "••••••••••••"}</span>
              <div style={{ display: "flex", gap: 4 }}>
                {revealed
                  ? <button onClick={() => setRevealed(null)} style={{ padding: "2px 4px", borderRadius: 4, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", color: "#6b7280" }}><EyeOff style={{ width: 11, height: 11 }} /></button>
                  : isAdmin && <RevealBtn credId={cred.id} onReveal={setRevealed} />}
                <CopyBtn title="Copy Password" isSecret credId={cred.id} field="password" isAdmin={isAdmin} small />
              </div>
            </DrawerRow>
            <DrawerRow label="MFA Status">
              <MfaBadge enabled={mfaOn} />
            </DrawerRow>
            <DrawerRow label="Owner">
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: "#2563eb" }}>{(cfg.owner ?? "?").slice(0, 2).toUpperCase()}</span>
                </div>
                <span style={{ fontSize: 12, color: "#374151" }}>{cfg.owner ?? "—"}</span>
              </div>
            </DrawerRow>
            {tags.length > 0 && (
              <DrawerRow label="Tags">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {tags.map(t => <TagBadge key={t} tag={t} />)}
                </div>
              </DrawerRow>
            )}
            <DrawerRow label="Last Updated">
              <span style={{ fontSize: 12, color: "#374151" }}>{cred.created_at ? new Date(cred.created_at).toLocaleString("en-GB") : "—"}</span>
            </DrawerRow>
            {cfg.notes && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Notes</div>
                <p style={{ fontSize: 12, color: "#374151", lineHeight: 1.6, margin: 0 }}>{cfg.notes}</p>
              </div>
            )}
          </div>
        )}
        {tab === "audit" && (
          <div style={{ fontSize: 12, color: "#6b7280", textAlign: "center", padding: "32px 0" }}>
            <History style={{ width: 24, height: 24, margin: "0 auto 8px", opacity: 0.3 }} />
            Audit events logged in Event Logs.
          </div>
        )}
        {tab === "notes" && (
          <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.7, margin: 0 }}>{cfg.notes || "No notes added."}</p>
        )}
      </div>

      {/* Footer actions */}
      <div style={{ padding: "12px 16px", borderTop: "1px solid #f1f5f9", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <a href={cfg.login_url} target="_blank" rel="noreferrer"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "8px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", textDecoration: "none", color: "#374151", fontSize: 12, fontWeight: 600 }}>
          <ExternalLink style={{ width: 13, height: 13 }} /> Open Login
        </a>
        <CopyBtn value={cfg.login_url} title="URL" label="Copy URL" small={false} />
        <CopyBtn value={cfg.username} title="Username" label="Copy Username" small={false} />
        <CopyBtn title="Copy Password" isSecret credId={cred.id} field="password" isAdmin={isAdmin} label="Copy Password" />
      </div>
      <div style={{ padding: "0 16px 16px" }}>
        <button onClick={() => onEdit(cred)}
          style={{ width: "100%", padding: "9px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#374151", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          Edit Credential
        </button>
      </div>
    </div>
  );
}

function DrawerRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>{children}</div>
    </div>
  );
}

// ─── Add/Edit Modal ───────────────────────────────────────────────────────────

interface CredForm {
  name: string; provider: string; login_url: string; username: string;
  password: string; provider_type: string; owner: string; tags: string;
  notes: string; mfa_enabled: string; status: string; logo_url: string; logo_data: string;
}

const EMPTY_FORM: CredForm = {
  name: "", provider: "", login_url: "", username: "", password: "",
  provider_type: "Cloud", owner: "", tags: "", notes: "", mfa_enabled: "false", status: "active", logo_url: "", logo_data: "",
};

function CredModal({ initial, onClose, onSave }: {
  initial?: Cred | null; onClose: () => void;
  onSave: (data: { name: string; provider: string; config: Record<string, string> }) => void;
}) {
  const [form, setForm] = useState<CredForm>(() => {
    if (!initial) return EMPTY_FORM;
    const c = initial.config;
    return {
      name: initial.name, provider: initial.provider,
      login_url: c.login_url ?? "", username: c.username ?? "",
      password: "", // never pre-fill password
      provider_type: c.provider_type ?? "Cloud", owner: c.owner ?? "",
      tags: c.tags ?? "", notes: c.notes ?? "", mfa_enabled: c.mfa_enabled ?? "false",
      status: initial.is_active ? "active" : "disabled", logo_url: c.logo_url ?? "", logo_data: c.logo_data ?? "",
    };
  });
  const [showPw, setShowPw] = useState(false);
  const set = (k: keyof CredForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const { name, provider, password, ...rest } = form;
    const config: Record<string, string> = { ...rest };
    if (password) config.password = password;
    onSave({ name, provider: provider.toLowerCase(), config });
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 16, width: 520, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 }}>{initial ? "Edit Credential" : "Add Credential"}</h2>
          <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", color: "#9ca3af" }}><X style={{ width: 16, height: 16 }} /></button>
        </div>
        <form onSubmit={submit} style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Platform name *"><input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value, provider: f.provider || e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "") }))} placeholder="OVH Cloud" /></Field>
            <Field label="Login URL"><input value={form.login_url} onChange={set("login_url")} placeholder="https://..." /></Field>
          </div>
          <Field label="Logo">
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {(form.logo_data || form.logo_url) && (
                <img src={form.logo_data || form.logo_url} alt="logo" style={{ height: 28, width: 28, objectFit: "contain", borderRadius: 4, border: "1px solid #e5e7eb", flexShrink: 0 }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
              )}
              <label style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "7px 10px", fontSize: 12, fontWeight: 500, background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 6, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
                Upload
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = ev => setForm(f => ({ ...f, logo_data: ev.target?.result as string, logo_url: "" }));
                  reader.readAsDataURL(file);
                }} />
              </label>
              <input value={form.logo_url} onChange={e => setForm(f => ({ ...f, logo_url: e.target.value, logo_data: "" }))} placeholder="Or paste URL…" style={{ flex: 1 }} />
              {form.logo_data && (
                <button type="button" onClick={() => setForm(f => ({ ...f, logo_data: "" }))} style={{ fontSize: 11, color: "#ef4444", background: "none", border: "none", cursor: "pointer", flexShrink: 0 }}>✕</button>
              )}
            </div>
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Username / Email"><input value={form.username} onChange={set("username")} placeholder="user@example.com" /></Field>
            <Field label="Password">
              <div style={{ position: "relative" }}>
                <input type={showPw ? "text" : "password"} value={form.password} onChange={set("password")} placeholder={initial ? "Leave blank to keep" : "Enter password"} style={{ paddingRight: 32 }} />
                <button type="button" onClick={() => setShowPw(p => !p)} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", cursor: "pointer", color: "#9ca3af" }}>
                  {showPw ? <EyeOff style={{ width: 13, height: 13 }} /> : <Eye style={{ width: 13, height: 13 }} />}
                </button>
              </div>
            </Field>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Provider type">
              <select value={form.provider_type} onChange={set("provider_type")}>
                {["Cloud","VPS","Hosting","IP Lease","IP / DC","Colocation","Domain","SMTP","Other"].map(o => <option key={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="MFA enabled">
              <select value={form.mfa_enabled} onChange={set("mfa_enabled")}>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </Field>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Owner"><input value={form.owner} onChange={set("owner")} placeholder="Ayush Jain" /></Field>
            <Field label="Status">
              <select value={form.status} onChange={set("status")}>
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
                <option value="expired">Expired</option>
              </select>
            </Field>
          </div>
          <Field label="Tags (comma-separated)"><input value={form.tags} onChange={set("tags")} placeholder="production, cloud, billing" /></Field>
          <Field label="Notes"><textarea value={form.notes} onChange={set("notes")} rows={2} placeholder="Optional notes..." /></Field>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 8, borderTop: "1px solid #f1f5f9" }}>
            <button type="button" onClick={onClose} style={{ padding: "9px 20px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#374151" }}>Cancel</button>
            <button type="submit" style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: "#18181b", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#fff" }}>
              {initial ? "Save Changes" : "Add Credential"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}>{label}</label>
      <div style={{ fontSize: 13 }}>{children}</div>
      <style>{`
        input, select, textarea { width: 100%; box-sizing: border-box; border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 10px; font-size: 13px; color: #111827; outline: none; background: #fff; }
        input:focus, select:focus, textarea:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
        textarea { resize: vertical; font-family: inherit; }
      `}</style>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function ProviderCredentialsPage() {
  const qc = useQueryClient();
  const user = useCurrentUser();
  const isAdmin = user?.role === "admin";

  const [search, setSearch] = useState("");
  const [credType, setCredType] = useState<"all" | "login" | "api">("all");
  const [providerFilter, setProviderFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<Cred | null>(null);
  const [editCred, setEditCred] = useState<Cred | null | "new">(null);
  const listQ = useQuery({
    queryKey: ["provider-creds"],
    queryFn: () => api<{ total: number; limit: number; offset: number; items: Cred[] }>("/api/credentials", { query: { limit: 100, cred_type: "login" } }),
    staleTime: 30_000,
  });

  const items: Cred[] = listQ.data?.items ?? [];

  const createMut = useMutation({
    mutationFn: (d: { name: string; provider: string; config: Record<string, string> }) =>
      api("/api/credentials", { method: "POST", json: { ...d, cred_type: "login" } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["provider-creds"] }); setEditCred(null); toast.success("Credential added"); },
    onError: () => toast.error("Failed to save"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...d }: { id: number; name: string; config: Record<string, string> }) =>
      api(`/api/credentials/${id}`, { method: "PUT", json: d }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["provider-creds"] }); setEditCred(null); toast.success("Credential updated"); },
    onError: () => toast.error("Failed to save"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api(`/api/credentials/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["provider-creds"] }); setSelected(null); toast.success("Deleted"); },
  });

  // Login creds: have login_url or username/password. API creds: have api_key/token/access_key.
  const isLoginCred = (c: Cred) => !!(c.config.login_url || c.config.username);
  const isApiCred   = (c: Cred) => !!(c.config.api_key || c.config.token || c.config.access_key || c.config.client_id || (!c.config.login_url && !c.config.username));

  // Filters
  const filtered = items.filter(c => {
    const cfg = c.config;
    const q = search.toLowerCase();
    if (q && !c.name.toLowerCase().includes(q) && !c.provider.toLowerCase().includes(q) && !(cfg.username ?? "").toLowerCase().includes(q)) return false;
    if (credType === "login" && !isLoginCred(c)) return false;
    if (credType === "api"   && !isApiCred(c))   return false;
    if (providerFilter && c.provider !== providerFilter) return false;
    if (ownerFilter && (cfg.owner ?? "") !== ownerFilter) return false;
    if (statusFilter === "active" && !c.is_active) return false;
    if (statusFilter === "inactive" && c.is_active) return false;
    return true;
  });

  // KPI stats
  const total = items.length;
  const active = items.filter(c => c.is_active).length;
  const mfaMissing = items.filter(c => c.config.mfa_enabled !== "true").length;
  const updatedThisWeek = items.filter(c => c.created_at && Date.now() - new Date(c.created_at).getTime() < 7 * 86400000).length;
  const expiring = 2; // placeholder

  const owners = [...new Set(items.map(c => c.config.owner).filter(Boolean))];
  const providers = [...new Set(items.map(c => c.provider))];

  function handleSave(data: { name: string; provider: string; config: Record<string, string> }) {
    if (editCred && editCred !== "new") {
      updateMut.mutate({ id: (editCred as Cred).id, name: data.name, config: data.config });
    } else {
      createMut.mutate(data);
    }
  }

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* Main content */}
      <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Shield style={{ width: 22, height: 22, color: "#3b82f6" }} />
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>Provider Credentials</h1>
              <p style={{ fontSize: 13, color: "#6b7280", margin: "2px 0 0" }}>Secure inventory of cloud provider login URLs, usernames, and protected credentials.</p>
            </div>
          </div>
          <button onClick={() => setEditCred("new")}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 9, border: "none", background: "#18181b", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            <Plus style={{ width: 14, height: 14 }} /> Add Credential
          </button>
        </div>

        {/* Credential type tabs */}
        <div style={{ display: "flex", gap: 2, marginBottom: 14, background: "#f3f4f6", borderRadius: 10, padding: 3, width: "fit-content" }}>
          {([["all", "All Credentials"], ["login", "Login Credentials"], ["api", "API Credentials"]] as [string, string][]).map(([v, l]) => (
            <button key={v} onClick={() => setCredType(v as "all" | "login" | "api")}
              style={{ padding: "7px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: credType === v ? "#fff" : "transparent", color: credType === v ? "#111827" : "#6b7280", boxShadow: credType === v ? "0 1px 3px rgba(0,0,0,0.1)" : "none", transition: "all 0.15s" }}>
              {l}
              <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: credType === v ? "#3b82f6" : "#9ca3af", background: credType === v ? "#eff6ff" : "#e5e7eb", borderRadius: 10, padding: "1px 6px" }}>
                {v === "all" ? items.length : v === "login" ? items.filter(isLoginCred).length : items.filter(isApiCred).length}
              </span>
            </button>
          ))}
        </div>

        {/* Filters bar */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ position: "relative" }}>
            <Search style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", width: 13, height: 13, color: "#9ca3af" }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search provider..."
              style={{ paddingLeft: 30, paddingRight: 10, paddingTop: 8, paddingBottom: 8, border: "1px solid #e5e7eb", borderRadius: 9, fontSize: 13, width: 200, outline: "none", background: "#fff", color: "#111827" }} />
          </div>
          <Sel value={providerFilter} onChange={setProviderFilter} opts={[["", "All Providers"], ...providers.map(p => [p, p.charAt(0).toUpperCase() + p.slice(1)] as [string,string])]} />
          <Sel value={ownerFilter} onChange={setOwnerFilter} opts={[["", "All Owners"], ...owners.map(o => [o, o] as [string,string])]} />
          <Sel value={statusFilter} onChange={setStatusFilter} opts={[["","All Status"],["active","Active"],["inactive","Inactive"]]} />
        </div>

        {/* KPI cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 20 }}>
          <KpiCard icon={<Cloud style={{ width: 20, height: 20, color: "#3b82f6" }} />} iconBg="#eff6ff" label="Total Providers" value={total} sub="All connected" />
          <KpiCard icon={<Check style={{ width: 20, height: 20, color: "#16a34a" }} />} iconBg="#f0fdf4" label="Active Credentials" value={active} sub={`${total ? Math.round(active/total*100) : 0}% active`} />
          <KpiCard icon={<AlertTriangle style={{ width: 20, height: 20, color: "#f59e0b" }} />} iconBg="#fffbeb" label="MFA Missing" value={mfaMissing} sub="Require attention" />
          <KpiCard icon={<RefreshCw style={{ width: 20, height: 20, color: "#8b5cf6" }} />} iconBg="#f5f3ff" label="Updated This Week" value={updatedThisWeek} sub="Last 7 days" />
          <KpiCard icon={<KeyRound style={{ width: 20, height: 20, color: "#ef4444" }} />} iconBg="#fef2f2" label="Expiring Passwords" value={expiring} sub="Within 30 days" />
        </div>

        {/* Table */}
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #f1f5f9", boxShadow: "0 1px 4px rgba(15,23,42,0.06)", overflow: "hidden" }}>
          {listQ.isLoading ? (
            <div style={{ padding: "48px 0", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>Loading credentials…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: "64px 0", textAlign: "center" }}>
              <Lock style={{ width: 32, height: 32, color: "#e5e7eb", margin: "0 auto 10px" }} />
              <p style={{ color: "#9ca3af", fontSize: 13, margin: 0 }}>No provider credentials added yet.</p>
              <button onClick={() => setEditCred("new")} style={{ marginTop: 12, padding: "8px 18px", borderRadius: 8, border: "none", background: "#18181b", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Add Credential</button>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f9fafb", borderBottom: "1px solid #f1f5f9" }}>
                  {["Platform","Login URL","Username / Email","Password","MFA","Tags","Owner","Last Updated","Actions"].map(h => (
                    <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(cred => {
                  const m = provMeta(cred.provider);
                  const cfg = cred.config;
                  const tags = (cfg.tags ?? "").split(",").map(t => t.trim()).filter(Boolean);
                  const mfaOn = cfg.mfa_enabled === "true";
                  const isSelected = selected?.id === cred.id;
                  return (
                    <tr key={cred.id} onClick={() => setSelected(isSelected ? null : cred)}
                      style={{ borderBottom: "1px solid #f9fafb", cursor: "pointer", background: isSelected ? "#eff6ff" : "transparent", transition: "background 0.1s" }}
                      onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "#f9fafb"; }}
                      onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                      {/* Platform */}
                      <td style={{ padding: "10px 12px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                          <div style={{ width: 34, height: 34, borderRadius: 9, background: m.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                            {(cred.config.logo_data || cred.config.logo_url)
                              ? <img src={cred.config.logo_data || cred.config.logo_url} alt={cred.name} style={{ width: 28, height: 28, objectFit: "contain" }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                              : <span style={{ fontSize: 9, fontWeight: 800, color: m.color }}>{m.initials}</span>
                            }
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: "#111827" }}>{cred.name}</div>
                            <div style={{ fontSize: 10, color: "#9ca3af" }}>{m.type}</div>
                          </div>
                        </div>
                      </td>
                      {/* Login URL */}
                      <td style={{ padding: "10px 12px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <a href={cfg.login_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                            style={{ color: "#3b82f6", fontSize: 12, textDecoration: "none", maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                            {(cfg.login_url ?? "").replace(/^https?:\/\//, "")}
                          </a>
                          <a href={cfg.login_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ color: "#9ca3af", flexShrink: 0 }}>
                            <ExternalLink style={{ width: 11, height: 11 }} />
                          </a>
                          <div onClick={e => e.stopPropagation()}>
                            <CopyBtn value={cfg.login_url} title="Copy URL" small />
                          </div>
                        </div>
                      </td>
                      {/* Username */}
                      <td style={{ padding: "10px 12px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <span style={{ fontSize: 12, color: "#374151", maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cfg.username ?? "—"}</span>
                          <div onClick={e => e.stopPropagation()}>
                            <CopyBtn value={cfg.username} title="Copy Username" small />
                          </div>
                        </div>
                      </td>
                      {/* Password */}
                      <td style={{ padding: "10px 12px" }} onClick={e => e.stopPropagation()}>
                        <PasswordCell cred={cred} isAdmin={isAdmin} />
                      </td>
                      {/* MFA */}
                      <td style={{ padding: "10px 12px" }}><MfaBadge enabled={mfaOn} /></td>
                      {/* Tags */}
                      <td style={{ padding: "10px 12px" }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                          {tags.slice(0, 2).map(t => <TagBadge key={t} tag={t} />)}
                        </div>
                      </td>
                      {/* Owner */}
                      <td style={{ padding: "10px 12px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <span style={{ fontSize: 9, fontWeight: 700, color: "#2563eb" }}>{(cfg.owner ?? "?").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}</span>
                          </div>
                          <span style={{ fontSize: 12, color: "#374151" }}>{(cfg.owner ?? "—").split(" ")[0]}</span>
                        </div>
                      </td>
                      {/* Last updated */}
                      <td style={{ padding: "10px 12px", fontSize: 12, color: "#6b7280", whiteSpace: "nowrap" }}>
                        {relativeTime(cred.created_at)}
                      </td>
                      {/* Actions */}
                      <td style={{ padding: "10px 12px" }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <a href={cfg.login_url} target="_blank" rel="noreferrer" title="Open login" style={{ padding: "4px", borderRadius: 5, border: "1px solid #e5e7eb", background: "#fff", color: "#6b7280", display: "inline-flex" }}>
                            <ExternalLink style={{ width: 12, height: 12 }} />
                          </a>
                          {isAdmin && (
                            <button onClick={() => setEditCred(cred)} title="Edit" style={{ padding: "4px", borderRadius: 5, border: "1px solid #e5e7eb", background: "#fff", color: "#6b7280", cursor: "pointer" }}>
                              <History style={{ width: 12, height: 12 }} />
                            </button>
                          )}
                          {isAdmin && (
                            <button onClick={() => { if (confirm(`Delete ${cred.name}?`)) deleteMut.mutate(cred.id); }} title="Delete"
                              style={{ padding: "4px", borderRadius: 5, border: "1px solid #fecaca", background: "#fff", color: "#ef4444", cursor: "pointer" }}>
                              <X style={{ width: 12, height: 12 }} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {filtered.length > 0 && (
            <div style={{ padding: "10px 16px", borderTop: "1px solid #f1f5f9", fontSize: 11, color: "#9ca3af" }}>
              Showing 1 to {filtered.length} of {filtered.length} providers
            </div>
          )}
        </div>
      </div>

      {/* Details drawer */}
      {selected && (
        <DetailsDrawer cred={selected} isAdmin={isAdmin} onClose={() => setSelected(null)} onEdit={c => { setEditCred(c); }} />
      )}

      {/* Add/Edit modal */}
      {editCred && (
        <CredModal initial={editCred === "new" ? null : editCred as Cred} onClose={() => setEditCred(null)} onSave={handleSave} />
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ─── Mini helpers ──────────────────────────────────────────────────────────────

function KpiCard({ icon, iconBg, label, value, sub }: { icon: React.ReactNode; iconBg: string; label: string; value: number; sub: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #f1f5f9", boxShadow: "0 1px 4px rgba(15,23,42,0.05)", padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 9, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 24, fontWeight: 800, color: "#111827", lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{sub}</div>
      </div>
    </div>
  );
}

function Sel({ value, onChange, opts }: { value: string; onChange: (v: string) => void; opts: [string, string][] }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ padding: "8px 28px 8px 10px", border: "1px solid #e5e7eb", borderRadius: 9, fontSize: 13, background: "#fff", color: "#374151", outline: "none", cursor: "pointer", appearance: "auto" }}>
      {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}
