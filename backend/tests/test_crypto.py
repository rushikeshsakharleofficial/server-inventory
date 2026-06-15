"""Tests for crypto encrypt/decrypt round-trips."""
import os
import pytest
from cryptography.fernet import Fernet


def _get_fernet_module():
    import importlib
    import app.crypto as crypto_mod
    importlib.reload(crypto_mod)
    return crypto_mod


class TestEncryptStr:
    def test_round_trip(self):
        from app.crypto import encrypt_str, decrypt_str
        plaintext = "my-totp-secret-ABCDEFGH"
        ciphertext = encrypt_str(plaintext)
        assert ciphertext != plaintext
        assert decrypt_str(ciphertext) == plaintext

    def test_ciphertext_not_plaintext(self):
        from app.crypto import encrypt_str
        result = encrypt_str("super-secret")
        assert "super-secret" not in result

    def test_decrypt_invalid_token_returns_input(self):
        from app.crypto import decrypt_str
        bad = "not-valid-fernet-token"
        result = decrypt_str(bad)
        assert result == bad  # graceful fallback

    def test_different_values_produce_different_ciphertexts(self):
        from app.crypto import encrypt_str
        c1 = encrypt_str("value-one")
        c2 = encrypt_str("value-two")
        assert c1 != c2


class TestEncryptConfig:
    def test_round_trip(self):
        from app.crypto import encrypt_config, decrypt_config
        cfg = {"access_key": "AKIA123", "secret_key": "abc/xyz", "region": "us-east-1"}
        encrypted = encrypt_config(cfg)
        assert "_enc" in encrypted
        assert encrypted["_enc"] != str(cfg)
        restored = decrypt_config(encrypted)
        assert restored == cfg

    def test_unencrypted_dict_passthrough(self):
        from app.crypto import decrypt_config
        raw = {"key": "value", "num": 42}
        assert decrypt_config(raw) == raw

    def test_invalid_enc_returns_input(self):
        from app.crypto import decrypt_config
        bad = {"_enc": "not-valid-ciphertext"}
        result = decrypt_config(bad)
        assert result == bad

    def test_empty_config_round_trip(self):
        from app.crypto import encrypt_config, decrypt_config
        assert decrypt_config(encrypt_config({})) == {}

    def test_nested_config_round_trip(self):
        from app.crypto import encrypt_config, decrypt_config
        cfg = {"project": "my-proj", "credentials": {"type": "service_account", "private_key": "PEM"}}
        assert decrypt_config(encrypt_config(cfg)) == cfg
