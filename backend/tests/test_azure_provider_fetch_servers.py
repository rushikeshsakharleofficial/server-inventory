"""
Pinning tests for AzureProvider.fetch_servers and fetch_block_storages
(backend/app/providers/azure.py). Written before refactoring.

The azure-* packages are imported inside the methods themselves, so we patch
the classes at their source module path (azure.identity.ClientSecretCredential,
azure.mgmt.compute.ComputeManagementClient, azure.mgmt.network.NetworkManagementClient)
-- the same objects the `from ... import ...` statements inside the methods
resolve to at call time.
"""
import sys
from unittest.mock import MagicMock, patch

import pytest

from app.providers.azure import AzureProvider


def _config():
    return {
        "subscription_id": "sub-1",
        "tenant_id": "tenant-1",
        "client_id": "client-1",
        "client_secret": "secret-1",
    }


def _vm(vm_id="/subscriptions/sub-1/resourceGroups/rg1/providers/Microsoft.Compute/virtualMachines/vm1",
        name="vm1", location="eastus", vm_size="Standard_B1s",
        os_type="Linux", tags=None, nic_ids=None):
    vm = MagicMock()
    vm.id = vm_id
    vm.name = name
    vm.location = location
    vm.hardware_profile = MagicMock(vm_size=vm_size)
    vm.storage_profile = MagicMock()
    vm.storage_profile.os_disk = MagicMock(os_type=MagicMock(lower=lambda: os_type.lower()) if os_type else None)
    if os_type is None:
        vm.storage_profile.os_disk.os_type = None
    vm.tags = tags
    if nic_ids is None:
        vm.network_profile = None
    else:
        vm.network_profile = MagicMock()
        vm.network_profile.network_interfaces = [MagicMock(id=nid) for nid in nic_ids]
    return vm


def _status(code):
    s = MagicMock()
    s.code = code
    return s


@pytest.fixture
def fake_azure_sdk():
    """Patch the three SDK entry points fetch_servers/fetch_block_storages import."""
    with patch("azure.identity.ClientSecretCredential") as cred, \
         patch("azure.mgmt.compute.ComputeManagementClient") as compute_cls, \
         patch("azure.mgmt.network.NetworkManagementClient") as network_cls:
        compute = MagicMock()
        network = MagicMock()
        compute_cls.return_value = compute
        network_cls.return_value = network
        yield {"cred": cred, "compute": compute, "network": network}


class TestFetchServers:
    def test_sdk_not_installed_raises_runtime_error(self):
        with patch.dict(sys.modules, {"azure.identity": None}):
            provider = AzureProvider(_config())
            with pytest.raises(RuntimeError, match="azure-mgmt-compute and azure-identity not installed"):
                provider.fetch_servers()

    def test_full_happy_path_maps_vm_with_ips_and_status(self, fake_azure_sdk):
        compute = fake_azure_sdk["compute"]
        network = fake_azure_sdk["network"]

        vm = _vm(tags={"env": "prod"}, nic_ids=["/subscriptions/sub-1/resourceGroups/rg1/providers/Microsoft.Network/networkInterfaces/nic1"])
        compute.virtual_machines.list_all.return_value = [vm]
        compute.virtual_machines.instance_view.return_value = MagicMock(statuses=[_status("PowerState/running")])

        ipc = MagicMock()
        ipc.private_ip_address = "10.0.0.4"
        ipc.public_ip_address = MagicMock(id="/subscriptions/sub-1/resourceGroups/rg1/providers/Microsoft.Network/publicIPAddresses/pip1")
        network.network_interfaces.get.return_value = MagicMock(ip_configurations=[ipc])
        network.public_ip_addresses.get.return_value = MagicMock(ip_address="1.2.3.4")

        result = AzureProvider(_config()).fetch_servers()

        assert len(result) == 1
        s = result[0]
        assert s["cloud_id"] == vm.id
        assert s["name"] == "vm1"
        assert s["provider"] == "azure"
        assert s["region"] == "eastus"
        assert s["instance_type"] == "Standard_B1s"
        assert s["status"] == "running"
        assert s["public_ip"] == "1.2.3.4"
        assert s["private_ip"] == "10.0.0.4"
        assert s["os"] == "linux"
        assert s["tags"] == {"env": "prod"}
        assert s["extra"]["resource_group"] == "rg1"
        assert s["extra"]["subscription_id"] == "sub-1"

    def test_instance_view_exception_leaves_status_unknown(self, fake_azure_sdk):
        compute = fake_azure_sdk["compute"]
        vm = _vm(nic_ids=None)
        compute.virtual_machines.list_all.return_value = [vm]
        compute.virtual_machines.instance_view.side_effect = RuntimeError("boom")

        result = AzureProvider(_config()).fetch_servers()

        assert len(result) == 1
        s = result[0]
        assert s["status"] == "unknown"
        assert s["public_ip"] is None
        assert s["private_ip"] is None

    def test_network_interface_lookup_exception_leaves_ips_none(self, fake_azure_sdk):
        compute = fake_azure_sdk["compute"]
        network = fake_azure_sdk["network"]
        vm = _vm(nic_ids=["/subscriptions/sub-1/resourceGroups/rg1/providers/Microsoft.Network/networkInterfaces/nic1"])
        compute.virtual_machines.list_all.return_value = [vm]
        compute.virtual_machines.instance_view.return_value = MagicMock(statuses=[])
        network.network_interfaces.get.side_effect = RuntimeError("network error")

        result = AzureProvider(_config()).fetch_servers()

        assert len(result) == 1
        s = result[0]
        assert s["public_ip"] is None
        assert s["private_ip"] is None

    def test_no_tags_and_no_hardware_profile_and_no_os_type(self, fake_azure_sdk):
        compute = fake_azure_sdk["compute"]
        vm = _vm(tags=None, os_type=None, nic_ids=None)
        vm.hardware_profile = None
        compute.virtual_machines.list_all.return_value = [vm]
        compute.virtual_machines.instance_view.return_value = MagicMock(statuses=[])

        result = AzureProvider(_config()).fetch_servers()

        assert len(result) == 1
        s = result[0]
        assert s["tags"] == {}
        assert s["os"] == "unknown"
        assert s["instance_type"] is None

    def test_multiple_vms_all_mapped(self, fake_azure_sdk):
        compute = fake_azure_sdk["compute"]
        vm1 = _vm(vm_id="/subscriptions/sub-1/resourceGroups/rg1/providers/Microsoft.Compute/virtualMachines/vm1", name="vm1", nic_ids=None)
        vm2 = _vm(vm_id="/subscriptions/sub-1/resourceGroups/rg2/providers/Microsoft.Compute/virtualMachines/vm2", name="vm2", nic_ids=None)
        compute.virtual_machines.list_all.return_value = [vm1, vm2]
        compute.virtual_machines.instance_view.return_value = MagicMock(statuses=[])

        result = AzureProvider(_config()).fetch_servers()

        assert len(result) == 2
        assert {r["name"] for r in result} == {"vm1", "vm2"}


def _disk(disk_id="/subscriptions/sub-1/resourceGroups/rg1/providers/Microsoft.Compute/disks/disk1",
          name="disk1", location="eastus", size_gb=128, sku_name="Premium_LRS",
          managed_by=None, tags=None, disk_state=None, time_created="2024-01-01",
          provisioning_state="Succeeded"):
    disk = MagicMock()
    disk.id = disk_id
    disk.name = name
    disk.location = location
    disk.disk_size_gb = size_gb
    disk.sku = MagicMock(name=sku_name) if sku_name else None
    if sku_name:
        disk.sku.name = sku_name
    disk.managed_by = managed_by
    disk.tags = tags
    disk.disk_state = disk_state
    disk.time_created = time_created
    disk.provisioning_state = provisioning_state
    return disk


class TestFetchBlockStorages:
    def test_sdk_not_installed_returns_empty_list(self):
        with patch.dict(sys.modules, {"azure.identity": None}):
            result = AzureProvider(_config()).fetch_block_storages()
        assert result == []

    def test_full_happy_path_maps_disk(self, fake_azure_sdk):
        compute = fake_azure_sdk["compute"]
        disk = _disk(
            managed_by="/subscriptions/sub-1/resourceGroups/rg1/providers/Microsoft.Compute/virtualMachines/vm1",
            tags={"env": "prod"}, disk_state="Attached",
        )
        compute.disks.list.return_value = [disk]

        result = AzureProvider(_config()).fetch_block_storages()

        assert len(result) == 1
        d = result[0]
        assert d["cloud_id"] == disk.id
        assert d["name"] == "disk1"
        assert d["provider"] == "azure"
        assert d["region"] == "eastus"
        assert d["size_gb"] == pytest.approx(128.0)
        assert d["status"] == "running"
        assert d["attachment"] == "vm1"
        assert d["volume_type"] == "Premium_LRS"
        assert d["tags"] == {"env": "prod"}
        assert d["extra"]["resource_group"] == "rg1"
        assert d["extra"]["disk_state"] == "Attached"
        assert d["extra"]["provisioning_state"] == "Succeeded"

    def test_unattached_disk_with_no_disk_state_is_available(self, fake_azure_sdk):
        compute = fake_azure_sdk["compute"]
        disk = _disk(managed_by=None, disk_state=None)
        compute.disks.list.return_value = [disk]

        result = AzureProvider(_config()).fetch_block_storages()

        assert len(result) == 1
        d = result[0]
        assert d["status"] == "available"
        assert d["attachment"] is None

    def test_attached_disk_with_no_disk_state_falls_back_to_running(self, fake_azure_sdk):
        compute = fake_azure_sdk["compute"]
        disk = _disk(
            managed_by="/subscriptions/sub-1/resourceGroups/rg1/providers/Microsoft.Compute/virtualMachines/vm1",
            disk_state=None,
        )
        compute.disks.list.return_value = [disk]

        result = AzureProvider(_config()).fetch_block_storages()

        assert len(result) == 1
        assert result[0]["status"] == "running"

    def test_missing_size_defaults_to_zero(self, fake_azure_sdk):
        compute = fake_azure_sdk["compute"]
        disk = _disk(size_gb=None)
        compute.disks.list.return_value = [disk]

        result = AzureProvider(_config()).fetch_block_storages()

        assert len(result) == 1
        assert result[0]["size_gb"] == pytest.approx(0.0)

    def test_no_sku_defaults_to_standard(self, fake_azure_sdk):
        compute = fake_azure_sdk["compute"]
        disk = _disk(sku_name=None)
        compute.disks.list.return_value = [disk]

        result = AzureProvider(_config()).fetch_block_storages()

        assert len(result) == 1
        assert result[0]["volume_type"] == "standard"

    def test_no_tags_defaults_to_empty_dict(self, fake_azure_sdk):
        compute = fake_azure_sdk["compute"]
        disk = _disk(tags=None)
        compute.disks.list.return_value = [disk]

        result = AzureProvider(_config()).fetch_block_storages()

        assert len(result) == 1
        assert result[0]["tags"] == {}

    def test_disks_list_exception_returns_empty_list(self, fake_azure_sdk):
        compute = fake_azure_sdk["compute"]
        compute.disks.list.side_effect = RuntimeError("boom")

        result = AzureProvider(_config()).fetch_block_storages()

        assert result == []

    def test_multiple_disks_all_mapped(self, fake_azure_sdk):
        compute = fake_azure_sdk["compute"]
        disk1 = _disk(disk_id="/subscriptions/sub-1/resourceGroups/rg1/providers/Microsoft.Compute/disks/disk1", name="disk1")
        disk2 = _disk(disk_id="/subscriptions/sub-1/resourceGroups/rg2/providers/Microsoft.Compute/disks/disk2", name="disk2")
        compute.disks.list.return_value = [disk1, disk2]

        result = AzureProvider(_config()).fetch_block_storages()

        assert len(result) == 2
        assert {r["name"] for r in result} == {"disk1", "disk2"}
