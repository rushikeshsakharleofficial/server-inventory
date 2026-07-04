"""
Pinning tests for _do_server_map (backend/app/routers/resource_map.py).
Written before refactoring.
"""
from unittest.mock import MagicMock, patch

from app import models
from app.routers.resource_map import _do_server_map


def _server(cloud_id="12345"):
    return models.Server(id=1, name="do-test", provider="digitalocean", cloud_id=cloud_id)


def _resp(ok=True, json_data=None):
    r = MagicMock()
    r.ok = ok
    r.json.return_value = json_data if json_data is not None else {}
    return r


class TestDoServerMap:
    def test_full_droplet_produces_all_node_types(self):
        server = _server()
        droplet_data = {"droplet": {"vpc_uuid": "vpc-1", "tags": ["web"]}}
        vpc_data = {"vpc": {"name": "default-vpc", "ip_range": "10.0.0.0/16", "region": "nyc1"}}
        fip_data = {"floating_ips": [{"droplet": {"id": 12345}, "ip": "1.2.3.4", "region": {"slug": "nyc1"}}]}
        fw_data = {"firewalls": [{"id": "fw-1", "name": "web-fw", "status": "active", "droplet_ids": [{"droplet_id": 12345}], "inbound_rules": [1], "outbound_rules": [1, 2]}]}
        lb_data = {"load_balancers": [{"id": "lb-1", "name": "my-lb", "droplet_ids": [12345], "ip": "5.6.7.8", "algorithm": "round_robin"}]}

        def fake_get(url, headers=None, timeout=None):
            if "/vpcs/" in url:
                return _resp(json_data=vpc_data)
            if "/floating_ips" in url:
                return _resp(json_data=fip_data)
            if "/firewalls" in url:
                return _resp(json_data=fw_data)
            if "/load_balancers" in url:
                return _resp(json_data=lb_data)
            return _resp(json_data=droplet_data)

        with patch("requests.get", side_effect=fake_get):
            result = _do_server_map(server, {"api_token": "tok"})

        node_types = {n["type"] for n in result["nodes"]}
        assert "vpc" in node_types
        assert "floating_ip" in node_types
        assert "firewall" in node_types
        assert "load_balancer" in node_types
        assert "tag" in node_types

    def test_droplet_fetch_not_ok_returns_empty_graph(self):
        server = _server()
        with patch("requests.get", return_value=_resp(ok=False)):
            result = _do_server_map(server, {"api_token": "tok"})
        assert result == {"nodes": [], "edges": []}

    def test_no_vpc_uuid_skips_vpc_lookup(self):
        server = _server()
        droplet_data = {"droplet": {"tags": []}}

        def fake_get(url, headers=None, timeout=None):
            if "/vpcs/" in url:
                raise AssertionError("should not be called")
            return _resp(json_data=droplet_data)

        with patch("requests.get", side_effect=fake_get):
            result = _do_server_map(server, {"api_token": "tok"})

        assert not any(n["type"] == "vpc" for n in result["nodes"])

    def test_floating_ip_not_matching_droplet_id_excluded(self):
        server = _server(cloud_id="12345")
        droplet_data = {"droplet": {"tags": []}}
        fip_data = {"floating_ips": [{"droplet": {"id": 99999}, "ip": "9.9.9.9"}]}

        def fake_get(url, headers=None, timeout=None):
            if "/floating_ips" in url:
                return _resp(json_data=fip_data)
            return _resp(json_data=droplet_data)

        with patch("requests.get", side_effect=fake_get):
            result = _do_server_map(server, {"api_token": "tok"})

        assert not any(n["type"] == "floating_ip" for n in result["nodes"])

    def test_firewall_not_matching_droplet_excluded(self):
        server = _server(cloud_id="12345")
        droplet_data = {"droplet": {"tags": []}}
        fw_data = {"firewalls": [{"id": "fw-1", "name": "web-fw", "droplet_ids": [{"droplet_id": 99999}]}]}

        def fake_get(url, headers=None, timeout=None):
            if "/firewalls" in url:
                return _resp(json_data=fw_data)
            return _resp(json_data=droplet_data)

        with patch("requests.get", side_effect=fake_get):
            result = _do_server_map(server, {"api_token": "tok"})

        assert not any(n["type"] == "firewall" for n in result["nodes"])

    def test_exception_during_fetch_returns_partial_graph_not_raise(self):
        server = _server()
        with patch("requests.get", side_effect=RuntimeError("boom")):
            result = _do_server_map(server, {"api_token": "tok"})
        assert result == {"nodes": [], "edges": []}
