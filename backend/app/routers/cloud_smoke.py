"""Admin-only real-cloud read-only smoke verification endpoints. Disabled
unless ENABLE_REAL_CLOUD_SMOKE=true; never exposes credential values. See
app/cloud_smoke_verifier.py for the actual verification logic."""

import json
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from .. import models
from ..auth import require_admin
from ..crypto import decrypt_config
from ..database import get_db
from ..cloud_smoke_verifier import (
    ENABLE_REAL_CLOUD_SMOKE,
    verify_provider_readonly,
    write_reports,
)
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/cloud-smoke", tags=["cloud-smoke"])

_REPORT_DIR = Path(__file__).resolve().parent.parent.parent / "test-reports"


def _require_enabled() -> None:
    if not ENABLE_REAL_CLOUD_SMOKE:
        raise HTTPException(status_code=403, detail="ENABLE_REAL_CLOUD_SMOKE is not enabled")


@router.get("/status")
def cloud_smoke_status(_: Annotated[models.User, Depends(require_admin)]) -> dict:
    return {"enabled": ENABLE_REAL_CLOUD_SMOKE}


@router.post("/run-readonly")
def cloud_smoke_run_readonly(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(require_admin)],
) -> dict:
    _require_enabled()
    creds = db.query(models.Credential).filter(models.Credential.is_active.is_(True)).all()
    results = [
        verify_provider_readonly(c.provider, decrypt_config(c.config or {}), c.name)
        for c in creds
    ]
    write_reports(results, _REPORT_DIR)
    return {"results": [r.to_dict() for r in results]}


@router.get("/report/latest")
def cloud_smoke_report_latest(_: Annotated[models.User, Depends(require_admin)]) -> dict:
    _require_enabled()
    json_path = _REPORT_DIR / "cloud-smoke-report.json"
    if not json_path.exists():
        raise HTTPException(status_code=404, detail="No report has been generated yet")
    return json.loads(json_path.read_text())
