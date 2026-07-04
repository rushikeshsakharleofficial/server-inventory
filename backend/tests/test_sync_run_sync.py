"""
Pinning tests for _run_sync (backend/app/routers/sync.py), complexity 67 vs
15 allowed. This function opens its OWN engine/session (background-task
style, not wired through FastAPI's get_db), so tests use a real committed
connection against the test Postgres DB rather than the rollback-per-test
db_session fixture, cleaning up rows it creates afterward.
"""
from unittest.mock import MagicMock, patch

import pytest

from app import models
from app.routers import sync as sync_module
from tests.conftest import _TEST_DB_URL


@pytest.fixture
def real_db():
    """A real, committing session against the test DB (not the rollback
    fixture) since _run_sync opens its own connection independent of
    whatever session the test uses to set up fixtures."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    engine = create_engine(_TEST_DB_URL, pool_pre_ping=True)
    Session = sessionmaker(bind=engine)
    session = Session()
    created_cred_ids = []
    created_server_ids = []
    try:
        yield session, created_cred_ids, created_server_ids
    finally:
        session.rollback()
        if created_server_ids:
            session.query(models.Server).filter(models.Server.id.in_(created_server_ids)).delete(
                synchronize_session=False
            )
        session.query(models.SyncLog).delete(synchronize_session=False)
        if created_cred_ids:
            session.query(models.Credential).filter(
                models.Credential.id.in_(created_cred_ids)
            ).delete(synchronize_session=False)
        session.commit()
        session.close()
        engine.dispose()


def _make_credential(session, created_cred_ids, provider="aws"):
    cred = models.Credential(name="test-cred", provider=provider, is_active=True, config={})
    session.add(cred)
    session.commit()
    session.refresh(cred)
    created_cred_ids.append(cred.id)
    return cred


class TestRunSyncHappyPath:
    def test_new_servers_added_and_snapshot_taken(self, real_db):
        session, created_cred_ids, created_server_ids = real_db
        cred = _make_credential(session, created_cred_ids)

        fake_provider = MagicMock()
        fake_provider.fetch_servers.return_value = [
            {"cloud_id": "i-abc123", "name": "srv-1", "provider": "aws", "status": "running"},
            {"cloud_id": "i-def456", "name": "srv-2", "provider": "aws", "status": "stopped"},
        ]

        with patch.object(sync_module, "get_provider", return_value=fake_provider), \
             patch.object(sync_module.manager, "broadcast"), \
             patch("app.stats_utils.take_snapshot") as mock_snapshot, \
             patch.object(sync_module, "_ssh_fetch_ips"):
            sync_module._run_sync("aws", _TEST_DB_URL)

        log = session.query(models.SyncLog).filter_by(provider="aws").first()
        assert log is not None
        assert log.status == "success"
        assert log.servers_added == 2
        assert log.servers_updated == 0
        mock_snapshot.assert_called_once()

        new_servers = session.query(models.Server).filter(
            models.Server.cloud_id.in_(["i-abc123", "i-def456"])
        ).all()
        created_server_ids.extend(s.id for s in new_servers)
        assert len(new_servers) == 2

    def test_existing_server_updated_not_duplicated(self, real_db):
        session, created_cred_ids, created_server_ids = real_db
        cred = _make_credential(session, created_cred_ids)

        existing = models.Server(
            cloud_id="i-existing", name="old-name", provider="aws", status="stopped"
        )
        session.add(existing)
        session.commit()
        session.refresh(existing)
        created_server_ids.append(existing.id)

        fake_provider = MagicMock()
        fake_provider.fetch_servers.return_value = [
            {"cloud_id": "i-existing", "name": "renamed", "provider": "aws", "status": "running"},
        ]

        with patch.object(sync_module, "get_provider", return_value=fake_provider), \
             patch.object(sync_module.manager, "broadcast") as mock_broadcast, \
             patch("app.stats_utils.take_snapshot"), \
             patch.object(sync_module, "_ssh_fetch_ips"):
            sync_module._run_sync("aws", _TEST_DB_URL)

        log = session.query(models.SyncLog).filter_by(provider="aws").first()
        assert log.servers_added == 0
        assert log.servers_updated == 1

        session.refresh(existing)
        assert existing.name == "renamed"
        assert existing.status == "running"

        status_change_events = [
            c for c in mock_broadcast.call_args_list
            if c.args[0].get("type") == "server_status_changed"
        ]
        assert len(status_change_events) == 1


class TestRunSyncErrorHandling:
    def test_provider_fetch_exception_marks_log_failed(self, real_db):
        session, created_cred_ids, _ = real_db
        cred = _make_credential(session, created_cred_ids)

        with patch.object(sync_module, "get_provider", side_effect=RuntimeError("bad credentials")), \
             patch.object(sync_module.manager, "broadcast"):
            sync_module._run_sync("aws", _TEST_DB_URL)

        log = session.query(models.SyncLog).filter_by(provider="aws").first()
        assert log.status == "failed"
        assert "bad credentials" in log.error_message

    def test_stop_event_set_before_fetch_aborts_as_stopped(self, real_db):
        session, created_cred_ids, _ = real_db
        cred = _make_credential(session, created_cred_ids)

        # Pre-populate the stop event so _run_sync sees it set immediately
        # after creating the log row — simulate a stop requested mid-run.
        original_run_sync = sync_module._run_sync

        def patched(provider_name, db_url):
            # Intercept right after the SyncLog is created by monkeypatching
            # threading.Event to return an already-set event.
            with patch.object(sync_module.threading, "Event") as mock_event_cls:
                mock_event = MagicMock()
                mock_event.is_set.return_value = True
                mock_event_cls.return_value = mock_event
                original_run_sync(provider_name, db_url)

        with patch.object(sync_module, "get_provider") as mock_get_provider, \
             patch.object(sync_module.manager, "broadcast"):
            patched("aws", _TEST_DB_URL)
            mock_get_provider.assert_not_called()

        log = session.query(models.SyncLog).filter_by(provider="aws").first()
        assert log.status == "failed"
        assert sync_module._SYNC_STOPPED_MSG in log.error_message
