import io
import asyncio
import os
import socket
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Annotated, Literal
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db
from ..auth import get_current_user, require_write
from ..crypto import decrypt_str
from ..ssh_utils import fetch_ssh_ips, fetch_ips_via_transport, _load_pkey
from ..ws_manager import manager as ws_manager
from ..event_log_utils import add_event_log
from .query_utils import escape_like

router = APIRouter(prefix="/api/servers", tags=["servers"])

_SERVER_NOT_FOUND = "Server not found"
_SSH_CREDENTIAL_NOT_FOUND = "SSH credential not found"


_SORT_COLS: dict[str, object] = {
    "name":       models.Server.name,
    "provider":   models.Server.provider,
    "status":     models.Server.status,
    "public_ip":  models.Server.public_ip,
    "private_ip": models.Server.private_ip,
    "region":     models.Server.region,
    "created_at": models.Server.created_at,
    "updated_at": models.Server.updated_at,
}


@router.get("")
def list_servers(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(get_current_user)],
    provider: Annotated[str | None, Query()] = None,
    status: Annotated[str | None, Query()] = None,
    search: Annotated[str | None, Query()] = None,
    region: Annotated[str | None, Query()] = None,
    os: Annotated[str | None, Query()] = None,
    datacenter: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=schemas._MAX_PAGE_SIZE)] = schemas._DEFAULT_PAGE_SIZE,
    offset: Annotated[int, Query(ge=0)] = 0,
    sort: Annotated[str, Query()] = "name",
    order: Annotated[Literal["asc", "desc"], Query()] = "asc",
) -> schemas.Page[schemas.ServerResponse]:
    q = db.query(models.Server)
    if provider:
        q = q.filter(models.Server.provider == provider)
    if status:
        q = q.filter(models.Server.status == status)
    if region:
        q = q.filter(models.Server.region.ilike(f"%{escape_like(region)}%", escape="\\"))
    if os:
        q = q.filter(models.Server.os.ilike(f"%{escape_like(os)}%", escape="\\"))
    if datacenter:
        q = q.filter(models.Server.datacenter.ilike(f"%{escape_like(datacenter)}%", escape="\\"))
    if search:
        like = f"%{escape_like(search)}%"
        q = q.filter(
            models.Server.name.ilike(like, escape="\\")
            | models.Server.public_ip.ilike(like, escape="\\")
            | models.Server.private_ip.ilike(like, escape="\\")
            | models.Server.hostname.ilike(like, escape="\\")
            | models.Server.region.ilike(like, escape="\\")
            | models.Server.os.ilike(like, escape="\\")
            | models.Server.datacenter.ilike(like, escape="\\")
            | models.Server.notes.ilike(like, escape="\\")
        )
    total = q.count()
    col = _SORT_COLS.get(sort, models.Server.name)
    order_expr = col.desc() if order == "desc" else col.asc()  # type: ignore[union-attr]
    items = q.order_by(order_expr).offset(offset).limit(limit).all()
    return schemas.Page(total=total, limit=limit, offset=offset, items=items)


@router.get("/stats")
def get_stats(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(get_current_user)],
) -> schemas.StatsResponse:
    total: int = db.query(func.count(models.Server.id)).scalar() or 0
    by_provider: dict[str, int] = dict(
        db.query(models.Server.provider, func.count(models.Server.id))
        .group_by(models.Server.provider)
        .all()
    )
    by_region: dict[str, int] = dict(
        db.query(models.Server.region, func.count(models.Server.id))
        .filter(models.Server.region.isnot(None))
        .group_by(models.Server.region)
        .all()
    )
    by_status: dict[str, int] = dict(
        db.query(models.Server.status, func.count(models.Server.id))
        .group_by(models.Server.status)
        .all()
    )
    return schemas.StatsResponse(
        total=total,
        running=by_status.get("running", 0),
        stopped=by_status.get("stopped", 0),
        by_provider=by_provider,
        by_region=by_region,
        by_status=by_status,
    )


def _classify_ip_kind(addr: str) -> str:
    is_v6 = ":" in addr
    is_loopback = addr.startswith("127.") or addr == "::1"
    is_link = addr.startswith("fe80:")
    if is_loopback:
        return "loopback"
    if is_link:
        return "link-local"
    return "ipv6" if is_v6 else "ipv4"


def _server_all_ips(srv) -> list[str]:
    """All known IPs/CIDRs for one server row: ssh_info.all_ips plus the
    legacy public_ip/private_ip columns if not already present."""
    ssh_info = srv.ssh_info or {}
    all_ips: list[str] = list(ssh_info.get("all_ips") or [])
    seen_addrs = {ip.split("/")[0] for ip in all_ips}
    for col_ip in (srv.public_ip, srv.private_ip):
        if col_ip and col_ip not in seen_addrs:
            all_ips.append(col_ip)
            seen_addrs.add(col_ip)
    return all_ips


def _build_ip_rows(servers) -> list[dict]:
    rows = []
    for srv in servers:
        for cidr in _server_all_ips(srv):
            addr = cidr.split("/")[0]
            rows.append({
                "server_id": srv.id,
                "server_name": srv.name,
                "provider": srv.provider,
                "cidr": cidr,
                "address": addr,
                "type": _classify_ip_kind(addr),
            })
    return rows


def _rdns_lookup(addr: str) -> tuple[str, str | None]:
    try:
        return addr, socket.gethostbyaddr(addr)[0]
    except Exception:  # noqa: BLE001 — no PTR record is the normal case
        return addr, None


def _resolve_rdns_concurrent(db: Session, addrs: set[str]) -> dict[str, str | None]:
    """Reverse-DNS lookups, concurrent, one per unique address not already in
    IpRdnsCache. Persisted in Postgres (not in-process) so results survive
    backend restarts/redeploys — call sites decide WHEN this runs (sync only;
    see sync.py), never on an IP Inventory page load."""
    cached_rows = db.query(models.IpRdnsCache).filter(models.IpRdnsCache.address.in_(addrs)).all()
    rdns_map: dict[str, str | None] = {r.address: r.hostname for r in cached_rows}
    to_resolve = addrs - rdns_map.keys()
    if not to_resolve:
        return rdns_map

    prev_timeout = socket.getdefaulttimeout()
    socket.setdefaulttimeout(2)
    try:
        # ponytail: gethostbyaddr blocks on network I/O, not CPU — threads
        # spend nearly all their time waiting, so this can safely run far
        # above core count. 40 cuts a ~500-address cold cache from ~55
        # batches to ~13 (each capped at the 2s timeout above).
        with ThreadPoolExecutor(max_workers=40) as ex:
            futures = {ex.submit(_rdns_lookup, addr): addr for addr in to_resolve}
            for fut in as_completed(futures):
                try:
                    addr, hostname = fut.result()
                    rdns_map[addr] = hostname
                    db.merge(models.IpRdnsCache(address=addr, hostname=hostname))
                except Exception:  # noqa: BLE001
                    pass
    finally:
        socket.setdefaulttimeout(prev_timeout)
    db.commit()
    return rdns_map


def _rdns_setting_enabled(db: Session) -> bool:
    setting = db.query(models.AppSetting).filter(models.AppSetting.key == "rdns_lookup_enabled").first()
    return (setting.value if setting else "true") != "false"


@router.get("/ip-inventory")
def ip_inventory(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(get_current_user)],
    search: Annotated[str, Query(alias="q")] = "",
    ip_type: Annotated[str, Query(alias="type")] = "",
) -> dict:
    """Aggregate all IPs from public_ip, private_ip, and ssh_info.all_ips.

    RDNS is deliberately NOT resolved here — reverse-DNS lookups are the slow
    part (network round trips per address) while everything else is a plain
    local DB read. Returning rows immediately with rdns=None lets the page
    render instantly; the frontend fetches /ip-inventory/rdns as a fast
    follow-up and fills the column in once those (cached) lookups resolve.
    """
    servers = db.query(
        models.Server.id, models.Server.name, models.Server.provider,
        models.Server.public_ip, models.Server.private_ip, models.Server.ssh_info,
    ).all()

    rows = _build_ip_rows(servers)
    rdns_on = _rdns_setting_enabled(db)
    for row in rows:
        row["rdns"] = None

    if search:
        q = search.lower()
        rows = [r for r in rows if q in r["address"] or q in r["server_name"].lower()]
    if ip_type:
        rows = [r for r in rows if r["type"] == ip_type]

    return {"total": len(rows), "items": rows, "rdns_enabled": rdns_on}


@router.get("/ip-inventory/rdns")
def ip_inventory_rdns(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(get_current_user)],
) -> dict[str, str | None]:
    """Fast follow-up call: return whatever RDNS is already cached from the
    last sync. Never triggers a live DNS lookup itself — sync.py is the only
    writer to IpRdnsCache, so this stays instant no matter fleet size."""
    if not _rdns_setting_enabled(db):
        return {}
    servers = db.query(
        models.Server.public_ip, models.Server.private_ip, models.Server.ssh_info,
    ).all()
    addrs: set[str] = set()
    for srv in servers:
        for cidr in _server_all_ips(srv):
            addrs.add(cidr.split("/")[0])
    rows = db.query(models.IpRdnsCache).filter(models.IpRdnsCache.address.in_(addrs)).all()
    return {r.address: r.hostname for r in rows}


@router.post("/ip-inventory/rdns/refresh")
def refresh_ip_inventory_rdns(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(require_write)],
) -> dict:
    """Manual on-demand RDNS resolution — the only request-path trigger for
    live DNS lookups (everything else only runs during sync). Synchronous by
    design: this is an explicit user action with an explicit wait, not a
    background job. Respects rdns_lookup_enabled same as every other path."""
    if not _rdns_setting_enabled(db):
        return {"resolved": 0, "rdns_enabled": False}
    servers = db.query(
        models.Server.public_ip, models.Server.private_ip, models.Server.ssh_info,
    ).all()
    addrs: set[str] = set()
    for srv in servers:
        for cidr in _server_all_ips(srv):
            addrs.add(cidr.split("/")[0])
    rdns_map = _resolve_rdns_concurrent(db, addrs) if addrs else {}
    return {"resolved": len(rdns_map), "rdns_enabled": True}


@router.get(
    "/{server_id}",
    response_model=schemas.ServerResponse,
    responses={404: {"description": "Server not found"}},
)
def get_server(
    server_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(get_current_user)],
) -> models.Server:
    server = db.query(models.Server).filter(models.Server.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail=_SERVER_NOT_FOUND)
    return server


@router.post("", response_model=schemas.ServerResponse, status_code=201)
def create_server(
    server: schemas.ServerCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_write)],
) -> models.Server:
    db_server = models.Server(**server.model_dump())
    db.add(db_server)
    add_event_log(db, source="servers", resource=db_server.name, event="Server added",
                  owner=user.username, message=f"provider={db_server.provider}")
    db.commit()
    db.refresh(db_server)
    return db_server


@router.put(
    "/{server_id}",
    response_model=schemas.ServerResponse,
    responses={404: {"description": "Server not found"}},
)
def update_server(
    server_id: int,
    update: schemas.ServerUpdate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_write)],
) -> models.Server:
    server = db.query(models.Server).filter(models.Server.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail=_SERVER_NOT_FOUND)
    changed = update.model_dump(exclude_unset=True)
    for field, value in changed.items():
        setattr(server, field, value)
    if changed:
        add_event_log(db, source="servers", resource=server.name, event="Server updated",
                      owner=user.username, message=", ".join(f"{k}={v}" for k, v in changed.items()))
    db.commit()
    db.refresh(server)
    return server


def _ssh_load_pkey(key_str: str):
    import paramiko
    key_classes = [paramiko.Ed25519Key, paramiko.RSAKey, paramiko.ECDSAKey]
    if hasattr(paramiko, "DSSKey"):
        key_classes.append(paramiko.DSSKey)  # type: ignore[attr-defined]
    for cls in key_classes:
        try:
            return cls.from_private_key(io.StringIO(key_str))
        except Exception:
            continue
    raise ValueError("Unsupported SSH private key type")


def _ssh_build_connect_kwargs(host: str, ssh_cred) -> dict | str:
    """Returns connect() kwargs, or an error message string if the credential
    is missing the secret its auth_method requires."""
    connect_kwargs: dict = {
        "hostname": host,
        "port": ssh_cred.port or 22,
        "username": ssh_cred.username,
        "timeout": 10,
        "banner_timeout": 10,
    }
    if ssh_cred.auth_method == "key":
        if not ssh_cred.private_key:
            return "Selected SSH credential has no private key"
        connect_kwargs["pkey"] = _ssh_load_pkey(decrypt_str(ssh_cred.private_key))
    elif ssh_cred.password:
        connect_kwargs["password"] = decrypt_str(ssh_cred.password)
        connect_kwargs["look_for_keys"] = False
        connect_kwargs["allow_agent"] = False
    else:
        return "Selected SSH credential has no password"
    return connect_kwargs


def _ssh_open_jump_channel(host: str, port: int, ssh_cred):
    """Connects to the configured jump/proxy host and opens a direct-tcpip
    channel to the real target through it. Returns (jump_client, channel)."""
    import paramiko
    proxy_key = decrypt_str(ssh_cred.proxy_private_key) if ssh_cred.proxy_private_key else None
    proxy_pass = decrypt_str(ssh_cred.proxy_password) if ssh_cred.proxy_password else None

    jump_client = paramiko.SSHClient()
    jump_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    jump_kwargs: dict = {
        "hostname": ssh_cred.proxy_host,
        "port": ssh_cred.proxy_port or 22,
        "username": ssh_cred.proxy_username or "root",
        "timeout": 10,
    }
    if getattr(ssh_cred, "proxy_auth_method", "password") == "key" and proxy_key:
        jump_kwargs["pkey"] = _ssh_load_pkey(proxy_key)
    elif proxy_pass:
        jump_kwargs["password"] = proxy_pass
        jump_kwargs["look_for_keys"] = False
        jump_kwargs["allow_agent"] = False
    jump_client.connect(**jump_kwargs)
    channel = jump_client.get_transport().open_channel(
        "direct-tcpip", (host, port), ("127.0.0.1", 0)
    )
    return jump_client, channel


def _ssh_run(client, cmd: str) -> str:
    _, stdout, _ = client.exec_command(cmd, timeout=10)
    return stdout.read().decode("utf-8", errors="replace").strip()


def _ssh_parse_facts(client, ssh_cred) -> dict:
    """Runs the fact-gathering commands over an already-connected client and
    parses their output into a plain dict."""
    import re
    ip_a = _ssh_run(client, "ip a 2>/dev/null || ip addr 2>/dev/null")
    nproc = _ssh_run(client, "nproc 2>/dev/null")
    free_m = _ssh_run(client, "free -m 2>/dev/null")
    uname_r = _ssh_run(client, "uname -r 2>/dev/null")
    hostname_f = _ssh_run(client, "hostname -f 2>/dev/null")
    os_release = _ssh_run(client, "cat /etc/os-release 2>/dev/null")

    all_ips = re.findall(r'inet6?\s+([\da-f:.]+/\d+)', ip_a)
    all_ips = [ip for ip in all_ips if not ip.startswith('127.') and ip != '::1/128']

    mem_mb = None
    for line in free_m.splitlines():
        if line.startswith("Mem:"):
            parts = line.split()
            if len(parts) > 1:
                mem_mb = int(parts[1])
            break

    os_info: dict = {}
    for line in os_release.splitlines():
        if "=" in line:
            k, _, v = line.partition("=")
            os_info[k.strip()] = v.strip().strip('"')

    return {
        "all_ips": all_ips,
        "cpu_count": int(nproc) if nproc.isdigit() else None,
        "memory_mb": mem_mb,
        "kernel": uname_r or None,
        "hostname": hostname_f or None,
        "os_release": os_info.get("PRETTY_NAME") or os_info.get("NAME"),
        "credential_id": ssh_cred.id,
        "credential_name": ssh_cred.name,
        "last_ssh_sync": datetime.now(timezone.utc).isoformat(),
    }


def _ssh_map_exception(exc: Exception) -> str:
    """Translates a raw paramiko/socket exception into a user-facing message."""
    import paramiko
    if isinstance(exc, paramiko.AuthenticationException):
        return "Authentication failed — check username and credentials"
    if isinstance(exc, (paramiko.SSHException, OSError)):
        msg = str(exc)
        if "not found in known_hosts" in msg or "not in known_hosts" in msg:
            return "Host key verification failed — server not in trusted hosts"
        if "timed out" in msg.lower() or "timeout" in msg.lower():
            return "Connection timed out — check host address and firewall rules"
        if "Connection refused" in msg:
            return "Connection refused — check SSH port and firewall"
        if "No existing session" in msg or "not open" in msg:
            return "SSH session error — please try again"
        return "SSH connection failed — check host address and network"
    return "SSH connection failed — unexpected error"


def _ssh_sync_gather_facts(host: str, ssh_cred) -> tuple[dict | None, str | None]:
    """Connects over SSH (optionally through a jump host), gathers OS/hardware
    facts, and returns (facts, None) on success or (None, error_message) on
    any failure. Runs on a worker thread via run_in_executor — never touches
    the DB session directly."""
    import paramiko

    client = paramiko.SSHClient()
    jump_client = None
    try:
        known_hosts = os.getenv("SSH_KNOWN_HOSTS")
        if known_hosts:
            client.load_host_keys(os.path.expanduser(known_hosts))
        else:
            client.load_system_host_keys()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

        connect_kwargs = _ssh_build_connect_kwargs(host, ssh_cred)
        if isinstance(connect_kwargs, str):
            return None, connect_kwargs

        if getattr(ssh_cred, "proxy_host", None):
            jump_client, channel = _ssh_open_jump_channel(
                host, ssh_cred.port or 22, ssh_cred
            )
            connect_kwargs["sock"] = channel

        client.connect(**connect_kwargs)
        facts = _ssh_parse_facts(client, ssh_cred)
        return facts, None

    except Exception as exc:  # noqa: BLE001 — mapped to a friendly message below
        return None, _ssh_map_exception(exc)
    finally:
        client.close()
        if jump_client:
            jump_client.close()


def _apply_ssh_facts_to_server(server, ssh_info: dict) -> None:
    """Fill in server fields from freshly-gathered SSH facts, only overwriting
    what is currently missing (except OS, where SSH is treated as authoritative)."""
    if not server.vcpu and ssh_info.get("cpu_count"):
        server.vcpu = ssh_info["cpu_count"]
    if not server.memory_gb and ssh_info.get("memory_mb"):
        server.memory_gb = round(ssh_info["memory_mb"] / 1024, 1)
    if ssh_info.get("os_release"):  # SSH is more accurate than cloud API
        server.os = ssh_info["os_release"]
    if not server.hostname and ssh_info.get("hostname"):
        server.hostname = ssh_info["hostname"]


@router.post(
    "/{server_id}/ssh-sync",
    response_model=schemas.ServerResponse,
    responses={
        404: {"description": "Server or SSH credential not found"},
        400: {"description": "Server has no IP address configured"},
        502: {"description": "SSH connection failed"},
    },
)
async def ssh_sync_server(
    server_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(require_write)],
    ssh_credential_id: Annotated[int, Query()],
):
    """Connect via SSH and gather live data from a Custom DC server."""
    server = db.query(models.Server).filter(models.Server.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail=_SERVER_NOT_FOUND)

    host = server.public_ip or server.private_ip
    if not host:
        raise HTTPException(status_code=400, detail="Server has no IP address configured")

    ssh_cred = (
        db.query(models.SSHCredential)
        .filter(models.SSHCredential.id == ssh_credential_id)
        .first()
    )
    if not ssh_cred:
        raise HTTPException(status_code=404, detail=_SSH_CREDENTIAL_NOT_FOUND)

    def _do_ssh():
        return _ssh_sync_gather_facts(host, ssh_cred)

    ssh_info, err = await asyncio.get_running_loop().run_in_executor(None, _do_ssh)
    if err and not ssh_info:
        raise HTTPException(status_code=502, detail=f"SSH connection failed: {err}")

    server.ssh_info = ssh_info

    # Update fields if currently missing
    if ssh_info:
        _apply_ssh_facts_to_server(server, ssh_info)

    db.commit()
    db.refresh(server)
    return server


def _ssh_trust_host_key(host: str, ssh_cred) -> tuple[dict | None, str | None]:
    """Connect via low-level Transport, read the remote host key, and persist it
    to known_hosts. Returns (result, None) on success or (None, error) on failure.
    Runs on a worker thread via run_in_executor — never touches the DB session."""
    import paramiko, socket as _socket
    transport = None
    try:
        port = ssh_cred.port or 22
        sock = _socket.create_connection((host, port), timeout=10)
        transport = paramiko.Transport(sock)
        transport.start_client(timeout=10)

        host_key = transport.get_remote_server_key()
        key_type = host_key.get_name()
        fingerprint_bytes = host_key.get_fingerprint()
        fingerprint = ":".join(f"{b:02x}" for b in fingerprint_bytes)

        transport.close()

        # Persist host key to known_hosts file
        known_hosts_path = os.getenv("SSH_KNOWN_HOSTS") or os.path.expanduser("~/.ssh/known_hosts")
        known_hosts_dir = os.path.dirname(os.path.abspath(known_hosts_path))
        os.makedirs(known_hosts_dir, exist_ok=True)

        known_hosts = paramiko.HostKeys()
        if os.path.exists(known_hosts_path):
            try:
                known_hosts.load(known_hosts_path)
            except Exception:  # noqa: BLE001
                pass  # Start fresh if file is corrupt
        known_hosts.add(host, key_type, host_key)
        known_hosts.save(known_hosts_path)

        return {"fingerprint": fingerprint, "key_type": key_type, "added": True}, None

    except Exception as exc:  # noqa: BLE001
        if transport:
            transport.close()
        return None, f"Could not retrieve host key: {exc}"


@router.post(
    "/{server_id}/trust-host-key",
    response_model=schemas.HostKeyTrustResponse,
    responses={
        404: {"description": "Server or SSH credential not found"},
        400: {"description": "Server has no IP address configured"},
        502: {"description": "Failed to trust host key"},
    },
)
async def trust_host_key(
    server_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(require_write)],
    ssh_credential_id: Annotated[int, Query()],
):
    """Retrieve and trust the SSH host key for a server by connecting via low-level Transport."""
    server = db.query(models.Server).filter(models.Server.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail=_SERVER_NOT_FOUND)

    host = server.public_ip or server.private_ip
    if not host:
        raise HTTPException(status_code=400, detail="Server has no IP address configured")

    ssh_cred = (
        db.query(models.SSHCredential)
        .filter(models.SSHCredential.id == ssh_credential_id)
        .first()
    )
    if not ssh_cred:
        raise HTTPException(status_code=404, detail=_SSH_CREDENTIAL_NOT_FOUND)

    def _do_trust():
        return _ssh_trust_host_key(host, ssh_cred)

    result, err = await asyncio.get_running_loop().run_in_executor(None, _do_trust)
    if err or not result:
        raise HTTPException(status_code=502, detail=err or "Failed to trust host key")

    return schemas.HostKeyTrustResponse(**result)


def _resolve_ssh_credential_or_default(db: Session, ssh_credential_id: int | None):
    """Return the requested SSH credential, or the default one when no id is given.
    Raises HTTPException(404) for a missing requested id and HTTPException(400)
    when neither an id nor a configured default is available."""
    if ssh_credential_id:
        ssh_cred = db.query(models.SSHCredential).filter(models.SSHCredential.id == ssh_credential_id).first()
        if not ssh_cred:
            raise HTTPException(status_code=404, detail=_SSH_CREDENTIAL_NOT_FOUND)
    else:
        ssh_cred = (
            db.query(models.SSHCredential)
            .filter(models.SSHCredential.is_default.is_(True))
            .first()
        )
    if not ssh_cred:
        raise HTTPException(status_code=400, detail="No SSH credential selected and no default configured")
    return ssh_cred


def _collect_ssh_ips(servers, ssh_cred) -> list[dict]:
    """SSH into each server concurrently, stamp discovered IPs onto ssh_info, and
    return one result row per server that yielded any addresses."""
    def _fetch_one(srv: models.Server) -> tuple[models.Server, list[str]]:
        host = srv.public_ip or srv.private_ip
        ips = fetch_ssh_ips(host, ssh_cred) if host else []
        return srv, ips

    results = []
    with ThreadPoolExecutor(max_workers=10) as ex:
        futures = {ex.submit(_fetch_one, srv): srv for srv in servers}
        for fut in as_completed(futures):
            try:
                srv, ips = fut.result()
                if ips:
                    srv.ssh_info = {**(srv.ssh_info or {}), "all_ips": ips}
                    results.append({
                        "server_id":  srv.id,
                        "server_name": srv.name,
                        "provider":   srv.provider,
                        "host":       srv.public_ip or srv.private_ip,
                        "ips":        ips,
                    })
            except Exception:  # noqa: BLE001
                pass
    return results


@router.post(
    "/ssh-fetch-all-ips",
    responses={
        404: {"description": "SSH credential not found"},
        400: {"description": "No SSH credential selected and no default configured"},
    },
)
def ssh_fetch_all_ips(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(require_write)],
    ssh_credential_id: Annotated[int | None, Query()] = None,
) -> list[dict]:
    """SSH into every server concurrently and collect all IPv4/IPv6 addresses."""
    ssh_cred = _resolve_ssh_credential_or_default(db, ssh_credential_id)

    servers = (
        db.query(models.Server)
        .filter((models.Server.public_ip != None) | (models.Server.private_ip != None))  # noqa: E711
        .all()
    )

    results = _collect_ssh_ips(servers, ssh_cred)

    if results:
        db.commit()

    return results


def _stream_setup_jump_client(ssh_cred) -> tuple:
    """Open the jump-host connection (if configured) and load the target private key.
    Returns (jump_client, jump_transport, pkey)."""
    import paramiko

    jump_client = None
    jump_transport = None
    pkey = None

    if getattr(ssh_cred, "proxy_host", None):
        _proxy_pass = decrypt_str(ssh_cred.proxy_password) if ssh_cred.proxy_password else None
        _proxy_key  = decrypt_str(ssh_cred.proxy_private_key) if ssh_cred.proxy_private_key else None
        jump_client = paramiko.SSHClient()
        jump_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        jk: dict = {
            "hostname": ssh_cred.proxy_host,
            "port":     ssh_cred.proxy_port or 22,
            "username": ssh_cred.proxy_username or "root",
            "timeout":  15,
        }
        if getattr(ssh_cred, "proxy_auth_method", "password") == "key" and _proxy_key:
            jk["pkey"] = _load_pkey(_proxy_key)
        elif _proxy_pass:
            jk["password"]      = _proxy_pass
            jk["look_for_keys"] = False
            jk["allow_agent"]   = False
        jump_client.connect(**jk)
        jump_transport = jump_client.get_transport()

    if ssh_cred.private_key:
        pkey = _load_pkey(decrypt_str(ssh_cred.private_key))

    return jump_client, jump_transport, pkey


def _stream_fetch_one(srv, ssh_cred, jump_transport, pkey) -> tuple:
    host = srv.public_ip or srv.private_ip
    if not host:
        return srv, []
    if jump_transport and pkey:
        ips = fetch_ips_via_transport(host, ssh_cred.port or 22, ssh_cred.username, pkey, jump_transport)
    else:
        ips = fetch_ssh_ips(host, ssh_cred)
    return srv, ips


def _stream_result_payload(srv, ips: list[str]) -> dict:
    return {
        "type":        "ip_fetch_result",
        "server_id":   srv.id,
        "server_name": srv.name,
        "provider":    srv.provider,
        "host":        srv.public_ip or srv.private_ip or "",
        "ips":         ips,
        "success":     bool(ips),
    }


def _stream_ip_results(db: Session, servers, ssh_cred):
    """Generator yielding one NDJSON line per server as its SSH IP fetch completes,
    broadcasting each result over the websocket and committing changes at the end."""
    import json

    try:
        jump_client, jump_transport, pkey = _stream_setup_jump_client(ssh_cred)
    except Exception as exc:  # noqa: BLE001
        yield json.dumps({"error": f"Jump/key setup failed: {exc}"}) + "\n"
        return

    changed: list[models.Server] = []
    try:
        with ThreadPoolExecutor(max_workers=20) as ex:
            futures = {
                ex.submit(_stream_fetch_one, srv, ssh_cred, jump_transport, pkey): srv
                for srv in servers
            }
            for fut in as_completed(futures):
                try:
                    srv, ips = fut.result()
                    srv.ssh_info = {**(srv.ssh_info or {}), "all_ips": ips}
                    changed.append(srv)
                    _result = _stream_result_payload(srv, ips)
                    ws_manager.broadcast(_result)
                    yield json.dumps(_result) + "\n"
                except Exception:  # noqa: BLE001
                    pass
    finally:
        if changed:
            db.commit()
        if jump_client:
            try: jump_client.close()
            except Exception: pass  # noqa: BLE001


@router.post(
    "/ssh-fetch-ips-stream",
    responses={
        404: {"description": "SSH credential not found"},
        400: {"description": "No SSH credential selected and no default configured"},
    },
)
def ssh_fetch_ips_stream(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(require_write)],
    ssh_credential_id: Annotated[int | None, Query()] = None,
) -> StreamingResponse:
    """Stream SSH IP results as NDJSON — one line per server as it completes."""
    ssh_cred = _resolve_ssh_credential_or_default(db, ssh_credential_id)

    servers = (
        db.query(models.Server)
        .filter((models.Server.public_ip != None) | (models.Server.private_ip != None))  # noqa: E711
        .all()
    )

    return StreamingResponse(
        _stream_ip_results(db, servers, ssh_cred),
        media_type="application/x-ndjson",
    )


@router.delete(
    "/{server_id}",
    status_code=204,
    responses={404: {"description": "Server not found"}},
)
def delete_server(
    server_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_write)],
) -> None:
    server = db.query(models.Server).filter(models.Server.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail=_SERVER_NOT_FOUND)
    add_event_log(db, source="servers", resource=server.name, event="Server removed",
                  owner=user.username, message=f"provider={server.provider}, id={server.id}")
    db.delete(server)
    db.commit()


from pydantic import BaseModel as _BM

class AssignSSHRequest(_BM):
    ssh_credential_id: int | None = None
    ssh_group: str | None = None

class BulkAssignSSHRequest(_BM):
    server_ids: list[int]
    ssh_credential_id: int | None = None
    ssh_group: str | None = None


def apply_ssh_assignment(db: Session, server_ids: list[int], ssh_credential_id: int | None, ssh_group: str | None) -> int:
    """Set ssh_credential_id/ssh_group on the given servers. Shared by bulk-assign and group-assign."""
    servers = db.query(models.Server).filter(models.Server.id.in_(server_ids)).all()
    for svr in servers:
        if ssh_credential_id is not None:
            svr.ssh_credential_id = ssh_credential_id
        if ssh_group is not None:
            svr.ssh_group = ssh_group
    db.commit()
    return len(servers)


@router.patch(
    "/{server_id}/assign-ssh",
    responses={404: {"description": "Server not found"}},
)
def assign_ssh_to_server(
    server_id: int,
    payload: AssignSSHRequest,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(require_write)],
) -> dict:
    svr = db.query(models.Server).filter(models.Server.id == server_id).first()
    if not svr:
        raise HTTPException(404, "Server not found")
    svr.ssh_credential_id = payload.ssh_credential_id
    if payload.ssh_group is not None:
        svr.ssh_group = payload.ssh_group
    db.commit()
    return {"id": svr.id, "ssh_credential_id": svr.ssh_credential_id, "ssh_group": svr.ssh_group}


@router.post("/bulk-assign-ssh")
def bulk_assign_ssh(
    payload: BulkAssignSSHRequest,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(require_write)],
) -> dict:
    updated = apply_ssh_assignment(db, payload.server_ids, payload.ssh_credential_id, payload.ssh_group)
    return {"updated": updated}

