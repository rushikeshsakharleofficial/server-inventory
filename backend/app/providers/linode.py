from typing import List, Dict, Any
from .base import CloudProvider

STATUS_MAP = {
    "running": "running",
    "offline": "stopped",
    "booting": "pending",
    "rebooting": "pending",
    "shutting_down": "stopped",
    "provisioning": "pending",
    "deleting": "terminated",
    "migrating": "pending",
    "rebuilding": "pending",
    "cloning": "pending",
    "restoring": "pending",
}


class LinodeProvider(CloudProvider):
    @property
    def provider_name(self) -> str:
        return "linode"

    def fetch_servers(self) -> List[Dict[str, Any]]:
        import requests

        token = self.config["api_token"]
        headers = {"Authorization": f"Bearer {token}"}
        servers = []
        page = 1

        while True:
            resp = requests.get(
                "https://api.linode.com/v4/linode/instances",
                headers=headers,
                params={"page": page, "page_size": 100},
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()

            for linode in data["data"]:
                ips = linode.get("ipv4", [])
                specs = linode.get("specs", {})
                servers.append({
                    "cloud_id": str(linode["id"]),
                    "name": linode["label"],
                    "provider": "linode",
                    "region": linode.get("region"),
                    "instance_type": linode.get("type"),
                    "status": STATUS_MAP.get(linode.get("status", ""), "unknown"),
                    "public_ip": ips[0] if ips else None,
                    "private_ip": None,
                    "vcpu": specs.get("vcpus"),
                    "memory_gb": round(specs["memory"] / 1024, 1) if specs.get("memory") else None,
                    "storage_gb": specs.get("disk"),
                    "os": linode.get("image", ""),
                    "tags": {tag: tag for tag in linode.get("tags", [])},
                    "extra": {
                        "hypervisor": linode.get("hypervisor"),
                        "created": linode.get("created"),
                    },
                })

            if page >= data.get("pages", 1):
                break
            page += 1

        return servers
