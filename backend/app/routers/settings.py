from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from .. import models
from ..database import get_db
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

@router.get("", response_model=dict[str, str])
def get_all_settings(
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
) -> dict[str, str]:
    """Return all application settings as a flat {key: value} dict."""
    settings = db.query(models.AppSetting).order_by(models.AppSetting.key).all()
    return {s.key: (s.value or "") for s in settings}


@router.put("/{key}", response_model=dict[str, str])
def upsert_setting(
    key: str,
    body: SettingValue,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
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
    return {setting.key: (setting.value or "")}
