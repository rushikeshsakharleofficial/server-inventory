"""Tests for validate_password password policy."""
import pytest
from fastapi import HTTPException


def _import_validate():
    from app.auth import validate_password
    return validate_password


class TestValidatePassword:
    def test_short_password_rejected(self):
        validate_password = _import_validate()
        with pytest.raises(HTTPException) as exc:
            validate_password("short")
        assert exc.value.status_code == 422
        assert "at least" in exc.value.detail

    def test_exactly_min_length_accepted(self):
        validate_password = _import_validate()
        validate_password("a" * 10)  # 10 chars, not in common list — should not raise

    def test_common_password_rejected(self):
        validate_password = _import_validate()
        # Only passwords ≥10 chars reach the blocklist check; short ones fail length first
        for pwd in ("Admin@1234", "password123"):
            with pytest.raises(HTTPException) as exc:
                validate_password(pwd)
            assert exc.value.status_code == 422
            assert "common" in exc.value.detail

    def test_common_password_case_insensitive(self):
        validate_password = _import_validate()
        with pytest.raises(HTTPException):
            validate_password("PASSWORD")  # "password".lower() in blocklist

    def test_strong_password_accepted(self):
        validate_password = _import_validate()
        validate_password("Tr0ub4dor&3xtra")  # strong, long, not in blocklist

    def test_custom_min_length(self):
        validate_password = _import_validate()
        with pytest.raises(HTTPException):
            validate_password("abc", min_length=5)
        validate_password("abcde", min_length=5)


class TestIsProduction:
    def test_production_env_detected(self):
        import os
        from unittest.mock import patch
        from app.auth import _is_production
        for env_name, val in [("ENVIRONMENT", "production"), ("APP_ENV", "prod"), ("ENV", "production")]:
            with patch.dict(os.environ, {env_name: val}, clear=False):
                assert _is_production()

    def test_dev_env_not_production(self):
        import os
        from unittest.mock import patch
        from app.auth import _is_production
        with patch.dict(os.environ, {"ENVIRONMENT": "development", "APP_ENV": "", "ENV": ""}, clear=False):
            assert not _is_production()
