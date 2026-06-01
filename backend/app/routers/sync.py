import threading
import concurrent.futures
from typing import Annotated
from fastapi import APIRouter, Depends, BackgroundTasks, Query
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from .. import models, schemas
from ..database import get_db, DATABASE_URL
from ..providers import get_provider
from ..auth import get_current_user, require_write
from ..crypto import decrypt_config
from ..ssh_utils import fetch_ssh_ips
from ..ws_manager import manager

router = APIRouter(prefix="/api/sync", tags=["sync"])

_SYNC_STOPPED_MSG = "Sync stopped by user"


def _ssh_fetch_ips(db, servers: list) -> None:
    """Best-effort: SSH each server with the default credential and store all_ips."""
    if not servers:
        return
    ssh_cred = (
        db.query(models.SSHCredential)
        .filter(models.SSHCredential.is_default.is_(True))
        .first()
    )
    if not ssh_cred:
        return
    changed = False
    for svr in servers:
        host = svr.public_ip or svr.private_ip
        if not host:
            continue
        ips = fetch_ssh_ips(host, ssh_cred)
        if ips:
            svr.ssh_info = {**(svr.ssh_info or {}), "all_ips": ips}
            changed = True
    if changed:
        db.commit()

# Per-log cancellation events (process-local — single worker only)
_stop_events: dict[int, threading.Event] = {}


def _run_sync(provider_name: str | None, db_url: str) -> None:
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from ..stats_utils import take_snapshot

    engine = create_engine(db_url, pool_pre_ping=True)
    db = sessionmaker(bind=engine)()

    try:
        q = db.query(models.Credential).filter(models.Credential.is_active.is_(True))
        if provider_name:
            q = q.filter(models.Credential.provider == provider_name)

        for cred in q.all():
            log = models.SyncLog(provider=cred.provider, status="running")
            db.add(log)
            db.commit()
            db.refresh(log)

            stop_event = threading.Event()
            _stop_events[log.id] = stop_event

            manager.broadcast({
                "type": "sync_started",
                "log_id": log.id,
                "provider": cred.provider,
            })

            added   = 0
            updated = 0
            error   = None

            try:
                if stop_event.is_set():
                    raise RuntimeError(_SYNC_STOPPED_MSG)

                provider = get_provider(cred.provider, decrypt_config(cred.config or {}))

                # 300s timeout on the provider fetch
                with concurrent.futures.ThreadPoolExecutor(max_workers=1) as ex:
                    future = ex.submit(provider.fetch_servers)
                    try:
                        srv_list = future.result(timeout=300)
                    except concurrent.futures.TimeoutError:
                        raise RuntimeError("Provider fetch timed out after 300 seconds")

                if stop_event.is_set():
                    raise RuntimeError(_SYNC_STOPPED_MSG)

                # Pre-fetch all existing servers for this provider in one query
                cloud_ids = [s.get("cloud_id") for s in srv_list if s.get("cloud_id")]
                existing_map: dict[str, models.Server] = {}
                if cloud_ids:
                    for obj in (
                        db.query(models.Server)
                        .filter(
                            models.Server.cloud_id.in_(cloud_ids),
                            models.Server.provider == cred.provider,
                        )
                        .all()
                    ):
                        if obj.cloud_id:
                            existing_map[obj.cloud_id] = obj

                allowed_cols = {c.key for c in models.Server.__table__.columns}
                new_servers: list[models.Server] = []
                for srv in srv_list:
                    if stop_event.is_set():
                        raise RuntimeError(_SYNC_STOPPED_MSG)

                    cloud_id = srv.get("cloud_id")
                    existing = existing_map.get(cloud_id) if cloud_id else None

                    if existing:
                        old_status = existing.status
                        for k, v in srv.items():
                            if hasattr(existing, k):
                                setattr(existing, k, v)
                        existing.last_synced = datetime.now(timezone.utc)
                        updated += 1
                        if old_status != existing.status:
                            manager.broadcast({
                                "type":        "server_status_changed",
                                "server_id":   existing.id,
                                "server_name": existing.name,
                                "provider":    existing.provider,
                                "old_status":  old_status,
                                "new_status":  existing.status,
                            })
                    else:
                        new_srv = models.Server(**{k: v for k, v in srv.items() if k in allowed_cols})
                        new_srv.last_synced = datetime.now(timezone.utc)
                        db.add(new_srv)
                        new_servers.append(new_srv)
                        added += 1

                db.commit()

                # SSH IP fetch — best-effort, runs after provider sync
                _ssh_fetch_ips(db, list(existing_map.values()) + new_servers)

                # Take a snapshot after successful sync
                try:
                    take_snapshot(db)
                except Exception:  # noqa: BLE001 — snapshot failure must not abort the sync
                    pass

            except Exception as exc:
                error = str(exc)
                db.rollback()
            finally:
                _stop_events.pop(log.id, None)

            log.status        = "failed" if error else "success"
            log.servers_added = added
            log.servers_updated = updated
            log.error_message = error
            log.completed_at  = datetime.now(timezone.utc)
            db.commit()

            manager.broadcast({
                "type":            "sync_complete",
                "log_id":          log.id,
                "provider":        cred.provider,
                "status":          log.status,
                "servers_added":   log.servers_added,
                "servers_updated": log.servers_updated,
                "error_message":   log.error_message,
            })

    finally:
        db.close()


@router.post("")
def trigger_sync(
    background_tasks: BackgroundTasks,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(require_write)],
    provider: str | None = None,
) -> dict[str, str]:
    background_tasks.add_task(_run_sync, provider, DATABASE_URL)
    return {"message": "Sync started", "provider": provider or "all"}


@router.post("/stop")
def stop_sync(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(require_write)],
    log_id: int | None = Query(None),
) -> dict[str, list[int]]:
    """Stop one or all running syncs."""
    now = datetime.now(timezone.utc)
    stopped_ids = []

    if log_id:
        targets = [log_id]
    else:
        running = db.query(models.SyncLog).filter(models.SyncLog.status == "running").all()
        targets = [l.id for l in running]

    for lid in targets:
        ev = _stop_events.get(lid)
        if ev:
            ev.set()
        log = db.query(models.SyncLog).filter(models.SyncLog.id == lid).first()
        if log and log.status == "running":
            log.status = "failed"
            log.error_message = "Stopped by user"
            log.completed_at = now
            db.commit()
            stopped_ids.append(lid)
            manager.broadcast({
                "type": "sync_stopped",
                "log_id": lid,
                "provider": log.provider,
            })

    return {"stopped": stopped_ids}


@router.get("/logs", response_model=list[schemas.SyncLogResponse])
def get_sync_logs(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(get_current_user)],
    limit: int = 50,
) -> list[models.SyncLog]:
    return (
        db.query(models.SyncLog)
        .order_by(models.SyncLog.started_at.desc())
        .limit(limit)
        .all()
    )
