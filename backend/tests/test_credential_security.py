"""Secrets must stay masked, and must not follow a changed destination."""
import pytest
from fastapi import HTTPException

from app.routers import credentials as c


def test_service_account_json_is_masked():
    assert c._mask_config({"service_account_json": '{"private_key":"x"}'}) == {"service_account_json": "***"}


def test_placeholder_and_blank_secrets_are_dropped():
    assert c._drop_placeholders({"password": "***", "api_token": "", "username": "u"}) == {"username": "u"}


def test_new_prism_url_needs_password():
    stored = {"prism_url": "https://a", "password": "p", "username": "u"}
    with pytest.raises(HTTPException):
        c._require_secrets_on_destination_change(stored, {"prism_url": "https://evil", "username": "u"})
    c._require_secrets_on_destination_change(stored, {"prism_url": "https://b", "password": "p"})
    c._require_secrets_on_destination_change(stored, {"prism_url": "https://a", "verify_ssl": "true"})
