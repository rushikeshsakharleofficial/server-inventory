import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { AlertCircle, KeyRound, ShieldCheck, User, UserCog } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { api, tokenStore, userStore, type LoginResponse } from "@/lib/api";
import { toast } from "sonner";

type SetupStatus = {
  requires_setup: boolean;
};

export const Route = createFileRoute("/setup")({
  head: () => ({ meta: [{ title: "Initial Setup — System Control" }] }),
  component: SetupPage,
});

function SetupPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [ready, setReady] = useState(false);
  const [username, setUsername] = useState("admin");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function checkStatus() {
      try {
        const status = await api<SetupStatus>("/api/setup/status");
        if (!active) return;
        if (!status.requires_setup) {
          navigate({ to: tokenStore.get() ? "/dashboard" : "/login" });
          return;
        }
        setReady(true);
      } catch (err) {
        if (!active) return;
        setError((err as Error).message);
      } finally {
        if (active) setChecking(false);
      }
    }
    void checkStatus();
    return () => {
      active = false;
    };
  }, [navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api<LoginResponse>("/api/setup/bootstrap", {
        method: "POST",
        json: {
          username,
          full_name: fullName || null,
          password,
        },
      });
      if (!res.access_token) throw new Error("Setup completed but no token was returned");
      tokenStore.set(res.access_token);
      userStore.set({
        username: res.username ?? username,
        full_name: res.full_name,
        role: res.role ?? "admin",
      });
      toast.success("Administrator account created");
      navigate({ to: "/dashboard" });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  let statusMessage: string | null = null;
  if (checking) {
    statusMessage = "Checking setup status…";
  } else if (!ready) {
    statusMessage = "Setup is not available for this instance.";
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden" style={{ background: "#f8fafc" }}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div style={{
          position: "absolute", inset: 0, opacity: 0.28,
          backgroundImage: "linear-gradient(rgba(15,23,42,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.04) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }} />
        <div style={{
          position: "absolute", top: "-12%", right: "-10%",
          width: "45vw", height: "45vw", maxWidth: 560, maxHeight: 560,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(14,165,233,0.10) 0%, transparent 70%)",
        }} />
        <div style={{
          position: "absolute", bottom: "-18%", left: "-10%",
          width: "40vw", height: "40vw", maxWidth: 520, maxHeight: 520,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(16,185,129,0.10) 0%, transparent 70%)",
        }} />
      </div>

      <div className="w-full relative z-10" style={{ maxWidth: 460 }}>
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-900 shadow-lg">
            <ShieldCheck className="h-7 w-7 text-cyan-300" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Initial administrator setup</h1>
          <p className="mt-2 text-sm text-gray-500">
            Create the first operator account for this instance.
          </p>
        </div>

        <div style={{
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: 18,
          boxShadow: "0 24px 60px rgba(15,23,42,0.08), 0 4px 16px rgba(15,23,42,0.05)",
          padding: "28px 32px 32px",
        }}>
          {statusMessage ? (
            <div className="text-sm text-gray-500">{statusMessage}</div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              {error && (
                <div style={{
                  display: "flex", alignItems: "flex-start", gap: 10,
                  background: "#fef2f2", border: "1px solid #fecaca",
                  borderRadius: 10, padding: "10px 12px",
                }}>
                  <AlertCircle style={{ width: 15, height: 15, color: "#dc2626", flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 12, color: "#991b1b", lineHeight: 1.5 }}>{error}</span>
                </div>
              )}

              <Field
                label="Admin username"
                icon={<User className="h-4 w-4" />}
                value={username}
                onChange={setUsername}
                autoComplete="username"
              />

              <Field
                label="Full name"
                icon={<UserCog className="h-4 w-4" />}
                value={fullName}
                onChange={setFullName}
                autoComplete="name"
                required={false}
              />

              <Field
                label="Password"
                icon={<KeyRound className="h-4 w-4" />}
                value={password}
                onChange={setPassword}
                type="password"
                autoComplete="new-password"
              />

              <Field
                label="Confirm password"
                icon={<KeyRound className="h-4 w-4" />}
                value={confirmPassword}
                onChange={setConfirmPassword}
                type="password"
                autoComplete="new-password"
              />

              <div style={{
                border: "1px solid #dbeafe",
                background: "#f8fbff",
                borderRadius: 12,
                padding: "12px 14px",
              }}>
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-700">Password policy</div>
                <div className="mt-1 text-xs leading-5 text-slate-600">
                  Use at least 10 characters. Avoid common passwords like admin, password, or Admin@1234.
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Creating admin…" : "Create administrator"}
              </button>
            </form>
          )}
        </div>
      </div>
      <Toaster position="top-right" richColors />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  icon,
  type = "text",
  autoComplete,
  required = true,
}: Readonly<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  icon: ReactNode;
  type?: string;
  autoComplete?: string;
  required?: boolean;
}>) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6b7280", marginBottom: 6 }}>
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9ca3af", pointerEvents: "none" }}>
          {icon}
        </span>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required={required}
          style={{
            width: "100%", height: 44, paddingLeft: 38, paddingRight: 12,
            fontSize: 13, background: "#fff", color: "#111827",
            border: "1px solid #d1d5db", borderRadius: 10, outline: "none",
            boxSizing: "border-box",
          }}
          onFocus={(e) => { e.target.style.borderColor = "#0891b2"; e.target.style.boxShadow = "0 0 0 3px rgba(8,145,178,0.12)"; }}
          onBlur={(e) => { e.target.style.borderColor = "#d1d5db"; e.target.style.boxShadow = "none"; }}
        />
      </div>
    </div>
  );
}
