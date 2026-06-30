from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status, Form, Request
from ..limiter import limiter
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db
from ..auth import (
    verify_password, hash_password, create_access_token,
    get_current_user, require_admin, create_mfa_challenge_token, validate_password,
)

router = APIRouter(tags=["auth & users"])


@router.post("/api/auth/login", response_model=schemas.LoginResponse)
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
    return schemas.LoginResponse(
        access_token=token,
        token_type="bearer",
        role=user.role,
        username=user.username,
    )


@router.get("/api/auth/me", response_model=schemas.UserResponse)
def me(current_user: Annotated[models.User, Depends(get_current_user)]) -> models.User:
    return current_user


@router.get("/api/users", response_model=list[schemas.UserResponse])
def list_users(
    _: Annotated[models.User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> list[models.User]:
    return db.query(models.User).order_by(models.User.created_at).all()


@router.post("/api/users", response_model=schemas.UserResponse, status_code=201)
def create_user(
    payload: schemas.UserCreate,
    _: Annotated[models.User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> models.User:
    validate_password(payload.password)
    if db.query(models.User).filter(models.User.username == payload.username).first():
        raise HTTPException(status_code=400, detail="Username already exists")
    db_user = models.User(
        username=payload.username,
        hashed_password=hash_password(payload.password),
        role=payload.role,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


@router.delete("/api/users/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    _: Annotated[models.User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role == "admin":
        raise HTTPException(status_code=400, detail="Cannot delete admin user")
    db.delete(user)
    db.commit()


@router.patch("/api/users/{user_id}/toggle", response_model=schemas.UserResponse)
def toggle_user(
    user_id: int,
    _: Annotated[models.User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> models.User:
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role == "admin":
        raise HTTPException(status_code=400, detail="Cannot toggle admin user")
    user.is_active = not user.is_active
    db.commit()
    db.refresh(user)
    return user


@router.put("/api/auth/change-password", status_code=204)
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
