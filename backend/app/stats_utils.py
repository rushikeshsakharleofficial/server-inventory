"""
Shared stats utility — no FastAPI router, just pure functions.
"""


def take_snapshot(db) -> dict:
    """Compute current stats from Server table and upsert today's ServerSnapshot. Returns snapshot data."""
    from datetime import date
    from . import models

    servers = db.query(models.Server).all()
    today = date.today().isoformat()
    by_provider: dict = {}
    by_status: dict = {}

    for s in servers:
        by_provider[s.provider] = by_provider.get(s.provider, 0) + 1
        by_status[s.status] = by_status.get(s.status, 0) + 1

    total = len(servers)
    running = by_status.get("running", 0)
    stopped = by_status.get("stopped", 0)

    # Upsert today's snapshot
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
