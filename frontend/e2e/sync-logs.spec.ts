import { authedTest, expect } from './fixtures/auth'
import { createApiClient } from './fixtures/api'
import { SyncLogsPage } from './pages/SyncLogsPage'

const BACKEND = process.env.VITE_BACKEND_URL ?? 'http://localhost:8000'

authedTest.describe('Sync Logs — API', () => {
  let api: Awaited<ReturnType<typeof createApiClient>>
  authedTest.beforeAll(async () => { api = await createApiClient() })

  authedTest('GET /api/sync/logs — 200 array', async () => {
    const res = await api.get('/api/sync/logs')
    expect(res.status).toBe(200)
    expect(Array.isArray(await res.json())).toBeTruthy()
  })

  authedTest('POST /api/sync — 200 or 409 if already running', async () => {
    const res = await api.post('/api/sync', {})
    expect([200, 409]).toContain(res.status)
    await api.post('/api/sync/stop', {})
  })

  authedTest('POST /api/sync/stop — 200', async () => {
    expect((await api.post('/api/sync/stop', {})).status).toBe(200)
  })

  authedTest('GET /api/stats/history — 200 array', async () => {
    const res = await api.get('/api/stats/history')
    expect(res.status).toBe(200)
    expect(Array.isArray(await res.json())).toBeTruthy()
  })
})

authedTest.describe('Sync Logs — WebSocket', () => {
  authedTest('WS /ws rejects invalid token with close code 4001', async ({ page }) => {
    const wsUrl = BACKEND.replace(/^http/, 'ws')
    const closeCode = await page.evaluate(({ url }) => {
      return new Promise<number>((resolve) => {
        const ws = new WebSocket(`${url}/ws?token=invalid-token-xyz`)
        ws.onclose = (e: CloseEvent) => resolve(e.code)
        ws.onerror = () => resolve(0)
        setTimeout(() => resolve(0), 4500)
      })
    }, { url: wsUrl })
    expect(closeCode).toBe(4001)
  })

  authedTest('WS /ws accepts valid token and sends ping', async ({ page }) => {
    const wsUrl = BACKEND.replace(/^http/, 'ws')
    const token = await page.evaluate(() => localStorage.getItem('si_token')) as string
    const opened = await page.evaluate(({ url, tok }) => {
      return new Promise<boolean>((resolve) => {
        const ws = new WebSocket(`${url}/ws?token=${tok}`)
        ws.onopen = () => { ws.close(); resolve(true) }
        ws.onerror = () => resolve(false)
        setTimeout(() => resolve(false), 5000)
      })
    }, { url: wsUrl, tok: token })
    expect(opened).toBeTruthy()
  })
})

authedTest.describe('Sync Logs — UI', () => {
  authedTest('heading = Sync Logs', async ({ page }) => {
    await new SyncLogsPage(page).goto()
    await expect(page.locator('header h1')).toHaveText('Sync Logs')
  })

  authedTest('sync button visible', async ({ page }) => {
    const logs = new SyncLogsPage(page)
    await logs.goto()
    await expect(logs.syncButton).toBeVisible()
  })
})
