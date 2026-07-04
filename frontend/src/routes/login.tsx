import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { api, API_BASE, tokenStore, userStore, type LoginResponse } from "@/lib/api";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { AlertCircle, Eye, EyeOff, Lock, User, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — System Control" }] }),
  component: LoginPage,
});

type SetupStatus = { requires_setup: boolean };

function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingSetup, setCheckingSetup] = useState(true);

  useEffect(() => {
    let active = true;
    async function checkSetup() {
      try {
        const status = await api<SetupStatus>("/api/setup/status");
        if (!active) return;
        if (status.requires_setup) {
          navigate({ to: "/setup" });
          return;
        }
      } catch {
        // Fall through to normal login if setup status cannot be determined.
      } finally {
        if (active) setCheckingSetup(false);
      }
    }
    void checkSetup();
    return () => {
      active = false;
    };
  }, [navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (mfaToken) {
        const res = await api<LoginResponse>("/api/auth/mfa/verify", {
          method: "POST",
          json: { mfa_token: mfaToken, code },
        });
        finalize(res);
      } else {
        const form = new URLSearchParams();
        form.append("username", username);
        form.append("password", password);
        form.append("remember_me", rememberMe ? "true" : "false");
        const res = await fetch(`${API_BASE}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: form,
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.detail || "Login failed");
        }
        const data = (await res.json()) as LoginResponse;
        if (data.mfa_required && data.mfa_token) {
          setMfaToken(data.mfa_token);
          toast.info("Enter your authenticator code");
        } else {
          finalize(data);
        }
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function finalize(res: LoginResponse) {
    if (!res.access_token) {
      setError("Missing token");
      return;
    }
    tokenStore.set(res.access_token);
    userStore.set({ username: res.username ?? username, full_name: res.full_name, role: res.role ?? "read" });
    toast.success("Signed in");
    navigate({ to: "/dashboard" });
  }

  let submitLabel: string;
  if (loading) {
    submitLabel = "Signing in…";
  } else if (mfaToken) {
    submitLabel = "Verify";
  } else {
    submitLabel = "Sign in";
  }

  if (checkingSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 text-sm text-gray-500" style={{ background: "#f8fafc" }}>
        Checking instance status…
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden"
      style={{ background: "#f8fafc" }}>

      {/* Background glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div style={{
          position: "absolute", top: "-15%", left: "-10%",
          width: "50vw", height: "50vw", maxWidth: 600, maxHeight: 600,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)",
        }} />
        <div style={{
          position: "absolute", bottom: "-15%", right: "-10%",
          width: "50vw", height: "50vw", maxWidth: 600, maxHeight: 600,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(34,197,94,0.07) 0%, transparent 70%)",
        }} />
        {/* Dot grid */}
        <div style={{
          position: "absolute", inset: 0, opacity: 0.3,
          backgroundImage: "radial-gradient(#94a3b8 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }} />
      </div>

      {/* Brand header */}
      <div className="flex flex-col items-center mb-8 relative z-10">
        <div className="relative mb-4">
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: "#18181b",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="8" height="8" rx="2" fill="#3b82f6" />
              <rect x="13" y="3" width="8" height="8" rx="2" fill="#6366f1" opacity="0.7" />
              <rect x="3" y="13" width="8" height="8" rx="2" fill="#22c55e" opacity="0.8" />
              <rect x="13" y="13" width="8" height="8" rx="2" fill="#3b82f6" opacity="0.5" />
            </svg>
          </div>
          <span style={{
            position: "absolute", bottom: -3, right: -3,
            width: 12, height: 12, borderRadius: "50%",
            background: "#22c55e", border: "2px solid #f8fafc",
          }} />
        </div>
        <div className="text-lg font-bold tracking-tight text-gray-900">System Control</div>
        <div className="text-xs text-gray-500 mt-0.5">Infrastructure operations console</div>
      </div>

      {/* Card */}
      <div className="w-full relative z-10" style={{ maxWidth: 420 }}>
        <div style={{
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          boxShadow: "0 20px 50px rgba(15,23,42,0.08), 0 4px 16px rgba(15,23,42,0.04)",
          padding: "28px 32px 32px",
        }}>
          {/* Card header */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-[17px] font-semibold text-gray-900">
                {mfaToken ? "Two-factor verification" : "Sign in to your console"}
              </h1>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                fontSize: 10, fontWeight: 600, color: "#15803d",
                background: "#f0fdf4", border: "1px solid #bbf7d0",
                borderRadius: 20, padding: "3px 8px",
              }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", flexShrink: 0 }} /> Secure
              </span>
            </div>
            <p className="text-xs text-gray-500">
              {mfaToken
                ? "Enter the 6-digit code from your authenticator app."
                : "Operator credentials only. Authorized access required."}
            </p>
          </div>

          {/* Error alert */}
          {error && (
            <div style={{
              display: "flex", alignItems: "flex-start", gap: 10,
              background: "#fef2f2", border: "1px solid #fecaca",
              borderRadius: 10, padding: "10px 12px", marginBottom: 16,
            }}>
              <AlertCircle style={{ width: 15, height: 15, color: "#dc2626", flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 12, color: "#991b1b", lineHeight: 1.5 }}>{error}</span>
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            {!mfaToken && (
              <>
                {/* Username */}
                <div>
                  <label htmlFor="login-username" style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6b7280", marginBottom: 6 }}>
                    Username
                  </label>
                  <div style={{ position: "relative" }}>
                    <User style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "#9ca3af", pointerEvents: "none" }} />
                    <input
                      id="login-username"
                      style={{
                        width: "100%", height: 42, paddingLeft: 36, paddingRight: 12,
                        fontSize: 13, background: "#fff", color: "#111827",
                        border: "1px solid #d1d5db", borderRadius: 10, outline: "none",
                        boxSizing: "border-box",
                        transition: "border-color 0.15s, box-shadow 0.15s",
                      }}
                      onFocus={e => { e.target.style.borderColor = "#3b82f6"; e.target.style.boxShadow = "0 0 0 3px rgba(59,130,246,0.12)"; }}
                      onBlur={e => { e.target.style.borderColor = "#d1d5db"; e.target.style.boxShadow = "none"; }}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      autoComplete="username"
                      required
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label htmlFor="login-password" style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6b7280", marginBottom: 6 }}>
                    Password
                  </label>
                  <div style={{ position: "relative" }}>
                    <Lock style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "#9ca3af", pointerEvents: "none" }} />
                    <input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      style={{
                        width: "100%", height: 42, paddingLeft: 36, paddingRight: 40,
                        fontSize: 13, background: "#fff", color: "#111827",
                        border: "1px solid #d1d5db", borderRadius: 10, outline: "none",
                        boxSizing: "border-box",
                        transition: "border-color 0.15s, box-shadow 0.15s",
                      }}
                      onFocus={e => { e.target.style.borderColor = "#3b82f6"; e.target.style.boxShadow = "0 0 0 3px rgba(59,130,246,0.12)"; }}
                      onBlur={e => { e.target.style.borderColor = "#d1d5db"; e.target.style.boxShadow = "none"; }}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(p => !p)}
                      style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 4, color: "#9ca3af" }}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
                    </button>
                  </div>
                </div>

                {/* Remember me */}
                <div>
                  <label htmlFor="login-remember" aria-label="Remember me for 90 days" style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}>
                    <input
                      id="login-remember"
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      style={{ width: 15, height: 15, accentColor: "#3b82f6", borderRadius: 4, cursor: "pointer", flexShrink: 0 }}
                    />
                    <div>
                      <span style={{ fontSize: 12, color: "#374151", fontWeight: 500 }}>Remember me for 90 days</span>
                      <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 1 }}>Only use this on trusted devices.</div>
                    </div>
                  </label>
                </div>
              </>
            )}

            {/* MFA field */}
            {mfaToken && (
              <div>
                <label htmlFor="login-mfa-code" style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6b7280", marginBottom: 6 }}>
                  Authenticator code
                </label>
                <input
                  id="login-mfa-code"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  style={{
                    width: "100%", height: 48, padding: "0 16px",
                    fontSize: 22, fontFamily: "monospace", fontWeight: 600,
                    letterSpacing: "0.5em", textAlign: "center",
                    background: "#fff", color: "#111827",
                    border: "1px solid #d1d5db", borderRadius: 10, outline: "none",
                    boxSizing: "border-box",
                  }}
                  onFocus={e => { e.target.style.borderColor = "#3b82f6"; e.target.style.boxShadow = "0 0 0 3px rgba(59,130,246,0.12)"; }}
                  onBlur={e => { e.target.style.borderColor = "#d1d5db"; e.target.style.boxShadow = "none"; }}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  required
                  autoFocus
                />
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%", height: 44,
                background: loading ? "#374151" : "#18181b",
                color: "#fff", border: "none", borderRadius: 10,
                fontSize: 13, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                transition: "background 0.15s, transform 0.1s",
                marginTop: 8,
              }}
              onMouseEnter={e => { if (!loading) (e.target as HTMLButtonElement).style.background = "#27272a"; }}
              onMouseLeave={e => { if (!loading) (e.target as HTMLButtonElement).style.background = "#18181b"; }}
              onMouseDown={e => { (e.target as HTMLButtonElement).style.transform = "scale(0.99)"; }}
              onMouseUp={e => { (e.target as HTMLButtonElement).style.transform = "scale(1)"; }}
            >
              {loading && (
                <svg className="animate-spin" style={{ width: 15, height: 15 }} viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                </svg>
              )}
              {submitLabel}
            </button>

            {mfaToken && (
              <button
                type="button"
                onClick={() => { setMfaToken(null); setCode(""); setError(null); }}
                style={{ width: "100%", padding: "8px", fontSize: 12, color: "#6b7280", background: "none", border: "none", cursor: "pointer" }}
              >
                ← Back to password
              </button>
            )}
          </form>

          {/* Card footer divider + security */}
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <ShieldCheck style={{ width: 12, height: 12, color: "#9ca3af" }} />
            <span style={{ fontSize: 10, color: "#9ca3af" }}>Protected administrative access</span>
          </div>
        </div>

        {/* Instance status footer */}
        <div style={{ marginTop: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", flexShrink: 0 }} />
          <span style={{ fontSize: 10, color: "#9ca3af" }}>Online</span>
        </div>
      </div>

      <Toaster position="top-right" richColors />
    </div>
  );
}
