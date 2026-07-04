"""
Shared test fixtures: a real throwaway Postgres database (JSONB columns and
postgresql.insert() upserts used across this codebase don't exist in SQLite,
so an in-memory SQLite DB isn't viable here), a FastAPI TestClient wired to
it via dependency override, and mocked SSH/cloud-provider clients so tests
never make real network calls.

Requires a Postgres instance reachable at TEST_DATABASE_URL (default: the
throwaway container started for this session, postgresql://test:test@
localhost:55432/server_inventory_test). Spin one up with:

    docker run -d --name si-test-postgres \
      -e POSTGRES_DB=server_inventory_test -e POSTGRES_USER=test \
      -e POSTGRES_PASSWORD=test -p 55432:5432 postgres:16-alpine
"""
import os
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql://test:test@localhost:55432/server_inventory_test",
)
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production-use")
os.environ.setdefault(
    "CREDENTIAL_ENCRYPTION_KEY", "N637BA0dKyVJU755KP9yndQK-ywwBwKU0QCYF1AA-ro="
)

from app import models  # noqa: E402  (import after env vars set, matches main.py's own import-time DB connect)
from app.database import get_db
from app.main import app

_TEST_DB_URL = os.environ["DATABASE_URL"]
_engine = create_engine(_TEST_DB_URL, pool_pre_ping=True)
_TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine)


@pytest.fixture(scope="session", autouse=True)
def _test_schema():
    """Create all tables once per test session, drop once at the end."""
    models.Base.metadata.create_all(bind=_engine)
    yield
    models.Base.metadata.drop_all(bind=_engine)


@pytest.fixture
def db_session():
    """A DB session wrapped in a transaction that's rolled back after each test."""
    connection = _engine.connect()
    transaction = connection.begin()
    session = _TestSessionLocal(bind=connection)
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture
def client(db_session):
    """FastAPI TestClient with the DB dependency overridden to use db_session."""

    def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.pop(get_db, None)


@pytest.fixture
def admin_user(db_session):
    """A persisted admin User row, for tests that need an authenticated actor."""
    from app.auth import hash_password

    user = models.User(
        username="test_admin",
        hashed_password=hash_password("Test-Password-123!"),
        role="admin",
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def auth_client(client, admin_user):
    """TestClient with get_current_user overridden to return admin_user directly —
    skips real JWT/login flow for tests that only care about endpoint logic."""
    from app.auth import get_current_user

    app.dependency_overrides[get_current_user] = lambda: admin_user
    yield client
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def mock_ssh_client():
    """Patches paramiko.SSHClient so no real SSH connection is attempted.
    Returns the MagicMock instance callers can configure (e.g. set exec_command
    return values) before invoking the function under test."""
    with patch("paramiko.SSHClient") as mock_cls:
        instance = MagicMock()
        mock_cls.return_value = instance
        yield instance


@pytest.fixture
def mock_boto3_client():
    """Patches boto3.client so no real AWS API call is attempted. Callers
    configure mock_boto3_client.return_value (a MagicMock) with the specific
    method return values (e.g. .describe_instances.return_value = {...})."""
    with patch("boto3.client") as mock_fn:
        yield mock_fn
