export type Provider = 'aws' | 'gcp' | 'azure' | 'linode' | 'digitalocean' | 'ovh' | 'custom_dc'
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
  created_at?: string
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

export type View = 'dashboard' | 'servers' | 'providers' | 'sync-logs' | 'ssh' | 'crons' | 'settings'
