from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Query
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user, require_write
from ..database import DATABASE_URL, get_db
from .query_utils import escape_like
from .sync_utils import _sync_resources

router = APIRouter(prefix="/api/domains", tags=["domains"])


def _sync_domains(provider_name: str | None, db_url: str) -> None:
    _sync_resources(provider_name, db_url, models.DnsRecord, "fetch_domains")


@router.get("", response_model=schemas.Page[schemas.DnsRecordResponse])
def list_domains(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(get_current_user)],
    provider: str | None = Query(None),
    status: str | None = Query(None),
    zone: str | None = Query(None),
    search: str | None = Query(None),
    limit: int = Query(default=schemas._DEFAULT_PAGE_SIZE, ge=1, le=schemas._MAX_PAGE_SIZE),
    offset: int = Query(default=0, ge=0),
) -> schemas.Page[schemas.DnsRecordResponse]:
    q = db.query(models.DnsRecord)
    if provider:
        q = q.filter(models.DnsRecord.provider == provider)
    if status:
        q = q.filter(models.DnsRecord.status == status)
    if zone:
        q = q.filter(models.DnsRecord.zone == zone)
    if search:
        q = q.filter(models.DnsRecord.name.ilike(f"%{escape_like(search)}%", escape="\\"))
    total = q.count()
    items = q.order_by(models.DnsRecord.zone, models.DnsRecord.name).offset(offset).limit(limit).all()
    return schemas.Page(total=total, limit=limit, offset=offset, items=items)


@router.post("/sync")
def sync_domains(
    background_tasks: BackgroundTasks,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(require_write)],
    provider: str | None = Query(None),
) -> dict[str, str]:
    background_tasks.add_task(_sync_domains, provider, DATABASE_URL)
    return {"status": "sync started"}
