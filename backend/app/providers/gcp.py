from typing import List, Dict, Any
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

    def fetch_servers(self) -> List[Dict[str, Any]]:
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
