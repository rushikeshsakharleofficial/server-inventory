from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone
from .. import models, schemas
from ..database import get_db, DATABASE_URL
from ..auth import get_current_user, require_write, require_admin
from .. import scheduler as sched_module

router = APIRouter(prefix="/api/crons", tags=["crons"])


def _validate_cron(expr: str) -> None:
    from croniter import croniter
    if not croniter.is_valid(expr):
        raise HTTPException(status_code=422, detail=f"Invalid cron expression: {expr!r}")


@router.get("", response_model=List[schemas.CronJobResponse])
def list_crons(
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    return db.query(models.CronJob).order_by(models.CronJob.name).all()


@router.post("", response_model=schemas.CronJobResponse, status_code=201)
def create_cron(
    payload: schemas.CronJobCreate,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_write),
):
    _validate_cron(payload.cron_expr)
    job = models.CronJob(**payload.model_dump())

    # Compute next_run_at
    nxt = sched_module._next_fire(payload.cron_expr)
    if nxt:
        job.next_run_at = nxt.replace(tzinfo=None)

    db.add(job)
    db.commit()
    db.refresh(job)

    if payload.is_active:
        sched_module.reload_job(job.id, DATABASE_URL)

    return job


@router.put("/{job_id}", response_model=schemas.CronJobResponse)
def update_cron(
    job_id: int,
    payload: schemas.CronJobUpdate,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_write),
):
    job = db.query(models.CronJob).filter(models.CronJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Cron job not found")

    updates = payload.model_dump(exclude_unset=True)
    if "cron_expr" in updates:
        _validate_cron(updates["cron_expr"])

    for k, v in updates.items():
        setattr(job, k, v)

    # Recompute next_run_at
    nxt = sched_module._next_fire(job.cron_expr)
    if nxt:
        job.next_run_at = nxt.replace(tzinfo=None)

    db.commit()
    db.refresh(job)
    sched_module.reload_job(job.id, DATABASE_URL)
    return job


@router.delete("/{job_id}", status_code=204)
def delete_cron(
    job_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_write),
):
    job = db.query(models.CronJob).filter(models.CronJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Cron job not found")
    sched_module.remove_job(job_id)
    db.delete(job)
    db.commit()


@router.patch("/{job_id}/toggle", response_model=schemas.CronJobResponse)
def toggle_cron(
    job_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_write),
):
    job = db.query(models.CronJob).filter(models.CronJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Cron job not found")
    job.is_active = not job.is_active
    if job.is_active:
        nxt = sched_module._next_fire(job.cron_expr)
        if nxt:
            job.next_run_at = nxt.replace(tzinfo=None)
    else:
        job.next_run_at = None
    db.commit()
    db.refresh(job)
    sched_module.reload_job(job.id, DATABASE_URL)
    return job


@router.post("/{job_id}/run-now", response_model=schemas.CronJobResponse)
def run_cron_now(
    job_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_write),
):
    """Trigger a cron job immediately, outside its schedule."""
    from fastapi.concurrency import run_in_threadpool
    from ..routers.sync import _run_sync

    job = db.query(models.CronJob).filter(models.CronJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Cron job not found")

    # Run sync in background thread via APScheduler's executor
    import threading
    def _go():
        try:
            _run_sync(job.provider, DATABASE_URL)
            status = "success"
        except Exception:
            status = "failed"
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        from ..database import DATABASE_URL as dbu
        engine = create_engine(dbu, pool_pre_ping=True)
        sess = sessionmaker(bind=engine)()
        try:
            j = sess.query(models.CronJob).filter(models.CronJob.id == job_id).first()
            if j:
                j.last_run_at = datetime.now(timezone.utc)
                j.last_run_status = status
                sess.commit()
        finally:
            sess.close()

    threading.Thread(target=_go, daemon=True).start()

    job.last_run_at = datetime.now(timezone.utc)
    job.last_run_status = "running"
    db.commit()
    db.refresh(job)
    return job
