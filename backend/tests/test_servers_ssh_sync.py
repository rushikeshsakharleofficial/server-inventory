"""
Pinning tests for POST /api/servers/{id}/ssh-sync (ssh_sync_server), the
worst SonarCloud cognitive-complexity offender in this codebase (111 vs 15
allowed). Written BEFORE refactoring — must pass against the current,
unrefactored implementation first to prove they exercise the real branches,
then stay green after the refactor.
"""
from unittest.mock import MagicMock

import pytest

from app import models
from app.crypto import encrypt_str


def _make_server(db_session, **overrides):
    defaults = dict(
        name="ssh-test-server",
        provider="custom",
        status="unknown",
        public_ip="10.0.0.5",
    )
    defaults.update(overrides)
    server = models.Server(**defaults)
    db_session.add(server)
    db_session.commit()
    db_session.refresh(server)
    return server


def _make_ssh_cred(db_session, **overrides):
    defaults = dict(
        name="test-cred",
        username="root",
        auth_method="password",
        password=encrypt_str("s3cr3t"),
        port=22,
    )
    defaults.update(overrides)
    cred = models.SSHCredential(**defaults)
    db_session.add(cred)
    db_session.commit()
    db_session.refresh(cred)
    return cred


_IP_A_OUTPUT = (
    "1: lo: <LOOPBACK,UP> mtu 65536\n"
    "    inet 127.0.0.1/8 scope host lo\n"
    "2: eth0: <BROADCAST,MULTICAST,UP> mtu 1500\n"
    "    inet 10.0.0.5/24 brd 10.0.0.255 scope global eth0\n"
    "    inet6 fe80::1/64 scope link\n"
)
_FREE_M_OUTPUT = "              total        used        free\nMem:           7975        1234        2000\n"
_OS_RELEASE_OUTPUT = 'NAME="Ubuntu"\nPRETTY_NAME="Ubuntu 22.04.3 LTS"\n'


def _command_router(cmd: str) -> str:
    if cmd.startswith("ip a"):
        return _IP_A_OUTPUT
    if cmd.startswith("nproc"):
        return "4"
    if cmd.startswith("free -m"):
        return _FREE_M_OUTPUT
    if cmd.startswith("uname -r"):
        return "5.15.0-91-generic"
    if cmd.startswith("hostname -f"):
        return "ssh-test-host.example.com"
    if cmd.startswith("cat /etc/os-release"):
        return _OS_RELEASE_OUTPUT
    return ""


def _configure_exec_command(mock_ssh_client):
    def _exec_command(cmd, timeout=None):
        stdout = MagicMock()
        stdout.read.return_value = _command_router(cmd).encode("utf-8")
        return (MagicMock(), stdout, MagicMock())

    mock_ssh_client.exec_command.side_effect = _exec_command


class TestSshSyncServerHappyPath:
    def test_password_auth_gathers_and_persists_facts(
        self, auth_client, db_session, mock_ssh_client
    ):
        server = _make_server(db_session)
        cred = _make_ssh_cred(db_session)
        _configure_exec_command(mock_ssh_client)

        resp = auth_client.post(
            f"/api/servers/{server.id}/ssh-sync",
            params={"ssh_credential_id": cred.id},
        )

        assert resp.status_code == 200
        body = resp.json()
        assert body["vcpu"] == 4
        assert body["memory_gb"] == round(7975 / 1024, 1)
        assert body["os"] == "Ubuntu 22.04.3 LTS"
        assert body["hostname"] == "ssh-test-host.example.com"

        db_session.refresh(server)
        assert server.ssh_info["cpu_count"] == 4
        assert server.ssh_info["kernel"] == "5.15.0-91-generic"
        assert "10.0.0.5/24" in server.ssh_info["all_ips"]
        assert "127.0.0.1" not in "".join(server.ssh_info["all_ips"])
        assert "::1/128" not in server.ssh_info["all_ips"]

        mock_ssh_client.connect.assert_called_once()
        connect_kwargs = mock_ssh_client.connect.call_args.kwargs
        assert connect_kwargs["hostname"] == "10.0.0.5"
        assert connect_kwargs["password"] == "s3cr3t"
        assert connect_kwargs["look_for_keys"] is False

    def test_existing_fields_not_overwritten_except_os(
        self, auth_client, db_session, mock_ssh_client
    ):
        """OS is always refreshed from SSH (more accurate); vcpu/memory/hostname
        are only filled in if currently blank."""
        server = _make_server(
            db_session, vcpu=99, memory_gb=999.0, hostname="do-not-overwrite", os="OldOS"
        )
        cred = _make_ssh_cred(db_session)
        _configure_exec_command(mock_ssh_client)

        resp = auth_client.post(
            f"/api/servers/{server.id}/ssh-sync",
            params={"ssh_credential_id": cred.id},
        )

        assert resp.status_code == 200
        db_session.refresh(server)
        assert server.vcpu == 99
        assert server.memory_gb == pytest.approx(999.0)
        assert server.hostname == "do-not-overwrite"
        assert server.os == "Ubuntu 22.04.3 LTS"


class TestSshSyncServerKeyAuth:
    def test_key_auth_uses_pkey_not_password(self, auth_client, db_session, mock_ssh_client, monkeypatch):
        server = _make_server(db_session)
        from cryptography.hazmat.primitives.asymmetric import ed25519
        pkey = ed25519.Ed25519PrivateKey.generate()
        from cryptography.hazmat.primitives import serialization
        pem = pkey.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.OpenSSH,
            encryption_algorithm=serialization.NoEncryption(),
        ).decode()
        cred = _make_ssh_cred(
            db_session, auth_method="key", password=None, private_key=encrypt_str(pem)
        )
        _configure_exec_command(mock_ssh_client)

        resp = auth_client.post(
            f"/api/servers/{server.id}/ssh-sync",
            params={"ssh_credential_id": cred.id},
        )

        assert resp.status_code == 200
        connect_kwargs = mock_ssh_client.connect.call_args.kwargs
        assert "pkey" in connect_kwargs
        assert "password" not in connect_kwargs


class TestSshSyncServerValidation:
    def test_404_when_server_missing(self, auth_client):
        resp = auth_client.post(
            "/api/servers/999999/ssh-sync", params={"ssh_credential_id": 1}
        )
        assert resp.status_code == 404

    def test_400_when_server_has_no_ip(self, auth_client, db_session):
        server = _make_server(db_session, public_ip=None)
        cred = _make_ssh_cred(db_session)
        resp = auth_client.post(
            f"/api/servers/{server.id}/ssh-sync",
            params={"ssh_credential_id": cred.id},
        )
        assert resp.status_code == 400

    def test_404_when_ssh_credential_missing(self, auth_client, db_session):
        server = _make_server(db_session)
        resp = auth_client.post(
            f"/api/servers/{server.id}/ssh-sync",
            params={"ssh_credential_id": 999999},
        )
        assert resp.status_code == 404

    def test_400_when_key_auth_but_no_private_key(self, auth_client, db_session, mock_ssh_client):
        server = _make_server(db_session)
        cred = _make_ssh_cred(db_session, auth_method="key", password=None, private_key=None)

        resp = auth_client.post(
            f"/api/servers/{server.id}/ssh-sync",
            params={"ssh_credential_id": cred.id},
        )
        assert resp.status_code == 502
        assert "no private key" in resp.json()["detail"]


class TestSshSyncServerExceptionMapping:
    def test_auth_failure_maps_to_friendly_message(self, auth_client, db_session, mock_ssh_client):
        import paramiko

        server = _make_server(db_session)
        cred = _make_ssh_cred(db_session)
        mock_ssh_client.connect.side_effect = paramiko.AuthenticationException()

        resp = auth_client.post(
            f"/api/servers/{server.id}/ssh-sync",
            params={"ssh_credential_id": cred.id},
        )
        assert resp.status_code == 502
        assert "Authentication failed" in resp.json()["detail"]

    def test_timeout_maps_to_friendly_message(self, auth_client, db_session, mock_ssh_client):
        server = _make_server(db_session)
        cred = _make_ssh_cred(db_session)
        mock_ssh_client.connect.side_effect = OSError("Connection timed out")

        resp = auth_client.post(
            f"/api/servers/{server.id}/ssh-sync",
            params={"ssh_credential_id": cred.id},
        )
        assert resp.status_code == 502
        assert "timed out" in resp.json()["detail"].lower()

    def test_connection_refused_maps_to_friendly_message(self, auth_client, db_session, mock_ssh_client):
        server = _make_server(db_session)
        cred = _make_ssh_cred(db_session)
        mock_ssh_client.connect.side_effect = OSError("Connection refused")

        resp = auth_client.post(
            f"/api/servers/{server.id}/ssh-sync",
            params={"ssh_credential_id": cred.id},
        )
        assert resp.status_code == 502
        assert "refused" in resp.json()["detail"].lower()

    def test_unexpected_exception_maps_to_generic_message(self, auth_client, db_session, mock_ssh_client):
        server = _make_server(db_session)
        cred = _make_ssh_cred(db_session)
        mock_ssh_client.connect.side_effect = RuntimeError("something weird")

        resp = auth_client.post(
            f"/api/servers/{server.id}/ssh-sync",
            params={"ssh_credential_id": cred.id},
        )
        assert resp.status_code == 502
        assert "unexpected error" in resp.json()["detail"].lower()
