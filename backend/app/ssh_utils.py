"""Shared SSH utilities used by both the sync pipeline and on-demand endpoints."""
import io
import re
from typing import Any, TYPE_CHECKING

if TYPE_CHECKING:
    from . import models


def _load_pkey(key_str: str):
    """Auto-detect and load an SSH private key (Ed25519, RSA, ECDSA, or DSS)."""
    import paramiko
    for cls in (paramiko.Ed25519Key, paramiko.RSAKey, paramiko.ECDSAKey, paramiko.DSSKey):
        try:
            return cls.from_private_key(io.StringIO(key_str))
        except Exception:
            continue
    raise ValueError("Unsupported SSH private key type")


def fetch_ssh_ips(host: str, ssh_cred: "models.SSHCredential") -> list[str]:
    """SSH into *host* using *ssh_cred* (including proxy if configured).

    Runs `ip a` and returns all non-loopback IP addresses.
    Returns empty list on any connection or auth failure.
    """
    import paramiko
    from .crypto import decrypt_str

    _private_key = decrypt_str(ssh_cred.private_key) if ssh_cred.private_key else None
    _password    = decrypt_str(ssh_cred.password)    if ssh_cred.password    else None

    if not _private_key and not _password:
        return []

    jump_client = None
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        connect_kwargs: dict[str, Any] = {
            "hostname":       host,
            "port":           ssh_cred.port or 22,
            "username":       ssh_cred.username,
            "timeout":        10,
            "banner_timeout": 10,
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
        _, stdout, _ = client.exec_command(
            "ip a 2>/dev/null || ip addr 2>/dev/null", timeout=10
        )
        output = stdout.read().decode("utf-8", errors="replace")

        all_ips = re.findall(r"inet6?\s+([\da-f:.]+)/\d+", output)
        return [ip for ip in all_ips if not ip.startswith("127.") and ip != "::1"]

    except Exception:  # noqa: BLE001 — best-effort, never propagate
        return []
    finally:
        try:
            client.close()
        except Exception:  # noqa: BLE001
            pass
        if jump_client:
            try:
                jump_client.close()
            except Exception:  # noqa: BLE001
                pass
