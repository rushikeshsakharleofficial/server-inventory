import { authedTest, expect } from './fixtures/auth'
import { createApiClient } from './fixtures/api'
import { KubernetesPage } from './pages/InventoryPage'

authedTest.describe('Kubernetes — API params', () => {
  let api: Awaited<ReturnType<typeof createApiClient>>
  authedTest.beforeAll(async () => { api = await createApiClient() })

  authedTest('GET /api/kubernetes — 200 array', async () => {
    expect((await api.get('/api/kubernetes')).status).toBe(200)
  })

  authedTest('GET /api/kubernetes?search=prod — 200', async () => {
    expect((await api.get('/api/kubernetes', { search: 'prod' })).status).toBe(200)
  })

  authedTest('GET /api/kubernetes?provider=gcp — only gcp', async () => {
    const body = await (await api.get('/api/kubernetes', { provider: 'gcp' })).json() as Array<{ provider: string }>
    expect(body.every(c => c.provider === 'gcp')).toBeTruthy()
  })

  authedTest('GET /api/kubernetes?status=running — only running', async () => {
    const body = await (await api.get('/api/kubernetes', { status: 'running' })).json() as Array<{ status: string }>
    expect(body.every(c => c.status === 'running')).toBeTruthy()
  })

  authedTest('GET /api/kubernetes?search=%_% — wildcard safe 200', async () => {
    expect((await api.get('/api/kubernetes', { search: '%_%' })).status).toBe(200)
  })
})

authedTest.describe('Kubernetes — UI', () => {
  authedTest('heading = Kubernetes', async ({ page }) => {
    await new KubernetesPage(page).goto()
    await expect(page.locator('header h1')).toHaveText('Kubernetes')
  })

  authedTest('search input accepts text', async ({ page }) => {
    const k8s = new KubernetesPage(page)
    await k8s.goto()
    await k8s.search('xyz')
    await expect(k8s.searchInput).toHaveValue('xyz')
  })
})
