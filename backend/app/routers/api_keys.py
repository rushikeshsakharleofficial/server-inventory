from typing import Annotated
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..auth import get_current_user
from ..permissions import effective_permissions, has_perm
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


@router.get("")
def list_api_keys(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(get_current_user)],
) -> list[schemas.ApiKeyResponse]:
    q = db.query(models.ApiKey)
    if not _can_manage_all(user):
        q = q.filter(models.ApiKey.user_id == user.id)
    return [schemas.ApiKeyResponse.model_validate(k) for k in q.order_by(models.ApiKey.created_at.desc()).all()]


@router.get("/audit-logs/summary")
def get_api_keys_endpoint_usage(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(get_current_user)],
) -> list[schemas.ApiKeyEndpointUsageResponse]:
    """Per-endpoint request counts across every key in scope — own keys only,
    unless api_keys:manage_all, in which case it's fleet-wide. Uses
    ApiKeyAuditLog.user_id directly (not a join through ApiKey) so a revoked
    OR fully deleted key's history still counts — deleting a key only clears
    its audit rows' api_key_id (ondelete=SET NULL), never their user_id."""
    q = db.query(
        models.ApiKeyAuditLog.method,
        models.ApiKeyAuditLog.path,
        func.count(models.ApiKeyAuditLog.id).label("total"),
        func.count(models.ApiKeyAuditLog.id).filter(models.ApiKeyAuditLog.decision == "allowed").label("allowed"),
        func.avg(models.ApiKeyAuditLog.response_time_ms).label("avg_response_time_ms"),
        func.max(models.ApiKeyAuditLog.created_at).label("last_used_at"),
    )
    if not _can_manage_all(user):
        q = q.filter(models.ApiKeyAuditLog.user_id == user.id)
    rows = (
        q.group_by(models.ApiKeyAuditLog.method, models.ApiKeyAuditLog.path)
        .order_by(func.count(models.ApiKeyAuditLog.id).desc())
        .all()
    )
    return [
        schemas.ApiKeyEndpointUsageResponse(
            method=r.method,
            path=r.path,
            total=r.total,
            allowed=r.allowed or 0,
            denied=r.total - (r.allowed or 0),
            avg_response_time_ms=round(r.avg_response_time_ms) if r.avg_response_time_ms is not None else None,
            last_used_at=r.last_used_at,
        )
        for r in rows
    ]


@router.get("/audit-logs/timeseries")
def get_api_keys_requests_over_time(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(get_current_user)],
    days: Annotated[int, Query(ge=1, le=90)] = 7,
) -> list[schemas.ApiKeyTimeseriesPointResponse]:
    """Daily request counts across every key in scope, same own-keys-vs-
    fleet-wide scoping and revoked/deleted-key-inclusive behavior as
    /audit-logs/summary — feeds the "Requests Over Time" line chart."""
    since = datetime.now(timezone.utc) - timedelta(days=days)
    day = func.date(models.ApiKeyAuditLog.created_at)
    q = db.query(
        day.label("date"),
        func.count(models.ApiKeyAuditLog.id).label("total"),
        func.count(models.ApiKeyAuditLog.id).filter(models.ApiKeyAuditLog.decision == "allowed").label("allowed"),
    ).filter(models.ApiKeyAuditLog.created_at >= since)
    if not _can_manage_all(user):
        q = q.filter(models.ApiKeyAuditLog.user_id == user.id)
    rows = q.group_by(day).order_by(day).all()
    return [
        schemas.ApiKeyTimeseriesPointResponse(
            date=str(r.date),
            total=r.total,
            allowed=r.allowed or 0,
            denied=r.total - (r.allowed or 0),
        )
        for r in rows
    ]


@router.post("", status_code=201)
def create_api_key(
    payload: schemas.ApiKeyCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(get_current_user)],
) -> schemas.ApiKeyCreateResponse:
    # A key always gets exactly its creator's current permissions — there is
    # no separate scope selection. This is a snapshot at creation time only;
    # the live check in api_key_auth.py still re-derives has_perm(user, ...)
    # on every request, so a later permission change still applies immediately
    # even though this stored copy doesn't move until the key is rotated.
    scopes = {feature: sorted(actions) for feature, actions in effective_permissions(user).items() if actions}

    raw_token, key_prefix = generate_api_token()
    key = models.ApiKey(
        user_id=user.id,
        name=payload.name,
        key_prefix=key_prefix,
        token_hash=hash_api_token(raw_token),
        scopes=scopes,
        allowed_ips=payload.allowed_ips,
        expires_at=payload.expires_at,
    )
    db.add(key)
    add_event_log(db, source="api-keys", resource=payload.name, event="API key created", owner=user.username)
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
