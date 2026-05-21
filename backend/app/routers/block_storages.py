from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Query
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user, require_write
from ..database import DATABASE_URL, get_db

router = APIRouter(prefix="/api/block-storages", tags=["block-storages"])


def _sync_block_storages(provider_name: Optional[str], db_url: str) -> None:
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    from ..providers import get_provider

    engine = create_engine(db_url)
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()
    try:
        cred_query = db.query(models.Credential).filter(models.Credential.is_active == True)
        if provider_name:
            cred_query = cred_query.filter(models.Credential.provider == provider_name)
        creds = cred_query.all()

        for cred in creds:
            try:
                provider = get_provider(cred.provider, cred.config)
                volumes = provider.fetch_block_storages()
            except Exception:
                continue

            now = datetime.now(timezone.utc)
            for vol in volumes:
                cloud_id = vol.get("cloud_id")
                existing = None
                if cloud_id:
                    existing = (
                        db.query(models.BlockStorage)
                        .filter(
                            models.BlockStorage.cloud_id == cloud_id,
                            models.BlockStorage.provider == cred.provider,
                        )
                        .first()
                    )

                if existing:
                    for k, v in vol.items():
                        if hasattr(existing, k):
                            setattr(existing, k, v)
                    existing.last_synced = now
                else:
                    obj = models.BlockStorage(
                        **{k: v for k, v in vol.items() if hasattr(models.BlockStorage, k)}
                    )
                    obj.last_synced = now
                    db.add(obj)
            db.commit()
    finally:
        db.close()


@router.get("", response_model=List[schemas.BlockStorageResponse])
def list_block_storages(
    provider: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(models.BlockStorage)
    if provider:
        q = q.filter(models.BlockStorage.provider == provider)
    if status:
        q = q.filter(models.BlockStorage.status == status)
    if search:
        q = q.filter(models.BlockStorage.name.ilike(f"%{search}%"))
    return q.order_by(models.BlockStorage.name).all()


@router.post("/sync")
def sync_block_storages(
    provider: Optional[str] = Query(None),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db),
    _=Depends(require_write),
):
    background_tasks.add_task(_sync_block_storages, provider, DATABASE_URL)
    return {"status": "sync started"}
