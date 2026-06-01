from typing import Any

from .base import CloudProvider

_BASE = "https://core.hivelocity.net/api/v2"

_POWER_STATUS_MAP: dict[str, str] = {
    "ON":  "running",
    "OFF": "stopped",
}


class HivelocityProvider(CloudProvider):
    @property
    def provider_name(self) -> str:
        return "hivelocity"

    def _headers(self) -> dict[str, str]:
        return {
            "X-API-KEY": self.config["api_key"],
            "Accept": "application/json",
        }

    def fetch_servers(self) -> list[dict[str, Any]]:
        import requests

        resp = requests.get(
            f"{_BASE}/device/",
            headers=self._headers(),
            timeout=30,
        )
        resp.raise_for_status()
        devices: list[dict[str, Any]] = resp.json()

        servers = []
        for dev in devices:
            location = dev.get("location") or {}
            billing  = dev.get("billingInfo") or {}

            # primaryIp can be IPv4 or IPv6; ipmiAddress is the out-of-band mgmt IP
            public_ip  = dev.get("primaryIp")
            private_ip = dev.get("ipmiAddress")  # OOB/IPMI, not a LAN private IP

            servers.append({
                "cloud_id":      str(dev["deviceId"]),
                "name":          dev.get("hostname") or dev.get("name", ""),
                "provider":      "hivelocity",
                "region":        location.get("facility"),
                "zone":          location.get("position"),
                "instance_type": dev.get("deviceType"),
                "status":        _POWER_STATUS_MAP.get(dev.get("powerStatus", ""), "unknown"),
                "public_ip":     public_ip,
                "private_ip":    private_ip,
                "vcpu":          None,
                "memory_gb":     None,
                "storage_gb":    None,
                "os":            None,
                "datacenter":    location.get("facility_title") or location.get("facility"),
                "hostname":      dev.get("hostname"),
                "tags":          {},
                "extra": {
                    "device_type_group": dev.get("deviceTypeGroup"),
                    "product_id":        dev.get("productId"),
                    "power_status":      dev.get("powerStatus"),
                    "sps_status":        dev.get("spsStatus"),
                    "billing_period":    billing.get("period"),
                    "billing_price":     billing.get("price"),
                    "ipmi_enabled":      dev.get("ipmiEnabled"),
                    "created_date":      dev.get("createdDate"),
                    "is_managed":        dev.get("isManaged"),
                    "service_plan":      dev.get("servicePlan"),
                },
            })
        return servers
