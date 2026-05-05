from sqlalchemy import Column, Integer, String, DateTime, JSON, Boolean, Float, Text, Date
from sqlalchemy.sql import func
from .database import Base


class Server(Base):
    __tablename__ = "servers"

    id = Column(Integer, primary_key=True, index=True)
    cloud_id = Column(String, index=True, nullable=True)
    name = Column(String, index=True, nullable=False)
    provider = Column(String, nullable=False)
    region = Column(String, nullable=True)
    zone = Column(String, nullable=True)
    instance_type = Column(String, nullable=True)
    status = Column(String, default="unknown")
    public_ip = Column(String, nullable=True)
    private_ip = Column(String, nullable=True)
    vcpu = Column(Integer, nullable=True)
    memory_gb = Column(Float, nullable=True)
    storage_gb = Column(Float, nullable=True)
    os = Column(String, nullable=True)
    tags = Column(JSON, default=dict)
    extra = Column(JSON, default=dict)
    datacenter = Column(String, nullable=True)
    hostname = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    last_synced = Column(DateTime(timezone=True), nullable=True)
    ssh_info    = Column(JSON, nullable=True)


class Credential(Base):
    __tablename__ = "credentials"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    provider = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    config = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="read", nullable=False)  # admin | write | read
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class SyncLog(Base):
    __tablename__ = "sync_logs"

    id = Column(Integer, primary_key=True, index=True)
    provider = Column(String, nullable=True)
    status = Column(String, nullable=False)
    servers_added = Column(Integer, default=0)
    servers_updated = Column(Integer, default=0)
    error_message = Column(String, nullable=True)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)


class SSHCredential(Base):
    __tablename__ = "ssh_credentials"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    username = Column(String, nullable=False)
    auth_method = Column(String, default="password")  # password | key
    password = Column(String, nullable=True)
    private_key = Column(Text, nullable=True)
    port = Column(Integer, default=22)
    is_default = Column(Boolean, default=False)
    notes = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ServerSnapshot(Base):
    __tablename__ = "server_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(String, unique=True, index=True, nullable=False)  # ISO date string YYYY-MM-DD
    total = Column(Integer, default=0)
    running = Column(Integer, default=0)
    stopped = Column(Integer, default=0)
    by_provider = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class AppSetting(Base):
    __tablename__ = "app_settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True, nullable=False)
    value = Column(Text, nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
