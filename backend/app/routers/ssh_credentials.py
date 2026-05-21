from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db
from ..auth import get_current_user, require_write

router = APIRouter(prefix="/api/ssh-credentials", tags=["ssh-credentials"])


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

@router.get("", response_model=list[schemas.SSHCredentialResponse])
def list_ssh_credentials(
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
) -> list[schemas.SSHCredentialResponse]:
    creds = db.query(models.SSHCredential).order_by(models.SSHCredential.name).all()
    return [_mask(c) for c in creds]


@router.post("", response_model=schemas.SSHCredentialResponse, status_code=201)
def create_ssh_credential(
    payload: schemas.SSHCredentialCreate,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_write),
) -> schemas.SSHCredentialResponse:
    # If this one is being set as default, unset all others first
    if payload.is_default:
        db.query(models.SSHCredential).update({"is_default": False})

    cred = models.SSHCredential(**payload.model_dump())
    db.add(cred)
    db.commit()
    db.refresh(cred)
    return _mask(cred)


@router.put("/{cred_id}", response_model=schemas.SSHCredentialResponse)
def update_ssh_credential(
    cred_id: int,
    payload: schemas.SSHCredentialUpdate,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_write),
) -> schemas.SSHCredentialResponse:
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
) -> None:
    cred = db.query(models.SSHCredential).filter(models.SSHCredential.id == cred_id).first()
    if not cred:
        raise HTTPException(status_code=404, detail="SSH credential not found")
    db.delete(cred)
    db.commit()


@router.patch("/{cred_id}/set-default", response_model=schemas.SSHCredentialResponse)
def set_default_ssh_credential(
    cred_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_write),
) -> schemas.SSHCredentialResponse:
    cred = db.query(models.SSHCredential).filter(models.SSHCredential.id == cred_id).first()
    if not cred:
        raise HTTPException(status_code=404, detail="SSH credential not found")

    # Unset all others, then set this one
    db.query(models.SSHCredential).update({"is_default": False})
    cred.is_default = True
    db.commit()
    db.refresh(cred)
    return _mask(cred)
