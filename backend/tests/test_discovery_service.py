"""Tests for the pure, DB-free functions in app.discovery_service.

discovery_service.py is a frozen contract (per plan) — not modified here.

DB-touching approach: resolve_server / check_identity_conflict call
db.query(models.Server)...filter(...).all()/.first()/.join(...).distinct()
chains. A full in-memory SQLite Base.metadata.create_all() is not viable —
several models use postgres-only JSONB columns and partial/GIN indexes
(postgresql_where/postgresql_using), which SQLite's DDL compiler rejects.

Instead this file uses a tiny in-memory fake session (_FakeSession/_FakeQuery
below) seeded with real (unpersisted) models.Server / models.ServerIpAddress
instances. The fake query evaluates SQLAlchemy filter clauses generically by
introspecting (table name, column key, operator, bound value) off each
BinaryExpression/BooleanClauseList — it does not hardcode per-callsite query
shapes, so it exercises resolve_server's actual filter/join logic rather than
re-implementing it. This lets us test resolve_server and
check_identity_conflict directly (stronger than a policy-only dict test),
per the plan's stated preference.

upsert_server_and_ips is out of scope (integration-level, needs a real
Postgres session for pg_insert) and is not tested here.
"""
import operator as op_mod

import pytest

from app import models
from app.discovery_service import (
    check_identity_conflict,
    compute_identity_hash,
    expand_cidr,
    extract_identity_signals,
    resolve_server,
    validate_cidr,
)
from app.ssh_utils import _classify_ip_scope


# ─── Fake session: generic clause evaluator, seeded with real model objects ──

class _FakeQuery:
    def __init__(self, session, model):
        self.session = session
        self.model = model
        self.clauses = []
        self.joined = False

    def join(self, *args, **kwargs):
        self.joined = True
        return self

    def filter(self, *clauses):
        self.clauses.extend(clauses)
        return self

    def distinct(self):
        return self

    def _matches(self, server):
        ip_rows = [r for r in self.session.ip_addresses if r.server_id == server.id]
        for clause in self.clauses:
            if not self._eval_clause(clause, server, ip_rows):
                return False
        return True

    def _eval_clause(self, clause, server, ip_rows):
        # BooleanClauseList: e.g. (Server.public_ip.in_(x) | Server.private_ip.in_(x))
        sub = getattr(clause, "clauses", None)
        if sub is not None:
            results = [self._eval_clause(c, server, ip_rows) for c in sub]
            if clause.operator is op_mod.or_:
                return any(results)
            return all(results)  # and_

        table_name = clause.left.table.name
        col_key = clause.left.key
        operator_fn = clause.operator
        value = getattr(clause.right, "value", None)

        if table_name == "servers":
            actual = getattr(server, col_key)
            if operator_fn is op_mod.eq:
                return actual == value
            # in_() compiles to a different operator; detect via clause type name
            if "in_op" in repr(operator_fn) or "in" in operator_fn.__name__:
                return actual in value
            raise NotImplementedError(f"unsupported operator {operator_fn} on servers.{col_key}")

        if table_name == "server_ip_addresses":
            if operator_fn is op_mod.eq:
                return any(getattr(r, col_key) == value for r in ip_rows)
            if "in_op" in repr(operator_fn) or "in" in operator_fn.__name__:
                return any(getattr(r, col_key) in value for r in ip_rows)
            raise NotImplementedError(f"unsupported operator {operator_fn} on server_ip_addresses.{col_key}")

        raise NotImplementedError(f"unsupported table {table_name}")

    def all(self):
        if self.model is models.Server:
            return [s for s in self.session.servers if self._matches(s)]
        raise NotImplementedError("only querying models.Server is exercised by discovery_service")

    def first(self):
        hits = self.all()
        return hits[0] if hits else None


class _FakeSession:
    """Seed with .servers (list[models.Server]) and .ip_addresses
    (list[models.ServerIpAddress], each with .server_id set)."""

    def __init__(self, servers=None, ip_addresses=None):
        self.servers = servers or []
        self.ip_addresses = ip_addresses or []

    def query(self, model):
        return _FakeQuery(self, model)


def _server(id, **kwargs):
    s = models.Server(name=f"s{id}", provider="on-prem")
    s.id = id
    for k, v in kwargs.items():
        setattr(s, k, v)
    return s


def _ip(server_id, address, mac_address=None):
    return models.ServerIpAddress(server_id=server_id, address=address, mac_address=mac_address)


# ─── validate_cidr ──────────────────────────────────────────────────────────

class TestValidateCidr:
    def test_validate_cidr_accepts_valid_ipv4(self):
        net = validate_cidr("10.10.10.0/24")
        assert net.num_addresses == 256

    def test_validate_cidr_rejects_invalid_string(self):
        with pytest.raises(ValueError):
            validate_cidr("not-a-cidr")

    def test_validate_cidr_rejects_ipv6(self):
        with pytest.raises(ValueError):
            validate_cidr("2001:db8::/32")

    def test_validate_cidr_rejects_oversized_range(self):
        with pytest.raises(ValueError):
            validate_cidr("10.0.0.0/8", max_ips=4096)
        validate_cidr("10.0.0.0/8", max_ips=20_000_000)  # does not raise


# ─── expand_cidr ────────────────────────────────────────────────────────────

class TestExpandCidr:
    def test_expand_cidr_host_count(self):
        net = validate_cidr("10.10.10.0/30")
        ips = expand_cidr(net)
        assert len(ips) == 2
        assert "10.10.10.0" not in ips  # network address excluded
        assert "10.10.10.3" not in ips  # broadcast excluded


# ─── _classify_ip_scope (ssh_utils) ─────────────────────────────────────────

class TestClassifyScope:
    def test_classify_scope(self):
        assert _classify_ip_scope("127.0.0.1") == "loopback"
        assert _classify_ip_scope("169.254.1.1") == "link-local"
        assert _classify_ip_scope("10.0.0.5") == "private"
        assert _classify_ip_scope("192.168.1.1") == "private"
        assert _classify_ip_scope("172.16.0.1") == "private"
        assert _classify_ip_scope("8.8.8.8") == "public"


# ─── compute_identity_hash ──────────────────────────────────────────────────

class TestComputeIdentityHash:
    def test_compute_identity_hash_deterministic(self):
        h1 = compute_identity_hash("machine_id", "abc123")
        h2 = compute_identity_hash("machine_id", "abc123")
        assert h1 == h2
        h3 = compute_identity_hash("machine_id", "different")
        assert h1 != h3


# ─── extract_identity_signals ───────────────────────────────────────────────

class TestExtractIdentitySignals:
    def test_extract_identity_signals_valid(self):
        facts = {
            "machine_id": "abcd1234abcd1234abcd1234abcd1234",
            "product_uuid": "4c4c4544-0044-3010-8047-b9c04f503333",
            "hostname": "Web-Server-01",
            "interfaces": [
                {
                    "name": "eth0",
                    "mac": "AA:BB:CC:DD:EE:FF",
                    "addresses": [{"address": "10.0.0.5", "scope": "private"}],
                }
            ],
        }
        signals = extract_identity_signals(facts)
        assert signals["machine_id"] == "abcd1234abcd1234abcd1234abcd1234"
        assert signals["product_uuid"] == "4c4c4544-0044-3010-8047-b9c04f503333"
        assert signals["hostname"] == "web-server-01"
        assert signals["primary_mac"] == "aa:bb:cc:dd:ee:ff"

    def test_extract_identity_signals_rejects_sentinels(self):
        facts = {
            "machine_id": "0" * 32,
            "product_uuid": "Not Settable",
            "hostname": None,
            "interfaces": [],
        }
        signals = extract_identity_signals(facts)
        assert signals["machine_id"] is None
        assert signals["product_uuid"] is None

    def test_extract_identity_signals_skips_link_local_only_interfaces(self):
        facts = {
            "machine_id": None,
            "product_uuid": None,
            "hostname": "host1",
            "interfaces": [
                {
                    "name": "eth0",
                    "mac": "11:11:11:11:11:11",
                    "addresses": [{"address": "169.254.1.5", "scope": "link-local"}],
                },
                {
                    "name": "eth1",
                    "mac": "22:22:22:22:22:22",
                    "addresses": [{"address": "10.0.0.9", "scope": "private"}],
                },
            ],
        }
        signals = extract_identity_signals(facts)
        assert signals["primary_mac"] == "22:22:22:22:22:22"


# ─── resolve_server (fake session) ──────────────────────────────────────────

class TestResolveServer:
    def test_identity_priority_ordering(self):
        # machine_id matches server A, product_uuid (independently) matches
        # server B. resolve_server must return A — proving machine_id is
        # checked, and returned on, before product_uuid is ever queried.
        server_a = _server(1, machine_id="mid-a", product_uuid=None)
        server_b = _server(2, machine_id=None, product_uuid="puid-b")
        db = _FakeSession(servers=[server_a, server_b])

        signals = {"machine_id": "mid-a", "product_uuid": "puid-b", "hostname": None, "primary_mac": None}
        server, signal_name = resolve_server(db, signals, None, [])
        assert server is server_a
        assert signal_name == "machine_id"

    def test_no_duplicate_server_for_multiple_ips_same_host(self):
        server_a = _server(1, machine_id="mid-shared")
        db = _FakeSession(servers=[server_a])

        signals = {"machine_id": "mid-shared", "product_uuid": None, "hostname": None, "primary_mac": None}
        s1, sig1 = resolve_server(db, signals, None, ["10.0.0.1"])
        s2, sig2 = resolve_server(db, signals, None, ["10.0.0.2", "10.0.0.3"])

        assert s1 is server_a
        assert s2 is server_a
        assert s1.id == s2.id
        assert sig1 == sig2 == "machine_id"

    def test_no_match_returns_none(self):
        db = _FakeSession(servers=[])
        signals = {"machine_id": None, "product_uuid": None, "hostname": None, "primary_mac": None}
        server, signal_name = resolve_server(db, signals, None, [])
        assert server is None
        assert signal_name is None

    def test_ambiguous_signal_falls_through_to_next(self):
        # Two servers share the same machine_id (cloned VMs) -> ambiguous ->
        # falls through; product_uuid uniquely matches one -> that one wins.
        server_a = _server(1, machine_id="mid-dup", product_uuid=None)
        server_b = _server(2, machine_id="mid-dup", product_uuid="puid-unique")
        db = _FakeSession(servers=[server_a, server_b])

        signals = {"machine_id": "mid-dup", "product_uuid": "puid-unique", "hostname": None, "primary_mac": None}
        server, signal_name = resolve_server(db, signals, None, [])
        assert server is server_b
        assert signal_name == "product_uuid"

    def test_existing_ip_match_via_legacy_columns(self):
        server_a = _server(1, public_ip="8.8.8.8", private_ip=None)
        db = _FakeSession(servers=[server_a])

        signals = {"machine_id": None, "product_uuid": None, "hostname": None, "primary_mac": None}
        server, signal_name = resolve_server(db, signals, None, ["8.8.8.8"])
        assert server is server_a
        assert signal_name == "existing_ip"


# ─── check_identity_conflict (fake session) ─────────────────────────────────

class TestCheckIdentityConflict:
    def test_flags_conflict_with_lower_priority_signal(self):
        matched = _server(1, machine_id="mid-1")
        other = _server(2, product_uuid="puid-2")
        db = _FakeSession(servers=[matched, other])

        signals = {"machine_id": "mid-1", "product_uuid": "puid-2", "hostname": None, "primary_mac": None}
        conflict = check_identity_conflict(db, signals, matched, "machine_id", ssh_host_key_fp=None)
        assert conflict == {"other_signal": "product_uuid", "other_server_id": 2}

    def test_no_conflict_when_signals_agree(self):
        matched = _server(1, machine_id="mid-1", product_uuid="puid-1")
        db = _FakeSession(servers=[matched])

        signals = {"machine_id": "mid-1", "product_uuid": "puid-1", "hostname": None, "primary_mac": None}
        conflict = check_identity_conflict(db, signals, matched, "machine_id", ssh_host_key_fp=None)
        assert conflict is None
