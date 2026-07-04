"""
Pinning tests for _gcp_database_map (backend/app/routers/resource_map.py),
complexity 32 vs 15 allowed. Written before refactoring.
"""
from unittest.mock import MagicMock, patch

from app import models
from app.routers.resource_map import _gcp_database_map


def _db_inst(cloud_id="inst-1"):
    return models.DatabaseInstance(id=1, name="gcp-db", provider="gcp", cloud_id=cloud_id)


def _resp(ok=True, json_data=None):
    r = MagicMock()
    r.ok = ok
    r.json.return_value = json_data if json_data is not None else {}
    return r


class TestGcpDatabaseMap:
    def test_full_instance_produces_all_node_types(self):
        db_inst = _db_inst()
        inst_data = {
            "settings": {
                "ipConfiguration": {
                    "privateNetwork": "projects/p/global/networks/vpc1",
                    "authorizedNetworks": [{"value": "1.2.3.0/24", "name": "office"}],
                },
                "backupConfiguration": {"enabled": True, "startTime": "02:00", "transactionLogRetentionDays": 7},
                "maintenanceWindow": {"day": 7, "hour": 3, "updateTrack": "stable"},
                "databaseFlags": [{"name": "max_connections", "value": "100"}],
            },
            "ipAddresses": [{"type": "PRIMARY", "ipAddress": "34.1.2.3"}, {"type": "PRIVATE", "ipAddress": "10.0.0.5"}],
            "replicaNames": ["inst-1-replica-1"],
            "serviceAccountEmailAddress": "sa@p.iam.gserviceaccount.com",
        }

        with patch("app.routers.resource_map._gcp_token", return_value=("tok", "proj")), \
             patch("requests.get", return_value=_resp(json_data=inst_data)):
            result = _gcp_database_map(db_inst, {"service_account_json": {}})

        node_types = {n["type"] for n in result["nodes"]}
        assert "vpc_network" in node_types
        assert "public_ip" in node_types
        assert "private_ip" in node_types
        assert "firewall_rule" in node_types
        assert "backup" in node_types
        assert "maintenance_policy" in node_types
        assert "read_replica" in node_types
        assert "parameter_group" in node_types
        assert "service_account" in node_types

    def test_token_failure_returns_empty_graph(self):
        db_inst = _db_inst()
        with patch("app.routers.resource_map._gcp_token", side_effect=RuntimeError("bad creds")):
            result = _gcp_database_map(db_inst, {"service_account_json": {}})
        assert result == {"nodes": [], "edges": []}

    def test_instance_fetch_not_ok_returns_empty_graph(self):
        db_inst = _db_inst()
        with patch("app.routers.resource_map._gcp_token", return_value=("tok", "proj")), \
             patch("requests.get", return_value=_resp(ok=False)):
            result = _gcp_database_map(db_inst, {"service_account_json": {}})
        assert result == {"nodes": [], "edges": []}

    def test_no_backup_no_maintenance_no_flags_produces_no_extra_nodes(self):
        db_inst = _db_inst()
        inst_data = {"settings": {}, "ipAddresses": []}
        with patch("app.routers.resource_map._gcp_token", return_value=("tok", "proj")), \
             patch("requests.get", return_value=_resp(json_data=inst_data)):
            result = _gcp_database_map(db_inst, {"service_account_json": {}})
        node_types = {n["type"] for n in result["nodes"]}
        assert "backup" not in node_types
        assert "maintenance_policy" not in node_types
        assert "parameter_group" not in node_types

    def test_exception_during_parsing_returns_partial_graph(self):
        db_inst = _db_inst()
        with patch("app.routers.resource_map._gcp_token", return_value=("tok", "proj")), \
             patch("requests.get", side_effect=RuntimeError("boom")):
            result = _gcp_database_map(db_inst, {"service_account_json": {}})
        assert result == {"nodes": [], "edges": []}

    def test_db_flags_capped_at_ten_in_properties(self):
        db_inst = _db_inst()
        flags = [{"name": f"flag{i}", "value": str(i)} for i in range(15)]
        inst_data = {"settings": {"databaseFlags": flags}, "ipAddresses": []}
        with patch("app.routers.resource_map._gcp_token", return_value=("tok", "proj")), \
             patch("requests.get", return_value=_resp(json_data=inst_data)):
            result = _gcp_database_map(db_inst, {"service_account_json": {}})
        flags_node = next(n for n in result["nodes"] if n["type"] == "parameter_group")
        assert len(flags_node["properties"]) == 10
