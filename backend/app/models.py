from sqlalchemy import Column, Integer, String, DateTime, JSON, Boolean, Float, Text, Index
from sqlalchemy.sql import func
from .database import Base


def _empty_json_dict() -> dict:
    return {}


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
    tags          = Column(JSON,        default=_empty_json_dict)
    extra         = Column(JSON,        default=_empty_json_dict)
    datacenter    = Column(String(128), nullable=True)
    hostname      = Column(String(255), nullable=True)
    notes         = Column(Text,        nullable=True)
    ssh_info      = Column(JSON,        nullable=True)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    updated_at    = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    last_synced   = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        # Most common query: list by provider (filter/group)
        Index("ix_servers_provider", "provider"),
        # Filter by status (running/stopped counts)
        Index("ix_servers_status", "status"),
        # Lookup existing server during sync (cloud_id + provider)
        Index("ix_servers_cloud_id_provider", "cloud_id", "provider"),
        # Full-text-style search on name
        Index("ix_servers_name", "name"),
    )


class Credential(Base):
    __tablename__ = "credentials"

    id         = Column(Integer, primary_key=True)
    name       = Column(String(255), nullable=False)
    provider   = Column(String(64),  nullable=False)
    is_active  = Column(Boolean,     default=True)
    config     = Column(JSON,        nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_credentials_provider_active", "provider", "is_active"),
    )


class User(Base):
    __tablename__ = "users"

    id              = Column(Integer, primary_key=True)
    username        = Column(String(128), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role            = Column(String(16),  default="read", nullable=False)
    is_active       = Column(Boolean,     default=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

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
    notes       = Column(Text,        nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        # Fast lookup of default credential
        Index("ix_ssh_credentials_is_default", "is_default"),
    )


class ServerSnapshot(Base):
    __tablename__ = "server_snapshots"

    id          = Column(Integer, primary_key=True)
    date        = Column(String(10), unique=True, nullable=False)  # YYYY-MM-DD
    total       = Column(Integer, default=0)
    running     = Column(Integer, default=0)
    stopped     = Column(Integer, default=0)
    by_provider = Column(JSON, default=_empty_json_dict)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        # History queries always sort by date
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
        Index("ix_cron_jobs_is_active", "is_active"),
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
    tags           = Column(JSON, default=_empty_json_dict)
    extra          = Column(JSON, default=_empty_json_dict)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())
    updated_at     = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    last_synced    = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_db_provider", "provider"),
        Index("ix_db_status", "status"),
        Index("ix_db_cloud_id_provider", "cloud_id", "provider"),
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
    tags        = Column(JSON, default=_empty_json_dict)
    extra       = Column(JSON, default=_empty_json_dict)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    last_synced = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_k8s_provider", "provider"),
        Index("ix_k8s_status", "status"),
        Index("ix_k8s_cloud_id_provider", "cloud_id", "provider"),
    )
