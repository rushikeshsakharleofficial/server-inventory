"""
Pinning tests for websocket_endpoint (backend/app/main.py), complexity 18.
Opens its own SessionLocal() (not through get_db), so tests use a real
committing session against the test Postgres DB, like the other
background-task-style functions.
"""
import pytest

from app import models
from app.auth import create_access_token, hash_password
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
        session.query(models.SyncLog).delete(synchronize_session=False)
        session.query(models.User).delete(synchronize_session=False)
        session.commit()
        session.close()
        engine.dispose()


def _make_user(session, username="wsuser", is_active=True):
    user = models.User(username=username, hashed_password=hash_password("pw"), role="viewer", is_active=is_active)
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


class TestWebsocketEndpointAuth:
    def test_valid_token_in_url_connects_and_receives_active_syncs(self, client, real_db):
        _make_user(real_db, username="wsuser")
        token = create_access_token({"sub": "wsuser"})

        with client.websocket_connect(f"/ws?token={token}") as ws:
            msg = ws.receive_json()
            assert msg["type"] == "active_syncs"

    def test_missing_token_and_no_auth_message_closes_connection(self, client, real_db):
        with pytest.raises(Exception):
            with client.websocket_connect("/ws") as ws:
                ws.close()
                # server should have closed the socket waiting for the auth message
                ws.receive_json()

    def test_invalid_jwt_closes_with_4001(self, client, real_db):
        with pytest.raises(Exception):
            with client.websocket_connect("/ws?token=not-a-real-jwt") as ws:
                ws.receive_json()

    def test_unknown_username_closes_connection(self, client, real_db):
        token = create_access_token({"sub": "ghost-user"})
        with pytest.raises(Exception):
            with client.websocket_connect(f"/ws?token={token}") as ws:
                ws.receive_json()

    def test_inactive_user_closes_connection(self, client, real_db):
        _make_user(real_db, username="inactive-user", is_active=False)
        token = create_access_token({"sub": "inactive-user"})
        with pytest.raises(Exception):
            with client.websocket_connect(f"/ws?token={token}") as ws:
                ws.receive_json()


class TestWebsocketEndpointMessaging:
    def test_ping_replies_with_pong(self, client, real_db):
        _make_user(real_db, username="pinguser")
        token = create_access_token({"sub": "pinguser"})

        with client.websocket_connect(f"/ws?token={token}") as ws:
            ws.receive_json()  # active_syncs
            ws.send_text("ping")
            reply = ws.receive_text()
            assert reply == "pong"

    def test_active_syncs_includes_running_sync_log(self, client, real_db):
        _make_user(real_db, username="syncviewer")
        log = models.SyncLog(provider="aws", status="running")
        real_db.add(log)
        real_db.commit()

        token = create_access_token({"sub": "syncviewer"})
        with client.websocket_connect(f"/ws?token={token}") as ws:
            msg = ws.receive_json()
            assert any(s["provider"] == "aws" for s in msg["syncs"])
