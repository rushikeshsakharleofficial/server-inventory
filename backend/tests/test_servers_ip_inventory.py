"""
Pinning tests for GET /api/servers/ips (ip_inventory), complexity 33 vs 15
allowed. Written before refactoring.
"""
import socket
from unittest.mock import patch

from app import models


def _make_server(db_session, **overrides):
    defaults = dict(name="ip-test-server", provider="custom", status="unknown")
    defaults.update(overrides)
    server = models.Server(**defaults)
    db_session.add(server)
    db_session.commit()
    db_session.refresh(server)
    return server


class TestIpInventory:
    def test_aggregates_public_private_and_ssh_info_ips(self, auth_client, db_session):
        _make_server(
            db_session,
            public_ip="34.1.2.3",
            private_ip="10.0.0.5",
            ssh_info={"all_ips": ["10.0.0.5", "10.0.0.6/24"]},
        )

        with patch("socket.gethostbyaddr", side_effect=socket.herror("no PTR")):
            resp = auth_client.get("/api/servers/ip-inventory")

        assert resp.status_code == 200
        body = resp.json()
        addrs = {r["address"] for r in body["items"]}
        assert {"34.1.2.3", "10.0.0.5", "10.0.0.6"}.issubset(addrs)
        # public_ip/private_ip already present in all_ips shouldn't duplicate
        assert sum(1 for r in body["items"] if r["address"] == "10.0.0.5") == 1

    def test_classifies_loopback_link_local_ipv4_ipv6(self, auth_client, db_session):
        _make_server(
            db_session,
            ssh_info={"all_ips": ["127.0.0.1", "fe80::1", "::1", "10.0.0.5", "2001:db8::1"]},
        )

        with patch("socket.gethostbyaddr", side_effect=socket.herror("no PTR")):
            resp = auth_client.get("/api/servers/ip-inventory")

        body = resp.json()
        by_addr = {r["address"]: r["type"] for r in body["items"]}
        assert by_addr["127.0.0.1"] == "loopback"
        assert by_addr["::1"] == "loopback"
        assert by_addr["fe80::1"] == "link-local"
        assert by_addr["10.0.0.5"] == "ipv4"
        assert by_addr["2001:db8::1"] == "ipv6"

    def test_rdns_lookup_populates_hostname_when_resolvable(self, auth_client, db_session):
        _make_server(db_session, public_ip="8.8.8.8")

        with patch("socket.gethostbyaddr", return_value=("dns.google", [], ["8.8.8.8"])):
            resp = auth_client.get("/api/servers/ip-inventory")

        body = resp.json()
        row = next(r for r in body["items"] if r["address"] == "8.8.8.8")
        assert row["rdns"] == "dns.google"

    def test_rdns_failure_leaves_rdns_none_not_raise(self, auth_client, db_session):
        _make_server(db_session, public_ip="10.0.0.99")

        with patch("socket.gethostbyaddr", side_effect=socket.herror("no PTR record")):
            resp = auth_client.get("/api/servers/ip-inventory")

        assert resp.status_code == 200
        row = next(r for r in resp.json()["items"] if r["address"] == "10.0.0.99")
        assert row["rdns"] is None

    def test_search_filters_by_address_or_server_name(self, auth_client, db_session):
        _make_server(db_session, name="web-server-1", public_ip="1.1.1.1")
        _make_server(db_session, name="db-server-1", public_ip="2.2.2.2")

        with patch("socket.gethostbyaddr", side_effect=socket.herror("no PTR")):
            resp = auth_client.get("/api/servers/ip-inventory", params={"q": "web-server"})

        body = resp.json()
        assert all("web-server" in r["server_name"] for r in body["items"])

    def test_type_filter_restricts_to_ipv4_only(self, auth_client, db_session):
        _make_server(db_session, ssh_info={"all_ips": ["10.0.0.5", "2001:db8::1"]})

        with patch("socket.gethostbyaddr", side_effect=socket.herror("no PTR")):
            resp = auth_client.get("/api/servers/ip-inventory", params={"type": "ipv4"})

        body = resp.json()
        assert all(r["type"] == "ipv4" for r in body["items"])
        assert any(r["address"] == "10.0.0.5" for r in body["items"])
        assert not any(r["address"] == "2001:db8::1" for r in body["items"])
