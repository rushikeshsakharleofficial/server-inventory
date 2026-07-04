from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import discovery_service, models, schemas
from ..auth import require_perm
from ..database import DATABASE_URL, get_db
from ..event_log_utils import add_event_log
from ..limiter import limiter
from ..ws_manager import manager
from datetime import datetime, timezone

router = APIRouter(prefix="/api/discovery", tags=["discovery"])

_NETWORK_NOT_FOUND = "Discovery network not found"
_JOB_NOT_FOUND = "Discovery job not found"


class RunOnceRequest(BaseModel):
    cidr: str
    ssh_credential_id: int | None = None
    # ponytail: no ssh_group->credential mapping exists anywhere in this codebase
    # (ssh_group is a free-text tag on Server rows, used to filter which *existing*
    # servers to SSH into during sync — there's no server yet during discovery, so
    # there's nothing to resolve against). Accepted for forward-compatibility only;
    # silently ignored if ssh_credential_id is also absent — falls through to the
    # default credential in discovery_service._get_ssh_credential. Add real
    # resolution if/when SSHCredential gains a group/tag field of its own.
    ssh_group: str | None = None
    max_parallel: int = 32
    timeout_seconds: int = 8


# ─── Networks (saved CIDR + scan settings) ─────────────────────────────────────

@router.get("/networks")
@limiter.limit("100/minute")
def list_networks(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(require_perm("discovery", "read"))],
) -> list[schemas.DiscoveryNetworkResponse]:
    return db.query(models.DiscoveryNetwork).order_by(models.DiscoveryNetwork.name).all()


@router.post("/networks", status_code=201)
@limiter.limit("30/minute")
def create_network(
    request: Request,
    payload: schemas.DiscoveryNetworkCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_perm("discovery", "write"))],
) -> schemas.DiscoveryNetworkResponse:
    try:
        discovery_service.validate_cidr(payload.cidr)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    network = models.DiscoveryNetwork(**payload.model_dump())
    db.add(network)
    add_event_log(
        db, source="discovery", resource=network.name,
        event="Discovery network created", owner=user.username,
    )
    db.commit()
    db.refresh(network)
    return network


@router.put("/networks/{network_id}")
@limiter.limit("30/minute")
def update_network(
    request: Request,
    network_id: int,
    payload: schemas.DiscoveryNetworkUpdate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_perm("discovery", "write"))],
) -> schemas.DiscoveryNetworkResponse:
    network = db.query(models.DiscoveryNetwork).filter(models.DiscoveryNetwork.id == network_id).first()
    if not network:
        raise HTTPException(status_code=404, detail=_NETWORK_NOT_FOUND)

    updates = payload.model_dump(exclude_unset=True)
    if "cidr" in updates and updates["cidr"]:
        try:
            discovery_service.validate_cidr(updates["cidr"])
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    for field, value in updates.items():
        setattr(network, field, value)

    if updates:
        add_event_log(
            db, source="discovery", resource=network.name,
            event="Discovery network updated", owner=user.username,
        )
    db.commit()
    db.refresh(network)
    return network


@router.delete("/networks/{network_id}", status_code=204)
@limiter.limit("30/minute")
def delete_network(
    request: Request,
    network_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_perm("discovery", "delete"))],
) -> None:
    network = db.query(models.DiscoveryNetwork).filter(models.DiscoveryNetwork.id == network_id).first()
    if not network:
        raise HTTPException(status_code=404, detail=_NETWORK_NOT_FOUND)
    add_event_log(
        db, source="discovery", resource=network.name,
        event="Discovery network removed", owner=user.username,
    )
    db.delete(network)
    db.commit()


@router.post("/networks/{network_id}/run")
@limiter.limit("10/minute")
def run_network(
    request: Request,
    network_id: int,
    background_tasks: BackgroundTasks,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_perm("discovery", "write"))],
) -> dict:
    network = db.query(models.DiscoveryNetwork).filter(models.DiscoveryNetwork.id == network_id).first()
    if not network or not network.is_active:
        raise HTTPException(status_code=404, detail=_NETWORK_NOT_FOUND)

    try:
        discovery_service.validate_cidr(network.cidr)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    job = models.DiscoveryJob(network_id=network.id, cidr=network.cidr, status="queued")
    db.add(job)
    db.commit()
    db.refresh(job)

    add_event_log(
        db, source="discovery", resource=network.name,
        event="Discovery run started", owner=user.username,
        message=f"cidr={network.cidr}",
    )
    db.commit()

    background_tasks.add_task(
        discovery_service.run_discovery,
        job.id, network.cidr, network.ssh_credential_id,
        network.max_parallel, network.timeout_seconds, DATABASE_URL,
    )
    return {"job_id": job.id, "message": "Discovery started"}


# ─── Run-once (ad-hoc CIDR, not saved) ─────────────────────────────────────────

@router.post("/run-once")
@limiter.limit("10/minute")
def run_once(
    request: Request,
    payload: RunOnceRequest,
    background_tasks: BackgroundTasks,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_perm("discovery", "write"))],
) -> dict:
    try:
        discovery_service.validate_cidr(payload.cidr)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    job = models.DiscoveryJob(network_id=None, cidr=payload.cidr, status="queued")
    db.add(job)
    db.commit()
    db.refresh(job)

    add_event_log(
        db, source="discovery", resource=payload.cidr,
        event="One-time discovery started", owner=user.username,
    )
    db.commit()

    background_tasks.add_task(
        discovery_service.run_discovery,
        job.id, payload.cidr, payload.ssh_credential_id,
        payload.max_parallel, payload.timeout_seconds, DATABASE_URL,
    )
    return {"job_id": job.id, "message": "Discovery started"}


# ─── Jobs ───────────────────────────────────────────────────────────────────────

@router.post("/jobs/{job_id}/stop")
@limiter.limit("30/minute")
def stop_job(
    request: Request,
    job_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(require_perm("discovery", "sync"))],
) -> dict:
    job = db.query(models.DiscoveryJob).filter(models.DiscoveryJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail=_JOB_NOT_FOUND)

    discovery_service.stop_discovery(job.id)

    if job.status == "running":
        job.status = "stopped"
        job.error_message = "Stopped by user"
        job.completed_at = datetime.now(timezone.utc)
        db.commit()
        manager.broadcast({"type": "discovery_stopped", "job_id": job.id})
        return {"stopped": True}

    return {"stopped": False}


@router.get("/jobs")
@limiter.limit("100/minute")
def list_jobs(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(require_perm("discovery", "read"))],
    limit: int = Query(default=50, ge=1, le=200),
    network_id: int | None = None,
    status: str | None = None,
) -> list[schemas.DiscoveryJobResponse]:
    q = db.query(models.DiscoveryJob)
    if network_id is not None:
        q = q.filter(models.DiscoveryJob.network_id == network_id)
    if status is not None:
        q = q.filter(models.DiscoveryJob.status == status)
    return q.order_by(models.DiscoveryJob.created_at.desc()).limit(limit).all()


@router.get("/jobs/{job_id}")
@limiter.limit("100/minute")
def get_job(
    request: Request,
    job_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(require_perm("discovery", "read"))],
) -> schemas.DiscoveryJobResponse:
    job = db.query(models.DiscoveryJob).filter(models.DiscoveryJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail=_JOB_NOT_FOUND)
    return job


@router.get("/jobs/{job_id}/results")
@limiter.limit("100/minute")
def get_job_results(
    request: Request,
    job_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(require_perm("discovery", "read"))],
    limit: int = Query(default=schemas._DEFAULT_PAGE_SIZE, ge=1, le=schemas._MAX_PAGE_SIZE),
    offset: int = Query(default=0, ge=0),
    status: str | None = None,
) -> schemas.Page[schemas.DiscoveryResultResponse]:
    q = db.query(models.DiscoveryResult).filter(models.DiscoveryResult.job_id == job_id)
    if status is not None:
        q = q.filter(models.DiscoveryResult.status == status)

    total = q.count()
    items = q.order_by(models.DiscoveryResult.id).offset(offset).limit(limit).all()
    return schemas.Page(total=total, limit=limit, offset=offset, items=items)
