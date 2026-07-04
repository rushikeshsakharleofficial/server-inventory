"""
Pinning tests for _append_ip_nodes (backend/app/routers/resource_map.py).
Pure function, no I/O — a plain in-memory Server object suffices.
"""
from app import models
from app.routers.resource_map import _append_ip_nodes


def _server(**overrides):
    defaults = dict(id=1, name="srv", provider="aws")
    defaults.update(overrides)
    return models.Server(**defaults)


class TestAppendIpNodes:
    def test_no_root_node_returns_result_unchanged(self):
        server = _server(public_ip="1.2.3.4")
        result = {"nodes": [], "edges": []}
        out = _append_ip_nodes(server, result)
        assert out == result

    def test_no_ips_available_returns_result_unchanged(self):
        server = _server()
        result = {"nodes": [{"id": "root", "type": "server", "category": "compute"}], "edges": []}
        out = _append_ip_nodes(server, result)
        assert out == result

    def test_ssh_info_all_ips_list_used_when_present(self):
        server = _server(ssh_info={"all_ips": ["10.0.0.5", "34.1.2.3"]})
        result = {"nodes": [{"id": "root", "type": "server", "category": "compute", "label": ""}], "edges": []}
        out = _append_ip_nodes(server, result)

        ip_labels = {n["label"] for n in out["nodes"] if n["type"] == "ip"}
        assert ip_labels == {"10.0.0.5", "34.1.2.3"}

    def test_falls_back_to_public_and_private_ip_when_no_ssh_info(self):
        server = _server(public_ip="34.1.2.3", private_ip="10.0.0.5")
        result = {"nodes": [{"id": "root", "type": "server", "category": "compute", "label": ""}], "edges": []}
        out = _append_ip_nodes(server, result)

        ip_labels = {n["label"] for n in out["nodes"] if n["type"] == "ip"}
        assert ip_labels == {"34.1.2.3", "10.0.0.5"}

    def test_private_ip_same_as_public_not_duplicated(self):
        server = _server(public_ip="34.1.2.3", private_ip="34.1.2.3")
        result = {"nodes": [{"id": "root", "type": "server", "category": "compute", "label": ""}], "edges": []}
        out = _append_ip_nodes(server, result)

        ip_nodes = [n for n in out["nodes"] if n["type"] == "ip"]
        assert len(ip_nodes) == 1

    def test_ip_already_present_as_existing_node_label_not_duplicated(self):
        server = _server(public_ip="34.1.2.3")
        result = {"nodes": [
            {"id": "root", "type": "server", "category": "compute", "label": ""},
            {"id": "other", "type": "public_ip", "category": "network", "label": "34.1.2.3"},
        ], "edges": []}
        out = _append_ip_nodes(server, result)

        assert not any(n["type"] == "ip" for n in out["nodes"])

    def test_public_ip_marked_primary_others_additional(self):
        server = _server(public_ip="34.1.2.3", ssh_info={"all_ips": ["34.1.2.3", "10.0.0.5"]})
        result = {"nodes": [{"id": "root", "type": "server", "category": "compute", "label": ""}], "edges": []}
        out = _append_ip_nodes(server, result)

        by_label = {n["label"]: n["properties"]["type"] for n in out["nodes"] if n["type"] == "ip"}
        assert by_label["34.1.2.3"] == "primary"
        assert by_label["10.0.0.5"] == "additional"

    def test_original_result_not_mutated(self):
        server = _server(public_ip="34.1.2.3")
        original_nodes = [{"id": "root", "type": "server", "category": "compute", "label": ""}]
        result = {"nodes": original_nodes, "edges": []}
        _append_ip_nodes(server, result)

        assert result["nodes"] is original_nodes
        assert len(original_nodes) == 1  # not appended to in place
