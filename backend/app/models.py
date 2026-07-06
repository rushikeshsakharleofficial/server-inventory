from sqlalchemy import Column, Integer, String, DateTime, Boolean, Float, Text, Index, Table, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from .database import Base


def _empty_json_dict() -> dict:
    return {}


_ON_DELETE_SET_NULL = "SET NULL"
_STATUS_RUNNING_FILTER = "status = 'running'"
_SERVERS_ID_FK = "servers.id"


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
    ssh_info          = Column(JSONB,    nullable=True)
    ssh_credential_id = Column(Integer,  ForeignKey("ssh_credentials.id", ondelete=_ON_DELETE_SET_NULL), nullable=True)
    ssh_group         = Column(String(128), nullable=True)
    # On-prem discovery identity signals — added via _migrate_discovery_server_columns
    # since `servers` is a pre-existing table. NOT unique: cloned VMs/images can
    # legitimately share a machine-id/product_uuid; discovery_service.resolve_server
    # falls through to the next-priority signal when a query returns >1 match.
    machine_id        = Column(String(64),  nullable=True)   # /etc/machine-id
    product_uuid      = Column(String(64),  nullable=True)   # /sys/class/dmi/id/product_uuid
    ssh_host_key_fp   = Column(String(128), nullable=True)   # sha256 SSH host key fingerprint
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    updated_at    = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    last_synced   = Column(DateTime(timezone=True), nullable=True)

    ssh_credential = relationship("SSHCredential", foreign_keys=[ssh_credential_id])

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
            postgresql_where=_STATUS_RUNNING_FILTER,
        ),
        # Lookup existing server during sync (cloud_id + provider)
        Index("ix_servers_cloud_id_provider", "cloud_id", "provider"),
        # Full-text-style search on name (B-tree for equality; GIN trigram added in _apply_db_optimizations)
        Index("ix_servers_name", "name"),
        # GIN index for JSONB containment queries on tags (e.g. tags @> '{"env":"prod"}')
        Index("ix_servers_tags_gin", "tags", postgresql_using="gin"),
        # Region filter/group-by (stats endpoint groups by region)
        Index("ix_servers_region", "region"),
        # Discovery identity lookups — resolve_server queries these directly
        Index("ix_servers_machine_id", "machine_id"),
        Index("ix_servers_product_uuid", "product_uuid"),
        Index("ix_servers_ssh_host_key_fp", "ssh_host_key_fp"),
    )


class Credential(Base):
    __tablename__ = "credentials"

    id         = Column(Integer, primary_key=True)
    name       = Column(String(255), nullable=False)
    provider   = Column(String(64),  nullable=False)
    is_active  = Column(Boolean,     default=True)
    cred_type  = Column(String(16),  nullable=False, server_default="login")
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

    id             = Column(Integer, primary_key=True)
    name           = Column(String(64), unique=True, nullable=False)
    description    = Column(String(255), nullable=True)
    permissions    = Column(JSONB, default=_empty_json_dict, nullable=False, server_default="{}")
    is_super_admin = Column(Boolean, nullable=False, default=False, server_default="false")
    created_at     = Column(DateTime(timezone=True), server_default=func.now())

    members     = relationship("User", secondary="user_groups", back_populates="groups")

    __table_args__ = (
        Index("ix_groups_name", "name", unique=True),
    )


server_group_members = Table(
    "server_group_members",
    Base.metadata,
    Column("server_id",       Integer, ForeignKey(_SERVERS_ID_FK,       ondelete="CASCADE"), primary_key=True),
    Column("server_group_id", Integer, ForeignKey("server_groups.id", ondelete="CASCADE"), primary_key=True),
)


class ServerGroup(Base):
    __tablename__ = "server_groups"

    id          = Column(Integer, primary_key=True)
    name        = Column(String(64), unique=True, nullable=False)
    description = Column(String(255), nullable=True)
    is_auto     = Column(Boolean, nullable=False, server_default="false")  # true = provider auto-group
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    members = relationship("Server", secondary="server_group_members")

    __table_args__ = (Index("ix_server_groups_name", "name", unique=True),)


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
            postgresql_where=_STATUS_RUNNING_FILTER,
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


class DnsRecord(Base):
    __tablename__ = "dns_records"

    id          = Column(Integer, primary_key=True)
    cloud_id    = Column(String(255), nullable=True)   # Cloudflare DNS record ID
    name        = Column(String(255), nullable=False)  # record name, e.g. "www.example.com"
    provider    = Column(String(64),  nullable=False)  # "cloudflare"
    zone        = Column(String(255), nullable=True)   # domain/zone name, e.g. "example.com"
    record_type = Column(String(16),  nullable=True)   # A, CNAME, MX, TXT, ...
    content     = Column(String(1024), nullable=True)  # record value
    ttl         = Column(Integer, nullable=True)
    proxied     = Column(Boolean, nullable=True)        # Cloudflare-specific (orange-cloud)
    status      = Column(String(32),  default="unknown")
    tags        = Column(JSONB, default=_empty_json_dict)
    extra       = Column(JSONB, default=_empty_json_dict)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    last_synced = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_dns_provider", "provider"),
        Index("ix_dns_provider_zone", "provider", "zone"),
        Index("ix_dns_cloud_id_provider", "cloud_id", "provider"),
        Index("ix_dns_tags_gin", "tags", postgresql_using="gin"),
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


# ─── On-prem network discovery ──────────────────────────────────────────────────

class ServerIpAddress(Base):
    """Normalized IP alias per server, discovered via SSH scan (or cloud/manual).

    One server can have many rows here (multi-homed hosts) — this table is what
    lets discovery merge many scanned IPs into a single Server instead of creating
    one server per address. Loopback/link-local addresses are deliberately never
    stored here (see discovery_service.classify_scope) so the global unique
    constraint on `address` holds — those scopes repeat identically across every
    host and would collide.
    """
    __tablename__ = "server_ip_addresses"

    id                 = Column(Integer, primary_key=True)
    server_id          = Column(Integer, ForeignKey(_SERVERS_ID_FK, ondelete="CASCADE"), nullable=False)
    address            = Column(String(45),  nullable=False)   # IPv4 or IPv6, no prefix
    cidr               = Column(String(64),  nullable=True)    # e.g. "10.10.10.5/24"
    ip_version         = Column(Integer,     nullable=True)    # 4 or 6
    interface_name     = Column(String(64),  nullable=True)
    mac_address        = Column(String(32),  nullable=True)
    scope              = Column(String(16),  nullable=True)    # public|private|link-local|loopback
    is_primary         = Column(Boolean,      default=False)
    discovered_from_ip = Column(String(45),  nullable=True)    # which scanned IP reached this host
    source             = Column(String(32),  default="ssh_discovery")  # ssh_discovery|cloud|manual
    first_seen_at      = Column(DateTime(timezone=True), server_default=func.now())
    last_seen_at       = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    server = relationship("Server", foreign_keys=[server_id])

    __table_args__ = (
        # Global uniqueness: an address belongs to exactly one server at a time.
        # Re-discovery reassigns via ON CONFLICT DO UPDATE, not insert-fails.
        Index("uq_server_ip_addresses_address", "address", unique=True),
        Index("ix_server_ip_addresses_server_id", "server_id"),
    )


class IpRdnsCache(Base):
    """Persistent reverse-DNS cache, keyed by address. Populated during sync
    (see sync.py), not on IP Inventory page load — refreshing only when a
    server's IP data actually changes, not on a blind time-based TTL, and
    surviving backend restarts/redeploys instead of resetting every time."""
    __tablename__ = "ip_rdns_cache"

    address    = Column(String(45), primary_key=True)
    hostname   = Column(String(255), nullable=True)  # None = looked up, no PTR record
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class DiscoveryNetwork(Base):
    """A saved CIDR range + scan settings an admin can re-run discovery against."""
    __tablename__ = "discovery_networks"

    id                = Column(Integer, primary_key=True)
    name              = Column(String(255), nullable=False)
    cidr              = Column(String(64),  nullable=False)
    datacenter        = Column(String(128), nullable=True)
    environment       = Column(String(64),  nullable=True)
    ssh_credential_id = Column(Integer, ForeignKey("ssh_credentials.id", ondelete=_ON_DELETE_SET_NULL), nullable=True)
    max_parallel      = Column(Integer,  default=32)
    timeout_seconds   = Column(Integer,  default=8)
    is_active         = Column(Boolean,  default=True)
    notes             = Column(Text,     nullable=True)
    created_at        = Column(DateTime(timezone=True), server_default=func.now())
    updated_at        = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    ssh_credential = relationship("SSHCredential", foreign_keys=[ssh_credential_id])

    __table_args__ = (
        Index("ix_discovery_networks_is_active", "is_active"),
    )


class DiscoveryJob(Base):
    """One scan run — either against a saved DiscoveryNetwork or a one-time CIDR."""
    __tablename__ = "discovery_jobs"

    id                = Column(Integer, primary_key=True)
    network_id        = Column(Integer, ForeignKey("discovery_networks.id", ondelete=_ON_DELETE_SET_NULL), nullable=True)
    cidr              = Column(String(64), nullable=False)
    status            = Column(String(16), nullable=False, default="queued")  # queued|running|success|failed|stopped
    total_ips         = Column(Integer, default=0)
    scanned_ips       = Column(Integer, default=0)
    reachable_ssh     = Column(Integer, default=0)
    authenticated     = Column(Integer, default=0)
    servers_added     = Column(Integer, default=0)
    servers_updated   = Column(Integer, default=0)
    duplicates_merged = Column(Integer, default=0)
    failed            = Column(Integer, default=0)
    started_at        = Column(DateTime(timezone=True), nullable=True)
    completed_at      = Column(DateTime(timezone=True), nullable=True)
    error_message     = Column(Text, nullable=True)
    created_at        = Column(DateTime(timezone=True), server_default=func.now())

    network = relationship("DiscoveryNetwork", foreign_keys=[network_id])

    __table_args__ = (
        Index("ix_discovery_jobs_status", "status"),
        Index("ix_discovery_jobs_network_id", "network_id"),
        # Partial index: startup crash-recovery and stop endpoint both query status='running'
        Index("ix_discovery_jobs_status_running", "status", postgresql_where=_STATUS_RUNNING_FILTER),
    )


class DiscoveryResult(Base):
    """Per-IP outcome of a discovery job — the audit trail for every scanned address."""
    __tablename__ = "discovery_results"

    id            = Column(Integer, primary_key=True)
    job_id        = Column(Integer, ForeignKey("discovery_jobs.id", ondelete="CASCADE"), nullable=False)
    ip            = Column(String(45), nullable=False)
    port          = Column(Integer, default=22)
    status        = Column(String(16), nullable=False)  # skipped|closed|open|auth_failed|success|duplicate|error
    server_id     = Column(Integer, ForeignKey(_SERVERS_ID_FK, ondelete=_ON_DELETE_SET_NULL), nullable=True)
    identity_hash = Column(String(64), nullable=True)    # audit trail only, never the join key
    hostname      = Column(String(255), nullable=True)
    error_message = Column(Text, nullable=True)
    raw_summary   = Column(JSONB, default=_empty_json_dict)  # non-secret facts only — never credentials
    created_at    = Column(DateTime(timezone=True), server_default=func.now())

    job    = relationship("DiscoveryJob", foreign_keys=[job_id])
    server = relationship("Server", foreign_keys=[server_id])

    __table_args__ = (
        Index("ix_discovery_results_job_id", "job_id"),
    )


class ApiKey(Base):
    """User-created Public API key. Effective permission is always
    api_key.scopes ∩ user_effective_permissions, computed fresh at request
    time in api_key_auth.py — never cached here or anywhere else."""
    __tablename__ = "api_keys"

    id             = Column(Integer, primary_key=True)
    user_id        = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name           = Column(String(255), nullable=False)
    key_prefix     = Column(String(32),  nullable=False)   # fast, non-secret lookup key
    token_hash     = Column(String(128), nullable=False)   # HMAC-SHA256(token, API_KEY_PEPPER) — never the raw token
    # {feature: [actions]} — same shape/vocabulary as User.permissions and
    # Group.permissions (permissions.FEATURES / permissions.ACTIONS).
    scopes         = Column(JSONB, default=_empty_json_dict, nullable=False, server_default="{}")
    allowed_ips    = Column(JSONB, nullable=True)           # list[str] CIDR/IP, null = no restriction
    expires_at     = Column(DateTime(timezone=True), nullable=True)
    last_used_at   = Column(DateTime(timezone=True), nullable=True)
    last_used_ip   = Column(String(45), nullable=True)
    is_active      = Column(Boolean, default=True, nullable=False)
    revoked_at     = Column(DateTime(timezone=True), nullable=True)
    revoked_by     = Column(Integer, ForeignKey("users.id", ondelete=_ON_DELETE_SET_NULL), nullable=True)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())
    updated_at     = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    owner = relationship("User", foreign_keys=[user_id])

    __table_args__ = (
        Index("ix_api_keys_user_id", "user_id"),
        Index("ix_api_keys_key_prefix", "key_prefix"),
        Index("ix_api_keys_token_hash", "token_hash", unique=True),
        Index("ix_api_keys_is_active", "is_active"),
    )


class ApiKeyAuditLog(Base):
    """Per-request allow/deny forensic trail for Public API access — separate
    from EventLog, which covers human-facing key lifecycle events (created/
    rotated/revoked) only."""
    __tablename__ = "api_key_audit_logs"

    id            = Column(Integer, primary_key=True)
    api_key_id    = Column(Integer, ForeignKey("api_keys.id", ondelete=_ON_DELETE_SET_NULL), nullable=True)
    user_id       = Column(Integer, ForeignKey("users.id", ondelete=_ON_DELETE_SET_NULL), nullable=True)
    request_id    = Column(String(64),  nullable=True)
    method        = Column(String(8),   nullable=False)
    path          = Column(String(512), nullable=False)
    ip_address    = Column(String(45),  nullable=False)
    user_agent    = Column(String(512), nullable=True)
    status_code   = Column(Integer,     nullable=True)
    decision      = Column(String(8),   nullable=False)   # allowed|denied
    denied_reason = Column(String(64),  nullable=True)
    response_time_ms = Column(Integer, nullable=True)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())

    api_key = relationship("ApiKey", foreign_keys=[api_key_id])
    user    = relationship("User", foreign_keys=[user_id])

    __table_args__ = (
        Index("ix_api_key_audit_logs_api_key_id", "api_key_id"),
        Index("ix_api_key_audit_logs_user_id", "user_id"),
        Index("ix_api_key_audit_logs_created_at", "created_at"),
    )

