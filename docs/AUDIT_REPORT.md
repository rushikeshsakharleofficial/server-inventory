# Server Inventory — Full Project Audit Report
Generated: 2026-06-08

## Summary
5 domain audits run in parallel:
- Backend Security
- Backend Logic / Correctness
- Frontend Correctness / UX
- API Contract Drift
- Infrastructure / Deployment

Total findings: 12 CRITICAL, 18 HIGH, 26 MEDIUM, 10 LOW

---

## CRITICAL

### SECURITY

**`docker-compose.yml:29` + `auth.py:12-15` — JWT signing key blocklist bypass**
Default `SECRET_KEY=change-this-secret-key-in-production` not in blocklist. Attacker with repo access can forge JWTs for any user including admin. `_is_production()` guard also never fires because `ENVIRONMENT` env var isn't set in compose.

**`docker-compose.yml:27-28` — Hardcoded admin credentials**
`ADMIN_PASSWORD=Admin@1234` is default fallback. Every deployment without explicit override has known-credential admin account.

### INFRASTRUCTURE

**`docker-compose.yml:8` — Hardcoded weak Postgres password in source control**
`POSTGRES_PASSWORD: inventory` hardcoded (no env-var escape hatch unlike other secrets). Database credential is public.

**`docker-compose.yml:29` — `SECRET_KEY` default is a known public string**
`${SECRET_KEY:-change-this-secret-key-in-production}` — deployment without `SECRET_KEY` set uses a publicly known value.

**`docker-compose.yml` (backend env) — `CREDENTIAL_ENCRYPTION_KEY` absent**
`crypto.py:19` uses this to encrypt SSH passwords/private keys. Not passed through compose. In dev mode, generates random ephemeral key written to `/app/.dev_cred_key` — every container restart generates new key, permanently breaking decryption of all stored SSH credentials.

**`backend/Dockerfile:11` — `--reload` (dev mode) in production**
`CMD [..., "--reload"]` combined with bind mount `./backend:/app` means editing any source file restarts the production API process. Also disables worker process separation.

**`docker-compose.yml:10` — PostgreSQL port 5432 bound to all host interfaces**
Any internet-facing host exposes the database externally with known credentials.

---

## HIGH

### SECURITY

**`ssh_utils.py:42,64,111` — `AutoAddPolicy` (MITM-vulnerable) on bulk SSH paths**
Interactive sync (`servers.py:163`) correctly uses `RejectPolicy()`. But `ssh_utils.py` uses `AutoAddPolicy()` — bulk endpoints `POST /ssh-fetch-all-ips` and streaming endpoint silently accept any host key. Full MITM susceptibility.

**`auth.py:57-58` — 90-day JWT with no revocation**
No token blacklist, no refresh token rotation, no session table. Stolen token valid up to 90 days. `toggle_user` disables future auth but can't revoke existing tokens.

**`routers/settings.py:34-51` — Unrestricted arbitrary settings key writes**
Any admin can write arbitrary keys to `AppSetting` with no allowlist. Values like `sync_timeout`, `ssh_default_port` fed into application logic without type/range validation.

**`docker-compose.yml` — Backend container runs as root**
No `USER` directive in Dockerfile. Code execution vulnerability gives full container root.

**`main.py:30-56` — Raw DDL at startup instead of migrations**
`_migrate_mfa_columns()` and `_migrate_ssh_proxy_columns()` run `ALTER TABLE ADD COLUMN IF NOT EXISTS` on every startup. No Alembic. Race condition on concurrent container startup, no rollback path, schema drift invisible.

**`nginx.conf` — No security response headers**
No `X-Frame-Options`, `X-Content-Type-Options`, `Content-Security-Policy`, `Referrer-Policy`. Clickjacking and MIME-sniffing unmitigated.

**`nginx.conf` — No rate limiting on `/api/` proxy**
All API requests forwarded without `limit_req`. High-volume brute force bypasses application-level rate limiting.

### BACKEND LOGIC

**`servers.py:203-204` — `jump_client` potentially undefined in exception handler**
`jump_client = None` not initialized before `try:` block. If exception raised before the proxy block (e.g., during `_load_pkey`), the `except` block at lines 273-296 that references `jump_client` raises `NameError`, masking the original exception.

**`sync.py:200-225` — Race condition in `stop_sync`**
Stop event set, then `SyncLog` force-written to `status="failed"` regardless of whether background thread already committed `status="success"`. No optimistic lock.

**`scheduler.py:44-57` — `DetachedInstanceError` after session close**
`db` session closed in `finally` block, but `job.provider` and `job.cron_expr` accessed at line 62 after session is gone. Any lazy-load attempt raises `DetachedInstanceError`.

**`routers/crons.py:134-154` — No cap on concurrent cron run threads**
`run_cron_now` spawns a daemon thread opening new SQLAlchemy engine+session per invocation. Rapid repeated calls exhaust database connection limit.

### FRONTEND

**`ErrorBoundary.tsx:54` — `toggleDetails` passes entire State object as boolean**
`this.setState((prev) => ({ showDetails: !prev }))` — `prev` is always truthy, so `!prev` is always `false`. "Show Diagnostics" button is permanently stuck and never reveals the error panel.

**`IpsPage.tsx:74` — Raw `fetch()` bypasses 401 interceptor**
Reads token from `localStorage` directly. If token cleared by axios 401 interceptor, `fetch` sends null Bearer token with no re-auth prompt — user stuck on page.

**`IpsPage.tsx:90` — Non-null assertion `resp.body!` crashes on null body**
`ReadableStream` body can be null. If null, throws `TypeError`, bypasses `finally`, leaves `fetching` permanently `true` — button stuck for rest of session.

**`IpsPage.tsx:99` — Non-null assertion `lines.pop()!` on possibly empty array**
If `lines` is empty, `pop()` returns `undefined`, assertion casts to `string` — `buf` becomes `"undefined"`, corrupts subsequent JSON parse loop.

### API CONTRACT

**`api.ts:71-74` — `syncApi.trigger` typed as `Promise<SyncLog>` but backend returns `{message, provider}`**
Backend `sync.py:188-189`: `return {"message": "Sync started", "provider": ...}`. All `SyncLog` fields will be `undefined`.

**`api.ts:76-79` — `syncApi.stop` typed as `Promise<SyncLog>` but backend returns `{stopped: number[]}`**
Backend `sync.py:225`: `return {"stopped": stopped_ids}`.

**`api.ts:136-154` — databases/kubernetes/blockStorage `.sync` all typed as `Promise<SyncLog>` but return `{status: "sync started"}`**
Three endpoints all return `{"status": "sync started"}` — none match `SyncLog` shape.

**`api.ts:189-190` — `mfaApi.status` and `mfaApi.setup` missing `.then(r => r.data)`**
Return raw `AxiosResponse` instead of typed data. Every other method in `api.ts` unwraps correctly. Callers receive `AxiosResponse` object where they expect `{ enabled: boolean }` / `{ secret: string; uri: string }`.

---

## MEDIUM

### SECURITY

**`main.py:73` — Swagger UI `/docs` exposed with no auth in production**

**`models.py:92` — TOTP secret stored in plaintext**
`totp_secret = Column(String(64))` — raw TOTP seed. Database compromise defeats MFA entirely.

**`auth.py:27-28` — Account enumeration via distinct 403 for disabled accounts**
Login returns `403 "Account is disabled"` vs `401 "Invalid username or password"` — reveals valid usernames.

**`crypto.py:57-62` — Silent decrypt fallback returns ciphertext as plaintext**
`decrypt_str` catches `InvalidToken`, returns raw ciphertext. Masks key mismatches; tampered ciphertext silently accepted.

**`servers.py:320-385` — `trust-host-key` is blind TOFU**
Connects, accepts whatever key presented, writes to known_hosts with no fingerprint verification step.

### BACKEND LOGIC

**`servers.py:32-53` — `list_servers` has no pagination**
Returns unbounded result set. 10k+ server inventory loads everything into memory.

**`servers.py:302-315` — Unhandled `db.commit()` can leak DB schema**
Failed commit raises raw `SQLAlchemyError` → FastAPI → HTTP 500 with internal detail.

**`resource_map.py:203-223` — O(N) API calls to AWS per request**
All target groups fetched without filter, `describe_target_health` called per group. 100 groups = 101 sequential API calls → AWS throttle → silent fail.

**`azure.py:37-85` — 600 sequential Azure API calls per 200 VMs**
Per-VM `instance_view`, per-NIC, per-PIP calls. Hits Azure Management API throttle (1200/hr).

**`sync.py:97-109` — Servers without `cloud_id` always re-inserted as duplicates**
Existing-server lookup only matches on `cloud_id`. Manual/partially-synced servers duplicate every sync run.

**`stats.py:39-44` — Date ordering uses string comparison**
`date` column is `str` type. Lexicographic ordering works only for `YYYY-MM-DD` format.

**`crons.py:39-41` — Timezone inconsistency between `next_run_at` and `last_run_at`**
`next_run_at` stored with timezone stripped; `last_run_at` stored with UTC timezone. Mixed-aware comparisons will fail.

**`schemas.py:158-165` — `auth_method` accepts unconstrained string**
Invalid `auth_method` silently falls through to password path.

**`schemas.py:26-27` — `provider` accepts any string**
Unrecognized provider silently returns empty results from dispatch logic.

**`resource_map.py:573-581` — `_az_token` duplicated from `azure.py`**
Auth logic must be updated in two places.

**`digitalocean.py:30-68` / `resource_map.py:699-717` — Inefficient DO API usage**
All floating IPs and firewalls fetched account-wide, filtered client-side. DO API supports `?droplet_id=` filter. Type mismatch in firewall `droplet_ids` comparison (int vs string).

### FRONTEND

**`AddServerModal.tsx:447-449` — Double-submission risk**
Both `<form onSubmit={submit}>` and footer `<Button onClick={submit}>` call `submit()`. Footer button missing `type="button"`.

**`ProvidersPage.tsx:160-164` — No per-provider field validation before submit**
Only validates `credName`. Empty AWS `access_key_id`/`secret_access_key` reach API.

**`ServerDetailModal.tsx:224` — `setTimeout` fires after modal unmounted**
500ms timer calls `sshSyncMutation.mutate()` after user closes modal.

**`Layout.tsx:220-228` — Resize handler only closes sidebar, never reopens**
Window expand past 768px leaves sidebar closed permanently.

**`SettingsPage.tsx:127-138` — `refetch()` causes dirty-state flash**
After save, `NumberField` compares stale `currentValue` until refetch resolves, hiding Save button prematurely.

**`UsersPage.tsx:69` — No error UI when users query fails**
`isError` not rendered; failed fetch silently shows empty table.

**`SyncLogsPage.tsx:49` — No error UI when logs query fails**
Shows "No sync runs yet" when fetch actually failed.

**`IpsPage.tsx:119-129` — Effect re-registers WebSocket listener on every fetch**
`fetching` in deps array tears down/reattaches listener on every state change.

**`ServerTable.tsx:562-596` — Pagination only shows pages 1-7**
Pages 8+ inaccessible via buttons; only "Next" works. Current page highlight invisible past page 7.

### API CONTRACT

**`api.ts:104-106` — Snapshot endpoint omits `id`/`created_at`**
Backend `stats.py` local schema doesn't include these; frontend `ServerSnapshot` expects them optionally.

**`api.ts:32-34` — `serversApi.create` takes `Partial<Server>` hiding required fields**
`name` and `provider` are required by backend but optional in TypeScript type.

### INFRASTRUCTURE

**`docker-compose.yml:19-33` — Backend has no health check**
Frontend `depends_on: backend` only waits for container start, not API readiness.

**`backend/Dockerfile:8` — `COPY . .` bakes `.env` into image if present**
No `.dockerignore` in backend directory.

**`docker-compose.yml:24` — Bind mount of entire backend source into container**
In production, path traversal can read/overwrite host files.

**`vite.config.ts:10` — Dev server proxy defaults to Docker-internal hostname**
`http://backend:8000` doesn't resolve outside Docker. Misleads local dev.

**`nginx.conf:47` — WebSocket 24hr proxy timeout, no keepalive tuning**

**`start.sh:22` — Dev API bound to `0.0.0.0`**
Exposes dev API on all network interfaces.

---

## LOW

### SECURITY
- `auth.py:118` — Password minimum length 10 chars, no complexity requirement
- `main.py:227` — JWT as URL query param in WebSocket (`/ws?token=`)
- `servers.py:320-385` — `trust-host-key` accepts key blindly

### BACKEND
- `sync.py:228-239` — `get_sync_logs` unbounded `limit` param (no max)
- `scheduler.py:96-98` — Stale `next_run_at` in UI if commit fails during job load
- `resource_map.py:329` — Empty string `cloud_id` causes `InvalidParameterException` swallowed silently
- `database.py:23` — 30s `statement_timeout` kills legitimate large read queries

### FRONTEND
- `AddServerModal.tsx:243-244` — IPv6 validation accepts any string with `:`
- `useToast.ts:34` — Dangling auto-dismiss timer after manual toast dismiss
- `DashboardPage.tsx:125` — CSS variable read during render before theme applied

### INFRASTRUCTURE
- `start.sh:.env.example` — Working default credentials in example file
- `nginx.conf:47` — Missing `proxy_send_timeout` on WS location

---

## Fix Priority Order

1. **Deploy-blocking** (do before any production use):
   - Remove `SECRET_KEY` fallback from compose
   - Add `CREDENTIAL_ENCRYPTION_KEY` to compose
   - Add `change-this-secret-key-in-production` to auth blocklist
   - Remove `ADMIN_PASSWORD` fallback from compose
   - Remove Postgres `ports: "5432:5432"` from compose
   - Remove `--reload` from backend Dockerfile

2. **Security hardening** (this sprint):
   - Fix `AutoAddPolicy` → `RejectPolicy` in ssh_utils.py
   - Add nginx security headers
   - Add nginx rate limiting on /api/
   - Encrypt TOTP secret at rest
   - Fix account enumeration (disabled account 403 → 401)
   - Add backend Dockerfile USER directive

3. **Frontend bugs** (this sprint):
   - Fix `ErrorBoundary.tsx` toggleDetails bug
   - Fix `IpsPage.tsx` three null-safety bugs
   - Fix `api.ts` wrong return types (5 endpoints)
   - Fix `mfaApi` missing `.then(r => r.data)`

4. **Backend correctness** (next sprint):
   - Paginate `list_servers`
   - Fix `jump_client` undefined before try block
   - Fix `DetachedInstanceError` in scheduler
   - Fix duplicate server insertion on sync
   - Add `Literal` validators to schemas
   - Fix cron timezone inconsistency
   - Add migrations (Alembic)

5. **UX gaps** (next sprint):
   - Error states for UsersPage, SyncLogsPage
   - Fix Layout sidebar resize
   - Fix ServerTable pagination past page 7
   - Fix AddServerModal double-submit
