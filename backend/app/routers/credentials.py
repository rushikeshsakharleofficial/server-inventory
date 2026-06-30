from typing import Any, Annotated
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db
from ..auth import get_current_user, require_write, require_admin
from ..crypto import encrypt_config, decrypt_config

router = APIRouter(prefix="/api/credentials", tags=["credentials"])

_KNOWN_PROVIDERS = frozenset({
    "aws", "gcp", "azure", "digitalocean", "linode", "ovh", "hivelocity",
})

_SECRET_KEYWORDS = frozenset({
    "secret", "password", "token", "key", "credential",
    "private", "auth", "api_key", "client_secret", "access_key",
})


def _field_is_secret(field_name: str) -> bool:
    lower = field_name.lower()
    return any(kw in lower for kw in _SECRET_KEYWORDS)


def _mask_config(config: Any) -> Any:
    """Recursively mask secret fields in a config dict."""
    if isinstance(config, dict):
        return {
            k: "***" if _field_is_secret(k) else _mask_config(v)
            for k, v in config.items()
        }
    if isinstance(config, list):
        return [_mask_config(item) for item in config]
    return config


def _build_response(c: models.Credential) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "provider": c.provider,
        "is_active": c.is_active,
        "config": _mask_config(decrypt_config(c.config or {})),
        "created_at": c.created_at,
    }


@router.get("", response_model=schemas.Page[schemas.CredentialResponse])
def list_credentials(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(get_current_user)],
    limit: int = Query(default=schemas._DEFAULT_PAGE_SIZE, ge=1, le=schemas._MAX_PAGE_SIZE),
    offset: int = Query(default=0, ge=0),
) -> schemas.Page[schemas.CredentialResponse]:
    q = db.query(models.Credential)
    total = q.count()
    creds = q.order_by(models.Credential.created_at.desc()).offset(offset).limit(limit).all()
    return schemas.Page(total=total, limit=limit, offset=offset, items=[_build_response(c) for c in creds])


@router.post("", response_model=schemas.CredentialResponse, status_code=201)
def create_credential(
    cred: schemas.CredentialCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(require_write)],
) -> dict:
    if cred.provider not in _KNOWN_PROVIDERS:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown provider {cred.provider!r}. Supported: {sorted(_KNOWN_PROVIDERS)}",
        )
    data = cred.model_dump()
    data["config"] = encrypt_config(data.get("config") or {})
    db_cred = models.Credential(**data)
    db.add(db_cred)
    db.commit()
    db.refresh(db_cred)
    return _build_response(db_cred)


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


@router.put("/{cred_id}", response_model=schemas.CredentialResponse)
def update_credential(
    cred_id: int,
    payload: schemas.CredentialUpdate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(require_write)],
) -> dict:
    cred = db.query(models.Credential).filter(models.Credential.id == cred_id).first()
    if not cred:
        raise HTTPException(status_code=404, detail="Credential not found")
    if payload.name is not None:
        cred.name = payload.name
    if payload.config is not None:
        existing = decrypt_config(cred.config or {})
        merged = {**existing, **payload.config}
        cred.config = encrypt_config(merged)
    db.commit()
    db.refresh(cred)
    return _build_response(cred)


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
    return _build_response(cred)
