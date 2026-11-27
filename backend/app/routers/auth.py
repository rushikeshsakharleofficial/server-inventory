from datetime import datetime, timedelta, timezone
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status, Form, Request
from ..limiter import limiter
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func, text
from sqlalchemy.orm import Session
from .. import ldap_auth, models, schemas
from ..database import get_db
from ..event_log_utils import add_event_log
from ..auth import (
    verify_password, hash_password, create_access_token,
    get_current_user, require_perm, create_mfa_challenge_token, validate_password,
)

router = APIRouter(tags=["auth & users"])

USER_NOT_FOUND = "User not found"


def _admin_exists(db: Session) -> bool:
    return db.query(models.User.id).filter(models.User.role == "admin").first() is not None


@router.get("/api/setup/status")
def setup_status(
    db: Annotated[Session, Depends(get_db)],
) -> schemas.SetupStatusResponse:
    requires_setup = not _admin_exists(db)
    return schemas.SetupStatusResponse(requires_setup=requires_setup)


@router.post(
    "/api/setup/bootstrap",
    status_code=201,
    responses={409: {"description": "Initial setup is already complete"}},
)
def bootstrap_admin(
    payload: schemas.InitialSetupRequest,
    db: Annotated[Session, Depends(get_db)],
) -> schemas.LoginResponse:
    # Serialise concurrent setups: the lock is held until commit/rollback.
    db.execute(text("SELECT pg_advisory_xact_lock(7001)"))
    if _admin_exists(db):
        raise HTTPException(status_code=409, detail="Initial setup is already complete")

    validate_password(payload.password)
    db_user = models.User(
        username=payload.username,
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
        role="admin",
        is_active=True,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    add_event_log(
        db,
        source="auth",
        resource=db_user.username,
        event="Initial administrator setup completed",
        owner=db_user.username,
        message="First admin account created from setup page",
    )
    db.commit()

    token = create_access_token({"sub": db_user.username, "role": db_user.role})
    return schemas.LoginResponse(
        access_token=token,
        token_type="bearer",
        role=db_user.role,
        username=db_user.username,
        full_name=db_user.full_name,
    )


def _invalid_login() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid username or password",
    )


def _find_user(db: Session, username: str) -> models.User | None:
    query = db.query(models.User)
    return query.filter(models.User.username == username).first() or (
        query.filter(func.lower(models.User.username) == username.lower())
        # a local account wins over any other case variant
        .order_by((models.User.auth_source == "local").desc())
        .first()
    )


def _check_ldap_target(user: models.User | None) -> None:
    """LDAP must never take over a local account or revive a disabled one."""
    if user and (user.auth_source == "local" or not user.is_active):
        raise _invalid_login()


def _ldap_login(db: Session, username: str, password: str) -> models.User:
    cfg = ldap_auth.load_config(db)
    # bcrypt backend raises on NUL bytes and on huge secrets
    if cfg is None or "\0" in password or len(password) > 4096:
        raise _invalid_login()
    existing = _find_user(db, username)
    _check_ldap_target(existing)

    try:
        result = ldap_auth.authenticate(cfg, username, password)
    except ldap_auth.LdapInvalid:
        # the directory refused the cached password itself: stop honouring it during outages
        if existing and existing.ldap_cached_at and verify_password(password, existing.hashed_password):
            existing.ldap_cached_at = None
            db.commit()
        raise _invalid_login()
    except ldap_auth.LdapUnavailable:
        if (
            existing
            and existing.ldap_cached_at
            and datetime.now(timezone.utc) - existing.ldap_cached_at < timedelta(hours=cfg["cache_ttl_hours"])
            and verify_password(password, existing.hashed_password)
        ):
            add_event_log(db, source="auth", severity="warning", resource=existing.username, event="LDAP unreachable, cached login", owner=existing.username)
            db.commit()
            return existing
        raise HTTPException(status_code=503, detail="Directory unavailable")

    # the directory name may differ from what was typed; DN catches accounts renamed here
    user = _find_user(db, result.username) or db.query(models.User).filter(models.User.ldap_dn == result.dn).first()
    _check_ldap_target(user)
    if not user:
        user = models.User(username=result.username, role=cfg["default_role"])
        db.add(user)
    user.auth_source = "ldap"
    user.full_name = result.full_name
    user.ldap_dn = result.dn
    user.hashed_password = hash_password(password)
    user.ldap_cached_at = datetime.now(timezone.utc)
    ldap_auth.sync_ldap_groups(db, user, result.group_dns)
    db.commit()
    return user


def _user_response(db: Session, user: models.User) -> schemas.UserResponse:
    r = schemas.UserResponse.model_validate(user)
    r.group_ids = [g.id for g in user.groups]
    r.ldap_group_ids = ldap_auth.ldap_group_ids(db, user.id)
    return r


@router.post(
    "/api/auth/login",
    responses={
        401: {"description": "Invalid username or password"},
        503: {"description": "Directory unavailable"},
    },
)
@limiter.limit("10/minute")
def login(
    request: Request,
    form: Annotated[OAuth2PasswordRequestForm, Depends()],
    remember_me: Annotated[bool | None, Form()] = False,
    db: Annotated[Session, Depends(get_db)] = None,
) -> schemas.LoginResponse:
    user = db.query(models.User).filter(models.User.username == form.username).first()
    if user and user.auth_source == "local":
        if not verify_password(form.password, user.hashed_password) or not user.is_active:
            raise _invalid_login()
    else:
        user = _ldap_login(db, form.username, form.password)

    if user.totp_enabled and user.totp_secret:
        mfa_token = create_mfa_challenge_token(user.username)
        return schemas.LoginResponse(mfa_required=True, mfa_token=mfa_token)

    token = create_access_token(
        {"sub": user.username, "role": user.role},
        remember=bool(remember_me),
    )
    add_event_log(
        db,
        source="auth",
        resource=user.username,
        event="User signed in",
        owner=user.username,
        message=f"remember_me={bool(remember_me)}",
    )
    db.commit()
    return schemas.LoginResponse(
        access_token=token,
        token_type="bearer",
        role=user.role,
        username=user.username,
        full_name=user.full_name,
    )


@router.get("/api/auth/me", response_model=schemas.UserResponse)
def me(current_user: Annotated[models.User, Depends(get_current_user)]) -> models.User:
    return current_user


@router.get("/api/users")
def list_users(
    _: Annotated[models.User, Depends(require_perm("users", "admin"))],
    db: Annotated[Session, Depends(get_db)],
) -> list[schemas.UserResponse]:
    users = db.query(models.User).order_by(models.User.created_at).all()
    return [_user_response(db, u) for u in users]


@router.post(
    "/api/users",
    response_model=schemas.UserResponse,
    status_code=201,
    responses={400: {"description": "Username already exists"}},
)
def create_user(
    payload: schemas.UserCreate,
    current_user: Annotated[models.User, Depends(require_perm("users", "admin"))],
    db: Annotated[Session, Depends(get_db)],
) -> models.User:
    validate_password(payload.password)
    if db.query(models.User).filter(models.User.username == payload.username).first():
        raise HTTPException(status_code=400, detail="Username already exists")
    db_user = models.User(
        username=payload.username,
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
        role=payload.role,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    add_event_log(db, source="users", resource=db_user.username, event="User created", owner=current_user.username, message=f"created_user={db_user.username}")
    db.commit()
    return db_user


@router.delete(
    "/api/users/{user_id}",
    status_code=204,
    responses={
        404: {"description": USER_NOT_FOUND},
        400: {"description": "Cannot delete admin user"},
    },
)
def delete_user(
    user_id: int,
    current_user: Annotated[models.User, Depends(require_perm("users", "admin"))],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail=USER_NOT_FOUND)
    if user.role == "admin":
        raise HTTPException(status_code=400, detail="Cannot delete admin user")
    username = user.username
    db.delete(user)
    db.commit()
    add_event_log(db, source="users", resource=username, event="User deleted", owner=current_user.username, message=f"deleted_user={username}")
    db.commit()


@router.patch(
    "/api/users/{user_id}",
    response_model=schemas.UserResponse,
    responses={
        404: {"description": USER_NOT_FOUND},
        400: {"description": "Username already exists"},
    },
)
def update_user(
    user_id: int,
    payload: schemas.UserUpdate,
    current_user: Annotated[models.User, Depends(require_perm("users", "admin"))],
    db: Annotated[Session, Depends(get_db)],
) -> schemas.UserResponse:
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail=USER_NOT_FOUND)
    to_local = user.auth_source == "ldap" and payload.auth_source == "local"
    to_ldap = user.auth_source == "local" and payload.auth_source == "ldap"
    if payload.password is not None:
        if not to_local:
            raise HTTPException(status_code=400, detail="Password can only be set when switching a user from LDAP to local")
        validate_password(payload.password)
    if to_ldap and user.role == "admin":
        raise HTTPException(status_code=400, detail="Cannot switch admin user to LDAP")
    # renaming would let a different directory account match this one by name
    if user.auth_source == "ldap" and not to_local and payload.username and payload.username != user.username:
        raise HTTPException(status_code=400, detail="LDAP usernames come from the directory")
    if payload.full_name is not None:
        user.full_name = payload.full_name or None
    if payload.username:
        if db.query(models.User).filter(models.User.username == payload.username, models.User.id != user_id).first():
            raise HTTPException(status_code=400, detail="Username already exists")
        user.username = payload.username
    if to_local:
        user.auth_source = "local"
        user.ldap_cached_at = None
        user.ldap_dn = None
        if payload.password is not None:
            user.hashed_password = hash_password(payload.password)
        db.execute(
            models.user_groups.update()
            .where(models.user_groups.c.user_id == user.id, models.user_groups.c.source == "ldap")
            .values(source="manual")
        )
    if to_ldap:
        user.auth_source = "ldap"
        # the old local password must not act as an LDAP cache
        user.ldap_cached_at = None
    db.commit()
    db.refresh(user)
    add_event_log(db, source="users", resource=user.username, event="User updated", owner=current_user.username, message=f"updated_user={user.username}")
    if to_local or to_ldap:
        add_event_log(db, source="users", resource=user.username, event="User auth source changed", owner=current_user.username, message=f"auth_source={user.auth_source}, password_set={payload.password is not None}")
    db.commit()
    return _user_response(db, user)


@router.patch(
    "/api/users/{user_id}/toggle",
    response_model=schemas.UserResponse,
    responses={
        404: {"description": USER_NOT_FOUND},
        400: {"description": "Cannot toggle admin user"},
    },
)
def toggle_user(
    user_id: int,
    current_user: Annotated[models.User, Depends(require_perm("users", "admin"))],
    db: Annotated[Session, Depends(get_db)],
) -> schemas.UserResponse:
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail=USER_NOT_FOUND)
    if user.role == "admin":
        raise HTTPException(status_code=400, detail="Cannot toggle admin user")
    user.is_active = not user.is_active
    db.commit()
    db.refresh(user)
    add_event_log(db, source="users", resource=user.username, event="User status changed", owner=current_user.username, message=f"updated_user={user.username}, is_active={user.is_active}")
    db.commit()
    return _user_response(db, user)


@router.put(
    "/api/auth/change-password",
    status_code=204,
    responses={400: {"description": "Current password is incorrect"}},
)
def change_password(
    payload: schemas.ChangePasswordRequest,
    current_user: Annotated[models.User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    if current_user.auth_source == "ldap":
        raise HTTPException(status_code=400, detail="Password is managed by the directory")
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    validate_password(payload.new_password)
    current_user.hashed_password = hash_password(payload.new_password)
    db.commit()
    add_event_log(db, source="auth", resource=current_user.username, event="Password changed", owner=current_user.username)
    db.commit()
