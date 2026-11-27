from datetime import datetime, timezone
from typing import Any, Annotated
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db
from ..auth import require_perm
from ..crypto import encrypt_config, decrypt_config
from ..permissions import has_perm
from ..event_log_utils import add_event_log
from ..ws_manager import manager

router = APIRouter(prefix="/api/credentials", tags=["credentials"])

CREDENTIAL_NOT_FOUND = "Credential not found"

_SECRET_KEYWORDS = frozenset({
    "secret", "password", "token", "key", "credential",
    "private", "auth", "api_key", "client_secret", "access_key", "service_account",
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


# Changing where or how credentials are sent must not reuse a stored secret.
_DESTINATION_FIELDS = ("prism_url", "verify_ssl")


def _drop_placeholders(config: dict) -> dict:
    """Never store the masked "***" value, or a blank, over a real secret."""
    return {k: v for k, v in config.items() if not (_field_is_secret(k) and v in ("***", ""))}


def _require_secrets_on_destination_change(existing: dict, incoming: dict) -> None:
    moved = any(
        k in incoming and str(incoming[k]).lower() != str(existing.get(k, "true" if k == "verify_ssl" else "")).lower()
        for k in _DESTINATION_FIELDS
    )
    missing = [k for k, v in existing.items() if v and _field_is_secret(k) and k not in incoming]
    if moved and missing:
        raise HTTPException(status_code=400, detail=f"Re-enter {', '.join(missing)} when changing the connection settings")


def _build_response(c: models.Credential) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "provider": c.provider,
        "is_active": c.is_active,
        "cred_type": getattr(c, "cred_type", "login") or "login",
        "config": _mask_config(decrypt_config(c.config or {})),
        "created_at": c.created_at,
    }


@router.get("")
def list_credentials(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(require_perm("credentials", "read"))],
    limit: Annotated[int, Query(ge=1, le=schemas._MAX_PAGE_SIZE)] = schemas._DEFAULT_PAGE_SIZE,
    offset: Annotated[int, Query(ge=0)] = 0,
    cred_type: Annotated[str | None, Query()] = None,
) -> schemas.Page[schemas.CredentialResponse]:
    q = db.query(models.Credential)
    if cred_type:
        q = q.filter(models.Credential.cred_type == cred_type)
    total = q.count()
    creds = q.order_by(models.Credential.created_at.desc()).offset(offset).limit(limit).all()
    return schemas.Page(total=total, limit=limit, offset=offset, items=[_build_response(c) for c in creds])


@router.post("", response_model=schemas.CredentialResponse, status_code=201)
def create_credential(
    cred: schemas.CredentialCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_perm("credentials", "write"))],
) -> dict:
    data = cred.model_dump()
    config = _drop_placeholders(data.get("config") or {})
    status = config.pop("status", None)
    if status is not None:
        data["is_active"] = status == "active"
    data["config"] = encrypt_config(config)
    db_cred = models.Credential(**data)
    db.add(db_cred)
    add_event_log(db, source="credentials", resource=db_cred.name, event="Credential added",
                  owner=user.username, message=f"provider={db_cred.provider}, type={db_cred.cred_type}")
    db.commit()
    db.refresh(db_cred)
    return _build_response(db_cred)


@router.delete("/{cred_id}", status_code=204, responses={404: {"description": CREDENTIAL_NOT_FOUND}})
def delete_credential(
    cred_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_perm("credentials", "admin"))],
) -> None:
    cred = db.query(models.Credential).filter(models.Credential.id == cred_id).first()
    if not cred:
        raise HTTPException(status_code=404, detail=CREDENTIAL_NOT_FOUND)
    add_event_log(db, source="credentials", resource=cred.name, event="Credential removed",
                  owner=user.username, message=f"provider={cred.provider}, type={cred.cred_type}")
    removed = db.query(models.DnsRecord).filter(
        models.DnsRecord.extra["credential_id"].as_integer() == cred.id
    ).delete(synchronize_session=False)
    db.delete(cred)
    db.commit()
    if removed:
        manager.broadcast({"type": "resources_changed", "resource": "dns_records"})


@router.put("/{cred_id}", response_model=schemas.CredentialResponse, responses={404: {"description": CREDENTIAL_NOT_FOUND}})
def update_credential(
    cred_id: int,
    payload: schemas.CredentialUpdate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_perm("credentials", "write"))],
) -> dict:
    cred = db.query(models.Credential).filter(models.Credential.id == cred_id).first()
    if not cred:
        raise HTTPException(status_code=404, detail=CREDENTIAL_NOT_FOUND)
    if payload.name is not None:
        cred.name = payload.name
    if payload.config is not None:
        existing = decrypt_config(cred.config or {})
        incoming = _drop_placeholders(payload.config)
        status = incoming.pop("status", None)
        _require_secrets_on_destination_change(existing, incoming)
        merged = {**existing, **incoming}
        cred.config = encrypt_config(merged)
        if status is not None:
            cred.is_active = status == "active"
    add_event_log(db, source="credentials", resource=cred.name, event="Credential updated",
                  owner=user.username)
    db.commit()
    db.refresh(cred)
    return _build_response(cred)


@router.patch("/{cred_id}/toggle", response_model=schemas.CredentialResponse, responses={404: {"description": CREDENTIAL_NOT_FOUND}})
def toggle_credential(
    cred_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_perm("credentials", "write"))],
) -> dict:
    cred = db.query(models.Credential).filter(models.Credential.id == cred_id).first()
    if not cred:
        raise HTTPException(status_code=404, detail=CREDENTIAL_NOT_FOUND)
    cred.is_active = not cred.is_active
    add_event_log(db, source="credentials", resource=cred.name, event="Credential status changed",
                  owner=user.username, message=f"is_active={cred.is_active}")
    db.commit()
    db.refresh(cred)
    return _build_response(cred)


class RevealRequest(BaseModel):
    field: str = "password"  # which secret field to reveal


@router.post("/{cred_id}/reveal-secret", responses={404: {"description": CREDENTIAL_NOT_FOUND}})
def reveal_secret(
    cred_id: int,
    payload: RevealRequest,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_perm("credentials", "admin"))],
) -> dict:
    """Admin-only: returns a single decrypted secret field. Audit-logged."""
    cred = db.query(models.Credential).filter(models.Credential.id == cred_id).first()
    if not cred:
        raise HTTPException(status_code=404, detail=CREDENTIAL_NOT_FOUND)
    config = decrypt_config(cred.config or {})
    value = config.get(payload.field)
    if value is None:
        raise HTTPException(status_code=404, detail=f"Field '{payload.field}' not found")
    # Audit log via EventLog (non-blocking)
    try:
        db.add(models.EventLog(
            severity="info",
            source="provider-credentials",
            resource=cred.name,
            event=f"Secret revealed: field={payload.field} by {user.username}",
            status="resolved",
            owner=user.username,
            tags=[],
        ))
        db.commit()
    except Exception:
        db.rollback()
    return {"field": payload.field, "value": value}


@router.post(
    "/{cred_id}/copy-secret",
    responses={
        403: {"description": "Admin role required to copy secrets"},
        404: {"description": CREDENTIAL_NOT_FOUND},
    },
)
def copy_secret(
    cred_id: int,
    payload: RevealRequest,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_perm("credentials", "read"))],
) -> dict:
    """Any authenticated user can copy — returns masked value except for admins."""
    cred = db.query(models.Credential).filter(models.Credential.id == cred_id).first()
    if not cred:
        raise HTTPException(status_code=404, detail=CREDENTIAL_NOT_FOUND)
    config = decrypt_config(cred.config or {})
    value = config.get(payload.field)
    if value is None:
        raise HTTPException(status_code=404, detail=f"Field '{payload.field}' not found")
    is_admin = has_perm(user, "credentials", "admin")
    if _field_is_secret(payload.field) and not is_admin:
        raise HTTPException(status_code=403, detail="Admin role required to copy secrets")
    # Audit
    try:
        db.add(models.EventLog(
            severity="info",
            source="provider-credentials",
            resource=cred.name,
            event=f"Secret copied: field={payload.field} by {user.username}",
            status="resolved",
            owner=user.username,
            tags=[],
        ))
        db.commit()
    except Exception:
        db.rollback()
    return {"field": payload.field, "value": value}
