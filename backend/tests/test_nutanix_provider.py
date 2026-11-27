import pytest
import requests

from app.providers import get_provider


def _vm(uuid, power, ips):
    return {
        "metadata": {"uuid": uuid, "categories": {"env": "prod"}},
        "status": {
            "name": f"vm-{uuid}",
            "cluster_reference": {"name": "clu1", "uuid": "c-1"},
            "resources": {
                "power_state": power,
                "num_sockets": 2,
                "num_vcpus_per_socket": 2,
                "memory_size_mib": 4096,
                "nic_list": [{"ip_endpoint_list": [{"ip": i} for i in ips]}],
                "disk_list": [
                    {"device_properties": {"device_type": "DISK"}, "disk_size_mib": 10240},
                    {"device_properties": {"device_type": "CDROM"}, "disk_size_mib": 999},
                ],
            },
        },
    }


class _Resp:
    status_code = 200

    def __init__(self, body):
        self.body = body

    def raise_for_status(self):
        pass

    def json(self):
        return self.body


def test_fetch_servers_paginates_and_maps(monkeypatch):
    import app.providers.nutanix as nx

    monkeypatch.setattr(nx, "PAGE", 1)
    pages = [
        {"metadata": {"total_matches": 2}, "entities": [_vm("a", "ON", ["10.0.0.5", "8.8.8.8"])]},
        {"metadata": {"total_matches": 2}, "entities": [_vm("b", "OFF", [])]},
    ]
    calls = []

    def fake_post(url, json, **kw):
        calls.append(json["offset"])
        assert kw["verify"] is False
        return _Resp(pages[len(calls) - 1])

    monkeypatch.setattr(requests, "post", fake_post)
    p = get_provider("nutanix", {"prism_url": "https://pc:9440/", "username": "u", "password": "p", "verify_ssl": "false"})
    a, b = p.fetch_servers()

    assert calls == [0, 1]
    assert (a["status"], a["private_ip"], a["public_ip"]) == ("running", "10.0.0.5", "8.8.8.8")
    assert (a["vcpu"], a["memory_gb"], a["storage_gb"]) == (4, 4.0, 10.0)
    assert b["status"] == "stopped" and b["public_ip"] is None


def test_rejects_plain_http():
    p = get_provider("nutanix", {"prism_url": "http://pc:9440", "username": "u", "password": "p"})
    with pytest.raises(ValueError):
        p.fetch_servers()


def test_fetch_block_storages(monkeypatch):
    vg = {
        "metadata": {"uuid": "vg1", "categories": {}},
        "status": {
            "name": "pvc-1",
            "state": "COMPLETE",
            "resources": {
                "size_mib": 30720,
                "usage_type": "INTERNAL",
                "iscsi_target_name": "ntnx-k8s-x",
                "attachment_list": [{"iscsi_initiator_name": "iqn.x"}],
            },
        },
    }
    monkeypatch.setattr(requests, "post", lambda *a, **k: _Resp({"metadata": {"total_matches": 1}, "entities": [vg]}))
    p = get_provider("nutanix", {"prism_url": "https://pc:9440", "username": "u", "password": "p"})
    (b,) = p.fetch_block_storages()
    assert (b["name"], b["size_gb"], b["status"], b["attachment"], b["volume_type"]) == ("pvc-1", 30.0, "running", "iqn.x", "INTERNAL")


def test_fetch_object_storages_paginates_and_maps_state(monkeypatch):
    def store(i, state):
        return {"extId": f"o{i}", "name": f"s3-{i}", "domain": "x.example", "state": state,
                "clusterExtId": "c1", "numWorkerNodes": 2, "deploymentVersion": "3.5"}

    pages = {0: [store(1, "OBJECT_STORE_AVAILABLE"), store(2, "OBJECT_STORE_DELETION_FAILED")], 1: [store(3, "OBJECT_STORE_DEPLOYING")]}
    seen = []

    def fake_get(url, params, **kw):
        seen.append(params["$page"])
        assert "/api/objects/v4.0/config/object-stores" in url and kw["verify"] is False
        return _Resp({"data": pages.get(params["$page"], []), "metadata": {"totalAvailableResults": 3}})

    monkeypatch.setattr(requests, "get", fake_get)
    p = get_provider("nutanix", {"prism_url": "https://pc:9440", "username": "u", "password": "p", "verify_ssl": "false"})
    got = p.fetch_object_storages()

    assert seen == [0, 1]
    assert [(g["cloud_id"], g["status"]) for g in got] == [("o1", "running"), ("o2", "failed"), ("o3", "pending")]
    assert got[0]["endpoint"] == "x.example" and got[0]["extra"]["worker_nodes"] == 2


def test_object_storages_503_means_not_enabled(monkeypatch):
    class R503(_Resp):
        status_code = 503

    monkeypatch.setattr(requests, "get", lambda *a, **k: R503({}))
    p = get_provider("nutanix", {"prism_url": "https://pc:9440", "username": "u", "password": "p"})
    assert p.fetch_object_storages() == []
