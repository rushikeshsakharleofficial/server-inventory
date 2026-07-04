"""
Pinning tests for _azure_kubernetes_map (backend/app/routers/resource_map.py).
Written before refactoring.
"""
from unittest.mock import MagicMock, patch

from app import models
from app.routers.resource_map import _azure_kubernetes_map


def _cluster(cloud_id="/subscriptions/s/resourceGroups/rg/providers/Microsoft.ContainerService/managedClusters/aks1"):
    return models.KubernetesCluster(id=1, name="aks-test", provider="azure", cloud_id=cloud_id)


def _resp(json_data=None):
    r = MagicMock()
    r.json.return_value = json_data if json_data is not None else {}
    return r


class TestAzureKubernetesMap:
    def test_full_cluster_produces_all_node_types(self):
        cluster = _cluster()
        c_data = {
            "properties": {
                "agentPoolProfiles": [
                    {"name": "pool1", "vmSize": "Standard_D2", "count": 3, "osType": "Linux", "mode": "System",
                     "vnetSubnetID": "/subscriptions/s/vnets/vnet1/subnets/sub1"}
                ],
                "aadProfile": {"managed": True, "enableAzureRBAC": True, "tenantID": "t1"},
                "oidcIssuerProfile": {"issuerURL": "https://oidc.example.com"},
                "networkProfile": {
                    "networkPlugin": "azure", "networkPolicy": "calico",
                    "loadBalancerProfile": {"effectiveOutboundIPs": [{"id": "/pip/1"}]},
                },
                "addonProfiles": {"httpApplicationRouting": {"enabled": True}, "omsagent": {"enabled": False}},
            },
            "identity": {"type": "SystemAssigned", "principalId": "p1"},
        }

        with patch("app.routers.resource_map._az_token", return_value=("tok", "sub")), \
             patch("requests.get", return_value=_resp(c_data)):
            result = _azure_kubernetes_map(cluster, {"tenant_id": "t"})

        node_types = {n["type"] for n in result["nodes"]}
        assert "node_group" in node_types
        assert "subnet" in node_types
        assert "vnet" in node_types
        assert "managed_identity" in node_types
        assert "oidc_provider" in node_types  # both aad + oidc use this type
        assert "public_ip" in node_types
        assert "network_interface" in node_types
        assert "addon" in node_types

        addon_ids = {n["id"] for n in result["nodes"] if n["type"] == "addon"}
        assert addon_ids == {"addon-httpApplicationRouting"}  # disabled addon excluded

    def test_token_failure_returns_empty_graph(self):
        cluster = _cluster()
        with patch("app.routers.resource_map._az_token", side_effect=RuntimeError("bad creds")):
            result = _azure_kubernetes_map(cluster, {"tenant_id": "t"})
        assert result == {"nodes": [], "edges": []}

    def test_no_cloud_id_skips_fetch(self):
        cluster = _cluster(cloud_id=None)
        with patch("app.routers.resource_map._az_token", return_value=("tok", "sub")), \
             patch("requests.get") as mock_get:
            result = _azure_kubernetes_map(cluster, {"tenant_id": "t"})
        mock_get.assert_not_called()
        assert result == {"nodes": [], "edges": []}

    def test_no_agent_pools_produces_no_pool_or_subnet_nodes(self):
        cluster = _cluster()
        c_data = {"properties": {"agentPoolProfiles": []}}
        with patch("app.routers.resource_map._az_token", return_value=("tok", "sub")), \
             patch("requests.get", return_value=_resp(c_data)):
            result = _azure_kubernetes_map(cluster, {"tenant_id": "t"})
        assert result["nodes"] == []

    def test_pool_without_subnet_id_produces_only_pool_node(self):
        cluster = _cluster()
        c_data = {"properties": {"agentPoolProfiles": [{"name": "pool1"}]}}
        with patch("app.routers.resource_map._az_token", return_value=("tok", "sub")), \
             patch("requests.get", return_value=_resp(c_data)):
            result = _azure_kubernetes_map(cluster, {"tenant_id": "t"})
        node_types = {n["type"] for n in result["nodes"]}
        assert node_types == {"node_group"}

    def test_no_identity_no_aad_no_oidc_produces_no_iam_nodes(self):
        cluster = _cluster()
        c_data = {"properties": {}}
        with patch("app.routers.resource_map._az_token", return_value=("tok", "sub")), \
             patch("requests.get", return_value=_resp(c_data)):
            result = _azure_kubernetes_map(cluster, {"tenant_id": "t"})
        node_types = {n["type"] for n in result["nodes"]}
        assert "managed_identity" not in node_types
        assert "oidc_provider" not in node_types

    def test_fetch_exception_returns_partial_graph_not_raise(self):
        cluster = _cluster()
        with patch("app.routers.resource_map._az_token", return_value=("tok", "sub")), \
             patch("requests.get", side_effect=RuntimeError("boom")):
            result = _azure_kubernetes_map(cluster, {"tenant_id": "t"})
        assert result == {"nodes": [], "edges": []}
