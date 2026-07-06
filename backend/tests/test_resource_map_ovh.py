"""
Tests for _ovh_server_map (backend/app/routers/resource_map.py).

Originally written as pinning tests against the raw-HTTP+SHA1-signing
implementation (patching requests.get). That implementation was replaced
with the OVH SDK client (which signs internally, removing our own SHA1
call) — these tests now inject a fake SDK client instead, but keep the
same per-test assertions as the original pins, so they still verify the
same graph-building behavior.

One real behavior difference from the original: the SDK raises a typed
exception (ovh.exceptions.APIError and subclasses) on any non-2xx or
network failure instead of returning a response with .ok=False. The
_ovh_sdk_get adapter in resource_map.py catches APIError and translates
it back to an .ok=False response so the _ovh_append_* helpers below are
unaffected — but a raised APIError with no attached response (e.g. a bare
network failure) now means "this one call failed", not necessarily
"abort the whole map", the way a caught RuntimeError used to via the
outer try/except. The all-calls-fail test still asserts an empty graph,
because the primary resource lookup failing already short-circuits
before any node is appended — so that assertion still holds either way.
"""
import sys
import types
from unittest.mock import MagicMock, patch

import pytest

from app import models
from app.routers.resource_map import _ovh_server_map


def _server(instance_type="dedicated", cloud_id="ns123456.ip-1-2-3.eu"):
    return models.Server(
        id=1, name="ovh-test", provider="ovh", cloud_id=cloud_id, instance_type=instance_type
    )


def _config():
    return {
        "application_key": "ak",
        "application_secret": "as",
        "consumer_key": "ck",
        "endpoint": "ovh-eu",
    }


@pytest.fixture
def fake_ovh_module():
    import ovh.exceptions as real_ovh_exc

    fake_module = types.ModuleType("ovh")
    fake_module.Client = MagicMock()
    fake_module.ENDPOINTS = {"ovh-eu": "...", "ovh-us": "...", "ovh-ca": "..."}
    fake_module.exceptions = real_ovh_exc
    with patch.dict(sys.modules, {"ovh": fake_module, "ovh.exceptions": real_ovh_exc}):
        yield fake_module


def _mock_client(fake_get):
    """fake_get(path) -> data on success, or raise ovh.exceptions.APIError on failure."""
    client = MagicMock()
    client.get.side_effect = fake_get
    return client


class TestOvhServerMapDedicated:
    def test_all_apis_succeed_produces_full_graph(self, fake_ovh_module):
        server = _server(instance_type="dedicated")

        def fake_get(path):
            if path.endswith("/ips"):
                return ["1.2.3.4"]
            if "type=failover" in path:
                return ["5.6.7.8/32"]
            if "/ip/5.6.7.8" in path:
                return {"routedTo": {"serviceName": "ns123456.ip-1-2-3.eu"}}
            if path.endswith("/vrack"):
                return {"vrack": "pn-123", "mode": "routed", "taskState": "ready"}
            if path.endswith("/features/ipmi"):
                return {"activated": True}
            if path.endswith("/backupCloudOfferDetails"):
                return {"quotaUsed": 10, "quotaTotal": 100}
            if "routedTo=" in path:
                return []
            if "/ip/" in path and "/firewall" in path:
                return []
            return {}

        fake_ovh_module.Client.return_value = _mock_client(fake_get)

        result = _ovh_server_map(server, _config())

        node_types = {n["type"] for n in result["nodes"]}
        assert "public_ip" in node_types
        assert "elastic_ip" in node_types
        assert "vpc_network" in node_types
        assert "backup" in node_types
        assert "network_interface" in node_types
        assert len(result["edges"]) == len(result["nodes"])

    def test_failed_primary_lookup_returns_empty_graph(self, fake_ovh_module):
        import ovh.exceptions as ovh_exc

        server = _server()

        def fake_get(path):
            raise ovh_exc.ResourceNotFoundError("not found")

        fake_ovh_module.Client.return_value = _mock_client(fake_get)

        result = _ovh_server_map(server, _config())
        assert result == {"nodes": [], "edges": []}

    def test_exception_during_fetch_returns_partial_graph_not_raise(self, fake_ovh_module):
        def fake_get(path):
            raise RuntimeError("network exploded")

        fake_ovh_module.Client.return_value = _mock_client(fake_get)

        result = _ovh_server_map(server=_server(), config=_config())
        assert result == {"nodes": [], "edges": []}

    def test_failover_ip_not_routed_to_this_server_excluded(self, fake_ovh_module):
        import ovh.exceptions as ovh_exc

        server = _server()

        def fake_get(path):
            if path.endswith("/ips"):
                return []
            if "type=failover" in path:
                return ["9.9.9.9/32"]
            if "/ip/9.9.9.9" in path:
                return {"routedTo": {"serviceName": "some-other-server"}}
            raise ovh_exc.ResourceNotFoundError("not found")

        fake_ovh_module.Client.return_value = _mock_client(fake_get)

        result = _ovh_server_map(server, _config())

        assert not any(n["type"] == "elastic_ip" for n in result["nodes"])


class TestOvhServerMapVps:
    def test_vps_path_uses_vps_endpoints_not_dedicated(self, fake_ovh_module):
        server = _server(instance_type="VPS-SSD-2")
        calls = []

        def fake_get(path):
            calls.append(path)
            if path.endswith("/snapshot"):
                return {"creationDate": "2026-01-01"}
            if path.endswith("/option"):
                return ["automated-backup"]
            if path.endswith("/ips") or "type=failover" in path:
                return []
            # primary resource lookup (/vps/{server_name}) and anything else: ok, empty
            return {}

        fake_ovh_module.Client.return_value = _mock_client(fake_get)

        result = _ovh_server_map(server, _config())

        assert any("/vps/" in c for c in calls)
        assert not any("/dedicated/server/" in c and "/vrack" in c for c in calls)
        node_types = {n["type"] for n in result["nodes"]}
        assert "disk" in node_types
        assert "addon" in node_types
