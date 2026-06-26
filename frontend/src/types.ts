export interface Page<T> { total: number; limit: number; offset: number; items: T[] }

export type Provider = 'aws' | 'gcp' | 'azure' | 'linode' | 'digitalocean' | 'ovh' | 'hivelocity' | 'custom_dc'
export type ServerStatus = 'running' | 'stopped' | 'terminated' | 'pending' | 'unknown'

export interface Server {
  id: number
  cloud_id?: string
  name: string
  provider: Provider
  region?: string
  zone?: string
  instance_type?: string
  status: ServerStatus
  public_ip?: string
  private_ip?: string
  vcpu?: number
  memory_gb?: number
  storage_gb?: number
  os?: string
  tags: Record<string, string>
  extra: Record<string, unknown>
  datacenter?: string
  hostname?: string
  notes?: string
  created_at?: string
  updated_at?: string
  last_synced?: string
  ssh_info?: Record<string, unknown>
}

export interface Credential {
  id: number
  name: string
  provider: Provider
  is_active: boolean
  config: Record<string, unknown>
  created_at?: string
}

export interface SyncLog {
  id: number
  provider?: string
  status: 'running' | 'success' | 'failed'
  servers_added: number
  servers_updated: number
  error_message?: string
  started_at?: string
  completed_at?: string
}

export interface Stats {
  total: number
  running: number
  stopped: number
  by_provider: Record<string, number>
  by_region: Record<string, number>
  by_status: Record<string, number>
}

export interface SSHCredential {
  id: number
  name: string
  username: string
  auth_method: 'password' | 'key'
  password?: string
  private_key?: string
  port: number
  is_default: boolean
  notes?: string
  proxy_host?: string
  proxy_port?: number
  proxy_username?: string
  proxy_auth_method?: string
  proxy_password?: string
  proxy_private_key?: string
  created_at?: string
  updated_at?: string
}

export interface ServerSnapshot {
  id?: number
  date: string
  total: number
  running: number
  stopped: number
  by_provider: Record<string, number>
  created_at?: string
}

export interface CronJob {
  id: number
  name: string
  cron_expr: string
  provider?: string
  is_active: boolean
  last_run_at?: string
  last_run_status?: string
  next_run_at?: string
  created_at?: string
  updated_at?: string
}

export type View = 'dashboard' | 'servers' | 'databases' | 'kubernetes' | 'block_storage' | 'ips' | 'providers' | 'sync-logs' | 'ssh' | 'crons' | 'settings' | 'users' | 'setup'

export interface DatabaseInstance {
  id: number
  cloud_id?: string
  name: string
  provider: string
  region?: string
  engine?: string
  engine_version?: string
  status: string
  endpoint?: string
  port?: number
  storage_gb?: number
  instance_type?: string
  tags: Record<string, string>
  extra: Record<string, unknown>
  created_at?: string
  last_synced?: string
}

export interface KubernetesCluster {
  id: number
  cloud_id?: string
  name: string
  provider: string
  region?: string
  version?: string
  status: string
  node_count?: number
  endpoint?: string
  tags: Record<string, string>
  extra: Record<string, unknown>
  created_at?: string
  last_synced?: string
}

export interface BlockStorage {
  id: number
  cloud_id?: string
  name: string
  provider: string
  region?: string
  size_gb?: number
  status: string
  attachment?: string
  volume_type?: string
  tags: Record<string, string>
  extra: Record<string, unknown>
  created_at?: string
  last_synced?: string
}

export interface MfaStatus {
  enabled: boolean
}

export interface MfaSetupData {
  secret: string
  uri: string
}

export interface LoginResponse {
  access_token?: string
  token_type?: string
  role?: string
  username?: string
  mfa_required?: boolean
  mfa_token?: string
}
