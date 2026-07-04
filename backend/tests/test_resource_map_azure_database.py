"""
Pinning tests for _azure_database_map (backend/app/routers/resource_map.py).
Written before refactoring.
"""
from unittest.mock import MagicMock, patch

from app import models
from app.routers.resource_map import _azure_database_map


def _db_inst(cloud_id="/subscriptions/s/resourceGroups/rg/providers/Microsoft.DBforPostgreSQL/flexibleServers/db1", engine="postgres"):
    return models.DatabaseInstance(id=1, name="az-db", provider="azure", cloud_id=cloud_id, engine=engine)


def _resp(ok=True, json_data=None):
    r = MagicMock()
    r.ok = ok
    r.json.return_value = json_data if json_data is not None else {}
    return r


class TestAzureDatabaseMap:
    def test_full_instance_produces_all_node_types(self):
        db_inst = _db_inst()
        srv_data = {
            "properties": {
                "privateEndpointConnections": [
                    {"id": "/pe/1", "properties": {"privateLinkServiceConnectionState": {"status": "Approved"}}}
                ],
                "highAvailability": {"mode": "ZoneRedundant", "standbyAvailabilityZone": "2", "state": "Healthy"},
                "maintenanceWindow": {"customWindow": "Enabled", "dayOfWeek": 0, "startHour": 2},
                "backup": {"backupRetentionDays": 7, "geoRedundantBackup": "Enabled"},
            }
        }
        fw_data = {"value": [{"id": "/fw/1", "name": "allow-all", "properties": {"startIpAddress": "0.0.0.0", "endIpAddress": "255.255.255.255"}}]}
        vnet_data = {"value": [{"id": "/vnet-rule/1", "name": "vnetrule1", "properties": {"virtualNetworkSubnetId": "/subscriptions/s/vnets/vnet1/subnets/sub1"}}]}
        replica_data = {"value": [{"id": "/replica/1", "name": "db1-replica", "location": "eastus", "properties": {"fullyQualifiedDomainName": "db1-replica.postgres.database.azure.com"}}]}

        def fake_get(url, headers=None, timeout=None):
            if "/firewallRules" in url:
                return _resp(json_data=fw_data)
            if "/virtualNetworkRules" in url:
                return _resp(json_data=vnet_data)
            if "/replicas" in url:
                return _resp(json_data=replica_data)
            return _resp(json_data=srv_data)

        with patch("app.routers.resource_map._az_token", return_value=("tok", "sub")), \
             patch("requests.get", side_effect=fake_get):
            result = _azure_database_map(db_inst, {"tenant_id": "t"})

        node_types = {n["type"] for n in result["nodes"]}
        assert "firewall_rule" in node_types
        assert "subnet" in node_types
        assert "public_ip" in node_types  # private endpoint
        assert "availability_zone" in node_types
        assert "maintenance_policy" in node_types
        assert "backup" in node_types
        assert "read_replica" in node_types

    def test_token_failure_returns_empty_graph(self):
        db_inst = _db_inst()
        with patch("app.routers.resource_map._az_token", side_effect=RuntimeError("bad creds")):
            result = _azure_database_map(db_inst, {"tenant_id": "t"})
        assert result == {"nodes": [], "edges": []}

    def test_no_cloud_id_skips_server_fetch(self):
        db_inst = _db_inst(cloud_id=None)
        with patch("app.routers.resource_map._az_token", return_value=("tok", "sub")), \
             patch("requests.get") as mock_get:
            result = _azure_database_map(db_inst, {"tenant_id": "t"})
        mock_get.assert_not_called()
        assert result == {"nodes": [], "edges": []}

    def test_mysql_engine_uses_mysql_api_version(self):
        db_inst = _db_inst(engine="mysql")
        calls = []

        def fake_get(url, headers=None, timeout=None):
            calls.append(url)
            return _resp(json_data={"properties": {}})

        with patch("app.routers.resource_map._az_token", return_value=("tok", "sub")), \
             patch("requests.get", side_effect=fake_get):
            _azure_database_map(db_inst, {"tenant_id": "t"})

        assert any("api-version=2021-05-01" in c for c in calls)

    def test_firewall_fetch_not_ok_skips_firewall_nodes_not_raise(self):
        db_inst = _db_inst()

        def fake_get(url, headers=None, timeout=None):
            if "/firewallRules" in url:
                return _resp(ok=False)
            return _resp(json_data={"properties": {}})

        with patch("app.routers.resource_map._az_token", return_value=("tok", "sub")), \
             patch("requests.get", side_effect=fake_get):
            result = _azure_database_map(db_inst, {"tenant_id": "t"})

        assert not any(n["type"] == "firewall_rule" for n in result["nodes"])

    def test_high_availability_disabled_produces_no_ha_node(self):
        db_inst = _db_inst()
        srv_data = {"properties": {"highAvailability": {"mode": "Disabled"}}}

        with patch("app.routers.resource_map._az_token", return_value=("tok", "sub")), \
             patch("requests.get", return_value=_resp(json_data=srv_data)):
            result = _azure_database_map(db_inst, {"tenant_id": "t"})

        assert not any(n["type"] == "availability_zone" for n in result["nodes"])

    def test_server_fetch_exception_returns_partial_graph_not_raise(self):
        db_inst = _db_inst()
        with patch("app.routers.resource_map._az_token", return_value=("tok", "sub")), \
             patch("requests.get", side_effect=RuntimeError("srv fetch boom")):
            result = _azure_database_map(db_inst, {"tenant_id": "t"})
        assert result == {"nodes": [], "edges": []}
