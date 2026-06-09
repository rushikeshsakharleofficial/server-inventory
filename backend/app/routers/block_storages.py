import time
from typing import Annotated
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, Query
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user, require_write
from ..crypto import decrypt_config
from ..database import DATABASE_URL, get_db

router = APIRouter(prefix="/api/block-storages", tags=["block-storages"])

_BATCH_SIZE = 25
_BATCH_DELAY_S = 0.15


def _sync_block_storages(provider_name: str | None, db_url: str) -> None:
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    from ..providers import get_provider

    engine = create_engine(db_url, pool_pre_ping=True)
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()
    try:
        cred_query = db.query(models.Credential).filter(models.Credential.is_active.is_(True))
        if provider_name:
            cred_query = cred_query.filter(models.Credential.provider == provider_name)
        creds = cred_query.all()

        for cred in creds:
            try:
                provider = get_provider(cred.provider, decrypt_config(cred.config or {}))
                volumes = provider.fetch_block_storages()
            except Exception:  # noqa: BLE001 — skip credential on any provider error
                continue

            now = datetime.now(timezone.utc)
            cloud_ids = [vol.get("cloud_id") for vol in volumes if vol.get("cloud_id")]
            existing_map: dict[str, models.BlockStorage] = {}
            if cloud_ids:
                for obj in (
                    db.query(models.BlockStorage)
                    .filter(
                        models.BlockStorage.cloud_id.in_(cloud_ids),
                        models.BlockStorage.provider == cred.provider,
                    )
                    .all()
                ):
                    if obj.cloud_id:
                        existing_map[obj.cloud_id] = obj

            total = len(volumes)
            for batch_start in range(0, total, _BATCH_SIZE):
                for vol in volumes[batch_start : batch_start + _BATCH_SIZE]:
                    cloud_id = vol.get("cloud_id")
                    existing = existing_map.get(cloud_id) if cloud_id else None
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
                if batch_start + _BATCH_SIZE < total:
                    time.sleep(_BATCH_DELAY_S)
    finally:
        db.close()


@router.get("", response_model=list[schemas.BlockStorageResponse])
def list_block_storages(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(get_current_user)],
    provider: str | None = Query(None),
    status: str | None = Query(None),
    search: str | None = Query(None),
) -> list[models.BlockStorage]:
    q = db.query(models.BlockStorage)
    if provider:
        q = q.filter(models.BlockStorage.provider == provider)
    if status:
        q = q.filter(models.BlockStorage.status == status)
    if search:
        # Escape LIKE metacharacters before building the pattern so that user
        # input containing '%' or '_' is treated as literal characters.
        escaped = search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        q = q.filter(models.BlockStorage.name.ilike(f"%{escaped}%", escape="\\"))
    return q.order_by(models.BlockStorage.name).all()


@router.post("/sync")
def sync_block_storages(
    background_tasks: BackgroundTasks,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(require_write)],
    provider: str | None = Query(None),
) -> dict[str, str]:
    background_tasks.add_task(_sync_block_storages, provider, DATABASE_URL)
    return {"status": "sync started"}
