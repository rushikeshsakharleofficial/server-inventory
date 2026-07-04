import asyncio
import json
import os
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from jose import jwt, JWTError
from sqlalchemy import text
from .database import engine, Base, SessionLocal
from .routers import servers, credentials, sync
from .routers.auth import router as auth_router
from .routers.ssh_credentials import router as ssh_credentials_router
from .routers.stats import router as stats_router
from .routers.settings import router as settings_router
from .routers.crons import router as crons_router
from .routers.databases import router as databases_router
from .routers.kubernetes_clusters import router as kubernetes_router
from .routers.resource_map import router as resource_map_router
from .routers.block_storages import router as block_storages_router
from .routers.domains import router as domains_router
from .routers.mfa import router as mfa_router
from .routers.iam import router as iam_router
from .routers.server_groups import router as server_groups_router
from .routers.event_logs import router as event_logs_router
from .routers.discovery import router as discovery_router
from .routers.branding import router as branding_router
from .ws_manager import manager
from . import models, scheduler as sched_module
from .auth import SECRET_KEY
from .database import DATABASE_URL

Base.metadata.create_all(bind=engine)


def _migrate_mfa_columns() -> None:
    """Add totp_secret and totp_enabled to users if they don't exist yet."""
    with engine.connect() as conn:
        conn.execute(text(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret VARCHAR(64)"
        ))
        conn.execute(text(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT FALSE"
        ))
        conn.commit()


def _migrate_user_permissions() -> None:
    """Add permissions JSONB column to users if it doesn't exist yet."""
    with engine.connect() as conn:
        conn.execute(text(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{}'"
        ))
        conn.commit()


def _migrate_event_logs() -> None:
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS event_logs (
                id          SERIAL PRIMARY KEY,
                timestamp   TIMESTAMPTZ NOT NULL DEFAULT now(),
                severity    VARCHAR(16) NOT NULL DEFAULT 'info',
                source      VARCHAR(128),
                resource    VARCHAR(255),
                event       TEXT NOT NULL,
                status      VARCHAR(32) NOT NULL DEFAULT 'open',
                owner       VARCHAR(128),
                message     TEXT,
                tags        JSONB DEFAULT '{}',
                extra       JSONB DEFAULT '{}'
            )
        """))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_evlog_timestamp ON event_logs (timestamp)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_evlog_severity  ON event_logs (severity)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_evlog_status    ON event_logs (status)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_evlog_source    ON event_logs (source)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_evlog_resource  ON event_logs (resource)"))
        conn.commit()


def _migrate_user_full_name() -> None:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(256)"))
        conn.commit()


def _migrate_ssh_proxy_columns() -> None:
    """Add proxy/jump-server columns to ssh_credentials if they don't exist yet."""
    with engine.connect() as conn:
        for col, definition in [
            ("proxy_host",        "VARCHAR(255)"),
            ("proxy_port",        "INTEGER DEFAULT 22"),
            ("proxy_username",    "VARCHAR(128)"),
            ("proxy_auth_method", "VARCHAR(16) DEFAULT 'password'"),
            ("proxy_password",    "VARCHAR(512)"),
            ("proxy_private_key", "TEXT"),
        ]:
            conn.execute(text(
                f"ALTER TABLE ssh_credentials ADD COLUMN IF NOT EXISTS {col} {definition}"
            ))
        conn.commit()


def _migrate_credential_type() -> None:
    with engine.connect() as conn:
        conn.execute(text(
            "ALTER TABLE credentials ADD COLUMN IF NOT EXISTS cred_type VARCHAR(16) NOT NULL DEFAULT 'login'"
        ))
        conn.commit()


def _migrate_server_ssh_assignment() -> None:
    with engine.connect() as conn:
        conn.execute(text(
            "ALTER TABLE servers ADD COLUMN IF NOT EXISTS ssh_credential_id INTEGER REFERENCES ssh_credentials(id) ON DELETE SET NULL"
        ))
        conn.execute(text(
            "ALTER TABLE servers ADD COLUMN IF NOT EXISTS ssh_group VARCHAR(128)"
        ))
        conn.commit()


def _migrate_group_super_admin() -> None:
    with engine.connect() as conn:
        conn.execute(text(
            "ALTER TABLE groups ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT FALSE"
        ))
        # Backfill: a pre-existing "Administrators" group is the super-admin group by
        # convention (see _seed_admin_group) — flag it so it stops relying on its
        # permissions JSON snapshot staying in sync with FEATURES.
        conn.execute(text(
            "UPDATE groups SET is_super_admin = TRUE WHERE name = 'Administrators'"
        ))
        conn.commit()


def _migrate_discovery_server_columns() -> None:
    """Add on-prem-discovery identity columns to servers if they don't exist yet.

    The 4 brand-new discovery_* / server_ip_addresses tables need no migration
    (Base.metadata.create_all above already creates them) — this is only for the
    identity columns added to the pre-existing `servers` table.
    """
    with engine.connect() as conn:
        for col, definition in [
            ("machine_id",      "VARCHAR(64)"),
            ("product_uuid",    "VARCHAR(64)"),
            ("ssh_host_key_fp", "VARCHAR(128)"),
        ]:
            conn.execute(text(
                f"ALTER TABLE servers ADD COLUMN IF NOT EXISTS {col} {definition}"
            ))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_servers_machine_id ON servers (machine_id)"
        ))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_servers_product_uuid ON servers (product_uuid)"
        ))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_servers_ssh_host_key_fp ON servers (ssh_host_key_fp)"
        ))
        conn.commit()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    _migrate_mfa_columns()
    _migrate_ssh_proxy_columns()
    _migrate_user_permissions()
    _migrate_user_full_name()
    _migrate_event_logs()
    _migrate_credential_type()
    _migrate_server_ssh_assignment()
    _migrate_group_super_admin()
    _migrate_discovery_server_columns()
    manager.set_loop(asyncio.get_running_loop())
    _apply_db_optimizations()
    _seed_admin()
    _cleanup_stale_syncs()
    _cleanup_stale_discovery_jobs()
    _seed_default_settings()
    _seed_admin_group()
    _seed_default_server_groups()
    sched_module.start(DATABASE_URL)
    yield
    sched_module.shutdown()


app = FastAPI(title="Server Inventory API", version="1.0.0", docs_url="/docs", lifespan=lifespan)

from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from .limiter import limiter

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: StarletteRequest, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response

app.add_middleware(SecurityHeadersMiddleware)

_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://localhost:3001,http://127.0.0.1:3001")
_cors_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(servers.router)
app.include_router(credentials.router)
app.include_router(sync.router)
app.include_router(ssh_credentials_router)
app.include_router(stats_router)
app.include_router(settings_router)
app.include_router(crons_router)
app.include_router(databases_router)
app.include_router(kubernetes_router)
app.include_router(resource_map_router)
app.include_router(block_storages_router)
app.include_router(domains_router)
app.include_router(mfa_router)
app.include_router(iam_router)
app.include_router(event_logs_router)
app.include_router(server_groups_router)
app.include_router(discovery_router)
app.include_router(branding_router)


def _apply_db_optimizations() -> None:
    """
    Idempotent: enable pg_trgm and create GIN trigram indexes for ILIKE search.
    Uses AUTOCOMMIT because CREATE INDEX CONCURRENTLY cannot run inside a transaction.

    Composite and partial indexes that can be expressed in SQLAlchemy Index()
    are declared in models.py and created by Base.metadata.create_all() above.
    Only trigram GIN indexes (which require the pg_trgm extension to exist first)
    are handled here at startup time.
    """
    from sqlalchemy import text
    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))

        # ── servers ────────────────────────────────────────────────────────
        # Trigram indexes for ILIKE search on name / IPs / hostname
        conn.execute(text(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_servers_name_trgm "
            "ON servers USING GIN (name gin_trgm_ops)"
        ))
        conn.execute(text(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_servers_public_ip_trgm "
            "ON servers USING GIN (public_ip gin_trgm_ops)"
        ))
        conn.execute(text(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_servers_private_ip_trgm "
            "ON servers USING GIN (private_ip gin_trgm_ops)"
        ))
        conn.execute(text(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_servers_hostname_trgm "
            "ON servers USING GIN (hostname gin_trgm_ops)"
        ))

        # ── database_instances ─────────────────────────────────────────────
        conn.execute(text(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_db_name_trgm "
            "ON database_instances USING GIN (name gin_trgm_ops)"
        ))

        # ── kubernetes_clusters ────────────────────────────────────────────
        conn.execute(text(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_k8s_name_trgm "
            "ON kubernetes_clusters USING GIN (name gin_trgm_ops)"
        ))

        # ── block_storages ─────────────────────────────────────────────────
        conn.execute(text(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_block_name_trgm "
            "ON block_storages USING GIN (name gin_trgm_ops)"
        ))


def _cleanup_stale_syncs() -> None:
    """Mark any 'running' syncs as failed — they were orphaned by a restart."""
    from datetime import datetime, timezone
    db = SessionLocal()
    try:
        stale = db.query(models.SyncLog).filter(models.SyncLog.status == "running").all()
        for log in stale:
            log.status = "failed"
            log.error_message = "Server restarted — sync orphaned"
            log.completed_at = datetime.now(timezone.utc)
        if stale:
            db.commit()
    finally:
        db.close()


def _cleanup_stale_discovery_jobs() -> None:
    """Mark any 'running' discovery jobs as failed — orphaned by a restart."""
    from datetime import datetime, timezone
    db = SessionLocal()
    try:
        stale = db.query(models.DiscoveryJob).filter(models.DiscoveryJob.status == "running").all()
        for job in stale:
            job.status = "failed"
            job.error_message = "Server restarted — discovery orphaned"
            job.completed_at = datetime.now(timezone.utc)
        if stale:
            db.commit()
    finally:
        db.close()


def _seed_default_settings() -> None:
    DEFAULTS = {
        "sync_timeout":       "300",
        "ssh_default_port":   "22",
        "appearance_compact": "false",
    }
    db = SessionLocal()
    try:
        for key, value in DEFAULTS.items():
            if not db.query(models.AppSetting).filter(models.AppSetting.key == key).first():
                db.add(models.AppSetting(key=key, value=value))
        db.commit()
    finally:
        db.close()


def _seed_admin_group() -> None:
    """Create the default 'Administrators' group with all permissions if it doesn't exist."""
    from .permissions import FEATURES, FEATURE_ACTIONS
    from sqlalchemy.exc import IntegrityError
    db = SessionLocal()
    try:
        if not db.query(models.Group).filter(models.Group.name == "Administrators").first():
            all_perms = {f: list(FEATURE_ACTIONS[f]) for f in FEATURES}
            db.add(models.Group(
                name="Administrators",
                description="Full access to all features and actions.",
                permissions=all_perms,
                is_super_admin=True,
            ))
            db.commit()
    except IntegrityError:
        db.rollback()  # another worker beat us to it — that's fine
    finally:
        db.close()


def _seed_default_server_groups() -> None:
    """Seed example custom server groups once. Deleted ones are never recreated."""
    from sqlalchemy.exc import IntegrityError
    DEFAULTS = ["DB-group", "Auth-group", "Webservers", "SMTP servers"]
    db = SessionLocal()
    try:
        has_custom = db.query(models.ServerGroup.id).filter_by(is_auto=False).first()
        if has_custom is None:
            for n in DEFAULTS:
                db.add(models.ServerGroup(name=n, is_auto=False))
            db.commit()
    except IntegrityError:
        db.rollback()
    finally:
        db.close()


_DEFAULT_ADMIN_PASSWORDS = {"Admin@1234", "admin123", "admin", "password", "changeme"}


def _seed_admin() -> None:
    from .auth import hash_password

    auto_seed_admin = os.getenv("AUTO_SEED_ADMIN", "").strip().lower() in {"1", "true", "yes", "on"}
    if not auto_seed_admin:
        return

    admin_username = os.getenv("ADMIN_USERNAME", "admin")
    admin_password = os.getenv("ADMIN_PASSWORD", "")

    if admin_password in _DEFAULT_ADMIN_PASSWORDS and _is_production():
        admin_password = ""

    db = SessionLocal()
    try:
        has_admin = db.query(models.User.id).filter(models.User.role == "admin").first() is not None
        if has_admin or not admin_password:
            return
        existing = db.query(models.User).filter(models.User.username == admin_username).first()
        if not existing:
            db.add(models.User(
                username=admin_username,
                hashed_password=hash_password(admin_password),
                role="admin",
                is_active=True,
            ))
            db.commit()
    finally:
        db.close()


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket, token: str | None = Query(None)) -> None:
    origin = ws.headers.get("origin", "")
    if origin and origin not in _cors_origins:
        await ws.close(code=4003)
        return
    await ws.accept()

    # If token not in URL, expect {"type":"auth","token":"<jwt>"} as first message
    if not token:
        try:
            raw = await asyncio.wait_for(ws.receive_text(), timeout=10.0)
            data = json.loads(raw)
            token = data.get("token") if isinstance(data, dict) else None
        except (asyncio.TimeoutError, json.JSONDecodeError, Exception):
            await ws.close(code=4001)
            return

    username: str = ""
    token_exp: float = float("inf")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        username = payload.get("sub", "")
        token_exp = float(payload.get("exp", float("inf")))
    except JWTError:
        pass

    if not username:
        await ws.close(code=4001)
        return

    db_check = SessionLocal()
    try:
        ws_user = db_check.query(models.User).filter(models.User.username == username).first()
        if not ws_user or not ws_user.is_active:
            await ws.close(code=4001)
            return
    finally:
        db_check.close()

    await manager.connect(ws, username=username, token_exp=token_exp)

    # On connect: send any currently running syncs so the client can recover state
    db = SessionLocal()
    try:
        running = (
            db.query(models.SyncLog)
            .filter(models.SyncLog.status == "running")
            .all()
        )
        await ws.send_json({
            "type": "active_syncs",
            "syncs": [
                {
                    "log_id": l.id,
                    "provider": l.provider,
                    "status": l.status,
                    "started_at": l.started_at.isoformat() if l.started_at else None,
                }
                for l in running
            ],
        })
    finally:
        db.close()

    try:
        while True:
            data = await ws.receive_text()

            # ── Rate limiting ────────────────────────────────────────────────
            if manager.is_rate_limited(ws):
                # Drop the message silently; client will self-regulate via backoff
                continue

            # ── Application-level ping/pong ──────────────────────────────────
            if data == "ping":
                await ws.send_text("pong")
            elif data == "pong":
                # Reply to a server-initiated ping — reset the dead-connection timer
                manager.record_pong(ws)
            # Unknown / malformed text messages are silently dropped; structured
            # messages arrive as JSON via broadcast() from the backend, not from
            # the client, so there is no JSON parse step needed here.

    except WebSocketDisconnect:
        manager.disconnect(ws)
    except Exception:  # noqa: BLE001 — catch-all to ensure cleanup on transport errors
        manager.disconnect(ws)


@app.get("/health")
def health() -> dict[str, str]:
    """Liveness probe — returns HTTP 200 with status ok."""
    return {"status": "ok"}
