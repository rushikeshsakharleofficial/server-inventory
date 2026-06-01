"""
APScheduler-based cron runner for ServerInventory.

On startup: loads all active CronJob records, schedules each as a cron trigger.
When a CronJob is created/updated/deleted via the API, the router calls
reload_job() / remove_job() so the live schedule stays in sync with the DB.
"""
from datetime import datetime, timezone
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
import logging

logger = logging.getLogger(__name__)

_scheduler: BackgroundScheduler | None = None


def get_scheduler() -> BackgroundScheduler:
    global _scheduler
    if _scheduler is None:
        _scheduler = BackgroundScheduler(timezone="UTC")
    return _scheduler


def _next_fire(cron_expr: str) -> datetime | None:
    try:
        trig = CronTrigger.from_crontab(cron_expr, timezone="UTC")
        return trig.get_next_fire_time(None, datetime.now(timezone.utc))
    except Exception:
        return None


def _run_cron(job_id: int, db_url: str) -> None:
    """Executed by APScheduler in a thread — mirrors _run_sync logic."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from .routers.sync import _run_sync
    from . import models

    engine = create_engine(db_url, pool_pre_ping=True)
    Session = sessionmaker(bind=engine)
    db = Session()

    try:
        job = db.query(models.CronJob).filter(models.CronJob.id == job_id).first()
        if not job or not job.is_active:
            return

        # Mark as running
        job.last_run_at = datetime.now(timezone.utc)
        job.last_run_status = "running"
        # Update next_run_at
        nxt = _next_fire(job.cron_expr)
        if nxt:
            job.next_run_at = nxt.replace(tzinfo=None)
        db.commit()
    finally:
        db.close()

    # Run the actual sync (reuse existing logic, separate DB session inside)
    try:
        _run_sync(job.provider, db_url)
        status = "success"
    except Exception:
        status = "failed"

    # Update status
    db2 = Session()
    try:
        j = db2.query(models.CronJob).filter(models.CronJob.id == job_id).first()
        if j:
            j.last_run_status = status
            db2.commit()
    finally:
        db2.close()


def load_jobs(db_url: str) -> None:
    """Load all active CronJob records and schedule them."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from . import models

    engine = create_engine(db_url, pool_pre_ping=True)
    db = sessionmaker(bind=engine)()
    sched = get_scheduler()

    try:
        jobs = db.query(models.CronJob).filter(models.CronJob.is_active.is_(True)).all()
        for job in jobs:
            _schedule_job(sched, job, db_url)
            # Update next_run_at in DB
            nxt = _next_fire(job.cron_expr)
            if nxt:
                job.next_run_at = nxt.replace(tzinfo=None)
        db.commit()
    except Exception:
        logger.exception("Failed to load cron jobs")
    finally:
        db.close()


def _schedule_job(sched: BackgroundScheduler, job, db_url: str) -> None:
    job_id = f"cron_{job.id}"
    if sched.get_job(job_id):
        sched.remove_job(job_id)
    try:
        trigger = CronTrigger.from_crontab(job.cron_expr, timezone="UTC")
        sched.add_job(
            _run_cron,
            trigger=trigger,
            id=job_id,
            args=[job.id, db_url],
            replace_existing=True,
            misfire_grace_time=300,
        )
    except Exception:
        logger.exception("Failed to schedule job %s (%s)", job.id, job.cron_expr)


def reload_job(job_id: int, db_url: str) -> None:
    """Re-schedule or remove a single job after DB update."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from . import models

    engine = create_engine(db_url, pool_pre_ping=True)
    db = sessionmaker(bind=engine)()
    sched = get_scheduler()

    try:
        job = db.query(models.CronJob).filter(models.CronJob.id == job_id).first()
        if not job:
            remove_job(job_id)
            return
        if job.is_active:
            _schedule_job(sched, job, db_url)
            nxt = _next_fire(job.cron_expr)
            if nxt:
                job.next_run_at = nxt.replace(tzinfo=None)
            db.commit()
        else:
            remove_job(job_id)
    finally:
        db.close()


def remove_job(job_id: int) -> None:
    sched = get_scheduler()
    apid = f"cron_{job_id}"
    if sched.get_job(apid):
        sched.remove_job(apid)


def _housekeeping(db_url: str) -> None:
    """Delete sync_logs and server_snapshots older than 1 year."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from datetime import timedelta
    from . import models

    cutoff = datetime.now(timezone.utc) - timedelta(days=365)
    engine = create_engine(db_url, pool_pre_ping=True)
    db = sessionmaker(bind=engine)()
    try:
        deleted_logs = (
            db.query(models.SyncLog)
            .filter(models.SyncLog.started_at < cutoff)
            .delete(synchronize_session=False)
        )
        cutoff_str = (datetime.now(timezone.utc) - timedelta(days=365)).strftime("%Y-%m-%d")
        deleted_snaps = (
            db.query(models.ServerSnapshot)
            .filter(models.ServerSnapshot.date < cutoff_str)
            .delete(synchronize_session=False)
        )
        db.commit()
        if deleted_logs or deleted_snaps:
            logger.info("Pruned %d sync_logs, %d snapshots older than 1 year", deleted_logs, deleted_snaps)
    except Exception:
        logger.exception("Housekeeping failed")
        db.rollback()
    finally:
        db.close()


def start(db_url: str) -> None:
    sched = get_scheduler()
    if not sched.running:
        sched.start()
    load_jobs(db_url)

    # Daily housekeeping at 03:00 UTC
    hk_id = "housekeeping_daily"
    if not sched.get_job(hk_id):
        sched.add_job(
            _housekeeping,
            trigger=CronTrigger.from_crontab("0 3 * * *", timezone="UTC"),
            id=hk_id,
            args=[db_url],
            replace_existing=True,
            misfire_grace_time=3600,
        )


def shutdown() -> None:
    sched = get_scheduler()
    if sched.running:
        sched.shutdown(wait=False)
