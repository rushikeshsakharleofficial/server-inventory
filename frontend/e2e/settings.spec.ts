import { authedTest, expect } from './fixtures/auth'
import { createApiClient } from './fixtures/api'
import { SettingsPage } from './pages/SettingsPage'

authedTest.describe('Settings — API', () => {
  let api: Awaited<ReturnType<typeof createApiClient>>
  authedTest.beforeAll(async () => { api = await createApiClient() })

  authedTest('GET /api/settings — 200 key-value map', async () => {
    const res = await api.get('/api/settings')
    expect(res.status).toBe(200)
    expect(typeof await res.json()).toBe('object')
  })

  authedTest('PUT /api/settings/:key — update and restore original', async () => {
    const all = await (await api.get('/api/settings')).json() as Record<string, string>
    const key = Object.keys(all)[0]
    if (!key) return
    const original = all[key]!
    const updated = await (await api.put(`/api/settings/${key}`, { value: 'e2e-test-value' })).json() as Record<string, string>
    expect(updated[key]).toBe('e2e-test-value')
    await api.put(`/api/settings/${key}`, { value: original })
  })
})

authedTest.describe('Settings — UI', () => {
  authedTest('heading = Settings', async ({ page }) => {
    await new SettingsPage(page).goto()
    await expect(page.locator('header h1')).toHaveText('Settings')
  })

  authedTest('settings table renders', async ({ page }) => {
    await new SettingsPage(page).goto()
    await expect(page.getByRole('table')).toBeVisible()
  })
})
