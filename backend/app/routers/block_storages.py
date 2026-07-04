from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Query
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user, require_write
from ..database import DATABASE_URL, get_db
from .query_utils import escape_like
from .sync_utils import _sync_resources

router = APIRouter(prefix="/api/block-storages", tags=["block-storages"])


def _sync_block_storages(provider_name: str | None, db_url: str) -> None:
    _sync_resources(provider_name, db_url, models.BlockStorage, "fetch_block_storages")


@router.get("", response_model=schemas.Page[schemas.BlockStorageResponse])
def list_block_storages(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(get_current_user)],
    provider: Annotated[str | None, Query()] = None,
    status: Annotated[str | None, Query()] = None,
    search: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=schemas._MAX_PAGE_SIZE)] = schemas._DEFAULT_PAGE_SIZE,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> schemas.Page[schemas.BlockStorageResponse]:
    q = db.query(models.BlockStorage)
    if provider:
        q = q.filter(models.BlockStorage.provider == provider)
    if status:
        q = q.filter(models.BlockStorage.status == status)
    if search:
        q = q.filter(models.BlockStorage.name.ilike(f"%{escape_like(search)}%", escape="\\"))
    total = q.count()
    items = q.order_by(models.BlockStorage.name).offset(offset).limit(limit).all()
    return schemas.Page(total=total, limit=limit, offset=offset, items=items)


@router.post("/sync")
def sync_block_storages(
    background_tasks: BackgroundTasks,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(require_write)],
    provider: Annotated[str | None, Query()] = None,
) -> dict[str, str]:
    background_tasks.add_task(_sync_block_storages, provider, DATABASE_URL)
    return {"status": "sync started"}
