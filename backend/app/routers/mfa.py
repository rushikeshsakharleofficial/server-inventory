import pyotp
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db
from ..auth import get_current_user, create_access_token, verify_mfa_challenge_token
from ..crypto import encrypt_str, decrypt_str

router = APIRouter(prefix="/api/auth/mfa", tags=["mfa"])

ISSUER = "ServerInventory"


def _get_totp_secret(user: models.User) -> str | None:
    """Decrypt the stored TOTP secret. Returns None if unset."""
    if not user.totp_secret:
        return None
    return decrypt_str(user.totp_secret)


@router.get("/status", response_model=schemas.MfaStatusResponse)
def mfa_status(
    current_user: Annotated[models.User, Depends(get_current_user)],
) -> schemas.MfaStatusResponse:
    return schemas.MfaStatusResponse(enabled=bool(current_user.totp_enabled))


@router.post("/setup", response_model=schemas.MfaSetupResponse)
def mfa_setup(
    current_user: Annotated[models.User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> schemas.MfaSetupResponse:
    if current_user.totp_enabled:
        raise HTTPException(status_code=400, detail="MFA is already enabled")
    secret = pyotp.random_base32()
    totp = pyotp.TOTP(secret)
    uri = totp.provisioning_uri(name=current_user.username, issuer_name=ISSUER)
    # Encrypt before storing; totp_enabled stays False until /enable verifies.
    current_user.totp_secret = encrypt_str(secret)
    db.commit()
    return schemas.MfaSetupResponse(secret=secret, uri=uri)


@router.post("/enable", status_code=204)
def mfa_enable(
    payload: schemas.MfaEnableRequest,
    current_user: Annotated[models.User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    if current_user.totp_enabled:
        raise HTTPException(status_code=400, detail="MFA is already enabled")
    secret = _get_totp_secret(current_user)
    if not secret:
        raise HTTPException(status_code=400, detail="Call /setup first to generate a secret")
    totp = pyotp.TOTP(secret)
    if not totp.verify(payload.code, valid_window=1):
        raise HTTPException(status_code=400, detail="Invalid TOTP code")
    current_user.totp_enabled = True
    db.commit()


@router.post("/disable", status_code=204)
def mfa_disable(
    payload: schemas.MfaDisableRequest,
    current_user: Annotated[models.User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    if not current_user.totp_enabled or not current_user.totp_secret:
        raise HTTPException(status_code=400, detail="MFA is not enabled")
    secret = _get_totp_secret(current_user)
    if not secret:
        raise HTTPException(status_code=400, detail="MFA is not enabled")
    totp = pyotp.TOTP(secret)
    if not totp.verify(payload.code, valid_window=1):
        raise HTTPException(status_code=400, detail="Invalid TOTP code")
    current_user.totp_secret = None
    current_user.totp_enabled = False
    db.commit()


@router.post("/verify", response_model=schemas.LoginResponse)
def mfa_verify(
    payload: schemas.MfaVerifyRequest,
    db: Annotated[Session, Depends(get_db)],
) -> schemas.LoginResponse:
    username = verify_mfa_challenge_token(payload.mfa_token)
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    if not user.totp_enabled or not user.totp_secret:
        raise HTTPException(status_code=400, detail="MFA is not configured for this user")
    secret = _get_totp_secret(user)
    if not secret:
        raise HTTPException(status_code=400, detail="MFA is not configured for this user")
    totp = pyotp.TOTP(secret)
    if not totp.verify(payload.code, valid_window=1):
        raise HTTPException(status_code=400, detail="Invalid TOTP code")
    token = create_access_token({"sub": user.username, "role": user.role})
    return schemas.LoginResponse(
        access_token=token,
        token_type="bearer",
        role=user.role,
        username=user.username,
    )
