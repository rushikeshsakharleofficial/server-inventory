from typing import List, Dict, Any
from .base import CloudProvider

STATUS_MAP = {
    "active": "running",
    "off": "stopped",
    "archive": "stopped",
    "new": "pending",
}


class DigitalOceanProvider(CloudProvider):
    @property
    def provider_name(self) -> str:
        return "digitalocean"

    def fetch_servers(self) -> List[Dict[str, Any]]:
        import requests

        token = self.config["api_token"]
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

        servers = []
        url = "https://api.digitalocean.com/v2/droplets"
        params: Dict[str, Any] = {"per_page": 200}

        while url:
            resp = requests.get(url, headers=headers, params=params, timeout=30)
            resp.raise_for_status()
            data = resp.json()

            for droplet in data.get("droplets", []):
                public_ip = None
                private_ip = None
                for net in droplet.get("networks", {}).get("v4", []):
                    if net["type"] == "public":
                        public_ip = net["ip_address"]
                    elif net["type"] == "private":
                        private_ip = net["ip_address"]

                size = droplet.get("size", {})
                servers.append({
                    "cloud_id": str(droplet["id"]),
                    "name": droplet["name"],
                    "provider": "digitalocean",
                    "region": droplet.get("region", {}).get("slug"),
                    "instance_type": droplet.get("size_slug"),
                    "status": STATUS_MAP.get(droplet.get("status", ""), "unknown"),
                    "public_ip": public_ip,
                    "private_ip": private_ip,
                    "vcpu": size.get("vcpus"),
                    "memory_gb": round(size["memory"] / 1024, 1) if size.get("memory") else None,
                    "storage_gb": size.get("disk"),
                    "os": droplet.get("image", {}).get("slug", ""),
                    "tags": {tag: tag for tag in droplet.get("tags", [])},
                    "extra": {
                        "droplet_id": droplet["id"],
                        "created_at": droplet.get("created_at"),
                        "features": droplet.get("features", []),
                    },
                })

            next_url = data.get("links", {}).get("pages", {}).get("next")
            url = next_url
            params = {}

        return servers
