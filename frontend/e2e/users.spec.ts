import { authedTest, expect } from './fixtures/auth'
import { createApiClient } from './fixtures/api'
import { UsersPage } from './pages/UsersPage'

authedTest.describe('Users — API', () => {
  let api: Awaited<ReturnType<typeof createApiClient>>
  authedTest.beforeAll(async () => { api = await createApiClient() })

  authedTest('GET /api/users — 200 includes admin', async () => {
    const res = await api.get('/api/users')
    expect(res.status).toBe(200)
    const body = await res.json() as Array<{ username: string; role: string }>
    expect(body.some(u => u.username === 'admin')).toBeTruthy()
  })

  authedTest('POST /api/users — create read user, cleanup', async () => {
    const res = await api.post('/api/users', { username: 'e2e_read', password: 'Test@1234', role: 'read' })
    expect(res.status).toBe(201)
    const body = await res.json() as { id: number; role: string }
    expect(body.role).toBe('read')
    await api.delete(`/api/users/${body.id}`)
  })

  authedTest('POST /api/users — invalid role → 422', async () => {
    expect((await api.post('/api/users', { username: 'bad', password: 'Test@1234', role: 'superadmin' })).status).toBe(422)
  })

  authedTest('DELETE /api/users/:id — 204', async () => {
    const created = await (await api.post('/api/users', { username: 'e2e_del', password: 'Test@1234', role: 'read' })).json() as { id: number }
    expect((await api.delete(`/api/users/${created.id}`)).status).toBe(204)
  })

  authedTest('PATCH /api/users/:id/toggle — flips is_active', async () => {
    const created = await (await api.post('/api/users', { username: 'e2e_tog', password: 'Test@1234', role: 'read' })).json() as { id: number; is_active: boolean }
    const toggled = await (await api.patch(`/api/users/${created.id}/toggle`)).json() as { is_active: boolean }
    expect(toggled.is_active).toBe(!created.is_active)
    await api.delete(`/api/users/${created.id}`)
  })

  authedTest('DELETE /api/users/999999 — 404', async () => {
    expect((await api.delete('/api/users/999999')).status).toBe(404)
  })

  authedTest('GET /api/users — response has no password field', async () => {
    const body = await (await api.get('/api/users')).json() as Array<Record<string, unknown>>
    for (const user of body) {
      expect(Object.keys(user)).not.toContain('password')
      expect(Object.keys(user)).not.toContain('hashed_password')
    }
  })
})

authedTest.describe('Users — UI', () => {
  authedTest('users table shows admin row', async ({ page }) => {
    await new UsersPage(page).goto()
    await expect(page.getByRole('cell', { name: 'admin' })).toBeVisible()
  })
})
