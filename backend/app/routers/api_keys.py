from typing import Annotated
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..auth import get_current_user
from ..permissions import FEATURE_ACTIONS, has_perm
from ..api_key_auth import (
    generate_api_token,
    hash_api_token,
)
from ..event_log_utils import add_event_log

router = APIRouter(prefix="/api/api-keys", tags=["api-keys"])

_KEY_NOT_FOUND = "API key not found"


def _can_manage_all(user: models.User) -> bool:
    return has_perm(user, "api_keys", "manage_all")


def _get_owned_or_404(db: Session, key_id: int, user: models.User) -> models.ApiKey:
    key = db.query(models.ApiKey).filter(models.ApiKey.id == key_id).first()
    if not key:
        raise HTTPException(status_code=404, detail=_KEY_NOT_FOUND)
    if key.user_id != user.id and not _can_manage_all(user):
        # Same 404 as not-found — do not reveal existence of another user's key.
        raise HTTPException(status_code=404, detail=_KEY_NOT_FOUND)
    return key


def _validate_scopes(scopes: dict[str, list[str]], user: models.User) -> None:
    """A key can never be created/updated to exceed what its owner currently
    has. scopes is {feature: [actions]} — the exact same vocabulary as
    User/Group.permissions. Any unknown feature/action, or one the owner
    lacks right now, is rejected here at write time — the request-time
    intersection in api_key_auth.py enforces the same rule again on every
    subsequent call."""
    for feature, actions in scopes.items():
        valid_actions = FEATURE_ACTIONS.get(feature)
        if valid_actions is None:
            raise HTTPException(status_code=400, detail=f"Unknown feature: {feature}")
        for action in actions:
            if action not in valid_actions:
                raise HTTPException(status_code=400, detail=f"Unknown action '{action}' for feature '{feature}'")
            if not has_perm(user, feature, action):
                raise HTTPException(
                    status_code=403,
                    detail=f"Scope '{feature}:{action}' exceeds your current permissions",
                )


@router.get("")
def list_api_keys(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(get_current_user)],
) -> list[schemas.ApiKeyResponse]:
    q = db.query(models.ApiKey)
    if not _can_manage_all(user):
        q = q.filter(models.ApiKey.user_id == user.id)
    return [schemas.ApiKeyResponse.model_validate(k) for k in q.order_by(models.ApiKey.created_at.desc()).all()]


@router.post("", status_code=201)
def create_api_key(
    payload: schemas.ApiKeyCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(get_current_user)],
) -> schemas.ApiKeyCreateResponse:
    _validate_scopes(payload.scopes, user)

    raw_token, key_prefix = generate_api_token()
    key = models.ApiKey(
        user_id=user.id,
        name=payload.name,
        key_prefix=key_prefix,
        token_hash=hash_api_token(raw_token),
        scopes=payload.scopes,
        allowed_ips=payload.allowed_ips,
        expires_at=payload.expires_at,
    )
    db.add(key)
    add_event_log(db, source="api-keys", resource=payload.name, event="API key created",
                  owner=user.username, message=f"scopes={payload.scopes}")
    db.commit()
    db.refresh(key)

    return schemas.ApiKeyCreateResponse(**schemas.ApiKeyResponse.model_validate(key).model_dump(), token=raw_token)


@router.get("/{key_id}", responses={404: {"description": _KEY_NOT_FOUND}})
def get_api_key(
    key_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(get_current_user)],
) -> schemas.ApiKeyResponse:
    key = _get_owned_or_404(db, key_id, user)
    return schemas.ApiKeyResponse.model_validate(key)


@router.patch("/{key_id}", responses={404: {"description": _KEY_NOT_FOUND}})
def update_api_key(
    key_id: int,
    payload: schemas.ApiKeyUpdate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(get_current_user)],
) -> schemas.ApiKeyResponse:
    key = _get_owned_or_404(db, key_id, user)
    updates = payload.model_dump(exclude_unset=True)

    if updates.get("scopes") is None:
        # scopes is NOT NULL in the DB — a `null` in the payload means
        # "leave scopes unchanged", never "clear the scopes".
        updates.pop("scopes", None)
    else:
        # Validate against the *owner's* permissions, not the caller's — an
        # admin with manage_all editing someone else's key must still be
        # bound by what that key's owner can do, never their own broader set.
        owner = key.owner if key.owner is not None else user
        _validate_scopes(updates["scopes"], owner)

    for field, value in updates.items():
        setattr(key, field, value)

    if updates:
        add_event_log(db, source="api-keys", resource=key.name, event="API key updated", owner=user.username)
    db.commit()
    db.refresh(key)
    return schemas.ApiKeyResponse.model_validate(key)


@router.post("/{key_id}/rotate", responses={404: {"description": _KEY_NOT_FOUND}})
def rotate_api_key(
    key_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(get_current_user)],
) -> schemas.ApiKeyRotateResponse:
    key = _get_owned_or_404(db, key_id, user)

    raw_token, key_prefix = generate_api_token()
    key.key_prefix = key_prefix
    key.token_hash = hash_api_token(raw_token)

    add_event_log(db, source="api-keys", resource=key.name, event="API key rotated", owner=user.username)
    db.commit()
    db.refresh(key)

    return schemas.ApiKeyRotateResponse(**schemas.ApiKeyResponse.model_validate(key).model_dump(), token=raw_token)


@router.post("/{key_id}/revoke", responses={404: {"description": _KEY_NOT_FOUND}})
def revoke_api_key(
    key_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(get_current_user)],
) -> schemas.ApiKeyResponse:
    key = _get_owned_or_404(db, key_id, user)

    key.is_active = False
    key.revoked_at = datetime.now(timezone.utc)
    key.revoked_by = user.id

    add_event_log(db, source="api-keys", resource=key.name, event="API key revoked", owner=user.username)
    db.commit()
    db.refresh(key)
    return schemas.ApiKeyResponse.model_validate(key)


@router.delete("/{key_id}", status_code=204, responses={404: {"description": _KEY_NOT_FOUND}})
def delete_api_key(
    key_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(get_current_user)],
) -> None:
    key = _get_owned_or_404(db, key_id, user)
    add_event_log(db, source="api-keys", resource=key.name, event="API key deleted", owner=user.username)
    db.delete(key)
    db.commit()


@router.get("/{key_id}/audit-logs", responses={404: {"description": _KEY_NOT_FOUND}})
def get_api_key_audit_logs(
    key_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(get_current_user)],
) -> list[schemas.ApiKeyAuditLogResponse]:
    _get_owned_or_404(db, key_id, user)  # ownership/manage_all check, discard the row
    logs = (
        db.query(models.ApiKeyAuditLog)
        .filter(models.ApiKeyAuditLog.api_key_id == key_id)
        .order_by(models.ApiKeyAuditLog.created_at.desc())
        .limit(500)
        .all()
    )
    return [schemas.ApiKeyAuditLogResponse.model_validate(log) for log in logs]
