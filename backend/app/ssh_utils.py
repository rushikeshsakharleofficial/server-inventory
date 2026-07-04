"""Shared SSH utilities used by both the sync pipeline and on-demand endpoints."""
import io
import os
import re
import socket
from typing import Any, TYPE_CHECKING

if TYPE_CHECKING:
    from . import models


def probe_port(host: str, port: int = 22, timeout: float = 2.0) -> bool:
    """Fast TCP reachability check before attempting a full SSH handshake.

    Never raises — returns False on any connection failure/timeout.
    """
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except Exception:  # noqa: BLE001
        return False


def _load_pkey(key_str: str):
    """Auto-detect and load an SSH private key (Ed25519, RSA, ECDSA)."""
    import paramiko
    key_classes = [paramiko.Ed25519Key, paramiko.RSAKey, paramiko.ECDSAKey]
    # DSSKey removed in paramiko 5.x
    if hasattr(paramiko, "DSSKey"):
        key_classes.append(paramiko.DSSKey)  # type: ignore[attr-defined]
    for cls in key_classes:
        try:
            return cls.from_private_key(io.StringIO(key_str))
        except Exception:
            continue
    raise ValueError("Unsupported SSH private key type")


def _open_ssh_client(
    host: str, ssh_cred: "models.SSHCredential", timeout: int = 8
) -> tuple[Any, Any, str | None]:
    """Build + connect an SSHClient for *host* using *ssh_cred* (proxy-aware).

    Factored out of fetch_ssh_ips so discovery can reuse the exact same
    auth/jump-host logic without duplicating it. Returns
    (client, jump_client_or_None, host_key_fingerprint_or_None).
    Raises on any failure — caller decides how to classify/report it
    (unlike fetch_ssh_ips, which historically swallows and returns []).
    """
    import hashlib
    import paramiko
    from .crypto import decrypt_str

    _private_key = decrypt_str(ssh_cred.private_key) if ssh_cred.private_key else None
    _password    = decrypt_str(ssh_cred.password)    if ssh_cred.password    else None

    if not _private_key and not _password:
        raise ValueError("SSH credential has no usable password or private key")

    jump_client = None
    client = paramiko.SSHClient()
    known_hosts_path = os.getenv("SSH_KNOWN_HOSTS") or os.path.expanduser("~/.ssh/known_hosts")
    if os.path.exists(known_hosts_path):
        client.load_host_keys(known_hosts_path)
    else:
        client.load_system_host_keys()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    connect_kwargs: dict[str, Any] = {
        "hostname":       host,
        "port":           ssh_cred.port or 22,
        "username":       ssh_cred.username,
        "timeout":        timeout,
        "banner_timeout": timeout,
    }

    if ssh_cred.auth_method == "key" and _private_key:
        connect_kwargs["pkey"] = _load_pkey(_private_key)
    elif _password:
        connect_kwargs["password"]      = _password
        connect_kwargs["look_for_keys"] = False
        connect_kwargs["allow_agent"]   = False

    if getattr(ssh_cred, "proxy_host", None):
        _proxy_pass = decrypt_str(ssh_cred.proxy_password)    if ssh_cred.proxy_password    else None
        _proxy_key  = decrypt_str(ssh_cred.proxy_private_key) if ssh_cred.proxy_private_key else None
        jump_client = paramiko.SSHClient()
        known_hosts_path_j = os.getenv("SSH_KNOWN_HOSTS") or os.path.expanduser("~/.ssh/known_hosts")
        if os.path.exists(known_hosts_path_j):
            jump_client.load_host_keys(known_hosts_path_j)
        else:
            jump_client.load_system_host_keys()
        jump_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        jump_kwargs: dict[str, Any] = {
            "hostname": ssh_cred.proxy_host,
            "port":     ssh_cred.proxy_port or 22,
            "username": ssh_cred.proxy_username or "root",
            "timeout":  10,
        }
        if getattr(ssh_cred, "proxy_auth_method", "password") == "key" and _proxy_key:
            jump_kwargs["pkey"] = _load_pkey(_proxy_key)
        elif _proxy_pass:
            jump_kwargs["password"]      = _proxy_pass
            jump_kwargs["look_for_keys"] = False
            jump_kwargs["allow_agent"]   = False
        jump_client.connect(**jump_kwargs)
        connect_kwargs["sock"] = jump_client.get_transport().open_channel(
            "direct-tcpip",
            (host, ssh_cred.port or 22),
            ("127.0.0.1", 0),
        )

    client.connect(**connect_kwargs)

    host_key_fp = None
    try:
        remote_key = client.get_transport().get_remote_server_key()
        host_key_fp = hashlib.sha256(remote_key.asbytes()).hexdigest()
    except Exception:  # noqa: BLE001 — fingerprint capture is best-effort
        pass

    return client, jump_client, host_key_fp


def fetch_ssh_ips(host: str, ssh_cred: "models.SSHCredential") -> list[str]:
    """SSH into *host* using *ssh_cred* (including proxy if configured).

    Runs `ip -br a` (compact) or `ip a` as fallback.
    Returns empty list on any connection or auth failure.
    """
    client = None
    jump_client = None
    try:
        client, jump_client, _ = _open_ssh_client(host, ssh_cred)
        return _run_ip_cmd(client)
    except Exception:  # noqa: BLE001
        return []
    finally:
        if client:
            try: client.close()
            except Exception: pass  # noqa: BLE001
        if jump_client:
            try: jump_client.close()
            except Exception: pass  # noqa: BLE001


def fetch_ips_via_transport(
    host: str,
    port: int,
    username: str,
    pkey: Any,
    jump_transport: Any,
) -> list[str]:
    """Fetch IPs using a shared pre-established jump transport.

    No per-call jump handshake — opens only a new channel.
    """
    import paramiko

    client = paramiko.SSHClient()
    known_hosts_path = os.getenv("SSH_KNOWN_HOSTS") or os.path.expanduser("~/.ssh/known_hosts")
    if os.path.exists(known_hosts_path):
        client.load_host_keys(known_hosts_path)
    else:
        client.load_system_host_keys()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        sock = jump_transport.open_channel("direct-tcpip", (host, port), ("127.0.0.1", 0))
        client.connect(
            host,
            username=username,
            pkey=pkey,
            sock=sock,
            timeout=8,
            banner_timeout=8,
        )
        return _run_ip_cmd(client)
    except Exception:  # noqa: BLE001
        return []
    finally:
        try: client.close()
        except Exception: pass  # noqa: BLE001


def _run_ip_cmd(client: Any) -> list[str]:
    """Run `ip -br a` (compact) with fallback to `ip a`; parse all non-loopback IPs."""
    _, stdout, _ = client.exec_command(
        "ip -br a 2>/dev/null || ip a 2>/dev/null", timeout=8
    )
    output = stdout.read().decode("utf-8", errors="replace")
    all_ips = re.findall(r"([\da-f:.]+)/\d+", output)
    return [
        ip for ip in all_ips
        if not ip.startswith("127.") and ip != "::1" and ip not in ("0.0.0.0", "::")
    ]


def run_command_safe(client: Any, cmd: str, timeout: int = 8) -> str:
    """Run *cmd* over an already-connected SSHClient, return decoded stdout.

    Never raises — returns "" on any exec/timeout/decode failure. Callers must
    only pass fixed, non-interpolated command strings (see collect_host_facts) —
    this is not a general shell-execution helper and does no escaping.
    """
    try:
        _, stdout, _ = client.exec_command(cmd, timeout=timeout)
        return stdout.read().decode("utf-8", errors="replace")
    except Exception:  # noqa: BLE001
        return ""


# Sentinel values that mean "field not actually set" despite the file/command
# existing — reject these during identity extraction rather than treating them
# as real, matchable identity signals.
_IDENTITY_SENTINELS = {
    "", "none", "not settable", "not present", "not specified",
    "to be filled by o.e.m.", "00000000-0000-0000-0000-000000000000",
    "0" * 32,
}


def _clean_identity_value(raw: str) -> str | None:
    v = (raw or "").strip().strip('"').lower()
    if not v or v in _IDENTITY_SENTINELS:
        return None
    return v


def _parse_os_release(text_out: str) -> str | None:
    for line in text_out.splitlines():
        if line.startswith("PRETTY_NAME="):
            return line.split("=", 1)[1].strip().strip('"')
    return None


def _parse_free_m(text_out: str) -> int | None:
    """Parse `free -m` output, return total memory in MB from the Mem: row."""
    for line in text_out.splitlines():
        if line.strip().lower().startswith("mem:"):
            parts = line.split()
            if len(parts) >= 2:
                try:
                    return int(parts[1])
                except ValueError:
                    return None
    return None


def _classify_ip_scope(addr: str) -> str:
    import ipaddress as _ipaddress
    try:
        ip_obj = _ipaddress.ip_address(addr)
    except ValueError:
        return "public"
    if ip_obj.is_loopback:
        return "loopback"
    if ip_obj.is_link_local:
        return "link-local"
    if ip_obj.is_private:
        return "private"
    return "public"


def _parse_ip_json_address(raw_json: str) -> dict[str, list[dict[str, Any]]]:
    """Parse `ip -j address` output into {ifname: [{address,cidr,ip_version,scope}]}."""
    import json
    result: dict[str, list[dict[str, Any]]] = {}
    try:
        data = json.loads(raw_json)
    except Exception:  # noqa: BLE001
        return result
    for iface in data:
        ifname = iface.get("ifname")
        if not ifname:
            continue
        addrs = []
        for a in iface.get("addr_info", []):
            local = a.get("local")
            if not local:
                continue
            prefixlen = a.get("prefixlen")
            addrs.append({
                "address": local,
                "cidr": f"{local}/{prefixlen}" if prefixlen is not None else local,
                "ip_version": a.get("family") == "inet6" and 6 or 4,
                "scope": _classify_ip_scope(local),
            })
        result[ifname] = addrs
    return result


def _parse_ip_text_address(text_out: str) -> dict[str, list[dict[str, Any]]]:
    """Fallback parser for `ip -br a` plain-text output when `ip -j` is unavailable."""
    result: dict[str, list[dict[str, Any]]] = {}
    for line in text_out.splitlines():
        parts = line.split()
        if len(parts) < 3:
            continue
        ifname = parts[0]
        addrs = []
        for token in parts[2:]:
            m = re.match(r"([\da-f:.]+)/(\d+)", token)
            if not m:
                continue
            addr, prefixlen = m.group(1), m.group(2)
            addrs.append({
                "address": addr,
                "cidr": f"{addr}/{prefixlen}",
                "ip_version": 6 if ":" in addr else 4,
                "scope": _classify_ip_scope(addr),
            })
        if addrs:
            result[ifname] = addrs
    return result


def _parse_ip_json_link(raw_json: str) -> dict[str, str]:
    """Parse `ip -j link` output into {ifname: mac_address}."""
    import json
    result: dict[str, str] = {}
    try:
        data = json.loads(raw_json)
    except Exception:  # noqa: BLE001
        return result
    for iface in data:
        ifname = iface.get("ifname")
        mac = iface.get("address")
        if ifname and mac and mac != "00:00:00:00:00:00":
            result[ifname] = mac
    return result


def _parse_ip_text_link(text_out: str) -> dict[str, str]:
    """Fallback parser for `ip -br l` plain-text output."""
    result: dict[str, str] = {}
    for line in text_out.splitlines():
        parts = line.split()
        if len(parts) < 3:
            continue
        ifname = parts[0]
        mac = parts[2]
        if re.match(r"^([0-9a-f]{2}:){5}[0-9a-f]{2}$", mac, re.IGNORECASE) and mac != "00:00:00:00:00:00":
            result[ifname] = mac
    return result


def collect_host_facts(client: Any) -> dict[str, Any]:
    """Collect non-secret host facts over an already-connected SSHClient.

    Runs only the fixed, safe command list from the discovery spec — never
    touches credential material. Every sub-step is best-effort: a failed
    command yields a missing/None field rather than aborting the whole
    collection. Returns:
      {
        "hostname": str | None, "os": str | None, "kernel": str | None,
        "vcpu": int | None, "memory_mb": int | None,
        "machine_id": str | None, "product_uuid": str | None,
        "interfaces": [{"name": str, "mac": str | None,
                         "addresses": [{"address","cidr","ip_version","scope"}]}],
      }
    """
    hostname = run_command_safe(client, "hostname -f 2>/dev/null || hostname").strip() or None
    os_release = _parse_os_release(run_command_safe(client, "cat /etc/os-release 2>/dev/null"))
    kernel = run_command_safe(client, "uname -r").strip() or None

    nproc_out = run_command_safe(client, "nproc 2>/dev/null").strip()
    vcpu = int(nproc_out) if nproc_out.isdigit() else None

    memory_mb = _parse_free_m(run_command_safe(client, "free -m 2>/dev/null"))

    machine_id = _clean_identity_value(run_command_safe(client, "cat /etc/machine-id 2>/dev/null"))
    product_uuid = _clean_identity_value(
        run_command_safe(client, "cat /sys/class/dmi/id/product_uuid 2>/dev/null")
    )

    addr_json = run_command_safe(client, "ip -j address 2>/dev/null")
    addr_by_iface = _parse_ip_json_address(addr_json) if addr_json.strip() else {}
    if not addr_by_iface:
        addr_by_iface = _parse_ip_text_address(run_command_safe(client, "ip -br a 2>/dev/null"))

    link_json = run_command_safe(client, "ip -j link 2>/dev/null")
    mac_by_iface = _parse_ip_json_link(link_json) if link_json.strip() else {}
    if not mac_by_iface:
        mac_by_iface = _parse_ip_text_link(run_command_safe(client, "ip -br l 2>/dev/null"))

    interfaces = [
        {"name": ifname, "mac": mac_by_iface.get(ifname), "addresses": addrs}
        for ifname, addrs in addr_by_iface.items()
    ]

    return {
        "hostname": hostname,
        "os": os_release,
        "kernel": kernel,
        "vcpu": vcpu,
        "memory_mb": memory_mb,
        "machine_id": machine_id,
        "product_uuid": product_uuid,
        "interfaces": interfaces,
    }
