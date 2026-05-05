from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from .. import models, schemas
from ..database import get_db
from ..auth import get_current_user, require_write, require_admin

router = APIRouter(prefix="/api/credentials", tags=["credentials"])


@router.get("", response_model=List[schemas.CredentialResponse])
def list_credentials(
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    return db.query(models.Credential).order_by(models.Credential.created_at.desc()).all()


@router.post("", response_model=schemas.CredentialResponse, status_code=201)
def create_credential(
    cred: schemas.CredentialCreate,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_write),
):
    db_cred = models.Credential(**cred.model_dump())
    db.add(db_cred)
    db.commit()
    db.refresh(db_cred)
    return db_cred


@router.delete("/{cred_id}", status_code=204)
def delete_credential(
    cred_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    cred = db.query(models.Credential).filter(models.Credential.id == cred_id).first()
    if not cred:
        raise HTTPException(status_code=404, detail="Credential not found")
    db.delete(cred)
    db.commit()


@router.patch("/{cred_id}/toggle", response_model=schemas.CredentialResponse)
def toggle_credential(
    cred_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_write),
):
    cred = db.query(models.Credential).filter(models.Credential.id == cred_id).first()
    if not cred:
        raise HTTPException(status_code=404, detail="Credential not found")
    cred.is_active = not cred.is_active
    db.commit()
    db.refresh(cred)
    return cred
