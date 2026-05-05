from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime


class ServerBase(BaseModel):
    name: str
    provider: str
    region: Optional[str] = None
    zone: Optional[str] = None
    instance_type: Optional[str] = None
    status: str = "unknown"
    public_ip: Optional[str] = None
    private_ip: Optional[str] = None
    vcpu: Optional[int] = None
    memory_gb: Optional[float] = None
    storage_gb: Optional[float] = None
    os: Optional[str] = None
    tags: Dict[str, Any] = {}
    extra: Dict[str, Any] = {}
    datacenter: Optional[str] = None
    hostname: Optional[str] = None
    notes: Optional[str] = None


class ServerCreate(ServerBase):
    pass


class ServerUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    public_ip: Optional[str] = None
    private_ip: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[Dict[str, Any]] = None
    instance_type: Optional[str] = None
    vcpu: Optional[int] = None
    memory_gb: Optional[float] = None
    storage_gb: Optional[float] = None
    os: Optional[str] = None


class ServerResponse(ServerBase):
    id: int
    cloud_id: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    last_synced: Optional[datetime] = None
    ssh_info: Optional[Dict[str, Any]] = None

    model_config = {"from_attributes": True}


class CredentialCreate(BaseModel):
    name: str
    provider: str
    config: Dict[str, Any]


class CredentialResponse(BaseModel):
    id: int
    name: str
    provider: str
    is_active: bool
    config: Dict[str, Any] = {}
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class SyncLogResponse(BaseModel):
    id: int
    provider: Optional[str] = None
    status: str
    servers_added: int
    servers_updated: int
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "read"  # read | write


class UserResponse(BaseModel):
    id: int
    username: str
    role: str
    is_active: bool
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    role: str
    username: str


class StatsResponse(BaseModel):
    total: int
    running: int
    stopped: int
    by_provider: Dict[str, int]
    by_region: Dict[str, int]
    by_status: Dict[str, int]


class SSHCredentialCreate(BaseModel):
    name: str
    username: str
    auth_method: str = "password"
    password: Optional[str] = None
    private_key: Optional[str] = None
    port: int = 22
    is_default: bool = False
    notes: Optional[str] = None


class SSHCredentialResponse(BaseModel):
    id: int
    name: str
    username: str
    auth_method: str
    password: Optional[str] = None   # masked in endpoint
    private_key: Optional[str] = None  # masked in endpoint
    port: int
    is_default: bool
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class SSHCredentialUpdate(BaseModel):
    name: Optional[str] = None
    username: Optional[str] = None
    auth_method: Optional[str] = None
    password: Optional[str] = None
    private_key: Optional[str] = None
    port: Optional[int] = None
    is_default: Optional[bool] = None
    notes: Optional[str] = None


class ServerSnapshotResponse(BaseModel):
    id: Optional[int] = None
    date: str
    total: int
    running: int
    stopped: int
    by_provider: Dict[str, int] = {}
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class AppSettingResponse(BaseModel):
    key: str
    value: Optional[str] = None

    model_config = {"from_attributes": True}


class SettingUpdate(BaseModel):
    value: str


class CronJobCreate(BaseModel):
    name: str
    cron_expr: str
    provider: Optional[str] = None
    is_active: bool = True


class CronJobUpdate(BaseModel):
    name: Optional[str] = None
    cron_expr: Optional[str] = None
    provider: Optional[str] = None
    is_active: Optional[bool] = None


class CronJobResponse(BaseModel):
    id: int
    name: str
    cron_expr: str
    provider: Optional[str] = None
    is_active: bool
    last_run_at: Optional[datetime] = None
    last_run_status: Optional[str] = None
    next_run_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
