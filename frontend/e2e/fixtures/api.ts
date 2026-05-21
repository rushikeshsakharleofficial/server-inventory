import { request as pwRequest } from '@playwright/test'

const BACKEND = process.env.VITE_BACKEND_URL ?? 'http://localhost:8000'
const DEFAULT_USERNAME = 'admin'
const DEFAULT_PASSWORD = 'Admin@1234'

export interface ApiClient {
  token: string
  get(path: string, params?: Record<string, string>): Promise<Response>
  post(path: string, body: unknown): Promise<Response>
  put(path: string, body: unknown): Promise<Response>
  patch(path: string, body?: unknown): Promise<Response>
  delete(path: string): Promise<Response>
}

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>

function buildClient(token: string, fetchFn: FetchFn): ApiClient {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }

  return {
    token,
    async get(path, params) {
      const url = new URL(`${BACKEND}${path}`)
      if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
      return fetchFn(url.toString(), { method: 'GET', headers })
    },
    async post(path, body) {
      return fetchFn(`${BACKEND}${path}`, { method: 'POST', headers, body: JSON.stringify(body) })
    },
    async put(path, body) {
      return fetchFn(`${BACKEND}${path}`, { method: 'PUT', headers, body: JSON.stringify(body) })
    },
    async patch(path, body?) {
      return fetchFn(`${BACKEND}${path}`, { method: 'PATCH', headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) })
    },
    async delete(path) {
      return fetchFn(`${BACKEND}${path}`, { method: 'DELETE', headers })
    },
  }
}

export async function createApiClient(
  username = DEFAULT_USERNAME,
  password = DEFAULT_PASSWORD,
): Promise<ApiClient> {
  const ctx = await pwRequest.newContext()
  const res = await ctx.post(`${BACKEND}/api/auth/login`, {
    form: { username, password, remember_me: 'false' },
  })
  if (!res.ok()) throw new Error(`API login failed: ${await res.text()}`)
  const { access_token } = await res.json() as { access_token: string }
  await ctx.dispose()
  return buildClient(access_token, fetch)
}
