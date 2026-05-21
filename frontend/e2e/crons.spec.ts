import { authedTest, expect } from './fixtures/auth'
import { createApiClient } from './fixtures/api'
import { CronsPage } from './pages/CronsPage'

authedTest.describe('Cron Jobs — API', () => {
  let api: Awaited<ReturnType<typeof createApiClient>>
  authedTest.beforeAll(async () => { api = await createApiClient() })

  authedTest('GET /api/crons — 200 array', async () => {
    expect((await api.get('/api/crons')).status).toBe(200)
  })

  authedTest('POST /api/crons — valid 5-field cron, cleanup', async () => {
    const res = await api.post('/api/crons', { name: 'e2e-cron', schedule: '0 * * * *', provider: null })
    expect(res.status).toBe(201)
    const body = await res.json() as { id: number; schedule: string }
    expect(body.schedule).toBe('0 * * * *')
    await api.delete(`/api/crons/${body.id}`)
  })

  authedTest('POST /api/crons — invalid expression → 422', async () => {
    expect((await api.post('/api/crons', { name: 'bad', schedule: 'not-a-cron', provider: null })).status).toBe(422)
  })

  authedTest('PUT /api/crons/:id — update schedule', async () => {
    const created = await (await api.post('/api/crons', { name: 'e2e-upd', schedule: '0 * * * *', provider: null })).json() as { id: number }
    const updated = await (await api.put(`/api/crons/${created.id}`, { name: 'e2e-upd', schedule: '0 0 * * *', provider: null })).json() as { schedule: string }
    expect(updated.schedule).toBe('0 0 * * *')
    await api.delete(`/api/crons/${created.id}`)
  })

  authedTest('PATCH /api/crons/:id/toggle — flips is_active', async () => {
    const created = await (await api.post('/api/crons', { name: 'e2e-tog', schedule: '0 * * * *', provider: null })).json() as { id: number; is_active: boolean }
    const toggled = await (await api.patch(`/api/crons/${created.id}/toggle`)).json() as { is_active: boolean }
    expect(toggled.is_active).toBe(!created.is_active)
    await api.delete(`/api/crons/${created.id}`)
  })

  authedTest('POST /api/crons/:id/run-now — 200', async () => {
    const created = await (await api.post('/api/crons', { name: 'e2e-run', schedule: '0 * * * *', provider: null })).json() as { id: number }
    expect((await api.post(`/api/crons/${created.id}/run-now`, {})).status).toBe(200)
    await api.delete(`/api/crons/${created.id}`)
  })

  authedTest('DELETE /api/crons/999999 — 404', async () => {
    expect((await api.delete('/api/crons/999999')).status).toBe(404)
  })
})

authedTest.describe('Cron Jobs — UI', () => {
  authedTest('heading = Cron Jobs', async ({ page }) => {
    await new CronsPage(page).goto()
    await expect(page.locator('header h1')).toHaveText('Cron Jobs')
  })
})
