from typing import List, Dict, Any
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

    def fetch_servers(self) -> List[Dict[str, Any]]:
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
