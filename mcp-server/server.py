from mcp.server.fastmcp import FastMCP

from client import ServerInventoryClient, ServerInventoryError

mcp = FastMCP("server-inventory")
client = ServerInventoryClient()  # reads SERVER_INVENTORY_* env vars, no network call yet


def _wrap(exc: ServerInventoryError) -> Exception:
    return Exception(f"server-inventory API error: {exc}")


@mcp.tool()
def list_servers(limit: int = 50, offset: int = 0) -> dict:
    """List servers in the inventory. Requires servers:read API key scope."""
    try:
        return client.list_servers(limit, offset)
    except ServerInventoryError as exc:
        raise _wrap(exc) from exc


@mcp.tool()
def get_server(server_id: int) -> dict:
    """Get full details for one server by ID. Requires servers:read scope."""
    try:
        return client.get_server(server_id)
    except ServerInventoryError as exc:
        raise _wrap(exc) from exc


@mcp.tool()
def list_ip_inventory() -> dict:
    """List all discovered IP addresses across the fleet with reverse-DNS info where available. Requires servers:read scope."""
    try:
        return client.list_ip_inventory()
    except ServerInventoryError as exc:
        raise _wrap(exc) from exc


@mcp.tool()
def list_databases(limit: int = 50, offset: int = 0) -> dict:
    """List managed database instances. Requires databases:read scope."""
    try:
        return client.list_databases(limit, offset)
    except ServerInventoryError as exc:
        raise _wrap(exc) from exc


@mcp.tool()
def list_kubernetes(limit: int = 50, offset: int = 0) -> dict:
    """List Kubernetes clusters. Requires kubernetes:read scope."""
    try:
        return client.list_kubernetes(limit, offset)
    except ServerInventoryError as exc:
        raise _wrap(exc) from exc


@mcp.tool()
def list_block_storage(limit: int = 50, offset: int = 0) -> dict:
    """List block storage volumes. Requires block-storages:read scope."""
    try:
        return client.list_block_storage(limit, offset)
    except ServerInventoryError as exc:
        raise _wrap(exc) from exc


@mcp.tool()
def list_discovery_jobs(limit: int = 50) -> list:
    """List recent on-prem discovery jobs. Requires discovery:read scope."""
    try:
        return client.list_discovery_jobs(limit)
    except ServerInventoryError as exc:
        raise _wrap(exc) from exc


@mcp.tool()
def run_discovery_once(
    cidr: str,
    ssh_credential_id: int | None = None,
    max_parallel: int = 32,
    timeout_seconds: int = 8,
) -> dict:
    """Start an on-prem network discovery scan over the given CIDR range. Requires discovery:write scope. Rate limited to 5/hour."""
    try:
        return client.run_discovery_once(cidr, ssh_credential_id, max_parallel, timeout_seconds)
    except ServerInventoryError as exc:
        raise _wrap(exc) from exc


@mcp.tool()
def trigger_sync(provider: str | None = None) -> dict:
    """Trigger a cloud provider sync (all providers if none specified). Requires sync:write scope. Rate limited to 10/hour."""
    try:
        return client.trigger_sync(provider)
    except ServerInventoryError as exc:
        raise _wrap(exc) from exc


@mcp.tool()
def get_server_resource_map(server_id: int) -> dict:
    """Get the resource topology map (network/dependency graph) for one server. Requires resource-map:read scope."""
    try:
        return client.get_server_resource_map(server_id)
    except ServerInventoryError as exc:
        raise _wrap(exc) from exc


if __name__ == "__main__":
    mcp.run()
