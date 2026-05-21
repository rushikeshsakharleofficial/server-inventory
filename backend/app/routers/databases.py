from typing import Annotated
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, Query
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user, require_write
from ..database import DATABASE_URL, get_db

router = APIRouter(prefix="/api/databases", tags=["databases"])


def _sync_databases(provider_name: str | None, db_url: str) -> None:
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
                dbs = provider.fetch_databases()
            except Exception:  # noqa: BLE001 — skip credential on any provider error
                continue

            now = datetime.now(timezone.utc)
            for d in dbs:
                cloud_id = d.get("cloud_id")
                existing = None
                if cloud_id:
                    existing = (
                        db.query(models.DatabaseInstance)
                        .filter(
                            models.DatabaseInstance.cloud_id == cloud_id,
                            models.DatabaseInstance.provider == cred.provider,
                        )
                        .first()
                    )

                if existing:
                    for k, v in d.items():
                        if hasattr(existing, k):
                            setattr(existing, k, v)
                    existing.last_synced = now
                else:
                    obj = models.DatabaseInstance(
                        **{k: v for k, v in d.items() if hasattr(models.DatabaseInstance, k)}
                    )
                    obj.last_synced = now
                    db.add(obj)
            db.commit()
    finally:
        db.close()


@router.get("", response_model=list[schemas.DatabaseInstanceResponse])
def list_databases(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(get_current_user)],
    provider: str | None = Query(None),
    status: str | None = Query(None),
    search: str | None = Query(None),
) -> list[models.DatabaseInstance]:
    q = db.query(models.DatabaseInstance)
    if provider:
        q = q.filter(models.DatabaseInstance.provider == provider)
    if status:
        q = q.filter(models.DatabaseInstance.status == status)
    if search:
        # Escape LIKE metacharacters before building the pattern so that user
        # input containing '%' or '_' is treated as literal characters.
        escaped = search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        q = q.filter(models.DatabaseInstance.name.ilike(f"%{escaped}%", escape="\\"))
    return q.order_by(models.DatabaseInstance.name).all()


@router.post("/sync")
def sync_databases(
    background_tasks: BackgroundTasks,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(require_write)],
    provider: str | None = Query(None),
) -> dict[str, str]:
    background_tasks.add_task(_sync_databases, provider, DATABASE_URL)
    return {"status": "sync started"}
