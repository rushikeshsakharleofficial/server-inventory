import { authedTest, expect } from './fixtures/auth'
import { createApiClient } from './fixtures/api'
import { SSHPage } from './pages/SSHPage'

authedTest.describe('SSH Credentials — API', () => {
  let api: Awaited<ReturnType<typeof createApiClient>>
  authedTest.beforeAll(async () => { api = await createApiClient() })

  authedTest('GET /api/ssh-credentials — 200 array', async () => {
    expect((await api.get('/api/ssh-credentials')).status).toBe(200)
  })

  authedTest('POST /api/ssh-credentials — create password auth, cleanup', async () => {
    const res = await api.post('/api/ssh-credentials', { name: 'e2e-ssh', username: 'root', auth_method: 'password', password: 'testpass', port: 22 })
    expect(res.status).toBe(201)
    const body = await res.json() as { id: number }
    await api.delete(`/api/ssh-credentials/${body.id}`)
  })

  authedTest('PUT /api/ssh-credentials/:id — update name', async () => {
    const created = await (await api.post('/api/ssh-credentials', { name: 'e2e-upd', username: 'ubuntu', auth_method: 'password', password: 'pass', port: 22 })).json() as { id: number }
    const updated = await (await api.put(`/api/ssh-credentials/${created.id}`, { name: 'e2e-updated', username: 'ubuntu', auth_method: 'password', password: 'pass', port: 22 })).json() as { name: string }
    expect(updated.name).toBe('e2e-updated')
    await api.delete(`/api/ssh-credentials/${created.id}`)
  })

  authedTest('PATCH /api/ssh-credentials/:id/set-default — marks is_default', async () => {
    const created = await (await api.post('/api/ssh-credentials', { name: 'e2e-def', username: 'root', auth_method: 'password', password: 'pass', port: 22 })).json() as { id: number }
    const res = await api.patch(`/api/ssh-credentials/${created.id}/set-default`)
    expect(res.status).toBe(200)
    expect(((await res.json()) as { is_default: boolean }).is_default).toBeTruthy()
    await api.delete(`/api/ssh-credentials/${created.id}`)
  })

  authedTest('DELETE /api/ssh-credentials/999999 — 404', async () => {
    expect((await api.delete('/api/ssh-credentials/999999')).status).toBe(404)
  })
})

authedTest.describe('SSH Credentials — UI', () => {
  authedTest('heading = SSH Credentials', async ({ page }) => {
    await new SSHPage(page).goto()
    await expect(page.locator('header h1')).toHaveText('SSH Credentials')
  })
})
