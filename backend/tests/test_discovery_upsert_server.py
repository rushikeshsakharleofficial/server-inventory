"""
Pinning tests for upsert_server_and_ips (backend/app/discovery_service.py),
complexity 53 vs 15 allowed. Uses the real Postgres db_session fixture
since this function relies on postgresql.insert().on_conflict_do_update(),
a real Postgres feature.
"""
from app import models
from app.discovery_service import upsert_server_and_ips


def _facts(hostname="host1", os_name="Ubuntu 22.04", vcpu=4, memory_mb=8192, interfaces=None):
    return {
        "hostname": hostname,
        "os": os_name,
        "vcpu": vcpu,
        "memory_mb": memory_mb,
        "interfaces": interfaces if interfaces is not None else [],
    }


class TestUpsertServerAndIpsNewServer:
    def test_no_matched_server_creates_new_one(self, db_session):
        facts = _facts(interfaces=[
            {"name": "eth0", "mac": "aa:bb", "addresses": [{"address": "10.10.10.5", "cidr": "10.10.10.5/24", "ip_version": 4, "scope": "private"}]}
        ])
        signals = {"machine_id": "mach-123"}

        server, was_new = upsert_server_and_ips(db_session, None, signals, "fp-abc", facts, None, "10.10.10.5")
        db_session.commit()

        assert was_new is True
        assert server.id is not None
        assert server.name == "host1"
        assert server.provider == "on-prem"
        assert server.machine_id == "mach-123"
        assert server.ssh_host_key_fp == "fp-abc"
        assert server.private_ip == "10.10.10.5"

        ip_row = db_session.query(models.ServerIpAddress).filter_by(address="10.10.10.5").first()
        assert ip_row is not None
        assert ip_row.server_id == server.id
        assert ip_row.is_primary is True

    def test_loopback_and_link_local_addresses_never_stored(self, db_session):
        facts = _facts(interfaces=[
            {"name": "lo", "addresses": [{"address": "127.0.0.1", "scope": "loopback"}]},
            {"name": "eth0", "addresses": [{"address": "169.254.1.1", "scope": "link-local"}]},
        ])
        server, _ = upsert_server_and_ips(db_session, None, {}, None, facts, None, "1.2.3.4")
        db_session.commit()

        assert db_session.query(models.ServerIpAddress).filter_by(server_id=server.id).count() == 0


class TestUpsertServerAndIpsExistingServer:
    def test_matched_server_updates_only_blank_identity_fields(self, db_session):
        existing = models.Server(
            name="old-name", provider="on-prem", status="running",
            machine_id="existing-machine-id", vcpu=2,
        )
        db_session.add(existing)
        db_session.commit()
        db_session.refresh(existing)

        facts = _facts(hostname="new-hostname", vcpu=8, interfaces=[])
        signals = {"machine_id": "different-machine-id"}  # should NOT overwrite existing.machine_id

        server, was_new = upsert_server_and_ips(db_session, existing, signals, "fp-new", facts, None, "10.0.0.1")
        db_session.commit()

        assert was_new is False
        assert server.id == existing.id
        assert server.machine_id == "existing-machine-id"  # unchanged — was already populated
        assert server.hostname == "new-hostname"  # os/hostname always refreshed
        assert server.vcpu == 8  # vcpu always refreshed from facts
        assert server.ssh_host_key_fp == "fp-new"  # was blank, now filled

    def test_rediscovering_same_ip_reassigns_via_on_conflict(self, db_session):
        server_a = models.Server(name="server-a", provider="on-prem", status="running")
        server_b = models.Server(name="server-b", provider="on-prem", status="running")
        db_session.add_all([server_a, server_b])
        db_session.commit()
        db_session.refresh(server_a)
        db_session.refresh(server_b)

        shared_ip_facts = _facts(interfaces=[
            {"name": "eth0", "addresses": [{"address": "10.10.10.9", "scope": "private", "ip_version": 4}]}
        ])

        upsert_server_and_ips(db_session, server_a, {}, None, shared_ip_facts, None, "10.10.10.9")
        db_session.commit()

        # Now the same IP shows up on a scan matched to server_b (e.g. DHCP reassignment)
        upsert_server_and_ips(db_session, server_b, {}, None, shared_ip_facts, None, "10.10.10.9")
        db_session.commit()

        rows = db_session.query(models.ServerIpAddress).filter_by(address="10.10.10.9").all()
        assert len(rows) == 1  # global uniqueness held, not duplicated
        assert rows[0].server_id == server_b.id  # reassigned to the new owner


class TestUpsertServerAndIpsLegacyColumns:
    def test_public_and_private_ip_columns_populated_from_scopes(self, db_session):
        facts = _facts(interfaces=[
            {"name": "eth0", "addresses": [
                {"address": "10.0.0.5", "scope": "private", "ip_version": 4},
                {"address": "34.1.2.3", "scope": "public", "ip_version": 4},
            ]}
        ])
        server, _ = upsert_server_and_ips(db_session, None, {}, None, facts, None, "34.1.2.3")
        db_session.commit()

        assert server.public_ip == "34.1.2.3"
        assert server.private_ip == "10.0.0.5"
        assert set(server.ssh_info["all_ips"]) == {"10.0.0.5", "34.1.2.3"}

    def test_primary_flag_set_on_private_over_public(self, db_session):
        facts = _facts(interfaces=[
            {"name": "eth0", "addresses": [
                {"address": "10.0.0.5", "scope": "private", "ip_version": 4},
                {"address": "34.1.2.3", "scope": "public", "ip_version": 4},
            ]}
        ])
        server, _ = upsert_server_and_ips(db_session, None, {}, None, facts, None, "34.1.2.3")
        db_session.commit()

        rows = {r.address: r for r in db_session.query(models.ServerIpAddress).filter_by(server_id=server.id).all()}
        assert rows["10.0.0.5"].is_primary is True
        assert rows["34.1.2.3"].is_primary is False
