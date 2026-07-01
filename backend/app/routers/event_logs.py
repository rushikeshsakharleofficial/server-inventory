from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from .. import models
from ..auth import get_current_user
from ..database import get_db

router = APIRouter(prefix="/api/event-logs", tags=["event-logs"])

# ─── Schemas ──────────────────────────────────────────────────────────────────

class EventLogResponse(BaseModel):
    id: int
    timestamp: datetime
    severity: str
    source: str | None
    resource: str | None
    event: str
    status: str
    owner: str | None
    message: str | None
    tags: list[str] = []

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_obj(cls, obj: models.EventLog) -> "EventLogResponse":
        tags = obj.tags if isinstance(obj.tags, list) else list((obj.tags or {}).keys())
        return cls(
            id=obj.id, timestamp=obj.timestamp, severity=obj.severity,
            source=obj.source, resource=obj.resource, event=obj.event,
            status=obj.status, owner=obj.owner, message=obj.message, tags=tags,
        )


class EventLogUpdate(BaseModel):
    status: Literal["open", "acknowledged", "investigating", "resolved"] | None = None
    owner: str | None = None


class StatsOut(BaseModel):
    total: int
    critical: int
    warnings: int
    resolved_today: int
    by_severity: dict[str, int]
    by_source: list[dict]
    volume: list[dict]  # [{hour, count}]


# ─── Seed demo data if table is empty ─────────────────────────────────────────

_SOURCES   = ["nginx", "postgres", "redis", "kubelet", "sshd", "cron", "node-exporter", "python-app"]
_RESOURCES = ["lb-01", "db-prod-01", "db-replica-02", "app-server-01", "redis-cache-01", "worker-02", "worker-03", "api-gateway-01", "backup-worker"]
_OWNERS    = ["infra-team", "sre", "platform", "security", "automation"]
_STATUSES  = ["open", "open", "acknowledged", "investigating", "resolved", "resolved"]
_EVENTS: dict[str, list[str]] = {
    "critical": ["Replication lag exceeded threshold", "Memory usage crossed 95%", "Disk full on /dev/sda1", "OOM killer activated"],
    "error":    ["Pod restart back-off detected", "Connection refused", "Evicted keys rate high", "TLS handshake failed"],
    "warning":  ["Upstream response time degraded", "Multiple failed login attempts", "Connection pool saturation high", "CPU spike above 80%"],
    "info":     ["Nightly snapshot completed", "Node ready", "Configuration reloaded", "Backup completed successfully", "Service restarted cleanly"],
}
_MESSAGES: dict[str, str] = {
    "Replication lag exceeded threshold": "replication_lag_seconds=45.3 threshold_seconds=30\nprimary=10.0.0.21:5432 standby=10.0.0.22:5432\nslot=replication_slot_1\nstate=lagging",
    "Memory usage crossed 95%": "mem_used=15.6GB mem_total=16GB\nprocess=redis-server pid=12345\noom_score=800",
    "Pod restart back-off detected": "pod=worker-03-abc123 namespace=production\nreason=CrashLoopBackOff restarts=5\nlast_exit_code=137",
    "Multiple failed login attempts": "attempts=23 window=60s src_ip=185.220.101.47\nuser=root port=22\naction=block",
}


def _seed_demo(db: Session) -> None:
    if db.query(func.count(models.EventLog.id)).scalar() > 0:
        return
    now = datetime.now(timezone.utc)
    sev_weights = [("info", 0.658), ("warning", 0.223), ("error", 0.095), ("critical", 0.024)]
    rows = []
    for i in range(512):
        # pick severity by weight
        r = random.random(); acc = 0.0
        sev = "info"
        for s, w in sev_weights:
            acc += w
            if r < acc: sev = s; break
        event = random.choice(_EVENTS[sev])
        ts = now - timedelta(hours=random.uniform(0, 48))
        rows.append(models.EventLog(
            timestamp=ts, severity=sev,
            source=random.choice(_SOURCES),
            resource=random.choice(_RESOURCES),
            event=event,
            status=random.choice(_STATUSES),
            owner=random.choice(_OWNERS),
            message=_MESSAGES.get(event, f"{event.lower().replace(' ', '_')}=true ts={ts.isoformat()}"),
            tags=random.sample(["database", "replication", "production", "staging", "network", "security"], k=random.randint(0, 3)),
        ))
    db.bulk_save_objects(rows)
    db.commit()


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/stats", response_model=StatsOut)
def event_stats(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(get_current_user)],
    hours: int = Query(default=24, ge=1, le=720),
):
    _seed_demo(db)
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    base = db.query(models.EventLog).filter(models.EventLog.timestamp >= since)
    total = base.count()
    by_sev: dict[str, int] = {}
    for row in db.query(models.EventLog.severity, func.count()).filter(models.EventLog.timestamp >= since).group_by(models.EventLog.severity).all():
        by_sev[row[0]] = row[1]

    resolved_today = db.query(func.count(models.EventLog.id)).filter(
        models.EventLog.timestamp >= today_start,
        models.EventLog.status == "resolved",
    ).scalar() or 0

    by_src = []
    for src, cnt in db.query(models.EventLog.source, func.count()).filter(
        models.EventLog.timestamp >= since, models.EventLog.source.isnot(None),
    ).group_by(models.EventLog.source).order_by(func.count().desc()).limit(8).all():
        by_src.append({"source": src, "count": cnt})

    # Hourly volume buckets (last 24h)
    volume = []
    for h in range(23, -1, -1):
        bstart = datetime.now(timezone.utc) - timedelta(hours=h + 1)
        bend   = datetime.now(timezone.utc) - timedelta(hours=h)
        cnt = db.query(func.count(models.EventLog.id)).filter(
            models.EventLog.timestamp >= bstart,
            models.EventLog.timestamp < bend,
        ).scalar() or 0
        volume.append({"hour": bstart.strftime("%H:%M"), "count": cnt})

    return StatsOut(
        total=total,
        critical=by_sev.get("critical", 0),
        warnings=by_sev.get("warning", 0),
        resolved_today=resolved_today,
        by_severity=by_sev,
        by_source=by_src,
        volume=volume,
    )


@router.get("", response_model=dict)
def list_events(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(get_current_user)],
    severity: str | None = Query(default=None),
    source:   str | None = Query(default=None),
    resource: str | None = Query(default=None),
    status:   str | None = Query(default=None),
    q:        str | None = Query(default=None),
    hours:    int        = Query(default=24, ge=1, le=720),
    limit:    int        = Query(default=10, ge=1, le=200),
    offset:   int        = Query(default=0, ge=0),
):
    _seed_demo(db)
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    qry = db.query(models.EventLog).filter(models.EventLog.timestamp >= since)
    if severity: qry = qry.filter(models.EventLog.severity == severity.lower())
    if source:   qry = qry.filter(models.EventLog.source == source)
    if resource: qry = qry.filter(models.EventLog.resource == resource)
    if status:   qry = qry.filter(models.EventLog.status == status.lower())
    if q:
        like = f"%{q}%"
        qry = qry.filter(
            models.EventLog.event.ilike(like) |
            models.EventLog.source.ilike(like) |
            models.EventLog.resource.ilike(like)
        )
    total = qry.count()
    items = qry.order_by(models.EventLog.timestamp.desc()).offset(offset).limit(limit).all()
    return {
        "total": total, "limit": limit, "offset": offset,
        "items": [EventLogResponse.from_orm_obj(e) for e in items],
    }


@router.patch("/{event_id}", response_model=EventLogResponse)
def update_event(
    event_id: int,
    payload: EventLogUpdate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(get_current_user)],
):
    ev = db.query(models.EventLog).filter(models.EventLog.id == event_id).first()
    if not ev:
        from fastapi import HTTPException
        raise HTTPException(404, "Event not found")
    if payload.status is not None: ev.status = payload.status
    if payload.owner  is not None: ev.owner  = payload.owner
    db.commit(); db.refresh(ev)
    return EventLogResponse.from_orm_obj(ev)
