from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db
from ..auth import get_current_user, require_write, require_admin

router = APIRouter(prefix="/api/credentials", tags=["credentials"])

_SECRET_FIELDS = frozenset({
    "application_secret",
    "consumer_key",
    "api_token",
    "secret_access_key",
    "client_secret",
    "service_account_json",
    "password",
})


def _mask_config(config: dict) -> dict:
    return {
        k: "***" if k in _SECRET_FIELDS else v
        for k, v in config.items()
    }


@router.get("", response_model=list[schemas.CredentialResponse])
def list_credentials(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(get_current_user)],
) -> list[dict]:
    creds = db.query(models.Credential).order_by(models.Credential.created_at.desc()).all()
    return [
        {
            "id": c.id,
            "name": c.name,
            "provider": c.provider,
            "is_active": c.is_active,
            "config": _mask_config(c.config or {}),
            "created_at": c.created_at,
        }
        for c in creds
    ]


@router.post("", response_model=schemas.CredentialResponse, status_code=201)
def create_credential(
    cred: schemas.CredentialCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(require_write)],
) -> dict:
    db_cred = models.Credential(**cred.model_dump())
    db.add(db_cred)
    db.commit()
    db.refresh(db_cred)
    return {
        "id": db_cred.id,
        "name": db_cred.name,
        "provider": db_cred.provider,
        "is_active": db_cred.is_active,
        "config": _mask_config(db_cred.config or {}),
        "created_at": db_cred.created_at,
    }


@router.delete("/{cred_id}", status_code=204)
def delete_credential(
    cred_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(require_admin)],
) -> None:
    cred = db.query(models.Credential).filter(models.Credential.id == cred_id).first()
    if not cred:
        raise HTTPException(status_code=404, detail="Credential not found")
    db.delete(cred)
    db.commit()


@router.patch("/{cred_id}/toggle", response_model=schemas.CredentialResponse)
def toggle_credential(
    cred_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(require_write)],
) -> dict:
    cred = db.query(models.Credential).filter(models.Credential.id == cred_id).first()
    if not cred:
        raise HTTPException(status_code=404, detail="Credential not found")
    cred.is_active = not cred.is_active
    db.commit()
    db.refresh(cred)
    return {
        "id": cred.id,
        "name": cred.name,
        "provider": cred.provider,
        "is_active": cred.is_active,
        "config": _mask_config(cred.config or {}),
        "created_at": cred.created_at,
    }
