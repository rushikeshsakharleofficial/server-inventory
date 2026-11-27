import paramiko
import pytest

from app import ssh_utils


def test_keys_merge_and_changed_key_is_rejected(tmp_path, monkeypatch):
    monkeypatch.setenv("SSH_KNOWN_HOSTS", str(tmp_path / "kh"))
    a, b = paramiko.RSAKey.generate(2048), paramiko.RSAKey.generate(2048)
    ssh_utils.save_host_key("h1", a)
    ssh_utils.save_host_key("h2", b)
    with pytest.raises(paramiko.BadHostKeyException):
        ssh_utils.save_host_key("h1", b)
    ssh_utils.save_host_key("h1", b, replace=True)
    keys = paramiko.HostKeys(str(tmp_path / "kh"))
    assert keys["h1"]["ssh-rsa"] == b and keys["h2"]["ssh-rsa"] == b
