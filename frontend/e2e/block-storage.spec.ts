import { authedTest, expect } from './fixtures/auth'
import { createApiClient } from './fixtures/api'
import { BlockStoragePage } from './pages/InventoryPage'

authedTest.describe('Block Storage — API params', () => {
  let api: Awaited<ReturnType<typeof createApiClient>>
  authedTest.beforeAll(async () => { api = await createApiClient() })

  authedTest('GET /api/block-storages — 200 array', async () => {
    expect((await api.get('/api/block-storages')).status).toBe(200)
  })

  authedTest('GET /api/block-storages?search=vol — 200', async () => {
    expect((await api.get('/api/block-storages', { search: 'vol' })).status).toBe(200)
  })

  authedTest('GET /api/block-storages?provider=aws — only aws', async () => {
    const body = await (await api.get('/api/block-storages', { provider: 'aws' })).json() as Array<{ provider: string }>
    expect(body.every(b => b.provider === 'aws')).toBeTruthy()
  })

  authedTest('GET /api/block-storages?status=available — only available', async () => {
    const body = await (await api.get('/api/block-storages', { status: 'available' })).json() as Array<{ status: string }>
    expect(body.every(b => b.status === 'available')).toBeTruthy()
  })

  authedTest('GET /api/block-storages?search=%_% — wildcard safe 200', async () => {
    expect((await api.get('/api/block-storages', { search: '%_%' })).status).toBe(200)
  })
})

authedTest.describe('Block Storage — UI', () => {
  authedTest('heading contains Block Storage', async ({ page }) => {
    await new BlockStoragePage(page).goto()
    await expect(page.locator('header h1')).toHaveText('Block Storage')
  })

  authedTest('search input accepts text', async ({ page }) => {
    const bs = new BlockStoragePage(page)
    await bs.goto()
    await bs.search('xyz')
    await expect(bs.searchInput).toHaveValue('xyz')
  })
})
