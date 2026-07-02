from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from .. import models
from ..database import get_db
from ..event_log_utils import add_event_log
from ..auth import get_current_user, require_admin

router = APIRouter(prefix="/api/settings", tags=["settings"])


# ---------------------------------------------------------------------------
# Pydantic schema
# ---------------------------------------------------------------------------

class SettingValue(BaseModel):
    value: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("")
def get_all_settings(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(get_current_user)],
) -> dict[str, str]:
    """Return all application settings as a flat {key: value} dict."""
    settings = db.query(models.AppSetting).order_by(models.AppSetting.key).all()
    return {s.key: (s.value or "") for s in settings}


@router.put("/{key}")
def upsert_setting(
    key: str,
    body: SettingValue,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[models.User, Depends(require_admin)],
) -> dict[str, str]:
    """Create or update a single application setting by key."""
    setting = db.query(models.AppSetting).filter(models.AppSetting.key == key).first()
    if setting:
        setting.value = body.value
    else:
        setting = models.AppSetting(key=key, value=body.value)
        db.add(setting)

    db.commit()
    db.refresh(setting)
    add_event_log(
        db,
        source="settings",
        resource=key,
        event="Setting updated",
        owner=current_user.username,
        message=f"key={key}",
    )
    db.commit()
    return {setting.key: (setting.value or "")}
