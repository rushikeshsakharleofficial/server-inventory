import concurrent.futures
import hashlib
import re
import time
import urllib.parse
from collections.abc import Callable
from concurrent.futures import Future, ThreadPoolExecutor, as_completed
from typing import Any, cast

from .base import CloudProvider

# Type alias used inside nested functions (must be module-level for mypy)
_ServerDict = dict[str, Any]

# Dedicated server states ("ok" = normal operation — most common state)
DEDICATED_STATUS = {
    'ok':                'running',
    'active':            'running',
    'poweron':           'running',
    'hacked':            'stopped',
    'hackedBlocked':     'stopped',
    'locked':            'stopped',
    'disabled':          'stopped',
    'toDelete':          'terminated',
    'installing':        'pending',
    'upgradeRequested':  'pending',
    'maintenance':       'pending',
    'unknown':           'unknown',
}

VPS_STATUS = {
    'running':     'running',
    'stopped':     'stopped',
    'maintenance': 'pending',
    'installing':  'pending',
    'unknown':     'unknown',
}

CLOUD_STATUS = {
    'ACTIVE':        'running',
    'SHUTOFF':       'stopped',
    'SUSPENDED':     'stopped',
    'SHELVED':       'stopped',
    'BUILD':         'pending',
    'REBUILD':       'pending',
    'MIGRATING':     'pending',
    'RESCUE':        'pending',
    'ERROR':         'stopped',
    'DELETED':       'terminated',
    'SOFT_DELETED':  'terminated',
    'UNKNOWN':       'unknown',
}


_OVH_OS_MAP: dict[str, str | Callable[["re.Match[str]"], str]] = {
    # Ubuntu
    r'ubuntu(2404|24\.04)': 'Ubuntu 24.04 LTS',
    r'ubuntu(2204|22\.04)': 'Ubuntu 22.04 LTS',
    r'ubuntu(2004|20\.04)': 'Ubuntu 20.04 LTS',
    r'ubuntu(1804|18\.04)': 'Ubuntu 18.04 LTS',
    # Debian
    r'debian12':   'Debian 12 (Bookworm)',
    r'debian11':   'Debian 11 (Bullseye)',
    r'debian10':   'Debian 10 (Buster)',
    r'debian9':    'Debian 9 (Stretch)',
    # AlmaLinux
    r'almalinux9': 'AlmaLinux 9',
    r'almalinux8': 'AlmaLinux 8',
    # Rocky
    r'rocky(linux)?9': 'Rocky Linux 9',
    r'rocky(linux)?8': 'Rocky Linux 8',
    # CentOS
    r'centos-?stream9': 'CentOS Stream 9',
    r'centos-?stream8': 'CentOS Stream 8',
    r'centos7':    'CentOS 7',
    # Windows
    r'win2022':    'Windows Server 2022',
    r'win2019':    'Windows Server 2019',
    r'win2016':    'Windows Server 2016',
    # Fedora
    r'fedora(\d+)': lambda m: f'Fedora {m.group(1)}',
    # Arch
    r'archlinux':  'Arch Linux',
    # FreeBSD
    r'freebsd(\d+)': lambda m: f'FreeBSD {m.group(1)}',
}


def _prettify_os(raw: str | None) -> str | None:
    """Convert OVH OS template codes to human-readable names."""
    if not raw:
        return None
    low = raw.lower()
    for pattern, result in _OVH_OS_MAP.items():
        m = re.search(pattern, low)
        if m:
            return str(result(m)) if callable(result) else result
    # Fall back to cleaned-up version of raw string
    cleaned = re.sub(r'[-_](server|64|32|server_64|server_32)$', '', raw, flags=re.I)
    cleaned = re.sub(r'[-_]', ' ', cleaned).title()
    return cleaned or raw


def _ovh_get_distribution(endpoint: str, app_key: str, app_secret: str,
                           consumer_key: str, vps_name: str) -> str | None:
    """Fetch VPS distribution via raw HTTP, trying full FQDN then short ID.
    Returns None if the VPS plan doesn't expose distribution info via the API."""
    import requests as req_lib
    _ENDPOINT_URLS = {
        'ovh-eu': 'https://eu.api.ovh.com/1.0',
        'ovh-us': 'https://api.us.ovhcloud.com/1.0',
        'ovh-ca': 'https://ca.api.ovh.com/1.0',
    }
    base = _ENDPOINT_URLS.get(endpoint, 'https://eu.api.ovh.com/1.0')
    short_name = vps_name.split('.')[0] if '.' in vps_name else vps_name
    for name_variant in [vps_name, short_name]:
        try:
            encoded = urllib.parse.quote(name_variant, safe='')
            url = f"{base}/vps/{encoded}/distribution"
            ts  = str(int(time.time()))
            presign = "+".join([app_secret, consumer_key, "GET", url, "", ts])
            sig = "$1$" + hashlib.sha1(presign.encode('utf-8')).hexdigest()
            resp = req_lib.get(url, headers={
                "X-Ovh-Application": app_key,
                "X-Ovh-Consumer":    consumer_key,
                "X-Ovh-Signature":   sig,
                "X-Ovh-Timestamp":   ts,
            }, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                if isinstance(data, dict):
                    raw: str | None = data.get("name") or data.get("id")
                    return raw
                if isinstance(data, str):
                    return data
        except Exception:
            pass
    return None


def _clean_zone(zone: str | None) -> str | None:
    """Strip OVH verbose zone prefix: 'Region OpenStack: os-us-east-va-2' → 'us-east-va-2'"""
    if not zone:
        return zone
    if "OpenStack:" in zone:
        raw = zone.split(":")[-1].strip()
        # strip leading "os-" prefix
        return raw[3:] if raw.startswith("os-") else raw
    return zone


def _first_ipv4(ip_list: list[Any]) -> str | None:
    for ip in ip_list:
        val = ip.get("ip") if isinstance(ip, dict) else str(ip)
        if val and ":" not in val:
            return val
    return None


class OVHProvider(CloudProvider):
    @property
    def provider_name(self) -> str:
        return "ovh"

    def fetch_servers(self) -> list[dict[str, Any]]:
        try:
            import ovh as ovh_sdk
        except ImportError:
            raise RuntimeError("ovh package not installed. Run: pip install ovh")

        _OVH_AUTH_MSG = (
            "OVH authentication failed. To fix:\n"
            "1. Create an app at https://eu.api.ovh.com/createApp/ → get application_key + application_secret\n"
            "2. Generate a consumer_key at https://eu.api.ovh.com/createToken/ with rights:\n"
            "   GET /me, GET /dedicated/server, GET /dedicated/server/*,\n"
            "   GET /vps, GET /vps/*, GET /cloud/project, GET /cloud/project/*\n"
            "3. Update this credential's endpoint to ovh-eu (not ovh-us)\n"
            "Then update the credential with all three new values."
        )

        try:
            client = ovh_sdk.Client(
                endpoint=self.config.get("endpoint", "ovh-eu"),
                application_key=self.config["application_key"],
                application_secret=self.config["application_secret"],
                consumer_key=self.config["consumer_key"],
                timeout=20,
            )
            # Validate credentials immediately — cheap call, catches bad keys early
            client.get("/me")
        except Exception as _auth_err:
            _msg = str(_auth_err).lower()
            if any(k in _msg for k in ("invalid", "unauthorized", "forbidden", "application key", "consumer key", "credentials")):
                raise RuntimeError(_OVH_AUTH_MSG) from _auth_err
            raise

        servers: list[dict[str, Any]] = []
        errors: list[str] = []

        # ── Dedicated servers ──────────────────────────────────────────────
        try:
            names: list[str] = client.get("/dedicated/server")

            def fetch_dedicated(name: str) -> dict[str, Any] | None:
                try:
                    s = client.get(f"/dedicated/server/{name}")
                    state       = s.get("state", "unknown")
                    power_state = s.get("powerState", "")
                    # "ok" + powerState determines running vs stopped
                    if state == "ok":
                        status = "running" if power_state == "poweron" else "stopped"
                    else:
                        status = DEDICATED_STATUS.get(state, "unknown")

                    # IP is directly in the response — no extra API call
                    public_ip = s.get("ip")

                    # OS: try direct field first, fallback to install/status
                    raw_os = s.get("os") or None
                    if not raw_os:
                        try:
                            install = client.get(f"/dedicated/server/{name}/install/status")
                            raw_os = install.get("templateName") or install.get("template")
                        except Exception:
                            pass
                    os_name = _prettify_os(raw_os)

                    return {
                        "cloud_id":      name,
                        "name":          s.get("name", name),
                        "provider":      "ovh",
                        "region":        s.get("region") or s.get("datacenter"),
                        "instance_type": s.get("commercialRange") or s.get("rack"),
                        "status":        status,
                        "public_ip":     public_ip,
                        "private_ip":    None,
                        "os":            os_name,
                        "tags":          {},
                        "extra": {
                            "type":           "dedicated",
                            "datacenter":     s.get("datacenter"),
                            "support_level":  s.get("supportLevel"),
                            "availability_zone": s.get("availabilityZone"),
                            "link_speed_mbps":   s.get("linkSpeed"),
                        },
                    }
                except Exception as e:
                    errors.append(f"dedicated/{name}: {e}")
                    return None

            with ThreadPoolExecutor(max_workers=8) as pool:
                for fut in as_completed(
                    {pool.submit(fetch_dedicated, n): n for n in names}, timeout=120
                ):
                    r = fut.result()
                    if r:
                        servers.append(r)

        except Exception as e:
            errors.append(f"dedicated list: {e}")

        # ── VPS ───────────────────────────────────────────────────────────
        try:
            vps_names: list[str] = client.get("/vps")

            def fetch_vps(vps_name: str) -> dict[str, Any] | None:
                try:
                    v   = client.get(f"/vps/{vps_name}")
                    ips = client.get(f"/vps/{vps_name}/ips")

                    # IPs come back as plain strings on US endpoint
                    public_ip  = _first_ipv4(ips if isinstance(ips, list) else [])
                    private_ip = None
                    for ip in (ips or []):
                        val = ip.get("ip") if isinstance(ip, dict) else str(ip)
                        if val and ":" not in val and val != public_ip:
                            private_ip = val
                            break

                    # vcpu + memory at TOP LEVEL (not nested in model)
                    vcpu   = v.get("vcore")
                    ram_mb = v.get("memoryLimit")

                    # model.name is the cleanest type label
                    model = v.get("model") or {}
                    if not isinstance(model, dict):
                        model = {}
                    instance_type = model.get("offer") or model.get("name")

                    # Try distribution endpoint for OS
                    raw_os: str | None = None
                    try:
                        dist = client.get(f"/vps/{vps_name}/distribution")
                        if isinstance(dist, dict):
                            raw_os = dist.get("name") or dist.get("id")
                        elif isinstance(dist, str):
                            raw_os = dist
                    except Exception:
                        # SDK routing fails for some endpoints — fall back to raw HTTP
                        raw_os = _ovh_get_distribution(
                            self.config.get("endpoint", "ovh-eu"),
                            self.config["application_key"],
                            self.config["application_secret"],
                            self.config["consumer_key"],
                            vps_name,
                        )
                    os_name = _prettify_os(raw_os)

                    return {
                        "cloud_id":      vps_name,
                        "name":          v.get("displayName") or v.get("name", vps_name),
                        "provider":      "ovh",
                        "region":        _clean_zone(v.get("zone")),
                        "instance_type": instance_type,
                        "status":        VPS_STATUS.get(v.get("state", "unknown"), "unknown"),
                        "public_ip":     public_ip,
                        "private_ip":    private_ip,
                        "vcpu":          vcpu,
                        "memory_gb":     round(ram_mb / 1024, 1) if ram_mb else None,
                        "storage_gb":    model.get("disk"),
                        "os":            os_name,
                        "tags":          {},
                        "extra": {
                            "type":       "vps",
                            "offerType":  v.get("offerType"),
                            "model_ver":  model.get("version"),
                        },
                    }
                except Exception as e:
                    errors.append(f"vps/{vps_name}: {e}")
                    return None

            with ThreadPoolExecutor(max_workers=10) as pool:
                for fut in as_completed(
                    {pool.submit(fetch_vps, n): n for n in vps_names}, timeout=180
                ):
                    r = fut.result()
                    if r:
                        servers.append(r)

        except Exception as e:
            if "404" not in str(e) and "ResourceNotFound" not in str(e):
                errors.append(f"vps list: {e}")

        # ── Public Cloud instances ─────────────────────────────────────────
        try:
            projects: list[str] = client.get("/cloud/project")

            def fetch_cloud_project(project_id: str) -> list[dict[str, Any]]:
                results: list[dict[str, Any]] = []
                try:
                    instances = client.get(f"/cloud/project/{project_id}/instance")
                    for inst in (instances or []):
                        addrs      = inst.get("ipAddresses", [])
                        public_ip  = next((a["ip"] for a in addrs if a.get("type") == "public"  and ":" not in a.get("ip", "")), None)
                        private_ip = next((a["ip"] for a in addrs if a.get("type") == "private" and ":" not in a.get("ip", "")), None)
                        flavor     = inst.get("flavor") or {}
                        image      = inst.get("image")  or {}
                        results.append({
                            "cloud_id":      inst.get("id"),
                            "name":          inst.get("name", inst.get("id", "")),
                            "provider":      "ovh",
                            "region":        inst.get("region"),
                            "instance_type": flavor.get("name") or flavor.get("id"),
                            "status":        CLOUD_STATUS.get(inst.get("status", "UNKNOWN"), "unknown"),
                            "public_ip":     public_ip,
                            "private_ip":    private_ip,
                            "vcpu":          flavor.get("vcpus"),
                            "memory_gb":     round(flavor["ram"] / 1024, 1) if flavor.get("ram") else None,
                            "storage_gb":    flavor.get("disk"),
                            "os":            _prettify_os(image.get("name") or image.get("id")),
                            "tags":          {},
                            "extra":         {"type": "cloud", "project_id": project_id},
                        })
                except Exception as e:
                    errors.append(f"cloud/{project_id}: {e}")
                return results

            with ThreadPoolExecutor(max_workers=4) as cloud_pool:
                for fut in as_completed(  # type: ignore[assignment]
                    [cloud_pool.submit(fetch_cloud_project, pid) for pid in projects],
                    timeout=60,
                ):
                    result_batch: list[dict[str, Any]] = fut.result()  # type: ignore[assignment]
                    servers.extend(result_batch)

        except Exception as e:
            if "404" not in str(e):
                errors.append(f"cloud list: {e}")

        if not servers and errors:
            raise RuntimeError("; ".join(errors[:5]))

        return servers
