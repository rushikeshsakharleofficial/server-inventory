from typing import Any
from .base import CloudProvider

TOKEN_URL = "https://auth.contabo.com/auth/realms/contabo/protocol/openid-connect/token"
API_BASE = "https://api.contabo.com/v1"

STATUS_MAP = {
    "running": "running",
    "stopped": "stopped",
    "installing": "pending",
    "uninstalled": "stopped",
    "restarting": "pending",
    "manual_provisioning": "pending",
    "resetting_password": "pending",
    "product_change": "pending",
    "error": "unknown",
    "unknown": "unknown",
}


class ContaboProvider(CloudProvider):
    @property
    def provider_name(self) -> str:
        return "contabo"

    def _access_token(self) -> str:
        import requests

        resp = requests.post(
            TOKEN_URL,
            data={
                "grant_type": "password",
                "client_id": self.config["client_id"],
                "client_secret": self.config["client_secret"],
                "username": self.config["username"],
                "password": self.config["password"],
            },
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json()["access_token"]

    def fetch_servers(self) -> list[dict[str, Any]]:
        import requests
        import uuid

        token = self._access_token()
        headers = {
            "Authorization": f"Bearer {token}",
            "x-request-id": str(uuid.uuid4()),
            "Content-Type": "application/json",
        }
        servers = []
        page = 1

        while True:
            resp = requests.get(
                f"{API_BASE}/compute/instances",
                headers=headers,
                params={"page": page, "size": 100},
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()

            for inst in data.get("data", []):
                ip_config = inst.get("ipConfig", {})
                v4 = ip_config.get("v4") or {}
                v6 = ip_config.get("v6") or {}
                ram_mb = inst.get("ramMb")
                servers.append({
                    "cloud_id": str(inst["instanceId"]),
                    "name": inst.get("displayName") or inst.get("name") or str(inst["instanceId"]),
                    "provider": "contabo",
                    "region": inst.get("region") or inst.get("dataCenter"),
                    "instance_type": inst.get("productId"),
                    "status": STATUS_MAP.get(inst.get("status", ""), "unknown"),
                    "public_ip": v4.get("ip"),
                    "private_ip": None,
                    "vcpu": inst.get("cpuCores"),
                    "memory_gb": round(float(ram_mb) / 1024, 1) if ram_mb else None,
                    "storage_gb": inst.get("diskMb", 0) / 1024 if inst.get("diskMb") else None,
                    "os": inst.get("osType"),
                    "tags": {},
                    "extra": {
                        "ipv6": v6.get("ip"),
                        "data_center": inst.get("dataCenter"),
                        "product_type": inst.get("productType"),
                        "created_date": inst.get("createdDate"),
                        "v_host_name": inst.get("vHostName"),
                    },
                })

            page_count = data.get("pagination", {}).get("totalPages", 1)
            if page >= page_count:
                break
            page += 1

        return servers
