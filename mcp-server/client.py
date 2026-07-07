import os
from typing import Any
import httpx


class ServerInventoryError(Exception):
    pass


class AuthError(ServerInventoryError):
    pass


class PermissionDeniedError(ServerInventoryError):
    pass


class RateLimitError(ServerInventoryError):
    pass


class NotFoundError(ServerInventoryError):
    pass


class ApiError(ServerInventoryError):
    pass


class ServerInventoryClient:
    def __init__(
        self,
        base_url: str | None = None,
        api_key: str | None = None,
        verify_ssl: bool | None = None,
    ) -> None:
        self.base_url = base_url or os.getenv("SERVER_INVENTORY_BASE_URL")
        if not self.base_url:
            raise ValueError("base_url must be provided or set via SERVER_INVENTORY_BASE_URL")
        self.base_url = self.base_url.rstrip("/")

        self.api_key = api_key or os.getenv("SERVER_INVENTORY_API_KEY")
        if not self.api_key:
            raise ValueError("api_key must be provided or set via SERVER_INVENTORY_API_KEY")

        verify = verify_ssl
        if verify is None:
            env_verify = os.getenv("SERVER_INVENTORY_VERIFY_SSL", "true").lower()
            verify = env_verify != "false"

        self._http = httpx.Client(
            timeout=20.0,
            verify=verify,
        )

    def _request(
        self,
        method: str,
        path: str,
        *,
        params: dict | None = None,
        json_body: dict | None = None,
    ) -> Any:
        url = f"{self.base_url}/public/v1{path}"
        headers = {"Authorization": f"Bearer {self.api_key}"}
        response = self._http.request(
            method,
            url,
            params=params,
            json=json_body,
            headers=headers,
        )

        if response.status_code == 401:
            detail = response.json().get("detail", "Unauthorized")
            raise AuthError(detail)
        elif response.status_code == 403:
            detail = response.json().get("detail", "Forbidden")
            raise PermissionDeniedError(detail)
        elif response.status_code == 404:
            detail = response.json().get("detail", "Not found")
            raise NotFoundError(detail)
        elif response.status_code == 429:
            raise RateLimitError("Rate limit exceeded")
        elif response.status_code < 200 or response.status_code >= 300:
            raise ApiError(f"HTTP {response.status_code}: {response.text}")

        return response.json()

    def list_servers(self, limit: int = 50, offset: int = 0) -> dict:
        return self._request("GET", "/servers", params={"limit": limit, "offset": offset})

    def get_server(self, server_id: int) -> dict:
        return self._request("GET", f"/servers/{server_id}")

    def list_ip_inventory(self) -> dict:
        return self._request("GET", "/ip-inventory")

    def list_databases(self, limit: int = 50, offset: int = 0) -> dict:
        return self._request("GET", "/databases", params={"limit": limit, "offset": offset})

    def list_kubernetes(self, limit: int = 50, offset: int = 0) -> dict:
        return self._request("GET", "/kubernetes", params={"limit": limit, "offset": offset})

    def list_block_storage(self, limit: int = 50, offset: int = 0) -> dict:
        return self._request(
            "GET", "/block-storage", params={"limit": limit, "offset": offset}
        )

    def list_discovery_jobs(self, limit: int = 50) -> list[dict]:
        return self._request("GET", "/discovery/jobs", params={"limit": limit})

    def run_discovery_once(
        self,
        cidr: str,
        ssh_credential_id: int | None = None,
        max_parallel: int = 32,
        timeout_seconds: int = 8,
    ) -> dict:
        body = {
            "cidr": cidr,
            "ssh_credential_id": ssh_credential_id,
            "max_parallel": max_parallel,
            "timeout_seconds": timeout_seconds,
        }
        return self._request("POST", "/discovery/run-once", json_body=body)

    def trigger_sync(self, provider: str | None = None) -> dict:
        params = {"provider": provider} if provider else None
        return self._request("POST", "/sync", params=params)

    def get_server_resource_map(self, server_id: int) -> dict:
        return self._request("GET", f"/resource-map/server/{server_id}")

    def close(self) -> None:
        self._http.close()

    def __enter__(self) -> "ServerInventoryClient":
        return self

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        self.close()
