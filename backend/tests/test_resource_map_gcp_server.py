"""
Pinning tests for _gcp_server_map (backend/app/routers/resource_map.py),
complexity 64 vs 15 allowed. Written before refactoring.
"""
from unittest.mock import MagicMock, patch

from app import models
from app.routers.resource_map import _gcp_server_map


def _server(cloud_id="instance-1", zone="us-central1-a"):
    return models.Server(id=1, name="gcp-test", provider="gcp", cloud_id=cloud_id, zone=zone)


def _resp(ok=True, json_data=None):
    r = MagicMock()
    r.ok = ok
    r.json.return_value = json_data if json_data is not None else {}
    return r


class TestGcpServerMap:
    def test_full_instance_produces_all_node_types(self):
        server = _server()
        instance_data = {
            "networkInterfaces": [
                {
                    "network": "projects/p/global/networks/default",
                    "subnetwork": "projects/p/regions/us-central1/subnetworks/default",
                    "networkIP": "10.0.0.5",
                    "aliasIpRanges": [{"ipCidrRange": "10.1.0.0/24", "subnetworkRangeName": "r1"}],
                    "accessConfigs": [{"natIP": "34.1.2.3", "type": "ONE_TO_ONE_NAT", "name": "external-nat"}],
                }
            ],
            "serviceAccounts": [{"email": "sa@p.iam.gserviceaccount.com", "scopes": ["cloud-platform"]}],
            "tags": {"items": ["web-server"]},
            "disks": [{"source": ".../disks/boot-disk", "boot": True, "type": "PERSISTENT", "mode": "READ_WRITE"}],
        }
        fw_data = {"items": [{"name": "allow-web", "targetTags": ["web-server"], "direction": "INGRESS", "priority": 1000}]}

        def fake_get(url, headers=None, timeout=None):
            if "/firewalls" in url:
                return _resp(json_data=fw_data)
            return _resp(json_data=instance_data)

        with patch("app.routers.resource_map._gcp_token", return_value=("tok", "proj")), \
             patch("requests.get", side_effect=fake_get):
            result = _gcp_server_map(server, {"service_account_json": {}})

        node_types = {n["type"] for n in result["nodes"]}
        assert "vpc_network" in node_types
        assert "subnetwork" in node_types
        assert "elastic_ip" in node_types
        assert "subnet" in node_types  # alias IP range
        assert "external_ip" in node_types
        assert "service_account" in node_types
        assert "firewall_rule" in node_types
        assert "disk" in node_types

    def test_firewall_not_matching_tags_excluded(self):
        server = _server()
        instance_data = {
            "networkInterfaces": [],
            "serviceAccounts": [],
            "tags": {"items": ["db-server"]},
            "disks": [],
        }
        fw_data = {"items": [{"name": "allow-web", "targetTags": ["web-server"], "direction": "INGRESS", "priority": 1000}]}

        def fake_get(url, headers=None, timeout=None):
            if "/firewalls" in url:
                return _resp(json_data=fw_data)
            return _resp(json_data=instance_data)

        with patch("app.routers.resource_map._gcp_token", return_value=("tok", "proj")), \
             patch("requests.get", side_effect=fake_get):
            result = _gcp_server_map(server, {"service_account_json": {}})

        assert not any(n["type"] == "firewall_rule" for n in result["nodes"])

    def test_no_tags_skips_firewall_lookup_entirely(self):
        server = _server()
        instance_data = {"networkInterfaces": [], "serviceAccounts": [], "tags": {}, "disks": []}
        calls = []

        def fake_get(url, headers=None, timeout=None):
            calls.append(url)
            return _resp(json_data=instance_data)

        with patch("app.routers.resource_map._gcp_token", return_value=("tok", "proj")), \
             patch("requests.get", side_effect=fake_get):
            _gcp_server_map(server, {"service_account_json": {}})

        assert not any("/firewalls" in c for c in calls)

    def test_token_failure_returns_empty_graph(self):
        server = _server()
        with patch("app.routers.resource_map._gcp_token", side_effect=RuntimeError("bad creds")):
            result = _gcp_server_map(server, {"service_account_json": {}})
        assert result == {"nodes": [], "edges": []}

    def test_no_cloud_id_or_zone_skips_instance_fetch(self):
        server = _server(cloud_id=None, zone=None)
        server.region = None
        with patch("app.routers.resource_map._gcp_token", return_value=("tok", "proj")), \
             patch("requests.get") as mock_get:
            result = _gcp_server_map(server, {"service_account_json": {}})
        mock_get.assert_not_called()
        assert result == {"nodes": [], "edges": []}

    def test_instance_fetch_failure_returns_empty_graph(self):
        server = _server()
        with patch("app.routers.resource_map._gcp_token", return_value=("tok", "proj")), \
             patch("requests.get", return_value=_resp(ok=False)):
            result = _gcp_server_map(server, {"service_account_json": {}})
        assert result == {"nodes": [], "edges": []}

    def test_exception_during_parsing_returns_partial_graph(self):
        server = _server()
        with patch("app.routers.resource_map._gcp_token", return_value=("tok", "proj")), \
             patch("requests.get", side_effect=RuntimeError("boom")):
            result = _gcp_server_map(server, {"service_account_json": {}})
        assert result == {"nodes": [], "edges": []}
