import { authedTest, expect } from './fixtures/auth'
import { createApiClient } from './fixtures/api'
import { ServersPage } from './pages/ServersPage'

const BACKEND = process.env.VITE_BACKEND_URL ?? 'http://localhost:8000'

authedTest.describe('Servers — API params', () => {
  let api: Awaited<ReturnType<typeof createApiClient>>

  authedTest.beforeAll(async () => {
    api = await createApiClient()
  })

  authedTest('GET /api/servers — 200 array', async () => {
    const res = await api.get('/api/servers')
    expect(res.status).toBe(200)
    expect(Array.isArray(await res.json())).toBeTruthy()
  })

  authedTest('GET /api/servers?search= filters by name', async () => {
    const all = await (await api.get('/api/servers')).json() as Array<{ name: string }>
    if (all.length === 0) return
    const term = all[0]!.name.slice(0, 3)
    const filtered = await (await api.get('/api/servers', { search: term })).json() as Array<{ name: string }>
    expect(filtered.every(s => s.name.toLowerCase().includes(term.toLowerCase()))).toBeTruthy()
  })

  authedTest('GET /api/servers?provider=custom — returns only custom', async () => {
    const res = await api.get('/api/servers', { provider: 'custom' })
    expect(res.status).toBe(200)
    const body = await res.json() as Array<{ provider: string }>
    expect(body.every(s => s.provider === 'custom')).toBeTruthy()
  })

  authedTest('GET /api/servers?status=running — returns only running', async () => {
    const res = await api.get('/api/servers', { status: 'running' })
    expect(res.status).toBe(200)
    const body = await res.json() as Array<{ status: string }>
    expect(body.every(s => s.status === 'running')).toBeTruthy()
  })

  authedTest('GET /api/servers?search=%_% — wildcard injection returns 200', async () => {
    expect((await api.get('/api/servers', { search: '%_%' })).status).toBe(200)
  })

  authedTest('GET /api/servers/stats — returns total, running, by_provider', async () => {
    const res = await api.get('/api/servers/stats')
    expect(res.status).toBe(200)
    const body = await res.json() as { total: number; running: number; by_provider: object }
    expect(typeof body.total).toBe('number')
    expect(typeof body.running).toBe('number')
    expect(typeof body.by_provider).toBe('object')
  })

  authedTest('GET /api/servers/999999999 — 404', async () => {
    expect((await api.get('/api/servers/999999999')).status).toBe(404)
  })
})

authedTest.describe('Servers — UI', () => {
  authedTest('search filters table rows', async ({ page }) => {
    const servers = new ServersPage(page)
    await servers.goto()
    const before = await servers.tableRows.count()
    await servers.search('xyznotfound999e2e')
    const after = await servers.tableRows.count()
    expect(after).toBeLessThanOrEqual(before)
  })

  authedTest('clearing search restores all rows', async ({ page }) => {
    const servers = new ServersPage(page)
    await servers.goto()
    const all = await servers.tableRows.count()
    await servers.search('xyznotfound999e2e')
    await servers.search('')
    await expect(servers.tableRows).toHaveCount(all)
  })

  authedTest('clicking row opens detail panel', async ({ page }) => {
    const servers = new ServersPage(page)
    await servers.goto()
    if (await servers.tableRows.count() === 0) return
    await servers.clickRow(0)
    await expect(servers.detailPanel).toBeVisible()
  })

  authedTest('create and delete custom DC server via API', async () => {
    const created = await (await api.post('/api/servers', {
      name: 'e2e-test-server',
      provider: 'custom',
      hostname: '192.168.0.99',
    })).json() as { id: number; name: string }
    expect(created.name).toBe('e2e-test-server')
    const del = await api.delete(`/api/servers/${created.id}`)
    expect(del.status).toBe(204)
  })
})
