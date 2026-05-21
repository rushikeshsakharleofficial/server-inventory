from typing import Any
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

    def fetch_servers(self) -> list[dict[str, Any]]:
        import requests

        token = self.config["api_token"]
        headers: dict[str, str | bytes] = {"Authorization": f"Bearer {token}"}
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

    def fetch_databases(self) -> list[dict[str, Any]]:
        import requests

        token = self.config.get("api_token")
        headers: dict[str, str | bytes] = {"Authorization": f"Bearer {token}"}
        result = []
        for engine_path in ["mysql", "postgresql"]:
            url = f"https://api.linode.com/v4/databases/{engine_path}/instances"
            page = 1
            while True:
                resp = requests.get(
                    url,
                    headers=headers,
                    params={"page": page, "page_size": 100},
                    timeout=30,
                )
                if not resp.ok:
                    break
                data = resp.json()
                status_map = {
                    "active": "running",
                    "provisioning": "pending",
                    "suspending": "pending",
                    "suspended": "stopped",
                    "resuming": "pending",
                    "restoring": "pending",
                    "failed": "stopped",
                    "degraded": "stopped",
                }
                for db in data.get("data", []):
                    hosts = db.get("hosts", {})
                    result.append({
                        "cloud_id": str(db["id"]),
                        "name": db["label"],
                        "provider": "linode",
                        "region": db.get("region"),
                        "engine": engine_path,
                        "engine_version": db.get("version"),
                        "status": status_map.get(db.get("status", ""), "unknown"),
                        "endpoint": hosts.get("primary"),
                        "port": db.get("port"),
                        "storage_gb": db.get("total_disk_size_gb"),
                        "instance_type": db.get("type"),
                        "tags": {t: t for t in db.get("tags", [])},
                        "extra": {
                            "cluster_size": db.get("cluster_size"),
                            "replication_type": db.get("replication_type"),
                        },
                    })
                if page >= data.get("pages", 1):
                    break
                page += 1
        return result

    def fetch_kubernetes(self) -> list[dict[str, Any]]:
        import requests

        token = self.config.get("api_token")
        headers: dict[str, str | bytes] = {"Authorization": f"Bearer {token}"}
        page = 1
        result = []
        while True:
            resp = requests.get(
                "https://api.linode.com/v4/lke/clusters",
                headers=headers,
                params={"page": page, "page_size": 100},
                timeout=30,
            )
            if not resp.ok:
                break
            data = resp.json()
            status_map = {
                "ready": "running",
                "not_ready": "pending",
            }
            for cluster in data.get("data", []):
                node_count = 0
                try:
                    pools_resp = requests.get(
                        f"https://api.linode.com/v4/lke/clusters/{cluster['id']}/pools",
                        headers=headers,
                        timeout=15,
                    )
                    if pools_resp.ok:
                        node_count = sum(p.get("count", 0) for p in pools_resp.json().get("data", []))
                except Exception:
                    pass
                result.append({
                    "cloud_id": str(cluster["id"]),
                    "name": cluster["label"],
                    "provider": "linode",
                    "region": cluster.get("region"),
                    "version": cluster.get("k8s_version"),
                    "status": status_map.get(cluster.get("status", ""), "unknown"),
                    "node_count": node_count,
                    "endpoint": None,
                    "tags": {t: t for t in cluster.get("tags", [])},
                    "extra": {
                        "control_plane": cluster.get("control_plane"),
                    },
                })
            if page >= data.get("pages", 1):
                break
            page += 1
        return result

    def fetch_block_storages(self) -> list[dict[str, Any]]:
        import requests

        token = self.config.get("api_token")
        headers: dict[str, str | bytes] = {"Authorization": f"Bearer {token}"}
        result = []
        page = 1

        status_map = {
            "active": "running",
            "creating": "pending",
            "resizing": "pending",
        }

        while True:
            resp = requests.get(
                "https://api.linode.com/v4/volumes",
                headers=headers,
                params={"page": page, "page_size": 100},
                timeout=30,
            )
            if not resp.ok:
                break
            data = resp.json()

            for vol in data.get("data", []):
                linode_id = vol.get("linode_id")
                attachment = str(linode_id) if linode_id is not None else None
                status = status_map.get(vol.get("status", ""), "unknown") if not attachment else "running"

                result.append({
                    "cloud_id": str(vol["id"]),
                    "name": vol["label"],
                    "provider": "linode",
                    "region": vol.get("region"),
                    "size_gb": float(vol.get("size", 0)),
                    "status": status,
                    "attachment": attachment,
                    "volume_type": "standard",
                    "tags": {t: t for t in vol.get("tags", [])},
                    "extra": {
                        "filesystem_path": vol.get("filesystem_path"),
                        "created": vol.get("created"),
                        "updated": vol.get("updated"),
                        "hardware_type": vol.get("hardware_type"),
                    },
                })

            if page >= data.get("pages", 1):
                break
            page += 1

        return result
