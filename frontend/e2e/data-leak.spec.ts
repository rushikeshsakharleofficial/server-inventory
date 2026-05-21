// Audits for data leaks via network, localStorage, console, and CDP
import { authedTest, test, expect } from './fixtures/auth'
import { createApiClient } from './fixtures/api'

const BACKEND = process.env.VITE_BACKEND_URL ?? 'http://localhost:8000'
const ALLOWED_AUTH_HOSTS = ['localhost', '127.0.0.1']

authedTest.describe('Data Leak — Network (page.on request)', () => {
  authedTest('Authorization header not sent to 3rd-party hosts', async ({ page }) => {
    const leaks: string[] = []
    page.on('request', (req) => {
      const auth = req.headers()['authorization']
      if (!auth) return
      try {
        const { hostname } = new URL(req.url())
        if (!ALLOWED_AUTH_HOSTS.includes(hostname)) {
          leaks.push(`${req.method()} ${req.url()}`)
        }
      } catch { /* ignore malformed URLs */ }
    })
    for (const path of ['/dashboard', '/inventory/servers', '/providers']) {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
    }
    expect(leaks, `Auth header leaked to 3rd parties:\n${leaks.join('\n')}`).toHaveLength(0)
  })

  authedTest('JWT token not present in any request URL', async ({ page }) => {
    const token = await page.evaluate(() => localStorage.getItem('si_token')) as string
    const urlLeaks: string[] = []
    page.on('request', (req) => {
      if (req.url().includes(token)) urlLeaks.push(req.url())
    })
    for (const path of ['/dashboard', '/inventory/servers']) {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
    }
    expect(urlLeaks, `Token in URL:\n${urlLeaks.join('\n')}`).toHaveLength(0)
  })

  authedTest('GET /api/users — response contains no password fields', async ({ page }) => {
    const token = await page.evaluate(() => localStorage.getItem('si_token')) as string
    const res = await page.request.get(`${BACKEND}/api/users`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json() as Array<Record<string, unknown>>
    for (const user of body) {
      expect(Object.keys(user), `password field leaked for ${String(user['username'])}`).not.toContain('password')
      expect(Object.keys(user)).not.toContain('hashed_password')
    }
  })

  authedTest('Providers page does not expose raw secret values in DOM', async ({ page }) => {
    await page.goto('/providers')
    await page.waitForLoadState('networkidle')
    const pageText = (await page.textContent('body')) ?? ''
    const dangerousPatterns = [
      /secret_access_key["'\s:]+[A-Za-z0-9+/]{20,}/,
      /client_secret["'\s:]+[A-Za-z0-9_-]{10,}/,
      /application_secret["'\s:]+[A-Za-z0-9]{10,}/,
    ]
    for (const pattern of dangerousPatterns) {
      expect(pageText, `Secret exposed in DOM: ${pattern.source}`).not.toMatch(pattern)
    }
  })
})

authedTest.describe('Data Leak — LocalStorage', () => {
  authedTest('only allowed keys stored — no passwords', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    const storage = await page.evaluate(() => {
      const result: Record<string, string> = {}
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)!
        result[k] = localStorage.getItem(k)!
      }
      return result
    })
    const allowedKeys = new Set(['si_token', 'si_user', 'si_theme'])
    for (const key of Object.keys(storage)) {
      expect(allowedKeys.has(key), `Unexpected localStorage key: ${key}`).toBeTruthy()
    }
    if (storage['si_user']) {
      const user = JSON.parse(storage['si_user']) as Record<string, unknown>
      expect(Object.keys(user)).not.toContain('password')
      expect(Object.keys(user)).not.toContain('hashed_password')
    }
  })

  authedTest('login does not persist password in localStorage', async ({ page }) => {
    await page.goto('/')
    await page.getByLabel('Username').fill('admin')
    await page.getByLabel('Password').fill('Admin@1234')
    await page.getByRole('button', { name: /sign in/i }).click()
    await page.waitForSelector('aside', { timeout: 5000 })
    const allValues = await page.evaluate(() => {
      const vals: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        vals.push(localStorage.getItem(localStorage.key(i)!)!)
      }
      return vals.join(' ')
    })
    expect(allValues).not.toContain('Admin@1234')
  })
})

authedTest.describe('Data Leak — Console', () => {
  authedTest('token and password not printed to console during navigation', async ({ page }) => {
    const token = await page.evaluate(() => localStorage.getItem('si_token')) as string
    const consoleLeak: string[] = []
    page.on('console', (msg) => {
      const text = msg.text()
      if (text.includes(token)) consoleLeak.push(`Token in console: ${text.slice(0, 120)}`)
      if (text.toLowerCase().includes('admin@1234')) consoleLeak.push(`Password in console: ${text.slice(0, 120)}`)
    })
    for (const path of ['/dashboard', '/inventory/servers', '/sync-logs']) {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
    }
    expect(consoleLeak, consoleLeak.join('\n')).toHaveLength(0)
  })
})

authedTest.describe('Data Leak — CDP Network audit', () => {
  authedTest('no auth header leaked to non-backend hosts (CDP)', async ({ page }) => {
    // CDP: correct API is page.context().newCDPSession(page)
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Network.enable')
    const headerLeaks: string[] = []
    cdp.on('Network.requestWillBeSent', (params) => {
      const { headers, url } = params.request
      try {
        const { hostname } = new URL(url)
        if (ALLOWED_AUTH_HOSTS.includes(hostname)) return
        if (headers['Authorization'] ?? headers['authorization']) {
          headerLeaks.push(`Auth to non-backend: ${url}`)
        }
      } catch { /* ignore */ }
    })
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    await cdp.detach()
    expect(headerLeaks, headerLeaks.join('\n')).toHaveLength(0)
  })

  authedTest('no 5xx responses across all views (CDP)', async ({ page }) => {
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Network.enable')
    const serverErrors: string[] = []
    cdp.on('Network.responseReceived', (params) => {
      if (params.response.status >= 500) {
        serverErrors.push(`${params.response.status} ${params.response.url}`)
      }
    })
    const views = [
      '/dashboard', '/inventory/servers', '/inventory/databases',
      '/inventory/kubernetes', '/inventory/block-storages',
      '/providers', '/sync-logs', '/crons', '/ssh', '/settings',
    ]
    for (const path of views) {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
    }
    await cdp.detach()
    expect(serverErrors, `5xx errors:\n${serverErrors.join('\n')}`).toHaveLength(0)
  })
})

test.describe('Data Leak — Unauthenticated 401 guards', () => {
  test('sensitive endpoints return 401 without auth', async ({ page }) => {
    const endpoints = ['/api/users', '/api/credentials', '/api/ssh-credentials', '/api/servers', '/api/settings']
    for (const ep of endpoints) {
      const res = await page.request.get(`${BACKEND}${ep}`)
      expect(res.status(), `${ep} should 401 without auth`).toBe(401)
    }
  })
})
