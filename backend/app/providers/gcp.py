from typing import Any
from .base import CloudProvider

STATUS_MAP = {
    "RUNNING": "running",
    "STOPPED": "stopped",
    "TERMINATED": "terminated",
    "STAGING": "pending",
    "PROVISIONING": "pending",
    "SUSPENDED": "stopped",
    "REPAIRING": "unknown",
}


class GCPProvider(CloudProvider):
    @property
    def provider_name(self) -> str:
        return "gcp"

    def fetch_servers(self) -> list[dict[str, Any]]:
        try:
            from google.cloud import compute_v1
            from google.oauth2 import service_account
        except ImportError:
            raise RuntimeError("google-cloud-compute not installed. Run: pip install google-cloud-compute")

        project_id = self.config.get("project_id")
        sa_info = self.config.get("service_account_json")

        if sa_info:
            credentials = service_account.Credentials.from_service_account_info(
                sa_info,
                scopes=["https://www.googleapis.com/auth/cloud-platform"],
            )
            client = compute_v1.InstancesClient(credentials=credentials)
        else:
            client = compute_v1.InstancesClient()

        servers = []
        request = compute_v1.AggregatedListInstancesRequest(project=project_id)
        for zone_key, response in client.aggregated_list(request=request):
            if not hasattr(response, "instances"):
                continue
            for inst in response.instances:
                public_ip = None
                private_ip = None
                for iface in inst.network_interfaces:
                    private_ip = iface.network_i_p
                    for ac in iface.access_configs:
                        if ac.nat_i_p:
                            public_ip = ac.nat_i_p

                zone_name = zone_key.replace("zones/", "")
                machine_type = inst.machine_type.split("/")[-1] if inst.machine_type else None
                region = zone_name.rsplit("-", 1)[0] if zone_name else None

                servers.append({
                    "cloud_id": str(inst.id),
                    "name": inst.name,
                    "provider": "gcp",
                    "region": region,
                    "zone": zone_name,
                    "instance_type": machine_type,
                    "status": STATUS_MAP.get(inst.status, "unknown"),
                    "public_ip": public_ip,
                    "private_ip": private_ip,
                    "os": "linux",
                    "tags": dict(inst.labels) if inst.labels else {},
                    "extra": {
                        "project_id": project_id,
                        "creation_timestamp": inst.creation_timestamp,
                    },
                })
        return servers

    def fetch_databases(self) -> list[dict[str, Any]]:
        import json
        import requests

        sa = self.config.get("service_account_json", {})
        if isinstance(sa, str):
            sa = json.loads(sa)
        project_id = sa.get("project_id") or self.config.get("project_id")
        if not project_id:
            return []
        try:
            from google.oauth2 import service_account
            from google.auth.transport.requests import Request as GRequest

            creds = service_account.Credentials.from_service_account_info(
                sa, scopes=["https://www.googleapis.com/auth/cloud-platform"]
            )
            creds.refresh(GRequest())
            token = creds.token
        except Exception:
            return []

        headers: dict[str, str | bytes] = {"Authorization": f"Bearer {token}"}
        url = f"https://sqladmin.googleapis.com/v1/projects/{project_id}/instances"
        resp = requests.get(url, headers=headers, timeout=30)
        if not resp.ok:
            return []

        result = []
        status_map = {
            "RUNNABLE": "running",
            "SUSPENDED": "stopped",
            "PENDING_DELETE": "terminated",
            "PENDING_CREATE": "pending",
            "MAINTENANCE": "pending",
            "FAILED": "stopped",
        }
        for inst in resp.json().get("items", []):
            settings = inst.get("settings", {})
            ip_addrs = inst.get("ipAddresses", [])
            endpoint = next((a["ipAddress"] for a in ip_addrs if a.get("type") == "PRIMARY"), None)
            result.append({
                "cloud_id": inst["name"],
                "name": inst["name"],
                "provider": "gcp",
                "region": inst.get("region"),
                "engine": inst.get("databaseVersion", "").split("_")[0].lower(),
                "engine_version": inst.get("databaseVersion"),
                "status": status_map.get(inst.get("state", ""), "unknown"),
                "endpoint": endpoint,
                "port": None,
                "storage_gb": settings.get("dataDiskSizeGb"),
                "instance_type": settings.get("tier"),
                "tags": settings.get("userLabels", {}),
                "extra": {
                    "project": project_id,
                    "availability_type": settings.get("availabilityType"),
                },
            })
        return result

    def fetch_kubernetes(self) -> list[dict[str, Any]]:
        import json
        import requests

        sa = self.config.get("service_account_json", {})
        if isinstance(sa, str):
            sa = json.loads(sa)
        project_id = sa.get("project_id") or self.config.get("project_id")
        if not project_id:
            return []
        try:
            from google.oauth2 import service_account
            from google.auth.transport.requests import Request as GRequest

            creds = service_account.Credentials.from_service_account_info(
                sa, scopes=["https://www.googleapis.com/auth/cloud-platform"]
            )
            creds.refresh(GRequest())
            token = creds.token
        except Exception:
            return []

        headers: dict[str, str | bytes] = {"Authorization": f"Bearer {token}"}
        url = f"https://container.googleapis.com/v1/projects/{project_id}/locations/-/clusters"
        resp = requests.get(url, headers=headers, timeout=30)
        if not resp.ok:
            return []

        result = []
        status_map = {
            "RUNNING": "running",
            "PROVISIONING": "pending",
            "STOPPING": "pending",
            "ERROR": "stopped",
            "DEGRADED": "stopped",
            "RECONCILING": "pending",
        }
        for cluster in resp.json().get("clusters", []):
            node_count = sum(p.get("initialNodeCount", 0) for p in cluster.get("nodePools", []))
            result.append({
                "cloud_id": cluster.get("selfLink", cluster["name"]),
                "name": cluster["name"],
                "provider": "gcp",
                "region": cluster.get("location"),
                "version": cluster.get("currentMasterVersion"),
                "status": status_map.get(cluster.get("status", ""), "unknown"),
                "node_count": node_count or cluster.get("currentNodeCount"),
                "endpoint": cluster.get("endpoint"),
                "tags": cluster.get("resourceLabels", {}),
                "extra": {
                    "zone": cluster.get("zone"),
                    "network": cluster.get("network"),
                },
            })
        return result

    def fetch_block_storages(self) -> list[dict[str, Any]]:
        try:
            from google.cloud import compute_v1
            from google.oauth2 import service_account
        except ImportError:
            return []

        project_id = self.config.get("project_id")
        sa_info = self.config.get("service_account_json")

        if sa_info:
            import json
            if isinstance(sa_info, str):
                sa_info = json.loads(sa_info)
            credentials = service_account.Credentials.from_service_account_info(
                sa_info,
                scopes=["https://www.googleapis.com/auth/cloud-platform"],
            )
            client = compute_v1.DisksClient(credentials=credentials)
        else:
            client = compute_v1.DisksClient()

        result = []
        status_map = {
            "READY": "running",
            "CREATING": "pending",
            "RESTORING": "pending",
            "DELETING": "terminated",
            "FAILED": "stopped",
        }

        try:
            request = compute_v1.AggregatedListDisksRequest(project=project_id)
            for zone_key, response in client.aggregated_list(request=request):
                if not hasattr(response, "disks"):
                    continue
                for disk in response.disks:
                    zone_name = zone_key.replace("zones/", "")
                    region = zone_name.rsplit("-", 1)[0] if zone_name else None
                    
                    raw_type = getattr(disk, "type_", None) or getattr(disk, "type", "")
                    disk_type = raw_type.split("/")[-1] if raw_type else "standard"
                    
                    users = getattr(disk, "users", [])
                    attachments = list(users) if users else []
                    attachment = attachments[0].split("/")[-1] if attachments else None
                    
                    status = "in-use" if attachments else "available"
                    
                    result.append({
                        "cloud_id": str(disk.id) if hasattr(disk, "id") else disk.name,
                        "name": disk.name,
                        "provider": "gcp",
                        "region": region,
                        "size_gb": float(getattr(disk, "size_gb", 0)),
                        "status": status_map.get(getattr(disk, "status", ""), "unknown") if not attachments else "running",
                        "attachment": attachment,
                        "volume_type": disk_type,
                        "tags": dict(disk.labels) if getattr(disk, "labels", None) else {},
                        "extra": {
                            "zone": zone_name,
                            "creation_timestamp": getattr(disk, "creation_timestamp", None),
                            "disk_state": getattr(disk, "status", None),
                            "last_attach_timestamp": getattr(disk, "last_attach_timestamp", None),
                        },
                    })
        except Exception:
            pass

        return result
