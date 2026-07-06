from concurrent.futures import ThreadPoolExecutor
from typing import Any
from .base import CloudProvider

_ZONE_FETCH_WORKERS = 10


class CloudflareProvider(CloudProvider):
    """DNS-only provider — no compute servers, only zones/DNS records."""

    @property
    def provider_name(self) -> str:
        return "cloudflare"

    def fetch_servers(self) -> list[dict[str, Any]]:
        return []

    def fetch_domains(self) -> list[dict[str, Any]]:
        token = self.config["api_token"]
        email = self.config.get("email")
        # Global API Key (paired with account email) uses X-Auth headers;
        # scoped API Token (no email) uses Authorization: Bearer.
        if email:
            headers = {
                "X-Auth-Email": email,
                "X-Auth-Key": token,
                "Content-Type": "application/json",
            }
        else:
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            }

        zones = self._paginate("https://api.cloudflare.com/client/v4/zones", headers)

        def _fetch_zone_records(zone: dict[str, Any]) -> list[dict[str, Any]]:
            zone_status = zone.get("status", "unknown")
            rec_url = f"https://api.cloudflare.com/client/v4/zones/{zone['id']}/dns_records"
            return [
                {
                    "cloud_id": rec["id"],
                    "name": rec["name"],
                    "provider": "cloudflare",
                    "zone": zone.get("name"),
                    "record_type": rec.get("type"),
                    "content": rec.get("content"),
                    "ttl": rec.get("ttl"),
                    "proxied": rec.get("proxied"),
                    "status": zone_status,
                }
                for rec in self._paginate(rec_url, headers, per_page=100)
            ]

        records: list[dict[str, Any]] = []
        # One zone's DNS records is a small, independent HTTP round-trip — a
        # 50-zone account synced sequentially takes minutes; fan out instead.
        with ThreadPoolExecutor(max_workers=_ZONE_FETCH_WORKERS) as pool:
            for zone_records in pool.map(_fetch_zone_records, zones):
                records.extend(zone_records)
        return records

    @staticmethod
    def _paginate(url: str, headers: dict[str, str], per_page: int = 50) -> list[dict[str, Any]]:
        """Walk Cloudflare's page/total_pages pagination, return all `result` items.

        Retries on 429 honoring Retry-After — high concurrency across many
        zones/credentials can trip Cloudflare's rate limit even though each
        individual request is well-formed.
        """
        import requests
        from requests.adapters import HTTPAdapter
        from urllib3.util import Retry

        session = requests.Session()
        # total=3 → 3 retries after the initial attempt = 4 attempts total,
        # matching the previous `for _ in range(4)` loop. raise_on_status=False
        # so we still raise via resp.raise_for_status() below (same HTTPError
        # as before) instead of urllib3's RetryError.
        retry = Retry(
            total=3,
            status_forcelist=[429],
            respect_retry_after_header=True,
            backoff_factor=1,
            raise_on_status=False,
        )
        session.mount("http://", HTTPAdapter(max_retries=retry))
        session.mount("https://", HTTPAdapter(max_retries=retry))

        items: list[dict[str, Any]] = []
        page = 1
        while True:
            resp = session.get(url, headers=headers, params={"per_page": per_page, "page": page}, timeout=30)
            resp.raise_for_status()
            data = resp.json()
            items.extend(data.get("result") or [])
            info = data.get("result_info") or {}
            total_pages = info.get("total_pages", 1)
            if page >= total_pages:
                break
            page += 1
        return items
