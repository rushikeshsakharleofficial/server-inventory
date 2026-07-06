"""
Public API — authenticated with a user-created API key (Authorization: Bearer
si_live_...), never a browser JWT. Every route depends on
get_current_api_principal + require_api_permission(feature, action); the
effective permission for each request is always the live intersection of the
key's scopes and its owner's current IAM permissions (see api_key_auth.py).

Read/business logic is never duplicated here — each handler calls the same
query helpers or background-task functions the internal JWT routers already
use. Responses are built from explicit allow-list schemas only; no handler
here may return a raw secret field (cloud credential secrets, SSH password/
private key, proxy password/private key, token_hash, TOTP secret).
"""

from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import discovery_service, models, schemas
from ..api_key_auth import IP_INVENTORY_FEATURE, ApiPrincipal, require_api_permission
from ..database import DATABASE_URL, get_db
from ..limiter import limiter
from .servers import _build_ip_rows
from .sync import _run_sync, _run_sync_all_parallel

router = APIRouter(prefix="/public/v1", tags=["public-api"])

_SERVER_NOT_FOUND = "Server not found"


def _api_key_id_key_func(request: Request) -> str:
    """slowapi key_func: rate-limit per API key, not per IP. get_current_api_
    principal (a Depends resolved before this wrapper runs) stashes the
    principal on request.state, so it is always present here for a request
    that made it past authentication; falls back to remote address only for
    the (should-be-impossible) case that this ever fires before auth."""
    principal = getattr(request.state, "api_principal", None)
    if principal is not None:
        return f"apikey:{principal.api_key.id}"
    return request.client.host if request.client else "unknown"


# ─── Servers ────────────────────────────────────────────────────────────────────

@router.get("/servers")
@limiter.limit("300/minute", key_func=_api_key_id_key_func)
def public_list_servers(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    principal: Annotated[ApiPrincipal, Depends(require_api_permission("servers", "read"))],
    limit: Annotated[int, Query(ge=1, le=schemas._MAX_PAGE_SIZE)] = schemas._DEFAULT_PAGE_SIZE,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> schemas.Page[schemas.ServerResponse]:
    q = db.query(models.Server)
    total = q.count()
    items = q.order_by(models.Server.name).offset(offset).limit(limit).all()
    return schemas.Page(total=total, limit=limit, offset=offset, items=items)


@router.get("/servers/{server_id}", responses={404: {"description": _SERVER_NOT_FOUND}})
@limiter.limit("300/minute", key_func=_api_key_id_key_func)
def public_get_server(
    request: Request,
    server_id: int,
    db: Annotated[Session, Depends(get_db)],
    principal: Annotated[ApiPrincipal, Depends(require_api_permission("servers", "read"))],
) -> schemas.ServerResponse:
    server = db.query(models.Server).filter(models.Server.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail=_SERVER_NOT_FOUND)
    return server


@router.get("/ip-inventory")
@limiter.limit("300/minute", key_func=_api_key_id_key_func)
def public_ip_inventory(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    # No separate "ip_inventory" feature — this is a servers.py-owned query.
    principal: Annotated[ApiPrincipal, Depends(require_api_permission(IP_INVENTORY_FEATURE, "read"))],
    search: Annotated[str, Query(alias="q")] = "",
    ip_type: Annotated[str, Query(alias="type")] = "",
) -> dict:
    servers = db.query(
        models.Server.id, models.Server.name, models.Server.provider,
        models.Server.public_ip, models.Server.private_ip, models.Server.ssh_info,
    ).all()
    rows = _build_ip_rows(servers)
    # RDNS is resolved only during sync (see sync.py._ssh_fetch_ips), never on
    # this request path — read whatever's already cached, same as the
    # internal /api/servers/ip-inventory/rdns endpoint.
    addrs = {r["address"] for r in rows}
    cached = db.query(models.IpRdnsCache).filter(models.IpRdnsCache.address.in_(addrs)).all()
    rdns_map = {c.address: c.hostname for c in cached}
    for row in rows:
        row["rdns"] = rdns_map.get(row["address"])
    if search:
        s = search.lower()
        rows = [r for r in rows if s in r["address"] or s in r["server_name"].lower()]
    if ip_type:
        rows = [r for r in rows if r["type"] == ip_type]
    return {"total": len(rows), "items": rows}


# ─── Databases / Kubernetes / Block storage (read) ─────────────────────────────

@router.get("/databases")
@limiter.limit("300/minute", key_func=_api_key_id_key_func)
def public_list_databases(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    principal: Annotated[ApiPrincipal, Depends(require_api_permission("databases", "read"))],
    limit: Annotated[int, Query(ge=1, le=schemas._MAX_PAGE_SIZE)] = schemas._DEFAULT_PAGE_SIZE,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> schemas.Page[schemas.DatabaseInstanceResponse]:
    q = db.query(models.DatabaseInstance)
    total = q.count()
    items = q.order_by(models.DatabaseInstance.name).offset(offset).limit(limit).all()
    return schemas.Page(total=total, limit=limit, offset=offset, items=items)


@router.get("/kubernetes")
@limiter.limit("300/minute", key_func=_api_key_id_key_func)
def public_list_kubernetes(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    principal: Annotated[ApiPrincipal, Depends(require_api_permission("kubernetes", "read"))],
    limit: Annotated[int, Query(ge=1, le=schemas._MAX_PAGE_SIZE)] = schemas._DEFAULT_PAGE_SIZE,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> schemas.Page[schemas.KubernetesClusterResponse]:
    q = db.query(models.KubernetesCluster)
    total = q.count()
    items = q.order_by(models.KubernetesCluster.name).offset(offset).limit(limit).all()
    return schemas.Page(total=total, limit=limit, offset=offset, items=items)


@router.get("/block-storage")
@limiter.limit("300/minute", key_func=_api_key_id_key_func)
def public_list_block_storage(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    principal: Annotated[ApiPrincipal, Depends(require_api_permission("block-storages", "read"))],
    limit: Annotated[int, Query(ge=1, le=schemas._MAX_PAGE_SIZE)] = schemas._DEFAULT_PAGE_SIZE,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> schemas.Page[schemas.BlockStorageResponse]:
    q = db.query(models.BlockStorage)
    total = q.count()
    items = q.order_by(models.BlockStorage.name).offset(offset).limit(limit).all()
    return schemas.Page(total=total, limit=limit, offset=offset, items=items)


# ─── Discovery ──────────────────────────────────────────────────────────────────

@router.get("/discovery/jobs")
@limiter.limit("300/minute", key_func=_api_key_id_key_func)
def public_list_discovery_jobs(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    principal: Annotated[ApiPrincipal, Depends(require_api_permission("discovery", "read"))],
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> list[schemas.DiscoveryJobResponse]:
    return (
        db.query(models.DiscoveryJob)
        .order_by(models.DiscoveryJob.created_at.desc())
        .limit(limit)
        .all()
    )


class PublicRunOnceRequest(BaseModel):
    cidr: str
    ssh_credential_id: int | None = None
    max_parallel: int = 32
    timeout_seconds: int = 8


@router.post("/discovery/run-once", responses={400: {"description": "Invalid CIDR"}})
@limiter.limit("5/hour", key_func=_api_key_id_key_func)
def public_discovery_run_once(
    request: Request,
    payload: PublicRunOnceRequest,
    background_tasks: BackgroundTasks,
    db: Annotated[Session, Depends(get_db)],
    principal: Annotated[ApiPrincipal, Depends(require_api_permission("discovery", "write"))],
) -> dict:
    try:
        discovery_service.validate_cidr(payload.cidr)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    job = models.DiscoveryJob(network_id=None, cidr=payload.cidr, status="queued")
    db.add(job)
    db.commit()
    db.refresh(job)

    background_tasks.add_task(
        discovery_service.run_discovery,
        job.id, payload.cidr, payload.ssh_credential_id,
        payload.max_parallel, payload.timeout_seconds, DATABASE_URL,
    )
    return {"job_id": job.id, "message": "Discovery started"}


# ─── Sync ───────────────────────────────────────────────────────────────────────

@router.post("/sync")
@limiter.limit("10/hour", key_func=_api_key_id_key_func)
def public_trigger_sync(
    request: Request,
    background_tasks: BackgroundTasks,
    db: Annotated[Session, Depends(get_db)],
    principal: Annotated[ApiPrincipal, Depends(require_api_permission("sync", "write"))],
    provider: str | None = None,
) -> dict[str, str]:
    if provider:
        background_tasks.add_task(_run_sync, provider, DATABASE_URL)
    else:
        background_tasks.add_task(_run_sync_all_parallel, DATABASE_URL)
    return {"message": "Sync started", "provider": provider or "all"}
