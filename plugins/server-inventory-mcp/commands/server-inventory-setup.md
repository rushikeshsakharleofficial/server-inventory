---
description: Set up or fix the server-inventory MCP connection — create/rotate an API key and configure the plugin's .mcp.json.
---

# server-inventory MCP setup

This command gets the `server-inventory` MCP tools (list_servers,
get_server, list_ip_inventory, list_databases, list_kubernetes,
list_block_storage, list_discovery_jobs, run_discovery_once, trigger_sync,
get_server_resource_map) actually working, end to end.

## 1. Find the config file

The plugin's live config is at:
```
${CLAUDE_PLUGIN_ROOT}/.mcp.json
```
Read it. If `SERVER_INVENTORY_API_KEY` is empty or still a placeholder
(anything not starting with `si_live_`), or `SERVER_INVENTORY_BASE_URL` is
empty, setup isn't done yet — continue below. If both look filled in,
skip to step 4 (verify) first — it may already be working.

## 2. Get the backend URL

Ask the user for their server-inventory backend URL if you don't already
know it from context (e.g. `https://<vps-ip>:8444` behind nginx TLS, or
`http://localhost:8001` for local dev). Confirm it's reachable:
```bash
curl -sk <base_url>/health
```
Expect `{"status":"ok"}`. If this fails, stop — nothing downstream will
work either, and it's not an MCP-specific problem.

## 3. Get a real API key

Ask the user: do they already have a `si_live_...` token saved somewhere
(e.g. from creating a key via the dashboard's Access > API Keys page)?

- **They have one**: have them tell you to use it, but have *them* paste it
  into the config file themselves — do not accept a raw key pasted into
  chat and retype it, and never write a key value into any file other than
  this one `.mcp.json` (not into memory, not into a report, not into git).
- **They don't**: you can create one on their behalf *only if* they're
  already authenticated in this session (e.g. you have a JWT from a prior
  login this session) — call `POST /api/api-keys` with `{"name": "mcp-server"}`
  against their backend. The response includes a one-time `token` field.
  Print it once in chat so the user can copy it, then tell them to paste
  it into the config file themselves. Do not persist the raw token to disk
  under your own control.
- If a key was created earlier and the token is lost (never pasted in,
  can't be recovered — the dashboard only shows it once), rotate it instead:
  `POST /api/api-keys/{id}/rotate` with the same JWT. This invalidates the
  old token and returns a fresh one-time token the same way.

Remember: an API key here is stamped with its creating user's *current* IAM
permissions at creation time — there's no separate scope picker. Creating
it from an admin account gives it everything the 10 tools need.

## 4. Edit the config

Set both values in `${CLAUDE_PLUGIN_ROOT}/.mcp.json`:
```json
{
  "mcpServers": {
    "server-inventory": {
      "command": "python3",
      "args": ["${CLAUDE_PLUGIN_ROOT}/mcp-server/server.py"],
      "env": {
        "SERVER_INVENTORY_BASE_URL": "<the base url>",
        "SERVER_INVENTORY_API_KEY": "<the user pastes this in themselves>",
        "SERVER_INVENTORY_VERIFY_SSL": "false"
      }
    }
  }
}
```
Set `SERVER_INVENTORY_VERIFY_SSL` to `"false"` only if the host uses a
self-signed cert (common for a VPS's own nginx TLS termination) — leave it
`"true"` for a properly-certificated host. You can safely set
`SERVER_INVENTORY_BASE_URL` and `SERVER_INVENTORY_VERIFY_SSL` yourself;
leave `SERVER_INVENTORY_API_KEY` for the user to fill in if it still needs
a real value.

Tell the user to run `/reload-plugins` after the file is saved — the MCP
server process needs a restart to pick up new env values.

## 5. Verify

After reload, actually call a tool — don't just check the file looks
right. Try `list_servers` with a small limit. A working connection returns
real JSON (`total`, `items`, etc.). Common failures and what they mean:

- **"Invalid or unauthorized API key"** → the key is wrong, still a
  placeholder, revoked, or never got pasted into the file at all (check
  this first — it's the most common cause). Confirm with:
  `curl -sk <base_url>/api/api-keys/<id> -H "Authorization: Bearer <jwt>"`
  and check `is_active` / `last_used_at` (a `null` last_used_at after
  supposedly using it means the request never actually reached the backend
  with that key — usually a placeholder still in the file).
- **"API key missing required scope for X:Y"** → the creating user's IAM
  permissions don't include that feature:action. Fix the user's
  permissions, not the key — it picks up the change automatically on the
  next call.
- **Connection refused / timeout** → wrong base URL or backend down,
  unrelated to MCP itself.
- **TLS certificate error** → set `SERVER_INVENTORY_VERIFY_SSL` to
  `"false"` if the host's cert is self-signed and trusted.

Report the outcome plainly — don't claim success without an actual
successful tool call proving it.
