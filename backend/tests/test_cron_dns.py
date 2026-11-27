"""Cron jobs sync DNS records, not only servers."""
import pytest

from app import scheduler
from app.routers import domains, sync


@pytest.mark.parametrize("target,expected", [
    ("dns", [("dns", None)]),
    ("generic-dns", [("dns", "generic-dns")]),
    ("cloudflare", [("dns", "cloudflare")]),
    ("aws", [("servers", "aws")]),
    (None, [("servers", None), ("dns", None)]),
])
def test_cron_target_picks_the_sync(monkeypatch, target, expected):
    calls = []
    monkeypatch.setattr(sync, "_run_sync", lambda p, url: calls.append(("servers", p)))
    monkeypatch.setattr(domains, "_sync_domains", lambda p, url: calls.append(("dns", p)))
    scheduler.run_job_sync(target, "db")
    assert calls == expected
