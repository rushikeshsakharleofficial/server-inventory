from typing import Any
from .base import CloudProvider

POWER_STATE_MAP = {
    "running": "running",
    "deallocated": "stopped",
    "stopped": "stopped",
    "starting": "pending",
    "deallocating": "stopped",
}


class AzureProvider(CloudProvider):
    @property
    def provider_name(self) -> str:
        return "azure"

    def fetch_servers(self) -> list[dict[str, Any]]:
        try:
            from azure.identity import ClientSecretCredential
            from azure.mgmt.compute import ComputeManagementClient
            from azure.mgmt.network import NetworkManagementClient
        except ImportError:
            raise RuntimeError("azure-mgmt-compute and azure-identity not installed")

        subscription_id = self.config["subscription_id"]
        credential = ClientSecretCredential(
            tenant_id=self.config["tenant_id"],
            client_id=self.config["client_id"],
            client_secret=self.config["client_secret"],
        )

        compute = ComputeManagementClient(credential, subscription_id)
        network = NetworkManagementClient(credential, subscription_id)

        servers = []
        for vm in compute.virtual_machines.list_all():
            rg = vm.id.split("/")[4]

            status = "unknown"
            try:
                iv = compute.virtual_machines.instance_view(rg, vm.name)
                for s in iv.statuses:
                    if s.code.startswith("PowerState/"):
                        power = s.code.split("/")[1]
                        status = POWER_STATE_MAP.get(power, "unknown")
            except Exception:
                pass

            public_ip = None
            private_ip = None
            try:
                if vm.network_profile and vm.network_profile.network_interfaces:
                    nic_id = vm.network_profile.network_interfaces[0].id
                    nic_name = nic_id.split("/")[-1]
                    nic = network.network_interfaces.get(rg, nic_name)
                    for ipc in nic.ip_configurations:
                        private_ip = ipc.private_ip_address
                        if ipc.public_ip_address:
                            pip_name = ipc.public_ip_address.id.split("/")[-1]
                            pip = network.public_ip_addresses.get(rg, pip_name)
                            public_ip = pip.ip_address
            except Exception:
                pass

            os_type = "unknown"
            if vm.storage_profile and vm.storage_profile.os_disk and vm.storage_profile.os_disk.os_type:
                os_type = vm.storage_profile.os_disk.os_type.lower()

            servers.append({
                "cloud_id": vm.id,
                "name": vm.name,
                "provider": "azure",
                "region": vm.location,
                "instance_type": vm.hardware_profile.vm_size if vm.hardware_profile else None,
                "status": status,
                "public_ip": public_ip,
                "private_ip": private_ip,
                "os": os_type,
                "tags": dict(vm.tags) if vm.tags else {},
                "extra": {
                    "resource_group": rg,
                    "subscription_id": subscription_id,
                },
            })
        return servers

    def _az_token(self) -> str:
        import requests

        tenant_id = self.config["tenant_id"]
        url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
        data = {
            "grant_type": "client_credentials",
            "client_id": self.config["client_id"],
            "client_secret": self.config["client_secret"],
            "scope": "https://management.azure.com/.default",
        }
        resp = requests.post(url, data=data, timeout=15)
        resp.raise_for_status()
        return resp.json()["access_token"]

    def fetch_databases(self) -> list[dict[str, Any]]:
        import requests

        sub = self.config["subscription_id"]
        token = self._az_token()
        headers: dict[str, str | bytes] = {"Authorization": f"Bearer {token}"}
        result = []
        # PostgreSQL Flexible Servers and MySQL Flexible Servers
        for engine, api_path in [
            (
                "postgresql",
                f"https://management.azure.com/subscriptions/{sub}/providers/Microsoft.DBforPostgreSQL/flexibleServers?api-version=2022-12-01",
            ),
            (
                "mysql",
                f"https://management.azure.com/subscriptions/{sub}/providers/Microsoft.DBforMySQL/flexibleServers?api-version=2021-05-01",
            ),
        ]:
            try:
                resp = requests.get(api_path, headers=headers, timeout=30)
                if not resp.ok:
                    continue
                for srv in resp.json().get("value", []):
                    props = srv.get("properties", {})
                    state_map = {
                        "Ready": "running",
                        "Stopped": "stopped",
                        "Starting": "pending",
                        "Stopping": "pending",
                        "Updating": "pending",
                    }
                    result.append({
                        "cloud_id": srv["id"],
                        "name": srv["name"],
                        "provider": "azure",
                        "region": srv.get("location"),
                        "engine": engine,
                        "engine_version": props.get("version"),
                        "status": state_map.get(props.get("state", ""), "unknown"),
                        "endpoint": props.get("fullyQualifiedDomainName"),
                        "port": None,
                        "storage_gb": props.get("storage", {}).get("storageSizeGB"),
                        "instance_type": props.get("sku", {}).get("name") if "sku" in srv else None,
                        "tags": srv.get("tags", {}),
                        "extra": {
                            "resource_group": srv["id"].split("/")[4] if "/" in srv["id"] else "",
                        },
                    })
            except Exception:
                continue
        return result

    def fetch_kubernetes(self) -> list[dict[str, Any]]:
        import requests

        sub = self.config["subscription_id"]
        token = self._az_token()
        headers: dict[str, str | bytes] = {"Authorization": f"Bearer {token}"}
        url = f"https://management.azure.com/subscriptions/{sub}/providers/Microsoft.ContainerService/managedClusters?api-version=2023-08-01"
        try:
            resp = requests.get(url, headers=headers, timeout=30)
            resp.raise_for_status()
        except Exception:
            return []
        result = []
        for cluster in resp.json().get("value", []):
            props = cluster.get("properties", {})
            state_map = {
                "Succeeded": "running",
                "Creating": "pending",
                "Deleting": "terminated",
                "Failed": "stopped",
                "Updating": "pending",
            }
            node_count = sum(p.get("count", 0) for p in props.get("agentPoolProfiles", []))
            result.append({
                "cloud_id": cluster["id"],
                "name": cluster["name"],
                "provider": "azure",
                "region": cluster.get("location"),
                "version": props.get("kubernetesVersion"),
                "status": state_map.get(props.get("provisioningState", ""), "unknown"),
                "node_count": node_count,
                "endpoint": props.get("fqdn"),
                "tags": cluster.get("tags", {}),
                "extra": {
                    "resource_group": cluster["id"].split("/")[4] if "/" in cluster["id"] else "",
                },
            })
        return result

    def fetch_block_storages(self) -> list[dict[str, Any]]:
        try:
            from azure.identity import ClientSecretCredential
            from azure.mgmt.compute import ComputeManagementClient
        except ImportError:
            return []

        subscription_id = self.config["subscription_id"]
        credential = ClientSecretCredential(
            tenant_id=self.config["tenant_id"],
            client_id=self.config["client_id"],
            client_secret=self.config["client_secret"],
        )

        compute = ComputeManagementClient(credential, subscription_id)

        result = []
        state_map = {
            "Attached": "running",
            "Unattached": "available",
            "Reserved": "available",
            "Frozen": "stopped",
        }

        try:
            for disk in compute.disks.list():
                sku_name = "standard"
                if hasattr(disk, "sku") and disk.sku:
                    sku_name = getattr(disk.sku, "name", "standard")

                attachment = None
                if hasattr(disk, "managed_by") and disk.managed_by:
                    attachment = disk.managed_by.split("/")[-1]

                tags = {}
                if hasattr(disk, "tags") and disk.tags:
                    tags = dict(disk.tags)

                status = "unknown"
                if hasattr(disk, "disk_state") and disk.disk_state:
                    status = state_map.get(disk.disk_state, "unknown")
                elif attachment:
                    status = "running"
                else:
                    status = "available"

                result.append({
                    "cloud_id": disk.id,
                    "name": disk.name,
                    "provider": "azure",
                    "region": disk.location,
                    "size_gb": float(disk.disk_size_gb) if getattr(disk, "disk_size_gb", None) else 0.0,
                    "status": status,
                    "attachment": attachment,
                    "volume_type": sku_name,
                    "tags": tags,
                    "extra": {
                        "resource_group": disk.id.split("/")[4] if "/" in disk.id else "",
                        "time_created": str(getattr(disk, "time_created", "")),
                        "disk_state": getattr(disk, "disk_state", None),
                        "provisioning_state": getattr(disk, "provisioning_state", None),
                    },
                })
        except Exception:
            pass

        return result
