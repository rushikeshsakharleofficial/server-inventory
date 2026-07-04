"""
Pinning tests for resolve_server (backend/app/discovery_service.py),
complexity 18 vs 15 allowed. Pure DB-read function, uses the rollback
db_session fixture directly.
"""
from app import models
from app.discovery_service import resolve_server


def _make_server(db_session, **overrides):
    defaults = dict(name="srv", provider="on-prem", status="running")
    defaults.update(overrides)
    server = models.Server(**defaults)
    db_session.add(server)
    db_session.commit()
    db_session.refresh(server)
    return server


def _add_ip(db_session, server, address, mac_address=None):
    ip = models.ServerIpAddress(server_id=server.id, address=address, mac_address=mac_address)
    db_session.add(ip)
    db_session.commit()
    return ip


class TestResolveServerNoMatch:
    def test_empty_signals_and_no_ips_returns_none(self, db_session):
        server, reason = resolve_server(db_session, {}, None, [])
        assert server is None
        assert reason is None


class TestResolveServerMachineId:
    def test_single_hit_by_machine_id_wins(self, db_session):
        target = _make_server(db_session, machine_id="mach-1")
        _make_server(db_session, machine_id="mach-2")

        server, reason = resolve_server(db_session, {"machine_id": "mach-1"}, None, [])
        assert server.id == target.id
        assert reason == "machine_id"

    def test_multiple_hits_by_machine_id_falls_through(self, db_session):
        # cloned VMs sharing a machine_id — ambiguous, must not match
        s1 = _make_server(db_session, machine_id="dup-id")
        s2 = _make_server(db_session, machine_id="dup-id")

        server, reason = resolve_server(db_session, {"machine_id": "dup-id"}, None, [])
        assert server is None
        assert reason is None


class TestResolveServerPriorityOrder:
    def test_product_uuid_used_when_machine_id_absent(self, db_session):
        target = _make_server(db_session, product_uuid="uuid-1")
        server, reason = resolve_server(db_session, {"product_uuid": "uuid-1"}, None, [])
        assert server.id == target.id
        assert reason == "product_uuid"

    def test_ssh_host_key_fp_used_when_no_id_signals(self, db_session):
        target = _make_server(db_session, ssh_host_key_fp="fp-abc")
        server, reason = resolve_server(db_session, {}, "fp-abc", [])
        assert server.id == target.id
        assert reason == "ssh_host_key_fp"

    def test_machine_id_takes_priority_over_ssh_host_key_fp(self, db_session):
        by_machine = _make_server(db_session, machine_id="mach-x", ssh_host_key_fp="fp-y")
        server, reason = resolve_server(db_session, {"machine_id": "mach-x"}, "fp-y", [])
        assert server.id == by_machine.id
        assert reason == "machine_id"

    def test_hostname_and_mac_match_used_as_fallback(self, db_session):
        target = _make_server(db_session, hostname="host-a")
        _add_ip(db_session, target, "10.0.0.5", mac_address="aa:bb:cc")

        server, reason = resolve_server(
            db_session, {"hostname": "host-a", "primary_mac": "aa:bb:cc"}, None, []
        )
        assert server.id == target.id
        assert reason == "hostname_mac"

    def test_existing_ip_match_used_as_last_resort(self, db_session):
        target = _make_server(db_session)
        _add_ip(db_session, target, "10.10.10.9")

        server, reason = resolve_server(db_session, {}, None, ["10.10.10.9"])
        assert server.id == target.id
        assert reason == "existing_ip"


class TestResolveServerIpMatching:
    def test_legacy_public_private_ip_columns_also_match(self, db_session):
        target = _make_server(db_session, public_ip="34.1.2.3")
        server, reason = resolve_server(db_session, {}, None, ["34.1.2.3"])
        assert server.id == target.id
        assert reason == "existing_ip"

    def test_alias_and_legacy_match_same_server_deduped(self, db_session):
        target = _make_server(db_session, public_ip="34.1.2.3")
        _add_ip(db_session, target, "34.1.2.3")

        server, reason = resolve_server(db_session, {}, None, ["34.1.2.3"])
        assert server.id == target.id
        assert reason == "existing_ip"

    def test_multiple_servers_matching_different_ips_is_ambiguous(self, db_session):
        s1 = _make_server(db_session, public_ip="10.0.0.1")
        s2 = _make_server(db_session, public_ip="10.0.0.2")

        server, reason = resolve_server(db_session, {}, None, ["10.0.0.1", "10.0.0.2"])
        assert server is None
        assert reason is None
