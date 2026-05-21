"""
Shared stats utility — no FastAPI router, just pure functions.
"""
from __future__ import annotations

from datetime import date
from sqlalchemy import func
from sqlalchemy.orm import Session


def take_snapshot(db: Session) -> dict[str, object]:
    """Aggregate Server table stats with SQL and upsert today's ServerSnapshot."""
    from . import models

    today = date.today().isoformat()

    total: int = db.query(func.count(models.Server.id)).scalar() or 0
    by_status: dict[str, int] = dict(
        db.query(models.Server.status, func.count(models.Server.id))
        .group_by(models.Server.status)
        .all()
    )
    by_provider: dict[str, int] = dict(
        db.query(models.Server.provider, func.count(models.Server.id))
        .group_by(models.Server.provider)
        .all()
    )

    running = by_status.get("running", 0)
    stopped = by_status.get("stopped", 0)

    snap = db.query(models.ServerSnapshot).filter(models.ServerSnapshot.date == today).first()
    if snap:
        snap.total = total
        snap.running = running
        snap.stopped = stopped
        snap.by_provider = by_provider
    else:
        snap = models.ServerSnapshot(
            date=today,
            total=total,
            running=running,
            stopped=stopped,
            by_provider=by_provider,
        )
        db.add(snap)

    db.commit()
    return {
        "date": today,
        "total": total,
        "running": running,
        "stopped": stopped,
        "by_provider": by_provider,
    }
