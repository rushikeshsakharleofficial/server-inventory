import time
from datetime import datetime, timezone
from typing import Any

_BATCH_SIZE = 25
_BATCH_DELAY_S = 0.15


def _sync_resources(
    provider_name: str | None,
    db_url: str,
    model_cls: Any,
    fetch_method_name: str,
) -> None:
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    from .. import models
    from ..crypto import decrypt_config
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
                items = getattr(provider, fetch_method_name)()
            except Exception:  # noqa: BLE001 — skip credential on any provider error
                continue

            now = datetime.now(timezone.utc)
            cloud_ids = [item.get("cloud_id") for item in items if item.get("cloud_id")]
            existing_map: dict[str, Any] = {}
            if cloud_ids:
                for obj in (
                    db.query(model_cls)
                    .filter(
                        model_cls.cloud_id.in_(cloud_ids),
                        model_cls.provider == cred.provider,
                    )
                    .all()
                ):
                    if obj.cloud_id:
                        existing_map[obj.cloud_id] = obj

            total = len(items)
            for batch_start in range(0, total, _BATCH_SIZE):
                for item in items[batch_start : batch_start + _BATCH_SIZE]:
                    cloud_id = item.get("cloud_id")
                    existing = existing_map.get(cloud_id) if cloud_id else None
                    if existing:
                        for k, v in item.items():
                            if hasattr(existing, k):
                                setattr(existing, k, v)
                        existing.last_synced = now
                    else:
                        obj = model_cls(
                            **{k: v for k, v in item.items() if hasattr(model_cls, k)}
                        )
                        obj.last_synced = now
                        db.add(obj)
                db.commit()
                if batch_start + _BATCH_SIZE < total:
                    time.sleep(_BATCH_DELAY_S)
    finally:
        db.close()
