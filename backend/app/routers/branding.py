import base64
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Response
from sqlalchemy.orm import Session
from .. import models
from ..database import get_db
from ..auth import require_admin

router = APIRouter(prefix="/api/branding", tags=["branding"])

# ponytail: raster + gif only — inline SVG is a stored-XSS vector (same origin script exec)
ALLOWED_TYPES = {"image/png", "image/jpeg", "image/webp", "image/gif", "image/x-icon"}
MAX_BYTES = 2 * 1024 * 1024

SLOTS = {"logo", "favicon"}


def _keys(slot: str) -> tuple[str, str]:
    return f"branding_{slot}_data", f"branding_{slot}_type"


@router.get("/{slot}", responses={404: {"description": "Slot or asset not found"}})
def get_branding_asset(slot: str, db: Annotated[Session, Depends(get_db)]) -> Response:
    """Public — no auth. Login page and sidebar need this before the user is authenticated."""
    if slot not in SLOTS:
        raise HTTPException(404)
    data_key, type_key = _keys(slot)
    rows = {
        s.key: s.value
        for s in db.query(models.AppSetting).filter(models.AppSetting.key.in_([data_key, type_key])).all()
    }
    if not rows.get(data_key):
        raise HTTPException(404)
    return Response(content=base64.b64decode(rows[data_key]), media_type=rows.get(type_key) or "application/octet-stream")


@router.post(
    "/{slot}",
    responses={
        404: {"description": "Slot not found"},
        400: {"description": "Invalid or oversized image"},
    },
)
async def upload_branding_asset(
    slot: str,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(require_admin)],
    file: Annotated[UploadFile, File(...)],
) -> dict[str, bool]:
    if slot not in SLOTS:
        raise HTTPException(404)
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, f"Unsupported image type: {file.content_type}")
    body = await file.read()
    if len(body) > MAX_BYTES:
        raise HTTPException(400, "Image too large (max 2MB)")

    data_key, type_key = _keys(slot)
    for key, value in [(data_key, base64.b64encode(body).decode()), (type_key, file.content_type)]:
        setting = db.query(models.AppSetting).filter(models.AppSetting.key == key).first()
        if setting:
            setting.value = value
        else:
            db.add(models.AppSetting(key=key, value=value))
    db.commit()
    return {"ok": True}


@router.delete("/{slot}", responses={404: {"description": "Slot not found"}})
def reset_branding_asset(
    slot: str,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(require_admin)],
) -> dict[str, bool]:
    if slot not in SLOTS:
        raise HTTPException(404)
    data_key, type_key = _keys(slot)
    db.query(models.AppSetting).filter(models.AppSetting.key.in_([data_key, type_key])).delete(synchronize_session=False)
    db.commit()
    return {"ok": True}
