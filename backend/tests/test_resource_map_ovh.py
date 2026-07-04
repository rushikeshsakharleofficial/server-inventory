"""
Pinning tests for _ovh_server_map (backend/app/routers/resource_map.py),
complexity 69 vs 15 allowed. Written before refactoring — must pass against
the original implementation first.
"""
from unittest.mock import MagicMock, patch

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


def _resp(ok=True, json_data=None):
    r = MagicMock()
    r.ok = ok
    r.json.return_value = json_data if json_data is not None else {}
    return r


class TestOvhServerMapDedicated:
    def test_all_apis_succeed_produces_full_graph(self):
        server = _server(instance_type="dedicated")

        def fake_get(url, headers=None, timeout=None):
            if url.endswith("/ips"):
                return _resp(json_data=["1.2.3.4"])
            if "type=failover" in url:
                return _resp(json_data=["5.6.7.8/32"])
            if "/ip/5.6.7.8" in url:
                return _resp(json_data={"routedTo": {"serviceName": "ns123456.ip-1-2-3.eu"}})
            if url.endswith("/vrack"):
                return _resp(json_data={"vrack": "pn-123", "mode": "routed", "taskState": "ready"})
            if url.endswith("/features/ipmi"):
                return _resp(json_data={"activated": True})
            if url.endswith("/backupCloudOfferDetails"):
                return _resp(json_data={"quotaUsed": 10, "quotaTotal": 100})
            if "routedTo=" in url:
                return _resp(json_data=[])
            if "/ip/" in url and "/firewall" in url:
                return _resp(json_data=[])
            return _resp(json_data={})

        with patch("requests.get", side_effect=fake_get):
            result = _ovh_server_map(server, _config())

        node_types = {n["type"] for n in result["nodes"]}
        assert "public_ip" in node_types
        assert "elastic_ip" in node_types
        assert "vpc_network" in node_types
        assert "backup" in node_types
        assert "network_interface" in node_types
        assert len(result["edges"]) == len(result["nodes"])

    def test_failed_primary_lookup_returns_empty_graph(self):
        server = _server()
        with patch("requests.get", return_value=_resp(ok=False)):
            result = _ovh_server_map(server, _config())
        assert result == {"nodes": [], "edges": []}

    def test_exception_during_fetch_returns_partial_graph_not_raise(self):
        server = _server()
        with patch("requests.get", side_effect=RuntimeError("network exploded")):
            result = _ovh_server_map(server, _config())
        assert result == {"nodes": [], "edges": []}

    def test_failover_ip_not_routed_to_this_server_excluded(self):
        server = _server()

        def fake_get(url, headers=None, timeout=None):
            if url.endswith("/ips"):
                return _resp(json_data=[])
            if "type=failover" in url:
                return _resp(json_data=["9.9.9.9/32"])
            if "/ip/9.9.9.9" in url:
                return _resp(json_data={"routedTo": {"serviceName": "some-other-server"}})
            return _resp(ok=False)

        with patch("requests.get", side_effect=fake_get):
            result = _ovh_server_map(server, _config())

        assert not any(n["type"] == "elastic_ip" for n in result["nodes"])


class TestOvhServerMapVps:
    def test_vps_path_uses_vps_endpoints_not_dedicated(self):
        server = _server(instance_type="VPS-SSD-2")
        calls = []

        def fake_get(url, headers=None, timeout=None):
            calls.append(url)
            if url.endswith("/snapshot"):
                return _resp(json_data={"creationDate": "2026-01-01"})
            if url.endswith("/option"):
                return _resp(json_data=["automated-backup"])
            if url.endswith("/ips") or "type=failover" in url:
                return _resp(json_data=[])
            # primary resource lookup (/vps/{server_name}) and anything else: ok, empty
            return _resp(json_data={})

        with patch("requests.get", side_effect=fake_get):
            result = _ovh_server_map(server, _config())

        assert any("/vps/" in c for c in calls)
        assert not any("/dedicated/server/" in c and "/vrack" in c for c in calls)
        node_types = {n["type"] for n in result["nodes"]}
        assert "disk" in node_types
        assert "addon" in node_types
