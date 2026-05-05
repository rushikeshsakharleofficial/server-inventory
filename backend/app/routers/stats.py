from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Any, Dict, List
from pydantic import BaseModel
from .. import models
from ..database import get_db
from ..auth import get_current_user, require_write
from ..stats_utils import take_snapshot

router = APIRouter(prefix="/api/stats", tags=["stats"])


# ---------------------------------------------------------------------------
# Pydantic schema
# ---------------------------------------------------------------------------

class SnapshotResponse(BaseModel):
    date: str
    total: int
    running: int
    stopped: int
    by_provider: Dict[str, int]

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/history", response_model=List[SnapshotResponse])
def get_snapshot_history(
    days: int = Query(default=30, ge=1, le=365),
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    """Return the last N days of ServerSnapshot records ordered by date ascending."""
    snapshots = (
        db.query(models.ServerSnapshot)
        .order_by(models.ServerSnapshot.date.desc())
        .limit(days)
        .all()
    )
    # Return in ascending date order so charts render left-to-right
    snapshots = list(reversed(snapshots))
    return [
        SnapshotResponse(
            date=s.date,
            total=s.total,
            running=s.running,
            stopped=s.stopped,
            by_provider=s.by_provider or {},
        )
        for s in snapshots
    ]


@router.post("/snapshot", response_model=SnapshotResponse)
def trigger_snapshot(
    db: Session = Depends(get_db),
    _: models.User = Depends(require_write),
):
    """Manually compute and persist today's server snapshot."""
    result = take_snapshot(db)
    return SnapshotResponse(**result)
