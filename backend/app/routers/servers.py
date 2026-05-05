import io
import asyncio
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from .. import models, schemas
from ..database import get_db
from ..auth import get_current_user, require_write

router = APIRouter(prefix="/api/servers", tags=["servers"])


@router.get("", response_model=List[schemas.ServerResponse])
def list_servers(
    provider: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    q = db.query(models.Server)
    if provider:
        q = q.filter(models.Server.provider == provider)
    if status:
        q = q.filter(models.Server.status == status)
    if search:
        q = q.filter(
            models.Server.name.ilike(f"%{search}%")
            | models.Server.public_ip.ilike(f"%{search}%")
            | models.Server.private_ip.ilike(f"%{search}%")
            | models.Server.hostname.ilike(f"%{search}%")
        )
    return q.order_by(models.Server.name).all()


@router.get("/stats", response_model=schemas.StatsResponse)
def get_stats(
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    servers = db.query(models.Server).all()
    by_provider: dict = {}
    by_region: dict = {}
    by_status: dict = {}

    for s in servers:
        by_provider[s.provider] = by_provider.get(s.provider, 0) + 1
        if s.region:
            by_region[s.region] = by_region.get(s.region, 0) + 1
        by_status[s.status] = by_status.get(s.status, 0) + 1

    return schemas.StatsResponse(
        total=len(servers),
        running=by_status.get("running", 0),
        stopped=by_status.get("stopped", 0),
        by_provider=by_provider,
        by_region=by_region,
        by_status=by_status,
    )


@router.get("/{server_id}", response_model=schemas.ServerResponse)
def get_server(
    server_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    server = db.query(models.Server).filter(models.Server.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    return server


@router.post("", response_model=schemas.ServerResponse, status_code=201)
def create_server(
    server: schemas.ServerCreate,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_write),
):
    db_server = models.Server(**server.model_dump())
    db.add(db_server)
    db.commit()
    db.refresh(db_server)
    return db_server


@router.put("/{server_id}", response_model=schemas.ServerResponse)
def update_server(
    server_id: int,
    update: schemas.ServerUpdate,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_write),
):
    server = db.query(models.Server).filter(models.Server.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    for field, value in update.model_dump(exclude_unset=True).items():
        setattr(server, field, value)
    db.commit()
    db.refresh(server)
    return server


@router.post("/{server_id}/ssh-sync", response_model=schemas.ServerResponse)
async def ssh_sync_server(
    server_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_write),
):
    """Connect via SSH and gather live data from a Custom DC server."""
    server = db.query(models.Server).filter(models.Server.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")

    host = server.public_ip or server.private_ip
    if not host:
        raise HTTPException(status_code=400, detail="Server has no IP address configured")

    ssh_creds = (
        db.query(models.SSHCredential)
        .order_by(models.SSHCredential.is_default.desc(), models.SSHCredential.id)
        .all()
    )
    if not ssh_creds:
        raise HTTPException(status_code=400, detail="No SSH credentials configured — add them in the SSH page")

    def _do_ssh():
        import paramiko, socket, re
        for cred in ssh_creds:
            client = paramiko.SSHClient()
            client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            try:
                connect_kwargs: dict = {
                    "hostname": host,
                    "port": cred.port or 22,
                    "username": cred.username,
                    "timeout": 10,
                    "banner_timeout": 10,
                }
                if cred.auth_method == "key" and cred.private_key:
                    connect_kwargs["pkey"] = paramiko.RSAKey.from_private_key(
                        io.StringIO(cred.private_key)
                    )
                elif cred.password:
                    connect_kwargs["password"] = cred.password
                    connect_kwargs["look_for_keys"] = False
                    connect_kwargs["allow_agent"] = False

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
                    "last_ssh_sync": datetime.utcnow().isoformat(),
                }
                client.close()
                return ssh_info, None

            except paramiko.AuthenticationException:
                client.close()
                continue
            except (socket.timeout, paramiko.SSHException, OSError) as e:
                client.close()
                return None, str(e)
            except Exception as e:
                client.close()
                return None, str(e)

        return None, "All SSH credentials failed authentication"

    ssh_info, err = await asyncio.get_event_loop().run_in_executor(None, _do_ssh)
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


@router.delete("/{server_id}", status_code=204)
def delete_server(
    server_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_write),
):
    server = db.query(models.Server).filter(models.Server.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    db.delete(server)
    db.commit()
