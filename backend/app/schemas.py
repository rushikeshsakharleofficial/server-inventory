from pydantic import BaseModel, Field
from typing import Any, Literal
from datetime import datetime


class ServerBase(BaseModel):
    name: str
    provider: str
    region: str | None = None
    zone: str | None = None
    instance_type: str | None = None
    status: str = "unknown"
    public_ip: str | None = None
    private_ip: str | None = None
    vcpu: int | None = None
    memory_gb: float | None = None
    storage_gb: float | None = None
    os: str | None = None
    tags: dict[str, Any] = Field(default_factory=dict)
    extra: dict[str, Any] = Field(default_factory=dict)
    datacenter: str | None = None
    hostname: str | None = None
    notes: str | None = None


class ServerCreate(ServerBase):
    pass


class ServerUpdate(BaseModel):
    name: str | None = None
    status: str | None = None
    public_ip: str | None = None
    private_ip: str | None = None
    hostname: str | None = None
    datacenter: str | None = None
    notes: str | None = None
    tags: dict[str, Any] | None = None
    instance_type: str | None = None
    vcpu: int | None = None
    memory_gb: float | None = None
    storage_gb: float | None = None
    os: str | None = None


class ServerResponse(ServerBase):
    id: int
    cloud_id: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    last_synced: datetime | None = None
    ssh_info: dict[str, Any] | None = None

    model_config = {"from_attributes": True}


class CredentialCreate(BaseModel):
    name: str
    provider: str
    config: dict[str, Any]


class CredentialResponse(BaseModel):
    id: int
    name: str
    provider: str
    is_active: bool
    config: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class SyncLogResponse(BaseModel):
    id: int
    provider: str | None = None
    status: str
    servers_added: int
    servers_updated: int
    error_message: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None

    model_config = {"from_attributes": True}


class UserCreate(BaseModel):
    username: str
    password: str = Field(min_length=10)
    role: Literal["read", "write"] = "read"


class UserResponse(BaseModel):
    id: int
    username: str
    role: str
    is_active: bool
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    role: str
    username: str


class LoginResponse(BaseModel):
    """Login endpoint response — covers both plain auth and MFA challenge."""
    # Normal auth (MFA disabled or already verified)
    access_token: str | None = None
    token_type: str = "bearer"
    role: str | None = None
    username: str | None = None
    # MFA challenge (MFA enabled — access_token is None in this case)
    mfa_required: bool = False
    mfa_token: str | None = None


class MfaStatusResponse(BaseModel):
    enabled: bool


class MfaSetupResponse(BaseModel):
    secret: str
    uri: str    # otpauth:// URI — pass to QR renderer on frontend


class MfaEnableRequest(BaseModel):
    code: str     # current TOTP code to prove the user enrolled the server-generated secret


class MfaDisableRequest(BaseModel):
    code: str     # current TOTP code to prove possession before disabling


class MfaVerifyRequest(BaseModel):
    mfa_token: str   # the short-lived challenge token from the login step
    code: str        # 6-digit TOTP code


class StatsResponse(BaseModel):
    total: int
    running: int
    stopped: int
    by_provider: dict[str, int]
    by_region: dict[str, int]
    by_status: dict[str, int]


class SSHCredentialCreate(BaseModel):
    name: str
    username: str
    auth_method: str = "password"
    password: str | None = None
    private_key: str | None = None
    port: int = 22
    is_default: bool = False
    notes: str | None = None
    proxy_host:        str | None = None
    proxy_port:        int = 22
    proxy_username:    str | None = None
    proxy_auth_method: str = "password"
    proxy_password:    str | None = None
    proxy_private_key: str | None = None


class SSHCredentialResponse(BaseModel):
    id: int
    name: str
    username: str
    auth_method: str
    password: str | None = None   # masked in endpoint
    private_key: str | None = None  # masked in endpoint
    port: int
    is_default: bool
    notes: str | None = None
    proxy_host:        str | None = None
    proxy_port:        int = 22
    proxy_username:    str | None = None
    proxy_auth_method: str = "password"
    proxy_password:    str | None = None   # masked in endpoint
    proxy_private_key: str | None = None   # masked in endpoint
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class SSHCredentialUpdate(BaseModel):
    name: str | None = None
    username: str | None = None
    auth_method: str | None = None
    password: str | None = None
    private_key: str | None = None
    port: int | None = None
    is_default: bool | None = None
    notes: str | None = None
    proxy_host:        str | None = None
    proxy_port:        int | None = None
    proxy_username:    str | None = None
    proxy_auth_method: str | None = None
    proxy_password:    str | None = None
    proxy_private_key: str | None = None


class ServerSnapshotResponse(BaseModel):
    id: int | None = None
    date: str
    total: int
    running: int
    stopped: int
    by_provider: dict[str, int] = Field(default_factory=dict)
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class AppSettingResponse(BaseModel):
    key: str
    value: str | None = None

    model_config = {"from_attributes": True}


class SettingUpdate(BaseModel):
    value: str


class CronJobCreate(BaseModel):
    name: str
    cron_expr: str
    provider: str | None = None
    is_active: bool = True


class CronJobUpdate(BaseModel):
    name: str | None = None
    cron_expr: str | None = None
    provider: str | None = None
    is_active: bool | None = None


class CronJobResponse(BaseModel):
    id: int
    name: str
    cron_expr: str
    provider: str | None = None
    is_active: bool
    last_run_at: datetime | None = None
    last_run_status: str | None = None
    next_run_at: datetime | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class DatabaseInstanceResponse(BaseModel):
    id: int
    cloud_id: str | None = None
    name: str
    provider: str
    region: str | None = None
    engine: str | None = None
    engine_version: str | None = None
    status: str
    endpoint: str | None = None
    port: int | None = None
    storage_gb: float | None = None
    instance_type: str | None = None
    tags: dict[str, Any] = Field(default_factory=dict)
    extra: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime | None = None
    last_synced: datetime | None = None

    model_config = {"from_attributes": True}


class KubernetesClusterResponse(BaseModel):
    id: int
    cloud_id: str | None = None
    name: str
    provider: str
    region: str | None = None
    version: str | None = None
    status: str
    node_count: int | None = None
    endpoint: str | None = None
    tags: dict[str, Any] = Field(default_factory=dict)
    extra: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime | None = None
    last_synced: datetime | None = None

    model_config = {"from_attributes": True}


class BlockStorageResponse(BaseModel):
    id: int
    cloud_id: str | None = None
    name: str
    provider: str
    region: str | None = None
    size_gb: float | None = None
    status: str
    attachment: str | None = None
    volume_type: str | None = None
    tags: dict[str, Any] = Field(default_factory=dict)
    extra: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime | None = None
    last_synced: datetime | None = None

    model_config = {"from_attributes": True}


class HostKeyTrustResponse(BaseModel):
    fingerprint: str
    key_type: str
    added: bool
    message: str = "Host key added to trusted hosts"
