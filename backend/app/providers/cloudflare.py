from typing import Any
from .base import CloudProvider


class CloudflareProvider(CloudProvider):
    """DNS-only provider — no compute servers, only zones/DNS records."""

    @property
    def provider_name(self) -> str:
        return "cloudflare"

    def fetch_servers(self) -> list[dict[str, Any]]:
        return []

    def fetch_domains(self) -> list[dict[str, Any]]:
        import requests

        token = self.config["api_token"]
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

        records: list[dict[str, Any]] = []
        for zone in self._paginate("https://api.cloudflare.com/client/v4/zones", headers):
            zone_status = zone.get("status", "unknown")
            rec_url = f"https://api.cloudflare.com/client/v4/zones/{zone['id']}/dns_records"
            for rec in self._paginate(rec_url, headers, per_page=100):
                records.append({
                    "cloud_id": rec["id"],
                    "name": rec["name"],
                    "provider": "cloudflare",
                    "zone": zone.get("name"),
                    "record_type": rec.get("type"),
                    "content": rec.get("content"),
                    "ttl": rec.get("ttl"),
                    "proxied": rec.get("proxied"),
                    "status": zone_status,
                })
        return records

    @staticmethod
    def _paginate(url: str, headers: dict[str, str], per_page: int = 50) -> list[dict[str, Any]]:
        """Walk Cloudflare's page/total_pages pagination, return all `result` items."""
        import requests

        items: list[dict[str, Any]] = []
        page = 1
        while True:
            resp = requests.get(url, headers=headers, params={"per_page": per_page, "page": page}, timeout=30)
            resp.raise_for_status()
            data = resp.json()
            items.extend(data.get("result") or [])
            info = data.get("result_info") or {}
            total_pages = info.get("total_pages", 1)
            if page >= total_pages:
                break
            page += 1
        return items
