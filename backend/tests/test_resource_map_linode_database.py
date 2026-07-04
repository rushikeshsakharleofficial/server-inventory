"""
Pinning tests for _linode_database_map (backend/app/routers/resource_map.py).
Written before refactoring.
"""
from unittest.mock import MagicMock, patch

from app import models
from app.routers.resource_map import _linode_database_map


def _db_inst(cloud_id="12345", engine="mysql"):
    return models.DatabaseInstance(id=1, name="linode-db", provider="linode", cloud_id=cloud_id, engine=engine)


def _resp(ok=True, json_data=None):
    r = MagicMock()
    r.ok = ok
    r.json.return_value = json_data if json_data is not None else {}
    return r


def _db_data(**overrides):
    data = {
        "hosts": {"primary": "primary.example.com", "secondary": "secondary.example.com"},
        "port": 3306,
        "allow_list": ["1.2.3.0/24"],
        "members": {"1.2.3.4": "primary", "5.6.7.8": "secondary"},
        "backups": {"enabled": True, "schedule": {"hour": 3, "day_of_week": 1}},
        "type": "g6-standard-2",
        "cluster_size": 3,
        "replication_type": "semi_synch",
    }
    data.update(overrides)
    return data


class TestLinodeDatabaseMap:
    def test_full_instance_produces_all_node_types(self):
        db_inst = _db_inst()

        def fake_get(url, headers=None, timeout=None):
            if "/ssl" in url:
                return _resp(json_data={"ca_certificate": "cert-data"})
            return _resp(json_data=_db_data())

        with patch("requests.get", side_effect=fake_get):
            result = _linode_database_map(db_inst, {"api_token": "tok"})

        node_types = {n["type"] for n in result["nodes"]}
        assert "public_ip" in node_types  # primary host
        assert "read_replica" in node_types  # secondary host + members
        assert "firewall_rule" in node_types  # ssl config + allow list
        assert "backup" in node_types
        assert "parameter_group" in node_types  # instance type

    def test_instance_fetch_not_ok_returns_empty_graph(self):
        db_inst = _db_inst()
        with patch("requests.get", return_value=_resp(ok=False)):
            result = _linode_database_map(db_inst, {"api_token": "tok"})
        assert result == {"nodes": [], "edges": []}

    def test_no_secondary_host_produces_no_secondary_node(self):
        db_inst = _db_inst()

        def fake_get(url, headers=None, timeout=None):
            if "/ssl" in url:
                return _resp(json_data={})
            return _resp(json_data=_db_data(hosts={"primary": "primary.example.com"}))

        with patch("requests.get", side_effect=fake_get):
            result = _linode_database_map(db_inst, {"api_token": "tok"})

        host_secondary = [n for n in result["nodes"] if n["id"] == "host-secondary"]
        assert host_secondary == []

    def test_no_allow_list_produces_no_allow_list_node(self):
        db_inst = _db_inst()

        def fake_get(url, headers=None, timeout=None):
            if "/ssl" in url:
                return _resp(json_data={})
            return _resp(json_data=_db_data(allow_list=[]))

        with patch("requests.get", side_effect=fake_get):
            result = _linode_database_map(db_inst, {"api_token": "tok"})

        assert not any(n["id"] == "allow-list" for n in result["nodes"])

    def test_no_backups_enabled_produces_no_backup_node(self):
        db_inst = _db_inst()

        def fake_get(url, headers=None, timeout=None):
            if "/ssl" in url:
                return _resp(json_data={})
            return _resp(json_data=_db_data(backups={"enabled": False}))

        with patch("requests.get", side_effect=fake_get):
            result = _linode_database_map(db_inst, {"api_token": "tok"})

        assert not any(n["type"] == "backup" for n in result["nodes"])

    def test_exception_during_fetch_returns_partial_graph_not_raise(self):
        db_inst = _db_inst()
        with patch("requests.get", side_effect=RuntimeError("boom")):
            result = _linode_database_map(db_inst, {"api_token": "tok"})
        assert result == {"nodes": [], "edges": []}

    def test_members_dict_produces_one_replica_node_per_member(self):
        db_inst = _db_inst()

        def fake_get(url, headers=None, timeout=None):
            if "/ssl" in url:
                return _resp(json_data={})
            return _resp(json_data=_db_data(hosts={}, members={"a": "1", "b": "2", "c": "3"}))

        with patch("requests.get", side_effect=fake_get):
            result = _linode_database_map(db_inst, {"api_token": "tok"})

        member_nodes = [n for n in result["nodes"] if n["id"].startswith("member-")]
        assert len(member_nodes) == 3
