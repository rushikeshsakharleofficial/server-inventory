import dns.exception
import dns.resolver
import dns.rrset
import pytest

from app.providers import get_provider

ZONE = {
    ("example.com", "A"): ["192.0.2.1"],
    ("example.com", "MX"): ["10 mail.example.com."],
    ("example.com", "TXT"): ['"v=spf1 " "-all"'],
    ("www.example.com", "CNAME"): ["example.com."],
    ("api.example.com", "A"): ["192.0.2.7"],
}


def _fake_resolve(zone, wildcard=None, failing=()):
    def resolve(self, name, rtype, **kwargs):
        name = str(name).rstrip(".")
        if rtype in failing:
            raise dns.exception.Timeout()
        values = zone.get((name, rtype))
        if values is None and wildcard and rtype == "A" and name != "example.com":
            values = [wildcard]
        if values is None:
            raise dns.resolver.NoAnswer()

        class Answer:
            rrset = dns.rrset.from_text(name + ".", 300, "IN", rtype, *values)

        return Answer()

    return resolve


def _fetch(monkeypatch, **fake):
    monkeypatch.setattr(dns.resolver.Resolver, "resolve", _fake_resolve(**fake))
    provider = get_provider("generic-dns", {"domain": "example.com"})
    monkeypatch.setattr(type(provider), "_zone_transfer", lambda self, domain, ns: [])
    return {(r["name"], r["record_type"], r["content"]) for r in provider.fetch_domains()}


def test_collects_all_types_and_subdomains(monkeypatch):
    assert _fetch(monkeypatch, zone=ZONE, failing=("CAA",)) == {
        ("example.com", "A", "192.0.2.1"),
        ("example.com", "MX", "10 mail.example.com"),
        ("example.com", "TXT", "v=spf1 -all"),
        ("www.example.com", "CNAME", "example.com"),
        ("api.example.com", "A", "192.0.2.7"),
    }


def test_wildcard_does_not_invent_subdomains(monkeypatch):
    got = _fetch(monkeypatch, zone=ZONE, wildcard="192.0.2.99")
    assert ("*.example.com", "A", "192.0.2.99") in got
    assert ("api.example.com", "A", "192.0.2.7") in got
    assert not [r for r in got if r[2] == "192.0.2.99" and r[0] != "*.example.com"]


def test_resolver_outage_is_an_error_not_an_empty_zone(monkeypatch):
    with pytest.raises(dns.exception.Timeout):
        _fetch(monkeypatch, zone={}, failing=("A", "AAAA", "MX", "TXT", "NS", "SOA", "CAA", "CNAME"))
