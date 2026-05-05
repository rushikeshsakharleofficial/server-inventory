import axios from 'axios'
import type { Server, Credential, SyncLog, Stats, SSHCredential, ServerSnapshot, CronJob } from './types'

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

  sshSync: (id: number) =>
    http.post<Server>(`/api/servers/${id}/ssh-sync`).then(r => r.data),
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
  trigger: (provider?: string) =>
    http
      .post('/api/sync', null, { params: provider ? { provider } : {} })
      .then(r => r.data),

  stop: (logId?: number) =>
    http
      .post('/api/sync/stop', null, { params: logId ? { log_id: logId } : {} })
      .then(r => r.data),

  logs: (limit = 50) =>
    http.get<SyncLog[]>('/api/sync/logs', { params: { limit } }).then(r => r.data),
}

export const sshCredentialsApi = {
  list: () => http.get<SSHCredential[]>('/api/ssh-credentials').then(r => r.data),

  create: (data: Omit<SSHCredential, 'id' | 'created_at'>) =>
    http.post<SSHCredential>('/api/ssh-credentials', data).then(r => r.data),

  update: (id: number, data: Partial<Omit<SSHCredential, 'id' | 'created_at'>>) =>
    http.put<SSHCredential>(`/api/ssh-credentials/${id}`, data).then(r => r.data),

  delete: (id: number) => http.delete(`/api/ssh-credentials/${id}`),

  setDefault: (id: number) =>
    http.patch<SSHCredential>(`/api/ssh-credentials/${id}/set-default`).then(r => r.data),
}

export const statsApi = {
  history: (days = 30) =>
    http.get<ServerSnapshot[]>('/api/stats/history', { params: { days } }).then(r => r.data),

  snapshot: () => http.post('/api/stats/snapshot').then(r => r.data),
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

export const settingsApi = {
  list: () => http.get<Record<string, string>>('/api/settings').then(r => r.data),

  update: (key: string, value: string) =>
    http.put(`/api/settings/${key}`, { value }).then(r => r.data),
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
