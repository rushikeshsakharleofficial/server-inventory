"""
Pinning tests for POST /api/servers/ssh-fetch-ips-stream (ssh_fetch_ips_stream),
complexity 48 vs 15 allowed. Written before refactoring.
"""
import json
from unittest.mock import patch

from app import models


def _make_ssh_cred(db_session, **overrides):
    from app.crypto import encrypt_str
    defaults = dict(
        name="stream-cred", username="root", auth_method="password",
        password=encrypt_str("s3cr3t"), is_default=True,
    )
    defaults.update(overrides)
    cred = models.SSHCredential(**defaults)
    db_session.add(cred)
    db_session.commit()
    db_session.refresh(cred)
    return cred


def _make_server(db_session, **overrides):
    defaults = dict(name="stream-server", provider="custom", status="unknown", public_ip="10.0.0.5")
    defaults.update(overrides)
    server = models.Server(**defaults)
    db_session.add(server)
    db_session.commit()
    db_session.refresh(server)
    return server


def _parse_ndjson(resp):
    return [json.loads(line) for line in resp.text.strip().splitlines() if line.strip()]


class TestSshFetchIpsStream:
    def test_no_ssh_credential_id_and_no_default_returns_400(self, auth_client, db_session):
        resp = auth_client.post("/api/servers/ssh-fetch-ips-stream")
        assert resp.status_code == 400

    def test_unknown_ssh_credential_id_returns_404(self, auth_client, db_session):
        resp = auth_client.post("/api/servers/ssh-fetch-ips-stream", params={"ssh_credential_id": 999999})
        assert resp.status_code == 404

    def test_streams_one_result_line_per_server(self, auth_client, db_session):
        _make_ssh_cred(db_session)
        _make_server(db_session, name="srv-a", public_ip="10.0.0.5")
        _make_server(db_session, name="srv-b", public_ip="10.0.0.6")

        with patch("app.routers.servers.fetch_ssh_ips", return_value=["10.0.0.5", "10.0.0.6"]), \
             patch.object(ws_manager_module(), "broadcast"):
            resp = auth_client.post("/api/servers/ssh-fetch-ips-stream")

        assert resp.status_code == 200
        results = _parse_ndjson(resp)
        assert len(results) == 2
        assert {r["server_name"] for r in results} == {"srv-a", "srv-b"}
        assert all(r["success"] for r in results)

    def test_server_with_no_public_or_private_ip_excluded_from_query(self, auth_client, db_session):
        # servers.py's initial query filters to public_ip != None OR private_ip != None,
        # so a fully-IP-less server never reaches the fetch/stream loop at all.
        _make_ssh_cred(db_session)
        server = models.Server(name="no-ip-server", provider="custom", status="unknown")
        db_session.add(server)
        db_session.commit()

        with patch("app.routers.servers.fetch_ssh_ips", return_value=[]), \
             patch.object(ws_manager_module(), "broadcast"):
            resp = auth_client.post("/api/servers/ssh-fetch-ips-stream")

        results = _parse_ndjson(resp)
        assert results == []

    def test_fetch_failure_for_one_server_does_not_abort_stream(self, auth_client, db_session):
        _make_ssh_cred(db_session)
        _make_server(db_session, name="srv-ok", public_ip="10.0.0.5")

        def _boom(host, cred):
            raise RuntimeError("ssh boom")

        with patch("app.routers.servers.fetch_ssh_ips", side_effect=_boom), \
             patch.object(ws_manager_module(), "broadcast"):
            resp = auth_client.post("/api/servers/ssh-fetch-ips-stream")

        assert resp.status_code == 200
        # the exception is swallowed inside the per-future try/except, so no result line emitted
        results = _parse_ndjson(resp)
        assert results == []

    def test_jump_host_setup_failure_yields_error_line_and_stops(self, auth_client, db_session):
        _make_ssh_cred(db_session, proxy_host="jump.example.com", proxy_username="jumpuser")
        _make_server(db_session)

        with patch("paramiko.SSHClient") as mock_cls:
            mock_cls.return_value.connect.side_effect = RuntimeError("jump unreachable")
            resp = auth_client.post("/api/servers/ssh-fetch-ips-stream")

        results = _parse_ndjson(resp)
        assert len(results) == 1
        assert "error" in results[0]
        assert "jump unreachable" in results[0]["error"]

    def test_commits_db_when_servers_changed(self, auth_client, db_session):
        _make_ssh_cred(db_session)
        _make_server(db_session, name="srv-commit", public_ip="10.0.0.7")

        with patch("app.routers.servers.fetch_ssh_ips", return_value=["10.0.0.7"]), \
             patch.object(ws_manager_module(), "broadcast"):
            resp = auth_client.post("/api/servers/ssh-fetch-ips-stream")

        _parse_ndjson(resp)  # drain the stream so generator's finally block runs
        db_session.expire_all()
        srv = db_session.query(models.Server).filter_by(name="srv-commit").first()
        assert srv.ssh_info == {"all_ips": ["10.0.0.7"]}


def ws_manager_module():
    from app.routers import servers
    return servers.ws_manager
