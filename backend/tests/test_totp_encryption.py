"""Tests for TOTP secret encrypt-at-rest via _get_totp_secret."""
import pytest
from unittest.mock import MagicMock


def _get_helpers():
    from app.routers.mfa import _get_totp_secret
    from app.crypto import encrypt_str, decrypt_str
    return _get_totp_secret, encrypt_str, decrypt_str


class TestGetTotpSecret:
    def test_returns_none_when_no_secret(self):
        _get_totp_secret, _, _ = _get_helpers()
        user = MagicMock()
        user.totp_secret = None
        assert _get_totp_secret(user) is None

    def test_returns_none_when_empty_string(self):
        _get_totp_secret, _, _ = _get_helpers()
        user = MagicMock()
        user.totp_secret = ""
        assert _get_totp_secret(user) is None

    def test_decrypts_stored_secret(self):
        _get_totp_secret, encrypt_str, _ = _get_helpers()
        plaintext = "JBSWY3DPEHPK3PXP"
        user = MagicMock()
        user.totp_secret = encrypt_str(plaintext)
        assert _get_totp_secret(user) == plaintext

    def test_different_secrets_decrypt_correctly(self):
        _get_totp_secret, encrypt_str, _ = _get_helpers()
        for secret in ("AAAAAAAAAAAAAAAA", "BBBBBBBBBBBBBBBB", "CCCCCCCCCCCCCCCC"):
            user = MagicMock()
            user.totp_secret = encrypt_str(secret)
            assert _get_totp_secret(user) == secret

    def test_encrypted_value_differs_from_plaintext(self):
        _, encrypt_str, _ = _get_helpers()
        plaintext = "JBSWY3DPEHPK3PXP"
        assert encrypt_str(plaintext) != plaintext
