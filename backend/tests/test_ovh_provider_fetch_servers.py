"""
Pinning tests for OVHProvider.fetch_servers (backend/app/providers/ovh.py).
Written before refactoring. The `ovh` package is imported inside the
function, so tests inject a fake module via sys.modules.
"""
import sys
import types
from unittest.mock import MagicMock, patch

import pytest

from app.providers.ovh import OVHProvider


def _config():
    return {
        "endpoint": "ovh-eu", "application_key": "ak", "application_secret": "as",
        "consumer_key": "ck",
    }


@pytest.fixture
def fake_ovh_module():
    fake_module = types.ModuleType("ovh")
    fake_module.Client = MagicMock()
    with patch.dict(sys.modules, {"ovh": fake_module}):
        yield fake_module


def _mock_client(routes: dict):
    client = MagicMock()

    def fake_get(path):
        # exact match first, then longest-prefix match — avoids a short
        # registered path (e.g. "/cloud/project") shadowing a more specific
        # one ("/cloud/project/proj1/instance") registered later.
        if path in routes:
            value = routes[path]
            return value(path) if callable(value) else value
        best_prefix = None
        for prefix in routes:
            if path.startswith(prefix + "/") and (best_prefix is None or len(prefix) > len(best_prefix)):
                best_prefix = prefix
        if best_prefix is not None:
            value = routes[best_prefix]
            return value(path) if callable(value) else value
        raise KeyError(f"unmocked path: {path}")

    client.get.side_effect = fake_get
    return client


class TestOvhFetchServersAuth:
    def test_ovh_package_not_installed_raises_runtime_error(self):
        with patch.dict(sys.modules, {"ovh": None}):
            provider = OVHProvider(_config())
            with pytest.raises(RuntimeError, match="ovh package not installed"):
                provider.fetch_servers()

    def test_auth_failure_with_credential_keyword_raises_friendly_message(self, fake_ovh_module):
        client = MagicMock()
        client.get.side_effect = RuntimeError("Invalid application key")
        fake_ovh_module.Client.return_value = client

        provider = OVHProvider(_config())
        with pytest.raises(RuntimeError, match="OVH authentication failed"):
            provider.fetch_servers()

    def test_auth_failure_without_credential_keyword_reraises_original(self, fake_ovh_module):
        client = MagicMock()
        client.get.side_effect = RuntimeError("network timeout")
        fake_ovh_module.Client.return_value = client

        provider = OVHProvider(_config())
        with pytest.raises(RuntimeError, match="network timeout"):
            provider.fetch_servers()


class TestOvhFetchServersDedicated:
    def test_dedicated_server_ok_state_poweron_is_running(self, fake_ovh_module):
        routes = {
            "/me": {},
            "/dedicated/server": ["srv1"],
            "/dedicated/server/srv1": {"state": "ok", "powerState": "poweron", "ip": "1.2.3.4", "name": "srv1"},
            "/dedicated/server/srv1/install/status": {"templateName": "ubuntu2204-server"},
            "/vps": [],
            "/cloud/project": [],
        }
        fake_ovh_module.Client.return_value = _mock_client(routes)

        result = OVHProvider(_config()).fetch_servers()

        assert len(result) == 1
        assert result[0]["status"] == "running"
        assert result[0]["public_ip"] == "1.2.3.4"
        assert result[0]["extra"]["type"] == "dedicated"

    def test_dedicated_server_ok_state_poweroff_is_stopped(self, fake_ovh_module):
        routes = {
            "/me": {},
            "/dedicated/server": ["srv1"],
            "/dedicated/server/srv1": {"state": "ok", "powerState": "poweroff", "ip": "1.2.3.4", "name": "srv1"},
            "/dedicated/server/srv1/install/status": {},
            "/vps": [],
            "/cloud/project": [],
        }
        fake_ovh_module.Client.return_value = _mock_client(routes)

        result = OVHProvider(_config()).fetch_servers()
        assert result[0]["status"] == "stopped"

    def test_one_dedicated_server_failure_does_not_abort_others(self, fake_ovh_module):
        def detail_fetch(path):
            if path == "/dedicated/server/bad":
                raise RuntimeError("boom")
            return {"state": "ok", "powerState": "poweron", "ip": "5.6.7.8", "name": "good"}

        routes = {
            "/me": {},
            "/dedicated/server": ["good", "bad"],
            "/dedicated/server/good": detail_fetch,
            "/dedicated/server/good/install/status": {},
            "/dedicated/server/bad": detail_fetch,
            "/vps": [],
            "/cloud/project": [],
        }
        fake_ovh_module.Client.return_value = _mock_client(routes)

        result = OVHProvider(_config()).fetch_servers()
        assert len(result) == 1
        assert result[0]["name"] == "good"


class TestOvhFetchServersVps:
    def test_vps_instance_produces_server_dict(self, fake_ovh_module):
        routes = {
            "/me": {},
            "/dedicated/server": [],
            "/vps": ["vps1"],
            "/vps/vps1": {"displayName": "my-vps", "zone": "GRA", "vcore": 2, "memoryLimit": 4096, "model": {"offer": "VPS-2", "disk": 40}, "state": "running"},
            "/vps/vps1/ips": ["1.2.3.4", "10.0.0.5"],
            "/vps/vps1/distribution": {"name": "ubuntu2204"},
            "/cloud/project": [],
        }
        fake_ovh_module.Client.return_value = _mock_client(routes)

        result = OVHProvider(_config()).fetch_servers()

        assert len(result) == 1
        vps = result[0]
        assert vps["public_ip"] == "1.2.3.4"
        assert vps["private_ip"] == "10.0.0.5"
        assert vps["vcpu"] == 2
        assert vps["memory_gb"] == 4.0
        assert vps["extra"]["type"] == "vps"

    def test_vps_list_404_is_silently_ignored(self, fake_ovh_module):
        def vps_list_fetch(path):
            raise RuntimeError("404 Not Found ResourceNotFound")

        routes = {
            "/me": {},
            "/dedicated/server": [],
            "/vps": vps_list_fetch,
            "/cloud/project": [],
        }
        fake_ovh_module.Client.return_value = _mock_client(routes)

        result = OVHProvider(_config()).fetch_servers()
        assert result == []


class TestOvhFetchServersCloud:
    def test_cloud_instance_produces_server_dict(self, fake_ovh_module):
        routes = {
            "/me": {},
            "/dedicated/server": [],
            "/vps": [],
            "/cloud/project": ["proj1"],
            "/cloud/project/proj1/instance": [
                {
                    "id": "inst-1", "name": "cloud-vm", "region": "GRA9", "status": "ACTIVE",
                    "flavor": {"name": "b2-7", "vcpus": 2, "ram": 7168, "disk": 50},
                    "image": {"name": "Ubuntu 22.04"},
                    "ipAddresses": [{"type": "public", "ip": "1.2.3.4"}, {"type": "private", "ip": "10.0.0.5"}],
                }
            ],
        }
        fake_ovh_module.Client.return_value = _mock_client(routes)

        result = OVHProvider(_config()).fetch_servers()

        assert len(result) == 1
        cloud = result[0]
        assert cloud["public_ip"] == "1.2.3.4"
        assert cloud["private_ip"] == "10.0.0.5"
        assert cloud["extra"]["type"] == "cloud"
        assert cloud["extra"]["project_id"] == "proj1"


class TestOvhFetchServersErrorAggregation:
    def test_all_sections_fail_raises_runtime_error_with_aggregated_message(self, fake_ovh_module):
        def dedicated_fetch(path):
            raise RuntimeError("dedicated boom")

        def vps_fetch(path):
            raise RuntimeError("vps boom")

        def cloud_fetch(path):
            raise RuntimeError("cloud boom")

        routes = {
            "/me": {},
            "/dedicated/server": dedicated_fetch,
            "/vps": vps_fetch,
            "/cloud/project": cloud_fetch,
        }
        fake_ovh_module.Client.return_value = _mock_client(routes)

        with pytest.raises(RuntimeError) as exc_info:
            OVHProvider(_config()).fetch_servers()
        assert "boom" in str(exc_info.value)
