from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db
from ..auth import get_current_user, require_write
from ..crypto import encrypt_str

router = APIRouter(prefix="/api/ssh-credentials", tags=["ssh-credentials"])

_SSH_CRED_NOT_FOUND = "SSH credential not found"


def _mask(cred: models.SSHCredential) -> schemas.SSHCredentialResponse:
    return schemas.SSHCredentialResponse(
        id=cred.id,
        name=cred.name,
        username=cred.username,
        auth_method=cred.auth_method or "password",
        password="***" if cred.password else None,
        private_key="***" if cred.private_key else None,
        port=cred.port,
        is_default=cred.is_default,
        notes=cred.notes,
        created_at=cred.created_at,
        updated_at=cred.updated_at,
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("")
def list_ssh_credentials(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(get_current_user)],
) -> list[schemas.SSHCredentialResponse]:
    creds = db.query(models.SSHCredential).order_by(models.SSHCredential.name).all()
    return [_mask(c) for c in creds]


@router.post("", status_code=201)
def create_ssh_credential(
    payload: schemas.SSHCredentialCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(require_write)],
) -> schemas.SSHCredentialResponse:
    # If this one is being set as default, unset all others first
    if payload.is_default:
        db.query(models.SSHCredential).update({"is_default": False})

    data = payload.model_dump()
    if data.get("password"):
        data["password"] = encrypt_str(data["password"])
    if data.get("private_key"):
        data["private_key"] = encrypt_str(data["private_key"])
    cred = models.SSHCredential(**data)
    db.add(cred)
    db.commit()
    db.refresh(cred)
    return _mask(cred)


@router.put("/{cred_id}")
def update_ssh_credential(
    cred_id: int,
    payload: schemas.SSHCredentialUpdate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(require_write)],
) -> schemas.SSHCredentialResponse:
    cred = db.query(models.SSHCredential).filter(models.SSHCredential.id == cred_id).first()
    if not cred:
        raise HTTPException(status_code=404, detail=_SSH_CRED_NOT_FOUND)

    updates = payload.model_dump(exclude_unset=True)

    # If promoting to default, unset all others first
    if updates.get("is_default"):
        db.query(models.SSHCredential).filter(
            models.SSHCredential.id != cred_id
        ).update({"is_default": False})

    if "password" in updates and updates["password"]:
        updates["password"] = encrypt_str(updates["password"])
    if "private_key" in updates and updates["private_key"]:
        updates["private_key"] = encrypt_str(updates["private_key"])

    for field, value in updates.items():
        setattr(cred, field, value)

    db.commit()
    db.refresh(cred)
    return _mask(cred)


@router.delete("/{cred_id}", status_code=204)
def delete_ssh_credential(
    cred_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(require_write)],
) -> None:
    cred = db.query(models.SSHCredential).filter(models.SSHCredential.id == cred_id).first()
    if not cred:
        raise HTTPException(status_code=404, detail=_SSH_CRED_NOT_FOUND)
    db.delete(cred)
    db.commit()


@router.patch("/{cred_id}/set-default")
def set_default_ssh_credential(
    cred_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(require_write)],
) -> schemas.SSHCredentialResponse:
    cred = db.query(models.SSHCredential).filter(models.SSHCredential.id == cred_id).first()
    if not cred:
        raise HTTPException(status_code=404, detail=_SSH_CRED_NOT_FOUND)

    # Unset all others, then set this one
    db.query(models.SSHCredential).update({"is_default": False})
    cred.is_default = True
    db.commit()
    db.refresh(cred)
    return _mask(cred)
