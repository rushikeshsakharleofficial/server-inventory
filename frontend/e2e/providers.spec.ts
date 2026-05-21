// NOTE: Credential-addition flow intentionally skipped.
// Only list, toggle existing, and 404 guard are tested.
import { authedTest, expect } from './fixtures/auth'
import { createApiClient } from './fixtures/api'
import { ProvidersPage } from './pages/ProvidersPage'

authedTest.describe('Cloud Providers — API (no add-cred)', () => {
  let api: Awaited<ReturnType<typeof createApiClient>>
  authedTest.beforeAll(async () => { api = await createApiClient() })

  authedTest('GET /api/credentials — 200 array', async () => {
    const res = await api.get('/api/credentials')
    expect(res.status).toBe(200)
    expect(Array.isArray(await res.json())).toBeTruthy()
  })

  authedTest('PATCH /api/credentials/:id/toggle — toggles and restores', async () => {
    const all = await (await api.get('/api/credentials')).json() as Array<{ id: number; is_active: boolean }>
    if (all.length === 0) return
    const cred = all[0]!
    const toggled = await (await api.patch(`/api/credentials/${cred.id}/toggle`)).json() as { is_active: boolean }
    expect(toggled.is_active).toBe(!cred.is_active)
    await api.patch(`/api/credentials/${cred.id}/toggle`)
  })

  authedTest('DELETE /api/credentials/999999 — 404', async () => {
    expect((await api.delete('/api/credentials/999999')).status).toBe(404)
  })
})

authedTest.describe('Cloud Providers — UI', () => {
  authedTest('heading = Cloud Providers', async ({ page }) => {
    await new ProvidersPage(page).goto()
    await expect(page.locator('header h1')).toHaveText('Cloud Providers')
  })

  authedTest('add credential button visible (form submission skipped)', async ({ page }) => {
    await new ProvidersPage(page).goto()
    await expect(page.getByRole('button', { name: /add credential/i })).toBeVisible()
  })
})
