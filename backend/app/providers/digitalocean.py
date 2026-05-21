from typing import Any
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

    def fetch_servers(self) -> list[dict[str, Any]]:
        import requests

        token = self.config["api_token"]
        headers: dict[str, str | bytes] = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

        servers = []
        url = "https://api.digitalocean.com/v2/droplets"
        params: dict[str, Any] = {"per_page": 200}

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

    def fetch_databases(self) -> list[dict[str, Any]]:
        import requests

        token = self.config["api_token"]
        headers: dict[str, str | bytes] = {"Authorization": f"Bearer {token}"}
        resp = requests.get(
            "https://api.digitalocean.com/v2/databases",
            headers=headers,
            params={"per_page": 200},
            timeout=30,
        )
        if not resp.ok:
            return []
        result = []
        status_map = {
            "online": "running",
            "creating": "pending",
            "migrating": "pending",
            "forking": "pending",
            "resizing": "pending",
            "configuring_log_forwarder": "pending",
        }
        for db in resp.json().get("databases", []):
            conn = db.get("connection", {})
            result.append({
                "cloud_id": db["id"],
                "name": db["name"],
                "provider": "digitalocean",
                "region": db.get("region"),
                "engine": db.get("engine"),
                "engine_version": db.get("version"),
                "status": status_map.get(db.get("status", ""), "unknown"),
                "endpoint": conn.get("host"),
                "port": conn.get("port"),
                "storage_gb": db.get("storage_size_mib", 0) / 1024 if db.get("storage_size_mib") else None,
                "instance_type": db.get("size"),
                "tags": {t: t for t in db.get("tags", [])},
                "extra": {
                    "num_nodes": db.get("num_nodes"),
                    "db_names": db.get("db_names", []),
                },
            })
        return result

    def fetch_kubernetes(self) -> list[dict[str, Any]]:
        import requests

        token = self.config["api_token"]
        headers: dict[str, str | bytes] = {"Authorization": f"Bearer {token}"}
        resp = requests.get(
            "https://api.digitalocean.com/v2/kubernetes/clusters",
            headers=headers,
            params={"per_page": 200},
            timeout=30,
        )
        if not resp.ok:
            return []
        result = []
        status_map = {
            "running": "running",
            "provisioning": "pending",
            "degraded": "stopped",
            "error": "stopped",
            "deleting": "terminated",
            "invalid": "stopped",
        }
        for cluster in resp.json().get("kubernetes_clusters", []):
            node_count = sum(p.get("count", 0) for p in cluster.get("node_pools", []))
            result.append({
                "cloud_id": cluster["id"],
                "name": cluster["name"],
                "provider": "digitalocean",
                "region": cluster.get("region"),
                "version": cluster.get("version"),
                "status": status_map.get(cluster.get("status", {}).get("state", ""), "unknown"),
                "node_count": node_count,
                "endpoint": cluster.get("endpoint"),
                "tags": {t: t for t in cluster.get("tags", [])},
                "extra": {
                    "auto_upgrade": cluster.get("auto_upgrade"),
                    "surge_upgrade": cluster.get("surge_upgrade"),
                },
            })
        return result

    def fetch_block_storages(self) -> list[dict[str, Any]]:
        import requests

        token = self.config["api_token"]
        headers: dict[str, str | bytes] = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

        result = []
        url = "https://api.digitalocean.com/v2/volumes"
        params: dict[str, Any] = {"per_page": 200}

        while url:
            resp = requests.get(url, headers=headers, params=params, timeout=30)
            if not resp.ok:
                break
            data = resp.json()

            for vol in data.get("volumes", []):
                droplet_ids = vol.get("droplet_ids", [])
                attachment = str(droplet_ids[0]) if droplet_ids else None
                status = "in-use" if droplet_ids else "available"
                
                vol_region = vol.get("region")
                region_slug = None
                if isinstance(vol_region, dict):
                    region_slug = vol_region.get("slug")
                elif isinstance(vol_region, str):
                    region_slug = vol_region

                result.append({
                    "cloud_id": vol["id"],
                    "name": vol["name"],
                    "provider": "digitalocean",
                    "region": region_slug,
                    "size_gb": float(vol.get("size_gigabytes", 0)),
                    "status": status,
                    "attachment": attachment,
                    "volume_type": vol.get("filesystem_type") or "standard",
                    "tags": {tag: tag for tag in vol.get("tags", [])},
                    "extra": {
                        "description": vol.get("description"),
                        "created_at": vol.get("created_at"),
                        "filesystem_label": vol.get("filesystem_label"),
                    },
                })

            next_url = data.get("links", {}).get("pages", {}).get("next")
            url = next_url
            params = {}

        return result
