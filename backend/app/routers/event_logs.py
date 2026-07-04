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


_DEMO_EVENTS = {
    "Login failed for admin — 5 consecutive attempts",
    "API key rotation overdue by 30 days",
    "Credential vault decryption error",
    "Cloud sync auth token expired",
    "Cloud sync failed for OVH Cloud",
    "Credential copy rejected — insufficient role",
    "User session invalidated unexpectedly",
    "Cron job missed scheduled window",
    "MFA not enabled for provider credential",
    "Password not rotated in 90+ days",
    "Sync returned 0 servers — possible auth issue",
    "Duplicate IP detected across providers",
    "User logged in",
    "Cloud sync completed — 124 servers updated",
    "Provider credential added",
    "Password revealed by admin",
    "Credential copied",
    "Server added manually",
    "Cron sync triggered",
    "User password changed",
    "Settings updated",
    "New user created",
}


def _purge_demo_events(db: Session) -> None:
    deleted = (
        db.query(models.EventLog)
        .filter(models.EventLog.event.in_(_DEMO_EVENTS))
        .delete(synchronize_session=False)
    )
    if deleted:
        db.commit()


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/stats", response_model=StatsOut)
def event_stats(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(get_current_user)],
    hours: Annotated[int, Query(ge=1, le=720)] = 24,
):
    _purge_demo_events(db)
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
    severity: Annotated[str | None, Query()] = None,
    source:   Annotated[str | None, Query()] = None,
    resource: Annotated[str | None, Query()] = None,
    status:   Annotated[str | None, Query()] = None,
    q:        Annotated[str | None, Query()] = None,
    hours:    Annotated[int, Query(ge=1, le=720)] = 24,
    limit:    Annotated[int, Query(ge=1, le=200)] = 10,
    offset:   Annotated[int, Query(ge=0)] = 0,
):
    _purge_demo_events(db)
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    qry = db.query(models.EventLog).filter(models.EventLog.timestamp >= since)
    if severity:
        values = [v.strip().lower() for v in severity.split(",") if v.strip()]
        if values:
            qry = qry.filter(models.EventLog.severity.in_(values))
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


@router.patch(
    "/{event_id}",
    response_model=EventLogResponse,
    responses={404: {"description": "Event not found"}},
)
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
