"""Tests for recursive credential config masking and provider validation."""
import pytest


def _get_funcs():
    from app.routers.credentials import _mask_config, _field_is_secret, _KNOWN_PROVIDERS
    return _mask_config, _field_is_secret, _KNOWN_PROVIDERS


class TestFieldIsSecret:
    def test_secret_fields_detected(self):
        _, _field_is_secret, _ = _get_funcs()
        for name in ("secret_key", "access_key", "api_key", "password", "token",
                     "private_key", "client_secret", "auth_token", "credential"):
            assert _field_is_secret(name), f"{name} should be secret"

    def test_non_secret_fields_pass(self):
        _, _field_is_secret, _ = _get_funcs()
        for name in ("region", "project_id", "bucket_name", "username", "endpoint"):
            assert not _field_is_secret(name), f"{name} should not be secret"

    def test_case_insensitive(self):
        _, _field_is_secret, _ = _get_funcs()
        assert _field_is_secret("SECRET_KEY")
        assert _field_is_secret("Access_Key")


class TestMaskConfig:
    def test_masks_top_level_secret(self):
        _mask_config, _, _ = _get_funcs()
        result = _mask_config({"access_key": "AKIA123", "region": "us-east-1"})
        assert result["access_key"] == "***"
        assert result["region"] == "us-east-1"

    def test_masks_nested_secrets(self):
        _mask_config, _, _ = _get_funcs()
        # "credentials" key itself matches _field_is_secret (contains "credential"),
        # so use a non-secret parent key ("cloud_config") to test nested masking.
        cfg = {"project": "foo", "cloud_config": {"type": "service_account", "private_key": "PEM"}}
        result = _mask_config(cfg)
        assert result["project"] == "foo"
        assert result["cloud_config"]["private_key"] == "***"
        assert result["cloud_config"]["type"] == "service_account"

    def test_secret_parent_key_masked_entirely(self):
        _mask_config, _, _ = _get_funcs()
        # "credentials" key is itself secret — entire value becomes "***"
        cfg = {"name": "aws-prod", "credentials": {"access_key": "AKIA", "secret": "abc"}}
        result = _mask_config(cfg)
        assert result["name"] == "aws-prod"
        assert result["credentials"] == "***"

    def test_masks_inside_list(self):
        _mask_config, _, _ = _get_funcs()
        cfg = [{"token": "abc123", "name": "prod"}]
        result = _mask_config(cfg)
        assert result[0]["token"] == "***"
        assert result[0]["name"] == "prod"

    def test_non_dict_non_list_passthrough(self):
        _mask_config, _, _ = _get_funcs()
        assert _mask_config("plain string") == "plain string"
        assert _mask_config(42) == 42
        assert _mask_config(None) is None

    def test_empty_dict(self):
        _mask_config, _, _ = _get_funcs()
        assert _mask_config({}) == {}

    def test_deeply_nested(self):
        _mask_config, _, _ = _get_funcs()
        cfg = {"a": {"b": {"c": {"password": "secret", "label": "x"}}}}
        result = _mask_config(cfg)
        assert result["a"]["b"]["c"]["password"] == "***"
        assert result["a"]["b"]["c"]["label"] == "x"


class TestKnownProviders:
    def test_known_providers_set(self):
        _, _, _KNOWN_PROVIDERS = _get_funcs()
        for p in ("aws", "gcp", "azure", "digitalocean", "linode"):
            assert p in _KNOWN_PROVIDERS
