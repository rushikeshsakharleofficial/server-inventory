from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status, Form, Request
from ..limiter import limiter
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db
from ..event_log_utils import add_event_log
from ..auth import (
    verify_password, hash_password, create_access_token,
    get_current_user, require_admin, create_mfa_challenge_token, validate_password,
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


@router.post(
    "/api/auth/login",
    responses={401: {"description": "Invalid username or password"}},
)
@limiter.limit("100/minute")
def login(
    request: Request,
    form: Annotated[OAuth2PasswordRequestForm, Depends()],
    remember_me: bool | None = Form(default=False),
    db: Annotated[Session, Depends(get_db)] = None,
) -> schemas.LoginResponse:
    user = db.query(models.User).filter(models.User.username == form.username).first()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")

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
    _: Annotated[models.User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> list[schemas.UserResponse]:
    users = db.query(models.User).order_by(models.User.created_at).all()
    result = []
    for u in users:
        r = schemas.UserResponse.model_validate(u)
        r.group_ids = [g.id for g in u.groups]
        result.append(r)
    return result


@router.post(
    "/api/users",
    response_model=schemas.UserResponse,
    status_code=201,
    responses={400: {"description": "Username already exists"}},
)
def create_user(
    payload: schemas.UserCreate,
    current_user: Annotated[models.User, Depends(require_admin)],
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
    current_user: Annotated[models.User, Depends(require_admin)],
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
    current_user: Annotated[models.User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> models.User:
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail=USER_NOT_FOUND)
    if payload.full_name is not None:
        user.full_name = payload.full_name or None
    if payload.username:
        if db.query(models.User).filter(models.User.username == payload.username, models.User.id != user_id).first():
            raise HTTPException(status_code=400, detail="Username already exists")
        user.username = payload.username
    db.commit()
    db.refresh(user)
    add_event_log(db, source="users", resource=user.username, event="User updated", owner=current_user.username, message=f"updated_user={user.username}")
    db.commit()
    return user


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
    current_user: Annotated[models.User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> models.User:
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
    return user


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
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    validate_password(payload.new_password)
    current_user.hashed_password = hash_password(payload.new_password)
    db.commit()
    add_event_log(db, source="auth", resource=current_user.username, event="Password changed", owner=current_user.username)
    db.commit()
