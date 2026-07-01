from sqlalchemy import Column, Integer, String, DateTime, Boolean, Float, Text, Index, Table, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from .database import Base


def _empty_json_dict() -> dict:
    return {}


# ─── IAM association table ─────────────────────────────────────────────────────
user_groups = Table(
    "user_groups",
    Base.metadata,
    Column("user_id",  Integer, ForeignKey("users.id",  ondelete="CASCADE"), primary_key=True),
    Column("group_id", Integer, ForeignKey("groups.id", ondelete="CASCADE"), primary_key=True),
)


class Server(Base):
    __tablename__ = "servers"

    id            = Column(Integer, primary_key=True)
    cloud_id      = Column(String(128), nullable=True)
    name          = Column(String(255), nullable=False)
    provider      = Column(String(64),  nullable=False)
    region        = Column(String(128), nullable=True)
    zone          = Column(String(128), nullable=True)
    instance_type = Column(String(128), nullable=True)
    status        = Column(String(32),  default="unknown")
    public_ip     = Column(String(45),  nullable=True)   # 45 covers IPv6
    private_ip    = Column(String(45),  nullable=True)
    vcpu          = Column(Integer,     nullable=True)
    memory_gb     = Column(Float,       nullable=True)
    storage_gb    = Column(Float,       nullable=True)
    os            = Column(String(255), nullable=True)
    tags          = Column(JSONB,       default=_empty_json_dict)
    extra         = Column(JSONB,       default=_empty_json_dict)
    datacenter    = Column(String(128), nullable=True)
    hostname      = Column(String(255), nullable=True)
    notes         = Column(Text,        nullable=True)
    ssh_info      = Column(JSONB,       nullable=True)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    updated_at    = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    last_synced   = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        # Most common query: list by provider (filter/group)
        Index("ix_servers_provider", "provider"),
        # Composite index: provider + status covers the most frequent filtered list query
        Index("ix_servers_provider_status", "provider", "status"),
        # Filter by status (running/stopped counts) — kept for status-only filters
        Index("ix_servers_status", "status"),
        # Partial index: fast "running" server count used by stats and dashboard
        Index(
            "ix_servers_status_running",
            "status",
            postgresql_where="status = 'running'",
        ),
        # Lookup existing server during sync (cloud_id + provider)
        Index("ix_servers_cloud_id_provider", "cloud_id", "provider"),
        # Full-text-style search on name (B-tree for equality; GIN trigram added in _apply_db_optimizations)
        Index("ix_servers_name", "name"),
        # GIN index for JSONB containment queries on tags (e.g. tags @> '{"env":"prod"}')
        Index("ix_servers_tags_gin", "tags", postgresql_using="gin"),
        # Region filter/group-by (stats endpoint groups by region)
        Index("ix_servers_region", "region"),
    )


class Credential(Base):
    __tablename__ = "credentials"

    id         = Column(Integer, primary_key=True)
    name       = Column(String(255), nullable=False)
    provider   = Column(String(64),  nullable=False)
    is_active  = Column(Boolean,     default=True)
    config     = Column(JSONB,       nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        # Composite covers both provider-filtered and active-only sync queries
        Index("ix_credentials_provider_active", "provider", "is_active"),
        # Partial index: sync always filters is_active = true — eliminates dead rows from scan
        Index(
            "ix_credentials_active",
            "is_active",
            postgresql_where="is_active = true",
        ),
    )


class Group(Base):
    __tablename__ = "groups"

    id          = Column(Integer, primary_key=True)
    name        = Column(String(64), unique=True, nullable=False)
    description = Column(String(255), nullable=True)
    permissions = Column(JSONB, default=_empty_json_dict, nullable=False, server_default="{}")
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    members     = relationship("User", secondary="user_groups", back_populates="groups")

    __table_args__ = (
        Index("ix_groups_name", "name", unique=True),
    )


class User(Base):
    __tablename__ = "users"

    id              = Column(Integer, primary_key=True)
    username        = Column(String(128), unique=True, nullable=False)
    full_name       = Column(String(256), nullable=True)
    hashed_password = Column(String(255), nullable=False)
    role            = Column(String(16),  default="read", nullable=False)
    is_active       = Column(Boolean,     default=True)
    totp_secret     = Column(String(64),  nullable=True)
    totp_enabled    = Column(Boolean,     default=False)
    # Direct per-user permission overlay (additive on top of role baseline + groups)
    permissions     = Column(JSONB, default=_empty_json_dict, nullable=False, server_default="{}")
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    groups          = relationship("Group", secondary="user_groups", back_populates="members")

    __table_args__ = (
        Index("ix_users_username", "username", unique=True),
    )


class SyncLog(Base):
    __tablename__ = "sync_logs"

    id              = Column(Integer, primary_key=True)
    provider        = Column(String(64), nullable=True)
    status          = Column(String(16), nullable=False)
    servers_added   = Column(Integer,    default=0)
    servers_updated = Column(Integer,    default=0)
    error_message   = Column(Text,       nullable=True)
    started_at      = Column(DateTime(timezone=True), server_default=func.now())
    completed_at    = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        # Most common: list recent logs (desc sort) + filter by running
        Index("ix_sync_logs_started_at", "started_at"),
        Index("ix_sync_logs_status",     "status"),
        # Partial index: startup cleanup and WS handler both query status = 'running'
        # This is a tiny, high-selectivity subset — partial index is ideal
        Index(
            "ix_sync_logs_status_running",
            "status",
            postgresql_where="status = 'running'",
        ),
    )


class SSHCredential(Base):
    __tablename__ = "ssh_credentials"

    id          = Column(Integer, primary_key=True)
    name        = Column(String(255), nullable=False)
    username    = Column(String(128), nullable=False)
    auth_method = Column(String(16),  default="password")
    password    = Column(String(512), nullable=True)
    private_key = Column(Text,        nullable=True)
    port        = Column(Integer,     default=22)
    is_default  = Column(Boolean,     default=False)
    notes              = Column(Text,        nullable=True)
    proxy_host         = Column(String(255), nullable=True)
    proxy_port         = Column(Integer,     default=22)
    proxy_username     = Column(String(128), nullable=True)
    proxy_auth_method  = Column(String(16),  default="password")
    proxy_password     = Column(String(512), nullable=True)
    proxy_private_key  = Column(Text,        nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        # Partial index: only the one row where is_default = true matters for lookup
        Index(
            "ix_ssh_credentials_is_default",
            "is_default",
            postgresql_where="is_default = true",
        ),
    )


class ServerSnapshot(Base):
    __tablename__ = "server_snapshots"

    id          = Column(Integer, primary_key=True)
    date        = Column(String(10), unique=True, nullable=False)  # YYYY-MM-DD
    total       = Column(Integer, default=0)
    running     = Column(Integer, default=0)
    stopped     = Column(Integer, default=0)
    by_provider = Column(JSONB, default=_empty_json_dict)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        # History queries always sort by date; unique also enforces upsert safety
        Index("ix_server_snapshots_date", "date", unique=True),
    )


class AppSetting(Base):
    __tablename__ = "app_settings"

    id         = Column(Integer, primary_key=True)
    key        = Column(String(128), unique=True, nullable=False)
    value      = Column(Text, nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_app_settings_key", "key", unique=True),
    )


class CronJob(Base):
    __tablename__ = "cron_jobs"

    id              = Column(Integer, primary_key=True)
    name            = Column(String(255), nullable=False)
    cron_expr       = Column(String(64),  nullable=False)
    provider        = Column(String(64),  nullable=True)
    is_active       = Column(Boolean,     default=True)
    last_run_at     = Column(DateTime(timezone=True), nullable=True)
    last_run_status = Column(String(16),  nullable=True)
    next_run_at     = Column(DateTime(timezone=True), nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        # Partial index: scheduler only reads active jobs; reduces index size and scan cost
        Index(
            "ix_cron_jobs_is_active",
            "is_active",
            postgresql_where="is_active = true",
        ),
        # next_run_at index: scheduler queries upcoming jobs ordered by next execution time
        Index("ix_cron_jobs_next_run_at", "next_run_at"),
    )


class DatabaseInstance(Base):
    __tablename__ = "database_instances"

    id             = Column(Integer, primary_key=True)
    cloud_id       = Column(String(255), nullable=True)
    name           = Column(String(255), nullable=False)
    provider       = Column(String(64),  nullable=False)
    region         = Column(String(128), nullable=True)
    engine         = Column(String(64),  nullable=True)   # postgres, mysql, redis, mongodb
    engine_version = Column(String(32),  nullable=True)
    status         = Column(String(32),  default="unknown")
    endpoint       = Column(String(255), nullable=True)   # hostname
    port           = Column(Integer,     nullable=True)
    storage_gb     = Column(Float,       nullable=True)
    instance_type  = Column(String(128), nullable=True)
    tags           = Column(JSONB, default=_empty_json_dict)
    extra          = Column(JSONB, default=_empty_json_dict)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())
    updated_at     = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    last_synced    = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_db_provider", "provider"),
        # Composite: provider + status covers filtered list queries
        Index("ix_db_provider_status", "provider", "status"),
        Index("ix_db_status", "status"),
        Index("ix_db_cloud_id_provider", "cloud_id", "provider"),
        # GIN for tag containment queries
        Index("ix_db_tags_gin", "tags", postgresql_using="gin"),
    )


class KubernetesCluster(Base):
    __tablename__ = "kubernetes_clusters"

    id          = Column(Integer, primary_key=True)
    cloud_id    = Column(String(255), nullable=True)
    name        = Column(String(255), nullable=False)
    provider    = Column(String(64),  nullable=False)
    region      = Column(String(128), nullable=True)
    version     = Column(String(32),  nullable=True)     # k8s version e.g. 1.29
    status      = Column(String(32),  default="unknown")
    node_count  = Column(Integer,     nullable=True)
    endpoint    = Column(String(255), nullable=True)
    tags        = Column(JSONB, default=_empty_json_dict)
    extra       = Column(JSONB, default=_empty_json_dict)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    last_synced = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_k8s_provider", "provider"),
        # Composite: provider + status covers filtered list queries
        Index("ix_k8s_provider_status", "provider", "status"),
        Index("ix_k8s_status", "status"),
        Index("ix_k8s_cloud_id_provider", "cloud_id", "provider"),
        # GIN for tag containment queries
        Index("ix_k8s_tags_gin", "tags", postgresql_using="gin"),
    )


class BlockStorage(Base):
    __tablename__ = "block_storages"

    id          = Column(Integer, primary_key=True)
    cloud_id    = Column(String(255), nullable=True)
    name        = Column(String(255), nullable=False)
    provider    = Column(String(64),  nullable=False)
    region      = Column(String(128), nullable=True)
    size_gb     = Column(Float,       nullable=True)
    status      = Column(String(32),  default="unknown")
    attachment  = Column(String(255), nullable=True)
    volume_type = Column(String(64),  nullable=True)
    tags        = Column(JSONB, default=_empty_json_dict)
    extra       = Column(JSONB, default=_empty_json_dict)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    last_synced = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_block_provider", "provider"),
        # Composite: provider + status covers filtered list queries
        Index("ix_block_provider_status", "provider", "status"),
        Index("ix_block_status", "status"),
        Index("ix_block_cloud_id_provider", "cloud_id", "provider"),
        # GIN for tag containment queries
        Index("ix_block_tags_gin", "tags", postgresql_using="gin"),
    )


class EventLog(Base):
    __tablename__ = "event_logs"

    id          = Column(Integer, primary_key=True)
    timestamp   = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    severity    = Column(String(16),  nullable=False, default="info")   # info | warning | error | critical
    source      = Column(String(128), nullable=True)                    # nginx, postgres, kubelet…
    resource    = Column(String(255), nullable=True)                    # server/db name
    event       = Column(Text,        nullable=False)
    status      = Column(String(32),  nullable=False, default="open")   # open | acknowledged | investigating | resolved
    owner       = Column(String(128), nullable=True)
    message     = Column(Text,        nullable=True)
    tags        = Column(JSONB, default=_empty_json_dict)
    extra       = Column(JSONB, default=_empty_json_dict)

    __table_args__ = (
        Index("ix_evlog_timestamp", "timestamp"),
        Index("ix_evlog_severity",  "severity"),
        Index("ix_evlog_status",    "status"),
        Index("ix_evlog_source",    "source"),
        Index("ix_evlog_resource",  "resource"),
    )

