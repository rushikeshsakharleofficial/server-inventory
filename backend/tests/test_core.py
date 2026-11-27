"""Run inside the backend container: python -m pytest tests (needs the running Postgres)."""
import pytest
from cryptography.fernet import InvalidToken
from fastapi.testclient import TestClient

from app import crypto
from app.main import app

client = TestClient(app)


def test_decrypt_with_wrong_data_raises():
    with pytest.raises(InvalidToken):
        crypto.decrypt_str("not-a-valid-token")


def test_decrypt_roundtrip():
    assert crypto.decrypt_str(crypto.encrypt_str("pw")) == "pw"


def test_bad_token_is_rejected():
    assert client.get("/api/servers", headers={"Authorization": "Bearer nope"}).status_code == 401

