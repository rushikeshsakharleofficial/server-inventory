"""
Pinning tests for _sync_resources (backend/app/routers/sync_utils.py),
complexity 43 vs 15 allowed. Opens its own engine/session (background-task
style), so tests use a real committing session against the test Postgres DB.
"""
from unittest.mock import patch

import pytest

from app import models
from app.routers import sync_utils
from tests.conftest import _TEST_DB_URL


@pytest.fixture
def real_db():
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    engine = create_engine(_TEST_DB_URL, pool_pre_ping=True)
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.rollback()
        session.query(models.EventLog).delete(synchronize_session=False)
        session.query(models.DatabaseInstance).delete(synchronize_session=False)
        session.query(models.Credential).delete(synchronize_session=False)
        session.commit()
        session.close()
        engine.dispose()


def _make_credential(session, provider="aws"):
    cred = models.Credential(name="test-cred", provider=provider, is_active=True, config={})
    session.add(cred)
    session.commit()
    session.refresh(cred)
    return cred


class TestSyncResourcesNewItems:
    def test_new_items_created_from_fetch(self, real_db):
        cred = _make_credential(real_db)

        items = [
            {"cloud_id": "db-1", "name": "db-one", "provider": "aws", "engine": "postgres"},
            {"cloud_id": "db-2", "name": "db-two", "provider": "aws", "engine": "mysql"},
        ]

        with patch.object(sync_utils, "_fetch_for_credential", return_value=(cred, items, None)):
            sync_utils._sync_resources("aws", _TEST_DB_URL, models.DatabaseInstance, "fetch_databases")

        rows = real_db.query(models.DatabaseInstance).filter(
            models.DatabaseInstance.cloud_id.in_(["db-1", "db-2"])
        ).all()
        assert len(rows) == 2
        assert {r.name for r in rows} == {"db-one", "db-two"}

        log = real_db.query(models.EventLog).filter_by(resource=cred.name).first()
        assert log is not None
        assert "complete" in log.event
        assert "2 added, 0 updated" in log.message


class TestSyncResourcesExistingItems:
    def test_existing_item_matched_by_cloud_id_and_provider_updated(self, real_db):
        cred = _make_credential(real_db)
        existing = models.DatabaseInstance(
            cloud_id="db-existing", name="old-name", provider="aws", status="stopped",
        )
        real_db.add(existing)
        real_db.commit()

        items = [{"cloud_id": "db-existing", "name": "renamed", "provider": "aws", "status": "running"}]

        with patch.object(sync_utils, "_fetch_for_credential", return_value=(cred, items, None)):
            sync_utils._sync_resources("aws", _TEST_DB_URL, models.DatabaseInstance, "fetch_databases")

        real_db.refresh(existing)
        assert existing.name == "renamed"
        assert existing.status == "running"

        log = real_db.query(models.EventLog).filter_by(resource=cred.name).first()
        assert "0 added, 1 updated" in log.message

    def test_existing_item_matched_only_within_same_provider(self, real_db):
        cred = _make_credential(real_db, provider="aws")
        other_provider_row = models.DatabaseInstance(
            cloud_id="db-shared-id", name="gcp-db", provider="gcp", status="running",
        )
        real_db.add(other_provider_row)
        real_db.commit()

        items = [{"cloud_id": "db-shared-id", "name": "aws-db", "provider": "aws", "status": "running"}]

        with patch.object(sync_utils, "_fetch_for_credential", return_value=(cred, items, None)):
            sync_utils._sync_resources("aws", _TEST_DB_URL, models.DatabaseInstance, "fetch_databases")

        # a new row for aws should be created — the gcp row is not touched
        rows = real_db.query(models.DatabaseInstance).filter_by(cloud_id="db-shared-id").all()
        assert len(rows) == 2
        real_db.refresh(other_provider_row)
        assert other_provider_row.name == "gcp-db"


class TestSyncResourcesErrorHandling:
    def test_fetch_error_logs_and_skips_without_raising(self, real_db):
        cred = _make_credential(real_db)

        with patch.object(sync_utils, "_fetch_for_credential", return_value=(cred, [], "RuntimeError: boom")):
            sync_utils._sync_resources("aws", _TEST_DB_URL, models.DatabaseInstance, "fetch_databases")

        log = real_db.query(models.EventLog).filter_by(resource=cred.name).first()
        assert log is not None
        assert log.severity == "error"
        assert "boom" in log.message
        assert real_db.query(models.DatabaseInstance).count() == 0

    def test_empty_items_no_log_written(self, real_db):
        cred = _make_credential(real_db)

        with patch.object(sync_utils, "_fetch_for_credential", return_value=(cred, [], None)):
            sync_utils._sync_resources("aws", _TEST_DB_URL, models.DatabaseInstance, "fetch_databases")

        assert real_db.query(models.EventLog).filter_by(resource=cred.name).count() == 0


class TestSyncResourcesProviderFilter:
    def test_provider_name_filters_which_credentials_are_used(self, real_db):
        aws_cred = _make_credential(real_db, provider="aws")
        _make_credential(real_db, provider="gcp")

        call_count = {"n": 0}

        def fake_fetch(cred, method_name):
            call_count["n"] += 1
            return cred, [], None

        with patch.object(sync_utils, "_fetch_for_credential", side_effect=fake_fetch):
            sync_utils._sync_resources("aws", _TEST_DB_URL, models.DatabaseInstance, "fetch_databases")

        assert call_count["n"] == 1

    def test_no_provider_name_uses_all_active_credentials(self, real_db):
        _make_credential(real_db, provider="aws")
        _make_credential(real_db, provider="gcp")

        call_count = {"n": 0}

        def fake_fetch(cred, method_name):
            call_count["n"] += 1
            return cred, [], None

        with patch.object(sync_utils, "_fetch_for_credential", side_effect=fake_fetch):
            sync_utils._sync_resources(None, _TEST_DB_URL, models.DatabaseInstance, "fetch_databases")

        assert call_count["n"] == 2
