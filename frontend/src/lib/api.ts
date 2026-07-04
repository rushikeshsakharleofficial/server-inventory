/**
 * Thin fetch client around the FastAPI backend.
 * If VITE_API_URL is unset, browser builds derive the backend host from the current page host.
 */

function resolveApiBase(): string {
  const configured = (
    import.meta.env.VITE_API_URL as string | undefined
  )?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:8001`;
  }
  return "http://localhost:8001";
}

export const API_BASE = resolveApiBase();

const TOKEN_KEY = "sic.token";
const USER_KEY = "sic.user";

export interface StoredUser {
  username: string;
  full_name?: string | null;
  role: string;
}

export const tokenStore = {
  get: () =>
    typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

export const userStore = {
  get: (): StoredUser | null => {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  set: (u: StoredUser) => localStorage.setItem(USER_KEY, JSON.stringify(u)),
};

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export async function api<T = unknown>(
  path: string,
  init: RequestInit & { json?: unknown; query?: Record<string, unknown> } = {},
): Promise<T> {
  const { json, query, headers, ...rest } = init;
  let url = `${API_BASE}${path}`;
  if (query) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === "") continue;
      qs.append(k, String(v));
    }
    const s = qs.toString();
    if (s) url += `?${s}`;
  }
  const token = tokenStore.get();
  const h: Record<string, string> = {
    Accept: "application/json",
    ...(headers as Record<string, string> | undefined),
  };
  if (json !== undefined) h["Content-Type"] = "application/json";
  if (token) h["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url, {
    ...rest,
    headers: h,
    body:
      json !== undefined
        ? JSON.stringify(json)
        : (rest.body as BodyInit | undefined),
  });

  if (res.status === 204) return undefined as T;

  const contentType = res.headers.get("content-type") ?? "";
  const data = contentType.includes("application/json")
    ? await res.json()
    : await res.text();

  if (!res.ok) {
    if (res.status === 401) {
      tokenStore.clear();
      if (
        typeof window !== "undefined" &&
        !window.location.pathname.startsWith("/login")
      ) {
        window.location.assign("/login");
      }
    }
    const msg =
      (typeof data === "object" && data && "detail" in data
        ? String((data as { detail: unknown }).detail)
        : typeof data === "string"
          ? data
          : res.statusText) || "Request failed";
    throw new ApiError(res.status, msg, data);
  }
  return data as T;
}

/* ---------- typed surface ---------- */

export interface Page<T> {
  total: number;
  limit: number;
  offset: number;
  items: T[];
}

export interface Server {
  id: number;
  name: string;
  provider: string;
  region?: string | null;
  zone?: string | null;
  instance_type?: string | null;
  status: string;
  public_ip?: string | null;
  private_ip?: string | null;
  vcpu?: number | null;
  memory_gb?: number | null;
  storage_gb?: number | null;
  os?: string | null;
  tags?: Record<string, unknown>;
  extra?: Record<string, unknown>;
  datacenter?: string | null;
  hostname?: string | null;
  notes?: string | null;
  cloud_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  last_synced?: string | null;
  ssh_info?: Record<string, unknown> | null;
  ssh_credential_id?: number | null;
  ssh_group?: string | null;
}

export interface Stats {
  total: number;
  running: number;
  stopped: number;
  by_provider: Record<string, number>;
  by_region: Record<string, number>;
  by_status: Record<string, number>;
}

export interface Credential {
  id: number;
  name: string;
  provider: string;
  is_active: boolean;
  config: Record<string, unknown>;
  created_at?: string | null;
}

export interface SyncLog {
  id: number;
  provider?: string | null;
  status: string;
  servers_added: number;
  servers_updated: number;
  error_message?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
}

export interface DiscoveryNetwork {
  id: number;
  name: string;
  cidr: string;
  datacenter?: string | null;
  environment?: string | null;
  ssh_credential_id?: number | null;
  max_parallel: number;
  timeout_seconds: number;
  is_active: boolean;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface DiscoveryJob {
  id: number;
  network_id?: number | null;
  cidr: string;
  status: "queued" | "running" | "success" | "failed" | "stopped";
  total_ips: number;
  scanned_ips: number;
  reachable_ssh: number;
  authenticated: number;
  servers_added: number;
  servers_updated: number;
  duplicates_merged: number;
  failed: number;
  started_at?: string | null;
  completed_at?: string | null;
  error_message?: string | null;
  created_at?: string | null;
}

export interface DiscoveryResult {
  id: number;
  job_id: number;
  ip: string;
  port: number;
  status: "skipped" | "closed" | "open" | "auth_failed" | "success" | "duplicate" | "error";
  server_id?: number | null;
  identity_hash?: string | null;
  hostname?: string | null;
  error_message?: string | null;
  raw_summary: Record<string, unknown>;
  created_at?: string | null;
}

export interface ServerIpAddress {
  id: number;
  server_id: number;
  address: string;
  cidr?: string | null;
  ip_version?: number | null;
  interface_name?: string | null;
  mac_address?: string | null;
  scope: string;
  is_primary: boolean;
  discovered_from_ip?: string | null;
  source: string;
  first_seen_at?: string | null;
  last_seen_at?: string | null;
}

export interface SshCredential {
  id: number;
  name: string;
  username: string;
  auth_method: string;
  port: number;
  is_default: boolean;
  notes?: string | null;
  proxy_host?: string | null;
  proxy_port?: number | null;
  proxy_username?: string | null;
  proxy_auth_method?: string | null;
  created_at?: string | null;
}

export interface DatabaseInstance {
  id: number;
  cloud_id?: string | null;
  name: string;
  provider: string;
  engine?: string | null;
  engine_version?: string | null;
  region?: string | null;
  status: string;
  endpoint?: string | null;
  port?: number | null;
  storage_gb?: number | null;
  instance_type?: string | null;
  last_synced?: string | null;
}

export interface KubernetesCluster {
  id: number;
  cloud_id?: string | null;
  name: string;
  provider: string;
  region?: string | null;
  status: string;
  version?: string | null;
  node_count?: number | null;
  endpoint?: string | null;
  last_synced?: string | null;
}

export interface BlockStorage {
  id: number;
  cloud_id?: string | null;
  name: string;
  provider: string;
  region?: string | null;
  status: string;
  size_gb?: number | null;
  attachment?: string | null;
  volume_type?: string | null;
  last_synced?: string | null;
}

export interface DnsRecord {
  id: number;
  cloud_id?: string | null;
  name: string;
  provider: string;
  zone?: string | null;
  record_type?: string | null;
  content?: string | null;
  ttl?: number | null;
  proxied?: boolean | null;
  status: string;
  last_synced?: string | null;
}

// Providers whose credentials live under Domains (not Cloud Providers) —
// DNS-only, no compute servers.
export const DNS_PROVIDERS = ["cloudflare", "generic-dns"] as const;

export interface Snapshot {
  date: string;
  total: number;
  running: number;
  stopped: number;
  by_provider: Record<string, number>;
}

export interface CronJob {
  id: number;
  name: string;
  cron_expr: string;
  provider?: string | null;
  is_active: boolean;
  last_run_at?: string | null;
  last_run_status?: string | null;
  next_run_at?: string | null;
}

export interface CronJobCreate {
  name: string;
  cron_expr: string;
  provider?: string | null;
  is_active?: boolean;
}

export interface UserRow {
  id: number;
  username: string;
  full_name?: string | null;
  role: string;
  is_active: boolean;
  created_at?: string | null;
  permissions?: Record<string, string[]>;
  group_ids?: number[];
}

export interface Group {
  id: number;
  name: string;
  description?: string | null;
  permissions: Record<string, string[]>;
  is_super_admin: boolean;
  member_count: number;
  created_at?: string | null;
}

export interface GroupCreate {
  name: string;
  description?: string;
  permissions?: Record<string, string[]>;
}

export interface ServerGroup {
  id: number;
  name: string;
  description?: string | null;
  is_auto: boolean;
  server_count: number;
  created_at?: string | null;
}

export interface ServerGroupCreate {
  name: string;
  description?: string;
}

export interface PermissionCatalog {
  features: string[];
  actions: string[];
  feature_actions: Record<string, string[]>;
  role_baseline: Record<string, Record<string, string[]>>;
}

export interface LoginResponse {
  access_token: string | null;
  token_type: string;
  role: string | null;
  username: string | null;
  full_name: string | null;
  mfa_required: boolean;
  mfa_token: string | null;
}
