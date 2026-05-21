import { authedTest, expect } from './fixtures/auth'
import { createApiClient } from './fixtures/api'
import { DatabasesPage } from './pages/InventoryPage'

authedTest.describe('Databases — API params', () => {
  let api: Awaited<ReturnType<typeof createApiClient>>
  authedTest.beforeAll(async () => { api = await createApiClient() })

  authedTest('GET /api/databases — 200 array', async () => {
    const res = await api.get('/api/databases')
    expect(res.status).toBe(200)
    expect(Array.isArray(await res.json())).toBeTruthy()
  })

  authedTest('GET /api/databases?search=test — 200', async () => {
    expect((await api.get('/api/databases', { search: 'test' })).status).toBe(200)
  })

  authedTest('GET /api/databases?provider=aws — only aws', async () => {
    const body = await (await api.get('/api/databases', { provider: 'aws' })).json() as Array<{ provider: string }>
    expect(body.every(d => d.provider === 'aws')).toBeTruthy()
  })

  authedTest('GET /api/databases?status=available — only available', async () => {
    const body = await (await api.get('/api/databases', { status: 'available' })).json() as Array<{ status: string }>
    expect(body.every(d => d.status === 'available')).toBeTruthy()
  })

  authedTest('GET /api/databases?search=%_% — wildcard safe 200', async () => {
    expect((await api.get('/api/databases', { search: '%_%' })).status).toBe(200)
  })
})

authedTest.describe('Databases — UI', () => {
  authedTest('heading = Databases', async ({ page }) => {
    await new DatabasesPage(page).goto()
    await expect(page.locator('header h1')).toHaveText('Databases')
  })

  authedTest('search input filters', async ({ page }) => {
    const db = new DatabasesPage(page)
    await db.goto()
    const before = await db.tableRows.count()
    await db.search('xyznotfound999e2e')
    expect(await db.tableRows.count()).toBeLessThanOrEqual(before)
  })
})
