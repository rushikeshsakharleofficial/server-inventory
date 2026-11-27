import hashlib
import uuid
from concurrent.futures import ThreadPoolExecutor
from typing import Any

import dns.exception
import dns.query
import dns.rdatatype
import dns.resolver
import dns.zone

from .base import CloudProvider

# Live public DNS lookups, not an authenticated provider API. No ownership
# verification of the domain is performed.
_APEX_TYPES = ("A", "AAAA", "CNAME", "MX", "TXT", "NS", "CAA")  # SOA serial changes each edit
_SUB_TYPES = ("A", "AAAA", "MX", "TXT")

# shortcut: public DNS cannot list a zone, so only these names are found unless
# zone transfer is allowed. Use a provider API (e.g. Cloudflare) for the full zone.
_SUBDOMAINS = (
    "www", "mail", "webmail", "smtp", "imap", "pop", "mx", "mx1", "mx2", "ftp", "sftp",
    "ns", "ns1", "ns2", "ns3", "api", "app", "admin", "portal", "dashboard", "panel",
    "cpanel", "whm", "webdisk", "autodiscover", "autoconfig", "dev", "test", "staging",
    "stage", "uat", "demo", "beta", "blog", "shop", "store", "docs", "help", "support",
    "status", "cdn", "static", "assets", "img", "media", "files", "vpn", "remote",
    "gateway", "git", "ci", "monitor", "db", "server", "cloud", "secure", "login",
    "sso", "auth", "m", "crm", "erp", "intranet", "backup",
    "_dmarc", "default._domainkey", "google._domainkey",
    "selector1._domainkey", "selector2._domainkey",
)


def _record(domain: str, name: str, record_type: str, content: str, ttl: int | None) -> dict[str, Any]:
    return {
        "cloud_id": hashlib.sha256(f"{name}:{record_type}:{content}".encode()).hexdigest()[:32],
        "name": name,
        "provider": "generic-dns",
        "zone": domain,
        "record_type": record_type,
        "content": content[:1024],
        "ttl": ttl,
        "proxied": None,
        "status": "active",
    }


def _content(rdata: Any) -> str:
    if rdata.rdtype == dns.rdatatype.TXT:
        return b"".join(rdata.strings).decode(errors="replace")
    text = rdata.to_text()
    return text if text.endswith(" .") else text.rstrip(".")  # keep the null MX "0 ."


class GenericDnsProvider(CloudProvider):
    """DNS-only provider for domains with no API credential — looks records up live."""

    @property
    def provider_name(self) -> str:
        return "generic-dns"

    def fetch_servers(self) -> list[dict[str, Any]]:
        return []

    def fetch_domains(self) -> list[dict[str, Any]]:
        domain = self.config["domain"]
        resolver = dns.resolver.Resolver()
        resolver.lifetime = 3
        errors: list[Exception] = []

        def lookup(name: str, record_type: str) -> list[tuple[str, int]]:
            try:
                answer = resolver.resolve(f"{name.rstrip('.')}.", record_type)
            except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer):
                return []
            except dns.exception.DNSException as e:  # one failed type must not drop the rest
                errors.append(e)
                return []
            return [(_content(r), answer.rrset.ttl) for r in answer.rrset]

        def records_for(name: str, types: tuple[str, ...]) -> list[dict[str, Any]]:
            return [
                _record(domain, name, t, content, ttl)
                for t in types
                for content, ttl in lookup(name, t)
            ]

        apex = records_for(domain, _APEX_TYPES)
        transferred = self._zone_transfer(
            domain, [r["content"] for r in apex if r["record_type"] == "NS"]
        )
        if transferred:
            return transferred

        # A random name that answers means a wildcard: probed names with the same
        # answer are not real records.
        wildcard = records_for(f"{uuid.uuid4().hex}.{domain}", ("CNAME", "A", "AAAA"))
        wildcard_answers = {(r["record_type"], r["content"]) for r in wildcard}

        def probe(label: str) -> list[dict[str, Any]]:
            name = f"{label}.{domain}"
            # A CNAME owns its name; querying A would follow it and mislabel the target.
            found = records_for(name, ("CNAME",)) or records_for(name, _SUB_TYPES)
            return [r for r in found if (r["record_type"], r["content"]) not in wildcard_answers]

        with ThreadPoolExecutor(max_workers=10) as pool:
            subs = [r for found in pool.map(probe, _SUBDOMAINS) for r in found]

        records = apex + subs + [
            _record(domain, f"*.{domain}", r["record_type"], r["content"], r["ttl"]) for r in wildcard
        ]
        if not records and errors:
            raise errors[0]
        return records

    def _zone_transfer(self, domain: str, nameservers: list[str]) -> list[dict[str, Any]]:
        """Full zone via AXFR. Most nameservers refuse it, which returns []."""
        for ns in nameservers:
            try:
                address = next(iter(dns.resolver.resolve(ns, "A"))).to_text()
                zone = dns.zone.from_xfr(
                    dns.query.xfr(address, domain, timeout=3, lifetime=10), relativize=False
                )
                return [
                    _record(domain, name.to_text().rstrip("."), dns.rdatatype.to_text(rdataset.rdtype),
                            _content(rdata), rdataset.ttl)
                    for name, rdataset in zone.iterate_rdatasets()
                    for rdata in rdataset
                    if rdataset.rdtype != dns.rdatatype.SOA
                ]
            except Exception:  # noqa: BLE001, S112 — refused or unreachable: try the next one
                continue
        return []
