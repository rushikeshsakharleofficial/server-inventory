"""
Pinning tests for _azure_server_map (backend/app/routers/resource_map.py),
complexity 46 vs 15 allowed. Written before refactoring.
"""
from unittest.mock import MagicMock, patch

from app import models
from app.routers.resource_map import _azure_server_map


def _server(cloud_id="/subscriptions/s/resourceGroups/rg/providers/Microsoft.Compute/virtualMachines/vm1"):
    return models.Server(id=1, name="az-test", provider="azure", cloud_id=cloud_id)


def _resp(json_data=None):
    r = MagicMock()
    r.json.return_value = json_data if json_data is not None else {}
    return r


class TestAzureServerMap:
    def test_full_vm_produces_all_node_types(self):
        server = _server()
        vm_data = {
            "properties": {
                "networkProfile": {"networkInterfaces": [{"id": "/nic/1"}]},
                "availabilitySet": {"id": "/avset/1"},
            },
            "identity": {"type": "SystemAssigned"},
        }
        nic_data = {
            "name": "nic1",
            "properties": {
                "networkSecurityGroup": {"id": "/nsg/1"},
                "ipConfigurations": [
                    {
                        "properties": {
                            "subnet": {"id": "/subscriptions/s/vnets/vnet1/subnets/sub1"},
                            "publicIPAddress": {"id": "/pip/1"},
                        }
                    }
                ],
            },
        }
        nsg_data = {"name": "nsg1", "properties": {"securityRules": [{"a": 1}, {"a": 2}]}}
        pip_data = {"properties": {"ipAddress": "34.1.2.3", "publicIPAllocationMethod": "Static"}}

        def fake_get(url, headers=None, timeout=None):
            if "/nic/1" in url:
                return _resp(nic_data)
            if "/nsg/1" in url:
                return _resp(nsg_data)
            if "/pip/1" in url:
                return _resp(pip_data)
            return _resp(vm_data)

        with patch("app.routers.resource_map._az_token", return_value=("tok", "sub")), \
             patch("requests.get", side_effect=fake_get):
            result = _azure_server_map(server, {"tenant_id": "t", "client_id": "c", "client_secret": "s", "subscription_id": "sub"})

        node_types = {n["type"] for n in result["nodes"]}
        assert "network_interface" in node_types
        assert "nsg" in node_types
        assert "subnet" in node_types
        assert "vnet" in node_types
        assert "public_ip" in node_types
        assert "managed_identity" in node_types
        assert "availability_set" in node_types

    def test_token_failure_returns_empty_graph(self):
        server = _server()
        with patch("app.routers.resource_map._az_token", side_effect=RuntimeError("bad creds")):
            result = _azure_server_map(server, {"tenant_id": "t"})
        assert result == {"nodes": [], "edges": []}

    def test_no_cloud_id_skips_vm_fetch(self):
        server = _server(cloud_id=None)
        with patch("app.routers.resource_map._az_token", return_value=("tok", "sub")), \
             patch("requests.get") as mock_get:
            result = _azure_server_map(server, {"tenant_id": "t"})
        mock_get.assert_not_called()
        assert result == {"nodes": [], "edges": []}

    def test_no_network_interfaces_produces_no_nic_nodes(self):
        server = _server()
        vm_data = {"properties": {"networkProfile": {"networkInterfaces": []}}}
        with patch("app.routers.resource_map._az_token", return_value=("tok", "sub")), \
             patch("requests.get", return_value=_resp(vm_data)):
            result = _azure_server_map(server, {"tenant_id": "t"})
        assert result["nodes"] == []

    def test_nic_fetch_failure_does_not_abort_whole_map(self):
        server = _server()
        vm_data = {"properties": {"networkProfile": {"networkInterfaces": [{"id": "/nic/1"}]}}}

        def fake_get(url, headers=None, timeout=None):
            if "/nic/1" in url:
                raise RuntimeError("nic fetch boom")
            return _resp(vm_data)

        with patch("app.routers.resource_map._az_token", return_value=("tok", "sub")), \
             patch("requests.get", side_effect=fake_get):
            result = _azure_server_map(server, {"tenant_id": "t"})

        # nic fetch failure is swallowed; no partial nic node added, but no raise either
        assert result["nodes"] == []

    def test_nic_without_nsg_or_public_ip_only_adds_nic_node(self):
        server = _server()
        vm_data = {"properties": {"networkProfile": {"networkInterfaces": [{"id": "/nic/1"}]}}}
        nic_data = {"name": "nic1", "properties": {"ipConfigurations": []}}

        def fake_get(url, headers=None, timeout=None):
            if "/nic/1" in url:
                return _resp(nic_data)
            return _resp(vm_data)

        with patch("app.routers.resource_map._az_token", return_value=("tok", "sub")), \
             patch("requests.get", side_effect=fake_get):
            result = _azure_server_map(server, {"tenant_id": "t"})

        node_types = {n["type"] for n in result["nodes"]}
        assert node_types == {"network_interface"}

    def test_no_identity_or_availability_set_produces_no_extra_nodes(self):
        server = _server()
        vm_data = {"properties": {"networkProfile": {"networkInterfaces": []}}, "identity": {}}
        with patch("app.routers.resource_map._az_token", return_value=("tok", "sub")), \
             patch("requests.get", return_value=_resp(vm_data)):
            result = _azure_server_map(server, {"tenant_id": "t"})
        node_types = {n["type"] for n in result["nodes"]}
        assert "managed_identity" not in node_types
        assert "availability_set" not in node_types

    def test_top_level_exception_returns_partial_nodes_not_raise(self):
        server = _server()
        with patch("app.routers.resource_map._az_token", return_value=("tok", "sub")), \
             patch("requests.get", side_effect=RuntimeError("vm fetch boom")):
            result = _azure_server_map(server, {"tenant_id": "t"})
        assert result == {"nodes": [], "edges": []}
