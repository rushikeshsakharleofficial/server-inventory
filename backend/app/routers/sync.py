import threading
import concurrent.futures
import time
from typing import Annotated
from fastapi import APIRouter, Depends, BackgroundTasks, Query
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from .. import models, schemas
from ..database import get_db, DATABASE_URL
from ..providers import get_provider
from ..auth import get_current_user, require_write
from ..crypto import decrypt_config
from ..event_log_utils import add_event_log
from ..ssh_utils import fetch_ssh_ips
from ..ws_manager import manager

router = APIRouter(prefix="/api/sync", tags=["sync"])

_SYNC_STOPPED_MSG = "Sync stopped by user"

SYNC_BATCH_SIZE: int = 25
SYNC_BATCH_DELAY_S: float = 0.15
SYNC_PROVIDER_PARALLELISM: int = 8


def _get_default_ssh(db):
    return db.query(models.SSHCredential).filter(models.SSHCredential.is_default.is_(True)).first()


def _ssh_fetch_ips(db, servers: list) -> None:
    """Best-effort: SSH each server using its assigned key (fallback to default)."""
    if not servers:
        return
    default_cred = _get_default_ssh(db)
    changed = False
    for svr in servers:
        host = svr.public_ip or svr.private_ip
        if not host:
            continue
        cred = svr.ssh_credential or default_cred
        if not cred:
            continue
        ips = fetch_ssh_ips(host, cred)
        if ips:
            svr.ssh_info = {**(svr.ssh_info or {}), "all_ips": ips}
            changed = True
    if changed:
        db.commit()

# Per-log cancellation events (process-local — single worker only)
_stop_events: dict[int, threading.Event] = {}


def _get_active_providers(db: Session) -> list[str]:
    rows = (
        db.query(models.Credential.provider)
        .filter(models.Credential.is_active.is_(True))
        .distinct()
        .all()
    )
    return [provider for (provider,) in rows if provider]


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
                total = len(srv_list)
                for batch_start in range(0, total, SYNC_BATCH_SIZE):
                    if stop_event.is_set():
                        raise RuntimeError(_SYNC_STOPPED_MSG)

                    for srv in srv_list[batch_start : batch_start + SYNC_BATCH_SIZE]:
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
                    manager.broadcast({
                        "type":      "sync_progress",
                        "log_id":    log.id,
                        "provider":  cred.provider,
                        "processed": min(batch_start + SYNC_BATCH_SIZE, total),
                        "total":     total,
                        "added":     added,
                        "updated":   updated,
                    })
                    if batch_start + SYNC_BATCH_SIZE < total:
                        time.sleep(SYNC_BATCH_DELAY_S)

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
            add_event_log(
                db,
                severity="error" if error else "info",
                source="sync",
                resource=cred.provider,
                event="Provider sync failed" if error else "Provider sync completed",
                status="open" if error else "resolved",
                owner="system",
                message=error or f"servers_added={added}, servers_updated={updated}",
                tags=[cred.provider],
            )
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


def _run_sync_all_parallel(db_url: str) -> None:
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    engine = create_engine(db_url, pool_pre_ping=True)
    db = sessionmaker(bind=engine)()
    try:
        providers = _get_active_providers(db)
    finally:
        db.close()

    if not providers:
        return

    max_workers = min(len(providers), SYNC_PROVIDER_PARALLELISM)
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as ex:
        futures = [ex.submit(_run_sync, provider, db_url) for provider in providers]
        for future in concurrent.futures.as_completed(futures):
            future.result()


@router.post("")
def trigger_sync(
    background_tasks: BackgroundTasks,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(require_write)],
    provider: str | None = None,
) -> dict[str, str]:
    add_event_log(
        db,
        source="sync",
        resource=provider or "all",
        event="Sync requested",
        owner=getattr(_, "username", None),
        message=f"provider={provider or 'all'}",
    )
    db.commit()
    if provider:
        background_tasks.add_task(_run_sync, provider, DATABASE_URL)
    else:
        background_tasks.add_task(_run_sync_all_parallel, DATABASE_URL)
    return {"message": "Sync started", "provider": provider or "all"}


@router.post("/stop")
def stop_sync(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(require_write)],
    log_id: Annotated[int | None, Query()] = None,
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


from pydantic import BaseModel as _BM

class SSHSyncRequest(_BM):
    server_ids: list[int] | None = None
    ssh_group: str | None = None


def _run_ssh_sync(server_ids: list[int] | None, ssh_group: str | None, db_url: str) -> None:
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    engine = create_engine(db_url, pool_pre_ping=True)
    db = sessionmaker(bind=engine)()
    try:
        q = db.query(models.Server)
        if server_ids:
            q = q.filter(models.Server.id.in_(server_ids))
        elif ssh_group:
            q = q.filter(models.Server.ssh_group == ssh_group)
        servers = q.all()
        _ssh_fetch_ips(db, servers)
    finally:
        db.close()


@router.post("/ssh")
def trigger_ssh_sync(
    payload: SSHSyncRequest,
    background_tasks: BackgroundTasks,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(require_write)],
) -> dict:
    """Trigger SSH-only sync for specific servers or a group."""
    background_tasks.add_task(_run_ssh_sync, payload.server_ids, payload.ssh_group, DATABASE_URL)
    count = len(payload.server_ids) if payload.server_ids else "group"
    return {"status": "started", "targets": count}


@router.get("/logs", response_model=list[schemas.SyncLogResponse])
def get_sync_logs(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(get_current_user)],
    limit: Annotated[int, Query(ge=1, le=500)] = 50,
) -> list[models.SyncLog]:
    return (
        db.query(models.SyncLog)
        .order_by(models.SyncLog.started_at.desc())
        .limit(limit)
        .all()
    )
