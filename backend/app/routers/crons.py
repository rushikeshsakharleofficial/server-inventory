from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from .. import models, schemas
from ..database import get_db, DATABASE_URL
from ..auth import get_current_user, require_write, require_admin
from .. import scheduler as sched_module
from ..event_log_utils import add_event_log

router = APIRouter(prefix="/api/crons", tags=["crons"])

_CRON_NOT_FOUND = "Cron job not found"


def _validate_cron(expr: str) -> None:
    from croniter import croniter
    if not croniter.is_valid(expr):
        raise HTTPException(status_code=422, detail=f"Invalid cron expression: {expr!r}")


@router.get("", response_model=list[schemas.CronJobResponse])
def list_crons(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(get_current_user)],
) -> list[models.CronJob]:
    return db.query(models.CronJob).order_by(models.CronJob.name).all()


@router.post("", response_model=schemas.CronJobResponse, status_code=201,
             responses={422: {"description": "Invalid cron expression"}})
def create_cron(
    payload: schemas.CronJobCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_write)],
) -> models.CronJob:
    _validate_cron(payload.cron_expr)
    job = models.CronJob(**payload.model_dump())

    # Compute next_run_at
    nxt = sched_module._next_fire(payload.cron_expr)
    if nxt:
        job.next_run_at = nxt.replace(tzinfo=None)

    db.add(job)
    add_event_log(db, source="crons", resource=job.name, event="Cron job added",
                  owner=user.username, message=f"cron_expr={job.cron_expr}, provider={job.provider}")
    db.commit()
    db.refresh(job)

    if payload.is_active:
        sched_module.reload_job(job.id, DATABASE_URL)

    return job


@router.put("/{job_id}", response_model=schemas.CronJobResponse,
            responses={404: {"description": "Cron job not found"}})
def update_cron(
    job_id: int,
    payload: schemas.CronJobUpdate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_write)],
) -> models.CronJob:
    job = db.query(models.CronJob).filter(models.CronJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail=_CRON_NOT_FOUND)

    updates = payload.model_dump(exclude_unset=True)
    if "cron_expr" in updates:
        _validate_cron(updates["cron_expr"])

    for k, v in updates.items():
        setattr(job, k, v)

    # Recompute next_run_at
    nxt = sched_module._next_fire(job.cron_expr)
    if nxt:
        job.next_run_at = nxt.replace(tzinfo=None)

    if updates:
        add_event_log(db, source="crons", resource=job.name, event="Cron job updated",
                      owner=user.username, message=", ".join(f"{k}={v}" for k, v in updates.items()))
    db.commit()
    db.refresh(job)
    sched_module.reload_job(job.id, DATABASE_URL)
    return job


@router.delete("/{job_id}", status_code=204,
               responses={404: {"description": "Cron job not found"}})
def delete_cron(
    job_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_write)],
) -> None:
    job = db.query(models.CronJob).filter(models.CronJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail=_CRON_NOT_FOUND)
    sched_module.remove_job(job_id)
    add_event_log(db, source="crons", resource=job.name, event="Cron job removed", owner=user.username)
    db.delete(job)
    db.commit()


@router.patch("/{job_id}/toggle", response_model=schemas.CronJobResponse,
              responses={404: {"description": "Cron job not found"}})
def toggle_cron(
    job_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_write)],
) -> models.CronJob:
    job = db.query(models.CronJob).filter(models.CronJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail=_CRON_NOT_FOUND)
    job.is_active = not job.is_active
    if job.is_active:
        nxt = sched_module._next_fire(job.cron_expr)
        if nxt:
            job.next_run_at = nxt.replace(tzinfo=None)
    else:
        job.next_run_at = None
    add_event_log(db, source="crons", resource=job.name, event="Cron job status changed",
                  owner=user.username, message=f"is_active={job.is_active}")
    db.commit()
    db.refresh(job)
    sched_module.reload_job(job.id, DATABASE_URL)
    return job


@router.post("/{job_id}/run-now", response_model=schemas.CronJobResponse,
             responses={404: {"description": "Cron job not found"}})
def run_cron_now(
    job_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(require_write)],
) -> models.CronJob:
    """Trigger a cron job immediately, outside its schedule."""
    from fastapi.concurrency import run_in_threadpool
    from ..routers.sync import _run_sync

    job = db.query(models.CronJob).filter(models.CronJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail=_CRON_NOT_FOUND)

    # Run sync in background thread via APScheduler's executor
    import threading
    def _go() -> None:
        try:
            _run_sync(job.provider, DATABASE_URL)
            run_status = "success"
        except Exception:  # noqa: BLE001 — any sync error marks the run as failed
            run_status = "failed"
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        from ..database import DATABASE_URL as dbu
        engine = create_engine(dbu, pool_pre_ping=True)
        sess = sessionmaker(bind=engine)()
        try:
            j = sess.query(models.CronJob).filter(models.CronJob.id == job_id).first()
            if j:
                j.last_run_at = datetime.now(timezone.utc)
                j.last_run_status = run_status
                sess.commit()
        finally:
            sess.close()

    threading.Thread(target=_go, daemon=True).start()

    job.last_run_at = datetime.now(timezone.utc)
    job.last_run_status = "running"
    db.commit()
    db.refresh(job)
    return job
