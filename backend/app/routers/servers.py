import io
import asyncio
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Annotated
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db
from ..auth import get_current_user, require_write
from ..crypto import decrypt_str
from ..ssh_utils import fetch_ssh_ips

router = APIRouter(prefix="/api/servers", tags=["servers"])

_SERVER_NOT_FOUND = "Server not found"


def _escape_like(value: str) -> str:
    return (
        value
        .replace("\\", "\\\\")
        .replace("%", "\\%")
        .replace("_", "\\_")
    )


@router.get("", response_model=list[schemas.ServerResponse])
def list_servers(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(get_current_user)],
    provider: str | None = Query(None),
    status: str | None = Query(None),
    search: str | None = Query(None),
) -> list[models.Server]:
    q = db.query(models.Server)
    if provider:
        q = q.filter(models.Server.provider == provider)
    if status:
        q = q.filter(models.Server.status == status)
    if search:
        like = f"%{_escape_like(search)}%"
        q = q.filter(
            models.Server.name.ilike(like, escape="\\")
            | models.Server.public_ip.ilike(like, escape="\\")
            | models.Server.private_ip.ilike(like, escape="\\")
            | models.Server.hostname.ilike(like, escape="\\")
        )
    return q.order_by(models.Server.name).all()


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


@router.get("/{server_id}", response_model=schemas.ServerResponse)
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
    _: Annotated[models.User, Depends(require_write)],
) -> models.Server:
    db_server = models.Server(**server.model_dump())
    db.add(db_server)
    db.commit()
    db.refresh(db_server)
    return db_server


@router.put("/{server_id}", response_model=schemas.ServerResponse)
def update_server(
    server_id: int,
    update: schemas.ServerUpdate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(require_write)],
) -> models.Server:
    server = db.query(models.Server).filter(models.Server.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail=_SERVER_NOT_FOUND)
    for field, value in update.model_dump(exclude_unset=True).items():
        setattr(server, field, value)
    db.commit()
    db.refresh(server)
    return server


@router.post("/{server_id}/ssh-sync", response_model=schemas.ServerResponse)
async def ssh_sync_server(
    server_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(require_write)],
    ssh_credential_id: int = Query(...),
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
        raise HTTPException(status_code=404, detail="SSH credential not found")

    def _do_ssh():
        import paramiko, socket, re
        client = paramiko.SSHClient()
        try:
            known_hosts = os.getenv("SSH_KNOWN_HOSTS")
            if known_hosts:
                client.load_host_keys(os.path.expanduser(known_hosts))
            else:
                client.load_system_host_keys()
            client.set_missing_host_key_policy(paramiko.RejectPolicy())

            connect_kwargs: dict = {
                "hostname": host,
                "port": ssh_cred.port or 22,
                "username": ssh_cred.username,
                "timeout": 10,
                "banner_timeout": 10,
            }
            _private_key = decrypt_str(ssh_cred.private_key) if ssh_cred.private_key else None
            _password = decrypt_str(ssh_cred.password) if ssh_cred.password else None

            def _load_pkey(key_str: str):
                key_classes = [paramiko.Ed25519Key, paramiko.RSAKey, paramiko.ECDSAKey]
                if hasattr(paramiko, "DSSKey"):
                    key_classes.append(paramiko.DSSKey)  # type: ignore[attr-defined]
                for cls in key_classes:
                    try:
                        return cls.from_private_key(io.StringIO(key_str))
                    except Exception:
                        continue
                raise ValueError("Unsupported SSH private key type")

            if ssh_cred.auth_method == "key":
                if not _private_key:
                    return None, "Selected SSH credential has no private key"
                connect_kwargs["pkey"] = _load_pkey(_private_key)
            elif _password:
                connect_kwargs["password"] = _password
                connect_kwargs["look_for_keys"] = False
                connect_kwargs["allow_agent"] = False
            else:
                return None, "Selected SSH credential has no password"

            # Jump/proxy server — open channel through jump host if configured
            jump_client = None
            if getattr(ssh_cred, "proxy_host", None):
                _proxy_pass = decrypt_str(ssh_cred.proxy_password) if ssh_cred.proxy_password else None
                _proxy_key  = decrypt_str(ssh_cred.proxy_private_key) if ssh_cred.proxy_private_key else None
                jump_client = paramiko.SSHClient()
                jump_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
                jump_kwargs: dict = {
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

            def run(cmd):
                _, stdout, _ = client.exec_command(cmd, timeout=10)
                return stdout.read().decode("utf-8", errors="replace").strip()

            # Gather data
            ip_a        = run("ip a 2>/dev/null || ip addr 2>/dev/null")
            nproc       = run("nproc 2>/dev/null")
            free_m      = run("free -m 2>/dev/null")
            uname_r     = run("uname -r 2>/dev/null")
            hostname_f  = run("hostname -f 2>/dev/null")
            os_release  = run("cat /etc/os-release 2>/dev/null")

            # Parse IPs from `ip a`
            all_ips = re.findall(r'inet6?\s+([\da-f:.]+/\d+)', ip_a)
            all_ips = [ip for ip in all_ips if not ip.startswith('127.') and ip != '::1/128']

            # Parse memory (MemTotal from free -m)
            mem_mb = None
            for line in free_m.splitlines():
                if line.startswith("Mem:"):
                    parts = line.split()
                    if len(parts) > 1:
                        mem_mb = int(parts[1])
                    break

            # Parse OS from /etc/os-release
            os_info: dict = {}
            for line in os_release.splitlines():
                if "=" in line:
                    k, _, v = line.partition("=")
                    os_info[k.strip()] = v.strip().strip('"')

            ssh_info = {
                "all_ips":      all_ips,
                "cpu_count":    int(nproc) if nproc.isdigit() else None,
                "memory_mb":    mem_mb,
                "kernel":       uname_r or None,
                "hostname":     hostname_f or None,
                "os_release":   os_info.get("PRETTY_NAME") or os_info.get("NAME"),
                "credential_id": ssh_cred.id,
                "credential_name": ssh_cred.name,
                "last_ssh_sync": datetime.now(timezone.utc).isoformat(),
            }
            client.close()
            if jump_client:
                jump_client.close()
            return ssh_info, None

        except paramiko.AuthenticationException:
            client.close()
            if jump_client:
                jump_client.close()
            return None, "Authentication failed — check username and credentials"
        except (socket.timeout, paramiko.SSHException, OSError) as e:
            client.close()
            if jump_client:
                jump_client.close()
            msg = str(e)
            if "not found in known_hosts" in msg or "not in known_hosts" in msg:
                return None, "Host key verification failed — server not in trusted hosts"
            if "timed out" in msg.lower() or "timeout" in msg.lower():
                return None, "Connection timed out — check host address and firewall rules"
            if "Connection refused" in msg:
                return None, "Connection refused — check SSH port and firewall"
            if "No existing session" in msg or "not open" in msg:
                return None, "SSH session error — please try again"
            return None, "SSH connection failed — check host address and network"
        except Exception:  # noqa: BLE001 — catch-all for unexpected SSH errors
            client.close()
            if jump_client:
                jump_client.close()
            return None, "SSH connection failed — unexpected error"

    ssh_info, err = await asyncio.get_running_loop().run_in_executor(None, _do_ssh)
    if err and not ssh_info:
        raise HTTPException(status_code=502, detail=f"SSH connection failed: {err}")

    server.ssh_info = ssh_info

    # Update fields if currently missing
    if ssh_info:
        if not server.vcpu and ssh_info.get("cpu_count"):
            server.vcpu = ssh_info["cpu_count"]
        if not server.memory_gb and ssh_info.get("memory_mb"):
            server.memory_gb = round(ssh_info["memory_mb"] / 1024, 1)
        if not server.os and ssh_info.get("os_release"):
            server.os = ssh_info["os_release"]
        if not server.hostname and ssh_info.get("hostname"):
            server.hostname = ssh_info["hostname"]

    db.commit()
    db.refresh(server)
    return server


@router.post("/{server_id}/trust-host-key", response_model=schemas.HostKeyTrustResponse)
async def trust_host_key(
    server_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(require_write)],
    ssh_credential_id: int = Query(...),
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
        raise HTTPException(status_code=404, detail="SSH credential not found")

    def _do_trust():
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

    result, err = await asyncio.get_running_loop().run_in_executor(None, _do_trust)
    if err or not result:
        raise HTTPException(status_code=502, detail=err or "Failed to trust host key")

    return schemas.HostKeyTrustResponse(**result)


@router.post("/ssh-fetch-all-ips")
def ssh_fetch_all_ips(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(require_write)],
    ssh_credential_id: int | None = Query(None),
) -> list[dict]:
    """SSH into every server concurrently and collect all IPv4/IPv6 addresses."""
    if ssh_credential_id:
        ssh_cred = db.query(models.SSHCredential).filter(models.SSHCredential.id == ssh_credential_id).first()
        if not ssh_cred:
            raise HTTPException(status_code=404, detail="SSH credential not found")
    else:
        ssh_cred = (
            db.query(models.SSHCredential)
            .filter(models.SSHCredential.is_default.is_(True))
            .first()
        )
    if not ssh_cred:
        raise HTTPException(status_code=400, detail="No SSH credential selected and no default configured")

    servers = (
        db.query(models.Server)
        .filter((models.Server.public_ip != None) | (models.Server.private_ip != None))  # noqa: E711
        .all()
    )

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

    if results:
        db.commit()

    return results


@router.delete("/{server_id}", status_code=204)
def delete_server(
    server_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(require_write)],
) -> None:
    server = db.query(models.Server).filter(models.Server.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail=_SERVER_NOT_FOUND)
    db.delete(server)
    db.commit()
