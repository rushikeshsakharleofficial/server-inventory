from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user, require_write
from ..database import DATABASE_URL, get_db
from .query_utils import escape_like
from .sync_utils import _sync_resources

router = APIRouter(prefix="/api/object-storages", tags=["object-storages"])


def _sync_object_storages(provider_name: str | None, db_url: str) -> None:
    _sync_resources(provider_name, db_url, models.ObjectStorage, "fetch_object_storages")


@router.get("")
def list_object_storages(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(get_current_user)],
    provider: Annotated[str | None, Query()] = None,
    status: Annotated[str | None, Query()] = None,
    search: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=schemas._MAX_PAGE_SIZE)] = schemas._DEFAULT_PAGE_SIZE,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> schemas.Page[schemas.ObjectStorageResponse]:
    q = db.query(models.ObjectStorage)
    if provider:
        q = q.filter(models.ObjectStorage.provider == provider)
    if status:
        q = q.filter(models.ObjectStorage.status == status)
    if search:
        q = q.filter(models.ObjectStorage.name.ilike(f"%{escape_like(search)}%", escape="\\"))
    total = q.count()
    items = q.order_by(models.ObjectStorage.name).offset(offset).limit(limit).all()
    counts = dict(
        db.query(models.ObjectStorageUser.store_id, func.count())
        .filter(models.ObjectStorageUser.store_id.in_([i.id for i in items]))
        .group_by(models.ObjectStorageUser.store_id)
        .all()
    )
    out = [schemas.ObjectStorageResponse.model_validate(i).model_copy(update={"user_count": counts.get(i.id, 0)}) for i in items]
    return schemas.Page(total=total, limit=limit, offset=offset, items=out)


@router.post("/sync")
def sync_object_storages(
    background_tasks: BackgroundTasks,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(require_write)],
    provider: Annotated[str | None, Query()] = None,
) -> dict[str, str]:
    background_tasks.add_task(_sync_object_storages, provider, DATABASE_URL)
    return {"status": "sync started"}


def _store_or_404(db: Session, store_id: int) -> models.ObjectStorage:
    store = db.get(models.ObjectStorage, store_id)
    if not store:
        raise HTTPException(status_code=404, detail="Object store not found")
    return store


@router.get("/{store_id}/users")
def list_object_storage_users(
    store_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(get_current_user)],
) -> list[schemas.ObjectStorageUser]:
    _store_or_404(db, store_id)
    return db.query(models.ObjectStorageUser).filter_by(store_id=store_id).order_by(models.ObjectStorageUser.username).all()


@router.put("/{store_id}/users")
def set_object_storage_users(
    store_id: int,
    users: list[schemas.ObjectStorageUser],
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(require_write)],
) -> list[schemas.ObjectStorageUser]:
    """Replace the store's user list (access level + per-user quota)."""
    _store_or_404(db, store_id)
    if len({u.username for u in users}) != len(users):
        raise HTTPException(status_code=422, detail="Duplicate username")
    db.query(models.ObjectStorageUser).filter_by(store_id=store_id).delete()
    db.add_all(models.ObjectStorageUser(store_id=store_id, **u.model_dump()) for u in users)
    db.commit()
    return users
