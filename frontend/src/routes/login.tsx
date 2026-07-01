import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { api, tokenStore, userStore, type LoginResponse } from "@/lib/api";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — System Control" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
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
        const res = await fetch(`${(import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8000"}/api/auth/login`, {
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
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function finalize(res: LoginResponse) {
    if (!res.access_token) {
      toast.error("Missing token");
      return;
    }
    tokenStore.set(res.access_token);
    userStore.set({ username: res.username ?? username, role: res.role ?? "read" });
    toast.success("Signed in");
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8">
          <div className="size-7 bg-primary rounded flex items-center justify-center">
            <span className="size-2 bg-success rounded-full" />
          </div>
          <span className="font-medium tracking-tight">System Control</span>
        </div>

        <div className="bg-surface ring-1 ring-black/5 rounded-lg p-6">
          <h1 className="text-base font-semibold">
            {mfaToken ? "Two-factor verification" : "Sign in to your console"}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {mfaToken
              ? "Enter the 6-digit code from your authenticator app."
              : "Operator credentials only."}
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-3">
            {!mfaToken && (
              <>
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                    Username
                  </label>
                  <input
                    className="mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                    Password
                  </label>
                  <input
                    type="password"
                    className="mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="size-3.5 rounded border-border accent-primary"
                  />
                  <span className="text-xs text-muted-foreground">Remember me for 90 days</span>
                </label>
              </>
            )}
            {mfaToken && (
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                  Authenticator code
                </label>
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  className="mt-1 w-full px-3 py-2 text-lg font-mono tracking-[0.5em] text-center bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  required
                  autoFocus
                />
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-60"
            >
              {loading ? "Verifying…" : mfaToken ? "Verify" : "Sign in"}
            </button>
            {mfaToken && (
              <button
                type="button"
                onClick={() => {
                  setMfaToken(null);
                  setCode("");
                }}
                className="w-full py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                Back to password
              </button>
            )}
          </form>
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-6">
          API: {(import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8000"}
        </p>
      </div>
      <Toaster position="top-right" richColors />
    </div>
  );
}
