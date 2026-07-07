# Server Inventory MCP Server

This is a standalone MCP server (stdio transport) that exposes the server-inventory dashboard's public API (`/public/v1/*`) as MCP tools. Any MCP client (Claude Desktop, Claude Code, etc.) can query and manage infrastructure inventory without modifying the main backend process — it acts as an HTTP client over Bearer token authentication.

## Prerequisites

- Python 3.10+
- Server-inventory backend already running and reachable at a known URL
- An API key created in the dashboard

## Creating an API Key

1. Log into the server-inventory dashboard
2. Navigate to **Access > API Keys**
3. Click "Create new key" and name it
4. The key is stamped with your own current IAM permissions at creation time — there is no separate scope picker. It can only ever do what your account can do, and loses access immediately if your permissions are later reduced. The tools below need these feature:action pairs, so use an account (or IAM group) that has them:
   - `servers:read` — list and get servers, IP inventory
   - `resource-map:read` — resource topology maps
   - `databases:read` — list databases
   - `kubernetes:read` — list Kubernetes clusters
   - `block-storages:read` — list block storage volumes
   - `discovery:read` — list discovery jobs
   - `discovery:write` — start new network discovery scans
   - `sync:write` — trigger cloud provider syncs
5. Copy the token (shown once; will not appear again)

## Installation

```bash
pip install -r requirements.txt
```

## Environment Variables

Required:

- `SERVER_INVENTORY_BASE_URL` — Backend URL (e.g. `https://142.44.210.103:8444` for VPS, `http://localhost:8001` for local dev)
- `SERVER_INVENTORY_API_KEY` — Bearer token starting with `si_live_`

Optional:

- `SERVER_INVENTORY_VERIFY_SSL` — Set to `false` to skip TLS verification for self-signed certificates (default: `true`)

## Claude Desktop Configuration

Add to your `claude_desktop_config.json` under `"mcpServers"`:

```json
{
  "mcpServers": {
    "server-inventory": {
      "command": "python3",
      "args": ["/absolute/path/to/server-inventory/mcp-server/server.py"],
      "env": {
        "SERVER_INVENTORY_BASE_URL": "https://142.44.210.103:8444",
        "SERVER_INVENTORY_API_KEY": "si_live_your_key_here",
        "SERVER_INVENTORY_VERIFY_SSL": "false"
      }
    }
  }
}
```

Replace `/absolute/path/to` and the API key value with your actual values.

## Running Standalone

To test the server without a client:

```bash
SERVER_INVENTORY_BASE_URL=http://localhost:8001 \
SERVER_INVENTORY_API_KEY=si_live_your_key \
python3 server.py
```

The server waits on stdin/stdout for MCP client messages; it will not print anything on its own until a client connects.

## Available Tools

| Tool | Description | Required Scope |
|------|-------------|-----------------|
| `list_servers` | List servers with pagination (limit, offset) | `servers:read` |
| `get_server` | Get full details for one server by ID | `servers:read` |
| `list_ip_inventory` | List discovered IP addresses with reverse-DNS info | `servers:read` |
| `list_databases` | List managed database instances | `databases:read` |
| `list_kubernetes` | List Kubernetes clusters | `kubernetes:read` |
| `list_block_storage` | List block storage volumes | `block-storages:read` |
| `list_discovery_jobs` | List recent on-prem network discovery jobs | `discovery:read` |
| `run_discovery_once` | Start a new discovery scan over a CIDR range (rate limited 5/hour) | `discovery:write` |
| `trigger_sync` | Trigger a cloud provider sync, optionally filtered by provider (rate limited 10/hour) | `sync:write` |
| `get_server_resource_map` | Get the resource topology/dependency graph for one server | `resource-map:read` |

## Security Notes

The API key carries the permissions of its granted scopes intersected with the creating user's live IAM permissions. Treat `SERVER_INVENTORY_API_KEY` as sensitive — anyone with it can act as those scopes. Do not commit it to git or share the Claude Desktop config file if it contains a real key.
