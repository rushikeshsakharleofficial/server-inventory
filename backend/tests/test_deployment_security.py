"""Focused non-network security checks."""
import pytest
import paramiko
from app.config import validate_production_config
from app.ssh_utils import _new_client_with_host_keys


def set_secure_config(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("SECRET_KEY", "a" * 48)
    monkeypatch.setenv("API_KEY_PEPPER", "b" * 48)
    monkeypatch.setenv("POSTGRES_PASSWORD", "c" * 24)
    monkeypatch.setenv("CREDENTIAL_ENCRYPTION_KEY", "checked-by-crypto")


def test_production_rejects_example_secrets(monkeypatch):
    set_secure_config(monkeypatch)
    monkeypatch.setenv("API_KEY_PEPPER", "REPLACE_ME_RANDOM_PEPPER")
    with pytest.raises(RuntimeError, match="API_KEY_PEPPER"):
        validate_production_config()


def test_production_rejects_short_postgres_password(monkeypatch):
    set_secure_config(monkeypatch)
    monkeypatch.setenv("POSTGRES_PASSWORD", "short")
    with pytest.raises(RuntimeError, match="POSTGRES_PASSWORD"):
        validate_production_config()


def test_valid_production_config(monkeypatch):
    set_secure_config(monkeypatch)
    validate_production_config()


def test_new_ssh_hosts_are_rejected(monkeypatch, tmp_path):
    known_hosts = tmp_path / "known_hosts"
    known_hosts.write_text("")
    monkeypatch.setenv("SSH_KNOWN_HOSTS", str(known_hosts))
    client = _new_client_with_host_keys()
    try:
        assert isinstance(client._policy, paramiko.RejectPolicy)
    finally:
        client.close()
