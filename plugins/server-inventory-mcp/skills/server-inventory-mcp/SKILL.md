---
name: server-inventory-mcp
description: Set up, configure, and use the server-inventory dashboard's MCP server (mcp-server/ in the server-inventory repo) so Claude can query servers, IP inventory, databases, Kubernetes clusters, block storage, discovery jobs, sync, and resource maps for the user's self-hosted multi-cloud inventory. Use this whenever the user wants to check on their servers/infrastructure through Claude directly ("what servers do I have on AWS", "check my inventory", "is my database still empty", "show me the resource map for server 43", "kick off a sync"), wants help creating or troubleshooting an API key for it, wants to wire up the Claude Desktop config for server-inventory, or mentions "server-inventory MCP", "mcp-server", or the dashboard by name in the context of querying it programmatically rather than through the browser UI.
---

# server-inventory MCP

The user runs a self-hosted multi-cloud server inventory dashboard (repo:
`server-inventory`). It has a standalone MCP server at `mcp-server/` in that
repo — a thin stdio wrapper around the dashboard's own `/public/v1/*` REST
API, authenticated with a Bearer API key. It makes zero changes to the
running backend; it's just another authenticated client, same as the
browser dashboard or a curl script, but speaking MCP instead of HTTP directly.

This skill exists so you don't have to re-derive any of this from scratch
each session: what the tools are, what they need to run, how the user's
existing IAM/API-key model constrains what a key can do, and the concrete
steps to get a working setup or fix a broken one.

## When this is and isn't already running

If you're in a session that already has these MCP tools loaded (check
`available_skills`/tool list for names like `list_servers`, `get_server`,
`get_server_resource_map`, etc.), the server is already connected — just use
the tools directly, you don't need this skill's setup instructions. This
skill mostly matters when:
- The tools aren't connected yet and the user wants to query their inventory
- Something about the connection is broken (auth error, wrong scope, wrong
  host) and needs debugging
- The user is setting this up for the first time, on a new machine, or in a
  new MCP client

## The permission model — read this before touching API keys

Server-inventory's API keys have **no separate scope picker**. A key is
stamped with its creating user's full current IAM permissions at creation
time, and every request re-checks the key's scopes against that user's *live*
permissions — if the user's access is later reduced, every key they hold
loses that access on the very next call, automatically. This means:

- To create a key that can do everything the 10 tools below need, create it
  from an admin account. There is no "select servers:read, kubernetes:read"
  step to walk the user through — it's automatic.
- To create a more restricted key, the *user* (not the key) needs reduced
  IAM permissions — point them at IAM Policies / Users & Groups in the
  dashboard if they want a narrower key, don't try to restrict scopes on the
  key itself, that field doesn't exist.
- Never generate, print, or persist a raw API key value yourself (not to a
  file, not to memory, not to a report). The token is shown exactly once by
  the dashboard at creation time — tell the user to copy it themselves right
  then. If they lose it, the fix is rotating the key (which invalidates the
  old one and shows a new token once), not recovering the old value.

## Setting up a fresh connection

1. **Confirm the backend is reachable.** Ask for (or recall from context)
   the base URL — e.g. `https://<vps-ip>:8444` for a VPS behind nginx TLS,
   or `http://localhost:8001` for local dev. A quick `curl -sk <url>/health`
   should return `{"status":"ok"}`. If it doesn't, the MCP server can't do
   anything either — fix connectivity first, this isn't an MCP-specific
   problem.

2. **Get the user a real API key.** They create it themselves via the
   dashboard's **Access > API Keys** page (or you can create one via
   `POST /api/api-keys` with their own JWT if they're driving you through a
   terminal session already authenticated — never do this with credentials
   you don't already have from them in this session). Either way, the token
   is shown once. Tell them explicitly: "copy this now, it won't be shown
   again."

3. **Install dependencies** for `mcp-server/`:
   ```bash
   cd <repo>/mcp-server && pip install -r requirements.txt
   ```
   Needs Python 3.10+ (the code uses `str | None` union syntax, which is a
   hard requirement, not a style choice — it will fail to import on 3.9).

4. **Wire up the client config.** For Claude Desktop, this goes in
   `claude_desktop_config.json` under `"mcpServers"`:
   ```json
   {
     "mcpServers": {
       "server-inventory": {
         "command": "python3",
         "args": ["/absolute/path/to/repo/mcp-server/server.py"],
         "env": {
           "SERVER_INVENTORY_BASE_URL": "https://<host>:<port>",
           "SERVER_INVENTORY_API_KEY": "si_live_...",
           "SERVER_INVENTORY_VERIFY_SSL": "false"
         }
       }
     }
   }
   ```
   `SERVER_INVENTORY_VERIFY_SSL=false` is only needed for a self-signed cert
   (common on a VPS's own nginx TLS termination) — leave it `true`/unset for
   a properly-certificated host. Full setup detail lives in
   `mcp-server/README.md` in the repo itself — read that file if anything
   here seems out of date, it's the source of truth, this skill is a
   summary of it plus operational judgment.

5. **Verify it actually works** before telling the user it's done. Don't
   just check that the config file is syntactically valid — that proves
   nothing about whether the key or host are right. If you have shell
   access, drive the server directly over stdio (see `references/verify.md`
   for a working test script) or just restart the MCP client and try calling
   `list_servers` for real. A clean JSON response with real data is the only
   real confirmation.

## The tools and what they need

| Tool | What it does | Required feature:action |
|---|---|---|
| `list_servers(limit, offset)` | Paginated server list | `servers:read` |
| `get_server(server_id)` | One server's full detail | `servers:read` |
| `list_ip_inventory()` | All discovered IPs + reverse-DNS | `servers:read` |
| `list_databases(limit, offset)` | Managed database instances | `databases:read` |
| `list_kubernetes(limit, offset)` | Kubernetes clusters | `kubernetes:read` |
| `list_block_storage(limit, offset)` | Block storage volumes | `block-storages:read` |
| `list_discovery_jobs(limit)` | Recent on-prem discovery jobs | `discovery:read` |
| `run_discovery_once(cidr, ...)` | Start a discovery scan (mutating, rate-limited 5/hour) | `discovery:write` |
| `trigger_sync(provider)` | Trigger a cloud sync (mutating, rate-limited 10/hour) | `sync:write` |
| `get_server_resource_map(server_id)` | Topology/dependency graph for one server | `resource-map:read` |

Two of these — `run_discovery_once` and `trigger_sync` — cause real,
observable side effects on the user's actual infrastructure inventory (a
live network scan, a live provider API sync). Treat them like any other
side-effecting action: don't fire them speculatively "just to see", and if
the user's intent is ambiguous ("check my AWS stuff" could mean "read what's
there" or "go sync AWS right now"), ask which they mean rather than
guessing toward the mutating option.

## Debugging a broken connection

The client wraps errors into a small, meaningful exception hierarchy
(`AuthError`, `PermissionDeniedError`, `RateLimitError`, `NotFoundError`,
`ApiError` — see `mcp-server/client.py`), so a tool call that fails usually
tells you which of these categories it's in:

- **Auth error / "Invalid or unauthorized API key"** — the key is wrong,
  revoked, or the owning user is inactive. Check `is_active` on the key via
  the dashboard, or ask the user to rotate it.
- **Permission denied / "API key missing required scope for X:Y"** — the
  creating user's IAM permissions don't include that feature:action. This
  is not fixable on the key itself (see permission model above) — the fix
  is granting the *user* that permission, then the key picks it up
  automatically on the next call, no key edit needed.
- **Rate limited** — hit the 300/min read limit, or the 5/hour or 10/hour
  limits on the two mutating tools. Just wait; there's no override.
- **Connection refused / timeout** — base URL wrong, backend down, or a
  firewall/nginx issue unrelated to MCP at all. Test with plain curl against
  `/health` before assuming anything about the MCP layer is broken.
- **TLS certificate error** — self-signed cert and `SERVER_INVENTORY_VERIFY_SSL`
  wasn't set to `false`. Only turn this off for hosts you trust (like the
  user's own VPS) — never blanket-disable TLS verification for an unfamiliar
  host on the user's behalf.

## If the tools/README seem out of date

This skill describes the state of `mcp-server/` as of when it was written.
The repo is the source of truth, not this file. If a tool name, scope
string, or endpoint mentioned here doesn't match what's actually in
`mcp-server/server.py`, `mcp-server/client.py`, or `backend/app/routers/
public_api.py`, trust the code and treat this skill as stale — update it
rather than working around the mismatch silently.
