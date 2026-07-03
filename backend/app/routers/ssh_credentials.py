from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db
from ..auth import get_current_user, require_write, require_admin, require_perm
from ..crypto import encrypt_str, decrypt_str
from ..event_log_utils import add_event_log

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
        proxy_host=cred.proxy_host,
        proxy_port=cred.proxy_port or 22,
        proxy_username=cred.proxy_username,
        proxy_auth_method=cred.proxy_auth_method or "password",
        proxy_password="***" if cred.proxy_password else None,
        proxy_private_key="***" if cred.proxy_private_key else None,
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
    user: Annotated[models.User, Depends(require_write)],
) -> schemas.SSHCredentialResponse:
    # If this one is being set as default, unset all others first
    if payload.is_default:
        db.query(models.SSHCredential).update({"is_default": False})

    data = payload.model_dump()
    if data.get("password"):
        data["password"] = encrypt_str(data["password"])
    if data.get("private_key"):
        data["private_key"] = encrypt_str(data["private_key"])
    if data.get("proxy_password"):
        data["proxy_password"] = encrypt_str(data["proxy_password"])
    if data.get("proxy_private_key"):
        data["proxy_private_key"] = encrypt_str(data["proxy_private_key"])
    cred = models.SSHCredential(**data)
    db.add(cred)
    add_event_log(db, source="ssh-keys", resource=cred.name, event="SSH key added",
                  owner=user.username, message=f"username={cred.username}, auth_method={cred.auth_method}")
    db.commit()
    db.refresh(cred)
    return _mask(cred)


@router.put("/{cred_id}")
def update_ssh_credential(
    cred_id: int,
    payload: schemas.SSHCredentialUpdate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_perm("ssh-credentials", "write"))],
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
    if "proxy_password" in updates and updates["proxy_password"]:
        updates["proxy_password"] = encrypt_str(updates["proxy_password"])
    if "proxy_private_key" in updates and updates["proxy_private_key"]:
        updates["proxy_private_key"] = encrypt_str(updates["proxy_private_key"])

    for field, value in updates.items():
        setattr(cred, field, value)

    if updates:
        add_event_log(db, source="ssh-keys", resource=cred.name, event="SSH key updated", owner=user.username)
    db.commit()
    db.refresh(cred)
    return _mask(cred)


@router.delete("/{cred_id}", status_code=204)
def delete_ssh_credential(
    cred_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_perm("ssh-credentials", "delete"))],
) -> None:
    cred = db.query(models.SSHCredential).filter(models.SSHCredential.id == cred_id).first()
    if not cred:
        raise HTTPException(status_code=404, detail=_SSH_CRED_NOT_FOUND)
    add_event_log(db, source="ssh-keys", resource=cred.name, event="SSH key removed", owner=user.username)
    db.delete(cred)
    db.commit()


class RevealFieldRequest(BaseModel):
    field: str = "password"  # "password" or "private_key"


@router.post("/{cred_id}/reveal-secret")
def reveal_ssh_secret(
    cred_id: int,
    payload: RevealFieldRequest,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_admin)],
) -> dict:
    """Admin-only: returns a single decrypted secret field. Audit-logged."""
    cred = db.query(models.SSHCredential).filter(models.SSHCredential.id == cred_id).first()
    if not cred:
        raise HTTPException(status_code=404, detail=_SSH_CRED_NOT_FOUND)
    raw = getattr(cred, payload.field, None)
    if payload.field not in ("password", "private_key") or not raw:
        raise HTTPException(status_code=404, detail=f"Field '{payload.field}' not found")
    add_event_log(db, source="ssh-keys", resource=cred.name, event="SSH secret revealed",
                  owner=user.username, message=f"field={payload.field}")
    db.commit()
    return {"field": payload.field, "value": decrypt_str(raw)}


@router.patch("/{cred_id}/set-default")
def set_default_ssh_credential(
    cred_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_write)],
) -> schemas.SSHCredentialResponse:
    cred = db.query(models.SSHCredential).filter(models.SSHCredential.id == cred_id).first()
    if not cred:
        raise HTTPException(status_code=404, detail=_SSH_CRED_NOT_FOUND)

    # Unset all others, then set this one
    db.query(models.SSHCredential).update({"is_default": False})
    cred.is_default = True
    add_event_log(db, source="ssh-keys", resource=cred.name, event="SSH key set as default", owner=user.username)
    db.commit()
    db.refresh(cred)
    return _mask(cred)
