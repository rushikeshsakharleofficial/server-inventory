"""
Pinning tests for _linode_server_map (backend/app/routers/resource_map.py).
Written before refactoring.
"""
from unittest.mock import MagicMock, patch

from app import models
from app.routers.resource_map import _linode_server_map


def _server(cloud_id="12345"):
    return models.Server(id=1, name="linode-test", provider="linode", cloud_id=cloud_id)


def _resp(ok=True, json_data=None):
    r = MagicMock()
    r.ok = ok
    r.json.return_value = json_data if json_data is not None else {}
    return r


def _default_routes():
    return {
        "/firewalls": _resp(json_data={"data": []}),
        "/nodebalancers": _resp(json_data={"data": []}),
        "/configs": _resp(json_data={"data": []}),
        "/disks": _resp(json_data={"data": []}),
    }


class TestLinodeServerMap:
    def test_full_instance_produces_all_node_types(self):
        server = _server()

        def fake_get(url, headers=None, timeout=None):
            if "/firewalls" in url:
                return _resp(json_data={"data": [{"id": 1, "label": "web-fw", "status": "enabled", "rules": {"inbound_policy": "DROP"}}]})
            if "/nodebalancers/10/configs/20/nodes" in url:
                return _resp(json_data={"data": [{"address": "12345:80"}]})
            if "/nodebalancers/10/configs" in url:
                return _resp(json_data={"data": [{"id": 20}]})
            if "/nodebalancers" in url:
                return _resp(json_data={"data": [{"id": 10, "label": "my-nb", "ipv4": "1.2.3.4", "hostname": "nb.example.com"}]})
            if "/disks" in url:
                return _resp(json_data={"data": [{"id": 100, "label": "boot-disk", "size": 20480, "filesystem": "ext4"}]})
            if "/instances/12345/configs" in url:
                return _resp(json_data={"data": [{"interfaces": [{"purpose": "vlan", "label": "vlan1", "ipam_address": "10.0.0.1/24"}]}]})
            return _resp(json_data={})

        with patch("requests.get", side_effect=fake_get):
            result = _linode_server_map(server, {"api_token": "tok"})

        node_types = {n["type"] for n in result["nodes"]}
        assert "firewall" in node_types
        assert "load_balancer" in node_types
        assert "vlan" in node_types
        assert "disk" in node_types

    def test_instance_fetch_not_ok_returns_empty_graph(self):
        server = _server()
        with patch("requests.get", return_value=_resp(ok=False)):
            result = _linode_server_map(server, {"api_token": "tok"})
        assert result == {"nodes": [], "edges": []}

    def test_nodebalancer_not_matching_this_server_excluded(self):
        server = _server(cloud_id="12345")

        def fake_get(url, headers=None, timeout=None):
            if "/nodebalancers/10/configs/20/nodes" in url:
                return _resp(json_data={"data": [{"address": "99999:80"}]})
            if "/nodebalancers/10/configs" in url:
                return _resp(json_data={"data": [{"id": 20}]})
            if "/nodebalancers" in url:
                return _resp(json_data={"data": [{"id": 10, "label": "my-nb"}]})
            return _resp(json_data={"data": []})

        with patch("requests.get", side_effect=fake_get):
            result = _linode_server_map(server, {"api_token": "tok"})

        assert not any(n["type"] == "load_balancer" for n in result["nodes"])

    def test_non_vlan_interfaces_excluded(self):
        server = _server()
        routes = {
            "/configs": _resp(json_data={"data": [{"interfaces": [{"purpose": "public"}]}]}),
        }

        def fake_get(url, headers=None, timeout=None):
            for key, resp in routes.items():
                if key in url:
                    return resp
            return _resp(json_data={"data": []})

        with patch("requests.get", side_effect=fake_get):
            result = _linode_server_map(server, {"api_token": "tok"})

        assert not any(n["type"] == "vlan" for n in result["nodes"])

    def test_disks_truncated_to_four(self):
        server = _server()
        disks = [{"id": i, "label": f"disk{i}", "size": 1000, "filesystem": "ext4"} for i in range(6)]
        routes = {"/disks": _resp(json_data={"data": disks})}

        def fake_get(url, headers=None, timeout=None):
            for key, resp in routes.items():
                if key in url:
                    return resp
            return _resp(json_data={"data": []})

        with patch("requests.get", side_effect=fake_get):
            result = _linode_server_map(server, {"api_token": "tok"})

        disk_nodes = [n for n in result["nodes"] if n["type"] == "disk"]
        assert len(disk_nodes) == 4

    def test_exception_during_fetch_returns_partial_graph_not_raise(self):
        server = _server()
        with patch("requests.get", side_effect=RuntimeError("boom")):
            result = _linode_server_map(server, {"api_token": "tok"})
        assert result == {"nodes": [], "edges": []}
