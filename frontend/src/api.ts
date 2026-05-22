import axios from 'axios'
import type { Server, Credential, SyncLog, Stats, SSHCredential, ServerSnapshot, CronJob, DatabaseInstance, KubernetesCluster, BlockStorage } from './types'
import type { ResourceMap } from './components/ResourceMapModal'

export const http = axios.create({ baseURL: '' })

const _savedToken = localStorage.getItem('si_token')
if (_savedToken) {
  http.defaults.headers.common['Authorization'] = `Bearer ${_savedToken}`
}

http.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('si_token')
      localStorage.removeItem('si_user')
      window.dispatchEvent(new Event('auth:expired'))
    }
    return Promise.reject(err)
  },
)

export const serversApi = {
  list: (params?: { provider?: string; status?: string; search?: string }) =>
    http.get<Server[]>('/api/servers', { params }).then(r => r.data),

  stats: () => http.get<Stats>('/api/servers/stats').then(r => r.data),

  get: (id: number) => http.get<Server>(`/api/servers/${id}`).then(r => r.data),

  create: (data: Partial<Server>) =>
    http.post<Server>('/api/servers', data).then(r => r.data),

  update: (id: number, data: Partial<Server>) =>
    http.put<Server>(`/api/servers/${id}`, data).then(r => r.data),

  delete: (id: number) => http.delete(`/api/servers/${id}`),

  sshSync: (id: number, sshCredentialId: number) =>
    http
      .post<Server>(`/api/servers/${id}/ssh-sync`, null, { params: { ssh_credential_id: sshCredentialId } })
      .then(r => r.data),
}

export const credentialsApi = {
  list: () => http.get<Credential[]>('/api/credentials').then(r => r.data),

  create: (data: { name: string; provider: string; config: Record<string, unknown> }) =>
    http.post<Credential>('/api/credentials', data).then(r => r.data),

  delete: (id: number) => http.delete(`/api/credentials/${id}`),

  toggle: (id: number) =>
    http.patch<Credential>(`/api/credentials/${id}/toggle`).then(r => r.data),
}

export const syncApi = {
  trigger: (provider?: string): Promise<SyncLog> =>
    http
      .post<SyncLog>('/api/sync', null, { params: provider ? { provider } : {} })
      .then(r => r.data),

  stop: (logId?: number): Promise<SyncLog> =>
    http
      .post<SyncLog>('/api/sync/stop', null, { params: logId ? { log_id: logId } : {} })
      .then(r => r.data),

  logs: (limit = 50): Promise<SyncLog[]> =>
    http.get<SyncLog[]>('/api/sync/logs', { params: { limit } }).then(r => r.data),
}

export const sshCredentialsApi = {
  list: () => http.get<SSHCredential[]>('/api/ssh-credentials').then(r => r.data),

  create: (data: Omit<SSHCredential, 'id' | 'created_at' | 'updated_at'>) =>
    http.post<SSHCredential>('/api/ssh-credentials', data).then(r => r.data),

  update: (id: number, data: Partial<Omit<SSHCredential, 'id' | 'created_at' | 'updated_at'>>) =>
    http.put<SSHCredential>(`/api/ssh-credentials/${id}`, data).then(r => r.data),

  delete: (id: number) => http.delete(`/api/ssh-credentials/${id}`),

  setDefault: (id: number) =>
    http.patch<SSHCredential>(`/api/ssh-credentials/${id}/set-default`).then(r => r.data),
}

export const statsApi = {
  history: (days = 30): Promise<ServerSnapshot[]> =>
    http.get<ServerSnapshot[]>('/api/stats/history', { params: { days } }).then(r => r.data),

  snapshot: (): Promise<ServerSnapshot> =>
    http.post<ServerSnapshot>('/api/stats/snapshot').then(r => r.data),
}

export const cronsApi = {
  list: () => http.get<CronJob[]>('/api/crons').then(r => r.data),

  create: (data: Omit<CronJob, 'id' | 'created_at' | 'updated_at' | 'last_run_at' | 'last_run_status' | 'next_run_at'>) =>
    http.post<CronJob>('/api/crons', data).then(r => r.data),

  update: (id: number, data: Partial<Pick<CronJob, 'name' | 'cron_expr' | 'provider' | 'is_active'>>) =>
    http.put<CronJob>(`/api/crons/${id}`, data).then(r => r.data),

  delete: (id: number) => http.delete(`/api/crons/${id}`),

  toggle: (id: number) =>
    http.patch<CronJob>(`/api/crons/${id}/toggle`).then(r => r.data),

  runNow: (id: number) =>
    http.post<CronJob>(`/api/crons/${id}/run-now`).then(r => r.data),
}

export const resourceMapApi = {
  server:     (id: number): Promise<ResourceMap> => http.get<ResourceMap>(`/api/resource-map/server/${id}`).then(r => r.data),
  database:   (id: number): Promise<ResourceMap> => http.get<ResourceMap>(`/api/resource-map/database/${id}`).then(r => r.data),
  kubernetes: (id: number): Promise<ResourceMap> => http.get<ResourceMap>(`/api/resource-map/kubernetes/${id}`).then(r => r.data),
}

export const databasesApi = {
  list: (params?: { provider?: string; status?: string; search?: string }): Promise<DatabaseInstance[]> =>
    http.get<DatabaseInstance[]>('/api/databases', { params }).then(r => r.data),

  sync: (provider?: string): Promise<SyncLog> =>
    http.post<SyncLog>('/api/databases/sync', null, { params: provider ? { provider } : {} }).then(r => r.data),
}

export const kubernetesApi = {
  list: (params?: { provider?: string; status?: string; search?: string }): Promise<KubernetesCluster[]> =>
    http.get<KubernetesCluster[]>('/api/kubernetes', { params }).then(r => r.data),

  sync: (provider?: string): Promise<SyncLog> =>
    http.post<SyncLog>('/api/kubernetes/sync', null, { params: provider ? { provider } : {} }).then(r => r.data),
}

export const blockStoragesApi = {
  list: (params?: { provider?: string; status?: string; search?: string }): Promise<BlockStorage[]> =>
    http.get<BlockStorage[]>('/api/block-storages', { params }).then(r => r.data),

  sync: (provider?: string): Promise<SyncLog> =>
    http.post<SyncLog>('/api/block-storages/sync', null, { params: provider ? { provider } : {} }).then(r => r.data),
}

export const settingsApi = {
  list: (): Promise<Record<string, string>> =>
    http.get<Record<string, string>>('/api/settings').then(r => r.data),

  update: (key: string, value: string): Promise<Record<string, string>> =>
    http.put<Record<string, string>>(`/api/settings/${key}`, { value }).then(r => r.data),
}

export interface ApiUser {
  id: number
  username: string
  role: string
  is_active: boolean
  created_at?: string
}

export const usersApi = {
  list: () => http.get<ApiUser[]>('/api/users').then(r => r.data),

  create: (data: { username: string; password: string; role: string }) =>
    http.post<ApiUser>('/api/users', data).then(r => r.data),

  delete: (id: number) => http.delete(`/api/users/${id}`),

  toggle: (id: number) => http.patch<ApiUser>(`/api/users/${id}/toggle`).then(r => r.data),
}

export const authApi = {
  changePassword: (data: { current_password: string; new_password: string }) =>
    http.put('/api/auth/change-password', data),
}

export const mfaApi = {
  status: () => http.get<{ enabled: boolean }>('/api/auth/mfa/status'),
  setup: () => http.post<{ secret: string; uri: string }>('/api/auth/mfa/setup'),
  enable: (code: string) =>
    http.post('/api/auth/mfa/enable', { code }),
  disable: (code: string) =>
    http.post('/api/auth/mfa/disable', { code }),
  verify: (mfa_token: string, code: string) =>
    http.post<{
      access_token: string
      token_type: string
      role: string
      username: string
    }>('/api/auth/mfa/verify', { mfa_token, code }),
}

/** Shape of a single Pydantic v2 validation error item */
interface PydanticErrorItem {
  loc?: Array<string | number>
  msg: string
}

/** Shape of an Axios error response body (best-effort) */
interface ApiErrorResponseData {
  detail?: string | PydanticErrorItem[] | unknown
  message?: unknown
}

interface ApiError {
  response?: {
    data?: ApiErrorResponseData
    status?: number
  }
  message?: string
}

export function getErrorMessage(error: unknown): string {
  if (!error) return 'An unknown error occurred.'

  const apiError = error as ApiError

  if (apiError.response?.data) {
    const data = apiError.response.data
    if (data.detail !== undefined) {
      if (typeof data.detail === 'string') {
        return data.detail
      }
      if (Array.isArray(data.detail)) {
        return (data.detail as PydanticErrorItem[])
          .map(d => {
            const path = d.loc
              ? d.loc.filter(l => l !== 'body').join('.')
              : ''
            return `${path ? `'${path}': ` : ''}${d.msg}`
          })
          .join(', ')
      }
      return JSON.stringify(data.detail)
    }
    if (data.message !== undefined) {
      return String(data.message)
    }
  }

  if (typeof apiError.message === 'string') return apiError.message
  return String(error)
}
