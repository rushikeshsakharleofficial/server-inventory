import asyncio
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from jose import jwt, JWTError
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
from .ws_manager import manager
from . import models, scheduler as sched_module
from .auth import SECRET_KEY
from .database import DATABASE_URL

Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    manager.set_loop(asyncio.get_running_loop())
    _apply_db_optimizations()
    _seed_admin()
    _cleanup_stale_syncs()
    _seed_default_settings()
    sched_module.start(DATABASE_URL)
    yield
    sched_module.shutdown()


app = FastAPI(title="Server Inventory API", version="1.0.0", docs_url="/docs", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
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


def _apply_db_optimizations() -> None:
    """
    Idempotent: enable pg_trgm and create GIN + composite indexes for
    the search and filter query patterns. Uses AUTOCOMMIT because
    CREATE INDEX CONCURRENTLY cannot run inside a transaction.
    """
    from sqlalchemy import text
    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))
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
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_servers_hostname_trgm "
            "ON servers USING GIN (hostname gin_trgm_ops)"
        ))
        # Composite index for filtered server list (provider + status)
        conn.execute(text(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_servers_provider_status "
            "ON servers (provider, status)"
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


def _seed_admin() -> None:
    from .auth import hash_password

    admin_username = os.getenv("ADMIN_USERNAME", "admin")
    admin_password = os.getenv("ADMIN_PASSWORD", "admin123")

    db = SessionLocal()
    try:
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
async def websocket_endpoint(ws: WebSocket, token: str = Query(...)) -> None:
    # Authenticate token before accepting
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        username: str = payload.get("sub", "")
        if not username:
            await ws.close(code=4001)
            return
    except JWTError:
        await ws.close(code=4001)
        return

    await manager.connect(ws)

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
                {"log_id": l.id, "provider": l.provider, "status": l.status}
                for l in running
            ],
        })
    finally:
        db.close()

    try:
        while True:
            data = await ws.receive_text()
            if data == "ping":
                await ws.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(ws)
    except Exception:
        manager.disconnect(ws)


@app.get("/health")
def health():
    return {"status": "ok"}
