import os
from collections.abc import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase, Session
from dotenv import load_dotenv

from .config import _is_production

load_dotenv()

_DEV_DB_USER = "inventory"
_DEV_DB_NAME = "server_inventory"

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    if _is_production():
        raise RuntimeError("DATABASE_URL must be set in production")
    DATABASE_URL = (
        f"postgresql://{_DEV_DB_USER}:{_DEV_DB_USER}@localhost:5432/{_DEV_DB_NAME}"
    )

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    pool_recycle=1800,   # recycle connections after 30 min to avoid stale idle connections
    pool_timeout=30,     # raise after 30 s waiting for a connection instead of blocking forever
    # Set a server-side statement timeout to prevent runaway queries from holding connections.
    # Sync workers only; background sync jobs use their own engine without this limit.
    connect_args={"options": "-c statement_timeout=30000"},  # 30 s
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    """Yield a SQLAlchemy database session, closing it on exit."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
