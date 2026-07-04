import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Any

_BATCH_SIZE = 25
_BATCH_DELAY_S = 0.15
_CRED_FETCH_WORKERS = 10


def _fetch_for_credential(
    cred: Any, fetch_method_name: str
) -> tuple[Any, list[dict[str, Any]], str | None]:
    """Network fetch only — thread-safe, no DB access. Run concurrently across credentials.

    Returns (credential, items, error_message). error_message is None on success
    (including a legitimate empty result) so callers can distinguish "nothing to
    sync" from "the fetch itself failed."
    """
    from ..crypto import decrypt_config
    from ..providers import get_provider

    try:
        provider = get_provider(cred.provider, decrypt_config(cred.config or {}))
        items = getattr(provider, fetch_method_name)()
        return cred, items, None
    except Exception as e:  # noqa: BLE001 — surfaced via event log, not raised
        return cred, [], f"{type(e).__name__}: {e}"


def _load_active_credentials(db: Any, provider_name: str | None) -> list[Any]:
    from .. import models

    cred_query = db.query(models.Credential).filter(models.Credential.is_active.is_(True))
    if provider_name:
        cred_query = cred_query.filter(models.Credential.provider == provider_name)
    return cred_query.all()


def _fetch_all_credentials_concurrently(creds: list[Any], fetch_method_name: str) -> list[tuple]:
    # Fetching from N credentials' provider APIs is IO-bound and independent —
    # fan out across credentials, not just within one (e.g. a single Cloudflare
    # account can have hundreds of zones; 24 credentials run sequentially each
    # taking minutes made a full sync take over an hour).
    with ThreadPoolExecutor(max_workers=_CRED_FETCH_WORKERS) as pool:
        return list(pool.map(lambda c: _fetch_for_credential(c, fetch_method_name), creds))


def _existing_items_by_cloud_id(db: Any, model_cls: Any, items: list[dict], provider: str) -> dict[str, Any]:
    cloud_ids = [item.get("cloud_id") for item in items if item.get("cloud_id")]
    existing_map: dict[str, Any] = {}
    if not cloud_ids:
        return existing_map
    for obj in (
        db.query(model_cls)
        .filter(model_cls.cloud_id.in_(cloud_ids), model_cls.provider == provider)
        .all()
    ):
        if obj.cloud_id:
            existing_map[obj.cloud_id] = obj
    return existing_map


def _upsert_one_item(db: Any, model_cls: Any, item: dict, existing_map: dict[str, Any], now) -> bool:
    """Create or update a single item. Returns True if it was newly created."""
    cloud_id = item.get("cloud_id")
    existing = existing_map.get(cloud_id) if cloud_id else None
    if existing:
        for k, v in item.items():
            if hasattr(existing, k):
                setattr(existing, k, v)
        existing.last_synced = now
        return False
    obj = model_cls(**{k: v for k, v in item.items() if hasattr(model_cls, k)})
    obj.last_synced = now
    db.add(obj)
    return True


def _upsert_items_in_batches(db: Any, model_cls: Any, items: list[dict], existing_map: dict[str, Any]) -> tuple[int, int]:
    now = datetime.now(timezone.utc)
    total = len(items)
    added = updated = 0
    for batch_start in range(0, total, _BATCH_SIZE):
        for item in items[batch_start : batch_start + _BATCH_SIZE]:
            if _upsert_one_item(db, model_cls, item, existing_map, now):
                added += 1
            else:
                updated += 1
        db.commit()
        if batch_start + _BATCH_SIZE < total:
            time.sleep(_BATCH_DELAY_S)
    return added, updated


def _apply_one_credential_result(db: Any, model_cls: Any, resource_label: str, cred: Any, items: list[dict], error: str | None) -> None:
    from ..event_log_utils import add_event_log

    if error:
        add_event_log(
            db, source="sync", resource=cred.name, event=f"{resource_label} sync failed",
            severity="error", status="open", message=error,
        )
        db.commit()
        return
    if not items:
        return

    existing_map = _existing_items_by_cloud_id(db, model_cls, items, cred.provider)
    added, updated = _upsert_items_in_batches(db, model_cls, items, existing_map)

    add_event_log(
        db, source="sync", resource=cred.name, event=f"{resource_label} sync complete",
        message=f"{added} added, {updated} updated",
    )
    db.commit()


def _sync_resources(
    provider_name: str | None,
    db_url: str,
    model_cls: Any,
    fetch_method_name: str,
) -> None:
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    engine = create_engine(db_url, pool_pre_ping=True)
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()
    resource_label = model_cls.__tablename__
    try:
        creds = _load_active_credentials(db, provider_name)
        fetch_results = _fetch_all_credentials_concurrently(creds, fetch_method_name)
        for cred, items, error in fetch_results:
            _apply_one_credential_result(db, model_cls, resource_label, cred, items, error)
    finally:
        db.close()
