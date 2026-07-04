"""
Pinning tests for _linode_kubernetes_map (backend/app/routers/resource_map.py).
Written before refactoring.
"""
from unittest.mock import MagicMock, patch

from app import models
from app.routers.resource_map import _linode_kubernetes_map


def _cluster(cloud_id="12345"):
    return models.KubernetesCluster(id=1, name="lke-test", provider="linode", cloud_id=cloud_id)


def _resp(ok=True, json_data=None):
    r = MagicMock()
    r.ok = ok
    r.json.return_value = json_data if json_data is not None else {}
    return r


def _cluster_data(**overrides):
    data = {"control_plane": {"high_availability": True, "acl": True}, "tags": ["prod"]}
    data.update(overrides)
    return data


class TestLinodeKubernetesMap:
    def test_full_cluster_produces_all_node_types(self):
        cluster = _cluster()

        def fake_get(url, headers=None, timeout=None):
            if "/pools" in url:
                return _resp(json_data={"data": [{"id": 1, "type": "g6-standard-2", "count": 2, "disk_encryption": "enabled",
                                                    "nodes": [{"id": "node-abc12345", "status": "ready", "instance_id": "inst-1"}]}]})
            if "/api-endpoints" in url:
                return _resp(json_data={"data": [{"endpoint": "https://api.example.com"}]})
            if "/dashboard" in url:
                return _resp(json_data={"url": "https://dash.example.com"})
            return _resp(json_data=_cluster_data())

        with patch("requests.get", side_effect=fake_get):
            result = _linode_kubernetes_map(cluster, {"api_token": "tok"})

        node_types = {n["type"] for n in result["nodes"]}
        assert "node_pool" in node_types
        assert "network_interface" in node_types  # per-node info
        assert "oidc_provider" in node_types  # control plane
        assert "public_ip" in node_types  # api endpoint
        assert "addon" in node_types  # dashboard
        assert "tag" in node_types

    def test_cluster_fetch_not_ok_returns_empty_graph(self):
        cluster = _cluster()
        with patch("requests.get", return_value=_resp(ok=False)):
            result = _linode_kubernetes_map(cluster, {"api_token": "tok"})
        assert result == {"nodes": [], "edges": []}

    def test_pools_fetch_failure_still_returns_cluster_level_nodes(self):
        cluster = _cluster()

        def fake_get(url, headers=None, timeout=None):
            if "/pools" in url:
                return _resp(ok=False)
            if "/api-endpoints" in url:
                return _resp(json_data={"data": []})
            if "/dashboard" in url:
                return _resp(json_data={})
            return _resp(json_data=_cluster_data())

        with patch("requests.get", side_effect=fake_get):
            result = _linode_kubernetes_map(cluster, {"api_token": "tok"})

        assert not any(n["type"] == "node_pool" for n in result["nodes"])
        assert any(n["type"] == "oidc_provider" for n in result["nodes"])

    def test_node_list_truncated_to_three_per_pool(self):
        cluster = _cluster()
        nodes_list = [{"id": f"node-{i}", "status": "ready", "instance_id": f"inst-{i}"} for i in range(5)]

        def fake_get(url, headers=None, timeout=None):
            if "/pools" in url:
                return _resp(json_data={"data": [{"id": 1, "type": "g6-standard-2", "count": 5, "nodes": nodes_list}]})
            if "/api-endpoints" in url:
                return _resp(json_data={"data": []})
            if "/dashboard" in url:
                return _resp(json_data={})
            return _resp(json_data={})

        with patch("requests.get", side_effect=fake_get):
            result = _linode_kubernetes_map(cluster, {"api_token": "tok"})

        node_entries = [n for n in result["nodes"] if n["type"] == "network_interface"]
        assert len(node_entries) == 3

    def test_no_dashboard_url_produces_no_dashboard_node(self):
        cluster = _cluster()

        def fake_get(url, headers=None, timeout=None):
            if "/pools" in url:
                return _resp(json_data={"data": []})
            if "/api-endpoints" in url:
                return _resp(json_data={"data": []})
            if "/dashboard" in url:
                return _resp(json_data={"url": ""})
            return _resp(json_data={})

        with patch("requests.get", side_effect=fake_get):
            result = _linode_kubernetes_map(cluster, {"api_token": "tok"})

        assert not any(n["type"] == "addon" for n in result["nodes"])

    def test_exception_during_fetch_returns_partial_graph_not_raise(self):
        cluster = _cluster()
        with patch("requests.get", side_effect=RuntimeError("boom")):
            result = _linode_kubernetes_map(cluster, {"api_token": "tok"})
        assert result == {"nodes": [], "edges": []}
