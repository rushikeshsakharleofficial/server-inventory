from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Any, Dict, List, Optional
from pydantic import BaseModel
from .. import models
from ..database import get_db
from ..auth import get_current_user, require_write

router = APIRouter(prefix="/api/ssh-credentials", tags=["ssh-credentials"])


# ---------------------------------------------------------------------------
# Pydantic schemas (local — SSH credentials are not in the shared schemas.py)
# ---------------------------------------------------------------------------

class SSHCredentialCreate(BaseModel):
    name: str
    username: str
    auth_method: str = "password"  # password | key
    password: Optional[str] = None
    private_key: Optional[str] = None
    port: int = 22
    is_default: bool = False
    notes: Optional[str] = None


class SSHCredentialUpdate(BaseModel):
    name: Optional[str] = None
    username: Optional[str] = None
    auth_method: Optional[str] = None
    password: Optional[str] = None
    private_key: Optional[str] = None
    port: Optional[int] = None
    is_default: Optional[bool] = None
    notes: Optional[str] = None


class SSHCredentialResponse(BaseModel):
    id: int
    name: str
    username: str
    auth_method: str
    password: Optional[str] = None   # masked as "***" if set
    private_key: Optional[str] = None  # masked as "***" if set
    port: int
    is_default: bool
    notes: Optional[str] = None

    model_config = {"from_attributes": True}


def _mask(cred: models.SSHCredential) -> SSHCredentialResponse:
    return SSHCredentialResponse(
        id=cred.id,
        name=cred.name,
        username=cred.username,
        auth_method=cred.auth_method or "password",
        password="***" if cred.password else None,
        private_key="***" if cred.private_key else None,
        port=cred.port,
        is_default=cred.is_default,
        notes=cred.notes,
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("", response_model=List[SSHCredentialResponse])
def list_ssh_credentials(
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    creds = db.query(models.SSHCredential).order_by(models.SSHCredential.name).all()
    return [_mask(c) for c in creds]


@router.post("", response_model=SSHCredentialResponse, status_code=201)
def create_ssh_credential(
    payload: SSHCredentialCreate,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_write),
):
    # If this one is being set as default, unset all others first
    if payload.is_default:
        db.query(models.SSHCredential).update({"is_default": False})

    cred = models.SSHCredential(**payload.model_dump())
    db.add(cred)
    db.commit()
    db.refresh(cred)
    return _mask(cred)


@router.put("/{cred_id}", response_model=SSHCredentialResponse)
def update_ssh_credential(
    cred_id: int,
    payload: SSHCredentialUpdate,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_write),
):
    cred = db.query(models.SSHCredential).filter(models.SSHCredential.id == cred_id).first()
    if not cred:
        raise HTTPException(status_code=404, detail="SSH credential not found")

    updates = payload.model_dump(exclude_unset=True)

    # If promoting to default, unset all others first
    if updates.get("is_default"):
        db.query(models.SSHCredential).filter(
            models.SSHCredential.id != cred_id
        ).update({"is_default": False})

    for field, value in updates.items():
        setattr(cred, field, value)

    db.commit()
    db.refresh(cred)
    return _mask(cred)


@router.delete("/{cred_id}", status_code=204)
def delete_ssh_credential(
    cred_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_write),
):
    cred = db.query(models.SSHCredential).filter(models.SSHCredential.id == cred_id).first()
    if not cred:
        raise HTTPException(status_code=404, detail="SSH credential not found")
    db.delete(cred)
    db.commit()


@router.patch("/{cred_id}/set-default", response_model=SSHCredentialResponse)
def set_default_ssh_credential(
    cred_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_write),
):
    cred = db.query(models.SSHCredential).filter(models.SSHCredential.id == cred_id).first()
    if not cred:
        raise HTTPException(status_code=404, detail="SSH credential not found")

    # Unset all others, then set this one
    db.query(models.SSHCredential).update({"is_default": False})
    cred.is_default = True
    db.commit()
    db.refresh(cred)
    return _mask(cred)
