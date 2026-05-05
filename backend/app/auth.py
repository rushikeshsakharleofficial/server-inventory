import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from . import models
from .database import get_db

_INSECURE_SECRET_VALUES = {
    "dev-secret-key-" + "CHANGE-in-production",
    "generate-a-long-random-string-here",
}
_PRODUCTION_ENVS = {"prod", "production"}


def _is_production() -> bool:
    env_name = (
        os.getenv("ENVIRONMENT")
        or os.getenv("APP_ENV")
        or os.getenv("ENV")
        or ""
    ).lower()
    return env_name in _PRODUCTION_ENVS


def _load_secret_key() -> str:
    secret_key = os.getenv("SECRET_KEY")
    if secret_key and secret_key not in _INSECURE_SECRET_VALUES:
        return secret_key
    if _is_production():
        raise RuntimeError(
            "SECRET_KEY must be set to a strong unique value in production"
        )
    return secrets.token_urlsafe(32)


SECRET_KEY = _load_secret_key()
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8          # 8 hours (default)
ACCESS_TOKEN_EXPIRE_REMEMBER = 60 * 24 * 90  # 90 days (remember me)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(
    data: dict,
    expires_delta: Optional[timedelta] = None,
    remember: bool = False,
) -> str:
    if expires_delta is None:
        expires_delta = timedelta(
            minutes=ACCESS_TOKEN_EXPIRE_REMEMBER if remember else ACCESS_TOKEN_EXPIRE_MINUTES
        )
    to_encode = {**data, "remember": remember}
    to_encode["exp"] = datetime.now(timezone.utc) + expires_delta
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> models.User:
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub", "")
        if not username:
            raise exc
    except JWTError:
        raise exc

    user = db.query(models.User).filter(models.User.username == username).first()
    if not user or not user.is_active:
        raise exc
    return user


def require_write(user: models.User = Depends(get_current_user)) -> models.User:
    if user.role not in ("admin", "write"):
        raise HTTPException(status_code=403, detail="Write permission required")
    return user


def require_admin(user: models.User = Depends(get_current_user)) -> models.User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin permission required")
    return user
