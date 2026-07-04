"""
Pinning tests for _open_ssh_client (backend/app/ssh_utils.py).
Written before refactoring. paramiko is imported inside the function
(not at module scope), so patches target "paramiko.SSHClient" directly.
"""
from unittest.mock import MagicMock, patch

from app import models
from app.ssh_utils import _open_ssh_client


def _cred(**overrides):
    from app.crypto import encrypt_str
    defaults = dict(
        name="cred", username="root", auth_method="password",
        password=encrypt_str("s3cr3t"), port=22,
    )
    defaults.update(overrides)
    return models.SSHCredential(**defaults)


class TestOpenSshClientValidation:
    def test_no_password_or_key_raises_value_error(self):
        cred = _cred(auth_method="password", password=None)
        try:
            _open_ssh_client("10.0.0.5", cred)
            assert False, "expected ValueError"
        except ValueError as e:
            assert "no usable password or private key" in str(e)


class TestOpenSshClientPasswordAuth:
    def test_password_auth_connects_with_password_kwargs(self):
        cred = _cred()
        mock_client = MagicMock()
        mock_client.get_transport.return_value.get_remote_server_key.return_value.asbytes.return_value = b"keydata"

        with patch("paramiko.SSHClient", return_value=mock_client), \
             patch("os.path.exists", return_value=False):
            client, jump_client, host_key_fp = _open_ssh_client("10.0.0.5", cred)

        connect_kwargs = mock_client.connect.call_args.kwargs
        assert connect_kwargs["password"] == "s3cr3t"
        assert connect_kwargs["look_for_keys"] is False
        assert connect_kwargs["allow_agent"] is False
        assert jump_client is None
        assert host_key_fp is not None


class TestOpenSshClientKeyAuth:
    def test_key_auth_uses_pkey_not_password(self):
        from app.crypto import encrypt_str
        fake_key_pem = (
            "-----BEGIN OPENSSH PRIVATE KEY-----\nfake\n-----END OPENSSH PRIVATE KEY-----"
        )
        cred = _cred(auth_method="key", password=None, private_key=encrypt_str(fake_key_pem))
        mock_client = MagicMock()
        mock_client.get_transport.return_value.get_remote_server_key.return_value.asbytes.return_value = b"keydata"

        with patch("paramiko.SSHClient", return_value=mock_client), \
             patch("os.path.exists", return_value=False), \
             patch("app.ssh_utils._load_pkey", return_value="fake-pkey-object"):
            client, jump_client, host_key_fp = _open_ssh_client("10.0.0.5", cred)

        connect_kwargs = mock_client.connect.call_args.kwargs
        assert connect_kwargs["pkey"] == "fake-pkey-object"
        assert "password" not in connect_kwargs


class TestOpenSshClientJumpHost:
    def test_proxy_host_opens_jump_client_and_channel(self):
        from app.crypto import encrypt_str
        cred = _cred(proxy_host="jump.example.com", proxy_username="jumpuser",
                     proxy_password=encrypt_str("jumppass"))
        target_client = MagicMock()
        target_client.get_transport.return_value.get_remote_server_key.return_value.asbytes.return_value = b"keydata"
        jump_client = MagicMock()

        clients = iter([target_client, jump_client])

        def fake_ssh_client_ctor():
            return next(clients)

        with patch("paramiko.SSHClient", side_effect=fake_ssh_client_ctor), \
             patch("os.path.exists", return_value=False):
            client, returned_jump, host_key_fp = _open_ssh_client("10.0.0.5", cred)

        jump_client.connect.assert_called_once()
        jump_connect_kwargs = jump_client.connect.call_args.kwargs
        assert jump_connect_kwargs["hostname"] == "jump.example.com"
        assert jump_connect_kwargs["password"] == "jumppass"
        jump_client.get_transport.return_value.open_channel.assert_called_once()
        assert returned_jump is jump_client

    def test_known_hosts_file_present_loads_it_instead_of_system_keys(self):
        cred = _cred()
        mock_client = MagicMock()
        mock_client.get_transport.return_value.get_remote_server_key.return_value.asbytes.return_value = b"keydata"

        with patch("paramiko.SSHClient", return_value=mock_client), \
             patch("os.path.exists", return_value=True):
            _open_ssh_client("10.0.0.5", cred)

        mock_client.load_host_keys.assert_called_once()
        mock_client.load_system_host_keys.assert_not_called()


class TestOpenSshClientHostKeyFingerprint:
    def test_fingerprint_capture_failure_does_not_raise(self):
        cred = _cred()
        mock_client = MagicMock()
        mock_client.get_transport.return_value.get_remote_server_key.side_effect = RuntimeError("no key")

        with patch("paramiko.SSHClient", return_value=mock_client), \
             patch("os.path.exists", return_value=False):
            client, jump_client, host_key_fp = _open_ssh_client("10.0.0.5", cred)

        assert host_key_fp is None
