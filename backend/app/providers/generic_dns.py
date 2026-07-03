import hashlib
import socket
from typing import Any

from .base import CloudProvider

# Live public DNS resolution via stdlib socket — not an authenticated
# provider API. No ownership verification of the domain is performed;
# this just resolves whatever A/AAAA records are publicly visible.
_FAMILY_TO_RECORD_TYPE = {
    socket.AF_INET: "A",
    socket.AF_INET6: "AAAA",
}


class GenericDnsProvider(CloudProvider):
    """DNS-only provider for domains with no API credential — resolves A/AAAA live."""

    @property
    def provider_name(self) -> str:
        return "generic-dns"

    def fetch_servers(self) -> list[dict[str, Any]]:
        return []

    def fetch_domains(self) -> list[dict[str, Any]]:
        domain = self.config["domain"]
        try:
            addr_info = socket.getaddrinfo(domain, None)
        except socket.gaierror:
            return []

        seen: set[tuple[int, str]] = set()
        records: list[dict[str, Any]] = []
        for family, _, _, _, sockaddr in addr_info:
            record_type = _FAMILY_TO_RECORD_TYPE.get(family)
            if record_type is None:
                continue
            address = sockaddr[0]
            key = (family, address)
            if key in seen:
                continue
            seen.add(key)
            records.append({
                "cloud_id": hashlib.sha256(f"{domain}:{record_type}:{address}".encode()).hexdigest()[:32],
                "name": domain,
                "provider": "generic-dns",
                "zone": domain,
                "record_type": record_type,
                "content": address,
                "ttl": None,
                "proxied": None,
                "status": "active",
            })
        return records
