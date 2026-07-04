"""
Pinning tests for GCPProvider.fetch_servers and fetch_block_storages
(backend/app/providers/gcp.py). Written before refactoring.
"""
import sys
import types
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from app.providers.gcp import GCPProvider


def _config(**overrides):
    defaults = {"project_id": "proj-1", "service_account_json": None}
    defaults.update(overrides)
    return defaults


@pytest.fixture
def fake_gcp_modules():
    compute_v1 = types.ModuleType("google.cloud.compute_v1")
    compute_v1.InstancesClient = MagicMock()
    compute_v1.DisksClient = MagicMock()
    compute_v1.AggregatedListInstancesRequest = MagicMock(side_effect=lambda **kw: kw)
    compute_v1.AggregatedListDisksRequest = MagicMock(side_effect=lambda **kw: kw)

    service_account = types.ModuleType("google.oauth2.service_account")
    service_account.Credentials = MagicMock()

    google_cloud = types.ModuleType("google.cloud")
    google_cloud.compute_v1 = compute_v1
    google_oauth2 = types.ModuleType("google.oauth2")
    google_oauth2.service_account = service_account
    google_pkg = types.ModuleType("google")
    google_pkg.cloud = google_cloud
    google_pkg.oauth2 = google_oauth2

    modules = {
        "google": google_pkg,
        "google.cloud": google_cloud,
        "google.cloud.compute_v1": compute_v1,
        "google.oauth2": google_oauth2,
        "google.oauth2.service_account": service_account,
    }
    with patch.dict(sys.modules, modules):
        yield compute_v1


def _instance(**overrides):
    defaults = dict(
        id=123, name="vm-1", machine_type="zones/us-central1-a/machineTypes/e2-medium",
        status="RUNNING", labels={"env": "prod"}, creation_timestamp="2024-01-01",
        network_interfaces=[],
    )
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


def _iface(private_ip=None, public_ip=None):
    access_configs = [SimpleNamespace(nat_i_p=public_ip)] if public_ip else []
    return SimpleNamespace(network_i_p=private_ip, access_configs=access_configs)


class TestGcpFetchServers:
    def test_module_not_installed_raises_runtime_error(self):
        with patch.dict(sys.modules, {"google.cloud": None}):
            provider = GCPProvider(_config())
            with pytest.raises(RuntimeError, match="google-cloud-compute not installed"):
                provider.fetch_servers()

    def test_full_instance_produces_server_dict(self, fake_gcp_modules):
        inst = _instance(network_interfaces=[_iface(private_ip="10.0.0.5", public_ip="34.1.2.3")])
        response = SimpleNamespace(instances=[inst])
        fake_gcp_modules.InstancesClient.return_value.aggregated_list.return_value = [("zones/us-central1-a", response)]

        result = GCPProvider(_config()).fetch_servers()

        assert len(result) == 1
        srv = result[0]
        assert srv["cloud_id"] == "123"
        assert srv["public_ip"] == "34.1.2.3"
        assert srv["private_ip"] == "10.0.0.5"
        assert srv["region"] == "us-central1"
        assert srv["zone"] == "us-central1-a"
        assert srv["instance_type"] == "e2-medium"
        assert srv["status"] == "running"

    def test_response_without_instances_attr_skipped(self, fake_gcp_modules):
        response = SimpleNamespace()  # no .instances attribute
        fake_gcp_modules.InstancesClient.return_value.aggregated_list.return_value = [("zones/us-central1-a", response)]

        result = GCPProvider(_config()).fetch_servers()
        assert result == []

    def test_service_account_json_uses_credentials(self, fake_gcp_modules):
        response = SimpleNamespace(instances=[])
        fake_gcp_modules.InstancesClient.return_value.aggregated_list.return_value = [("zones/us-central1-a", response)]

        GCPProvider(_config(service_account_json={"type": "service_account"})).fetch_servers()

        _, kwargs = fake_gcp_modules.InstancesClient.call_args
        assert "credentials" in kwargs


class TestGcpFetchBlockStorages:
    def test_module_not_installed_returns_empty_list(self):
        with patch.dict(sys.modules, {"google.cloud": None}):
            result = GCPProvider(_config()).fetch_block_storages()
        assert result == []

    def test_full_disk_produces_storage_dict(self, fake_gcp_modules):
        disk = SimpleNamespace(
            id=999, name="disk-1", type_="projects/p/zones/z/diskTypes/pd-ssd",
            users=["projects/p/zones/z/instances/vm-1"], size_gb=100,
            status="READY", labels={"env": "prod"}, creation_timestamp="2024-01-01",
            last_attach_timestamp="2024-01-02",
        )
        response = SimpleNamespace(disks=[disk])
        fake_gcp_modules.DisksClient.return_value.aggregated_list.return_value = [("zones/us-central1-a", response)]

        result = GCPProvider(_config()).fetch_block_storages()

        assert len(result) == 1
        vol = result[0]
        assert vol["cloud_id"] == "999"
        assert vol["volume_type"] == "pd-ssd"
        assert vol["attachment"] == "vm-1"
        assert vol["status"] == "running"  # attached disks always "running" regardless of status_map
        assert vol["size_gb"] == 100.0

    def test_unattached_disk_uses_status_map(self, fake_gcp_modules):
        disk = SimpleNamespace(
            id=1000, name="disk-2", type_="", users=[], size_gb=50, status="CREATING", labels=None,
        )
        response = SimpleNamespace(disks=[disk])
        fake_gcp_modules.DisksClient.return_value.aggregated_list.return_value = [("zones/us-central1-a", response)]

        result = GCPProvider(_config()).fetch_block_storages()
        assert result[0]["status"] == "pending"
        assert result[0]["attachment"] is None

    def test_aggregated_list_exception_returns_empty_list_not_raise(self, fake_gcp_modules):
        fake_gcp_modules.DisksClient.return_value.aggregated_list.side_effect = RuntimeError("boom")

        result = GCPProvider(_config()).fetch_block_storages()
        assert result == []
