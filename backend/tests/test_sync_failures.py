"""Provider failures must surface, not look like an empty account."""
import threading
import time

import pytest
import requests

from app.providers.digitalocean import DigitalOceanProvider
from app.routers import sync


def _response(status):
    resp = requests.Response()
    resp.status_code, resp._content = status, b"{}"
    return resp


@pytest.mark.parametrize("method", ["fetch_databases", "fetch_kubernetes", "fetch_block_storages"])
def test_api_error_raises_but_404_is_empty(monkeypatch, method):
    provider = DigitalOceanProvider({"api_token": "t"})
    monkeypatch.setattr(requests, "get", lambda *a, **k: _response(401))
    with pytest.raises(requests.HTTPError):
        getattr(provider, method)()
    monkeypatch.setattr(requests, "get", lambda *a, **k: _response(404))
    assert getattr(provider, method)() == []


def test_hung_provider_times_out(monkeypatch):
    class Hung:
        warnings: list = []

        def fetch_servers(self):
            time.sleep(3)

    monkeypatch.setattr(sync, "get_provider", lambda *a: Hung())
    monkeypatch.setattr(sync, "FETCH_TIMEOUT_S", 0.2)
    cred = type("C", (), {"provider": "x", "config": {}})()
    started = time.monotonic()
    with pytest.raises(RuntimeError, match="timed out"):
        sync._fetch_provider_servers(cred, threading.Event())
    assert time.monotonic() - started < 2
