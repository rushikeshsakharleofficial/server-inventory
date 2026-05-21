import { test, authedTest, expect } from './fixtures/auth'
import { LoginPage } from './pages/LoginPage'

const BACKEND = process.env.VITE_BACKEND_URL ?? 'http://localhost:8000'

test.describe('Auth — Login', () => {
  test('valid credentials → dashboard', async ({ page }) => {
    const login = new LoginPage(page)
    await login.goto()
    await login.login('admin', 'Admin@1234')
    await expect(page.locator('header h1')).toHaveText('Dashboard')
  })

  test('wrong password → error visible', async ({ page }) => {
    const login = new LoginPage(page)
    await login.goto()
    await login.login('admin', 'wrongpassword')
    await expect(login.errorMessage).toBeVisible()
  })

  test('empty username → error visible', async ({ page }) => {
    const login = new LoginPage(page)
    await login.goto()
    await login.login('', 'Admin@1234')
    await expect(login.errorMessage).toBeVisible()
  })

  test('unknown user → error visible', async ({ page }) => {
    const login = new LoginPage(page)
    await login.goto()
    await login.login('nobody_xyz_e2e', 'Admin@1234')
    await expect(login.errorMessage).toBeVisible()
  })
})

authedTest.describe('Auth — Session', () => {
  authedTest('GET /api/auth/me returns correct role and username', async ({ page }) => {
    const token = await page.evaluate(() => localStorage.getItem('si_token')) as string
    const res = await page.request.get(`${BACKEND}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json() as { role: string; username: string }
    expect(body.role).toBe('admin')
    expect(body.username).toBe('admin')
  })

  authedTest('invalid token → 401', async ({ page }) => {
    const res = await page.request.get(`${BACKEND}/api/auth/me`, {
      headers: { Authorization: 'Bearer invalid-token-xyz' },
    })
    expect(res.status()).toBe(401)
  })

  authedTest('logout clears localStorage token', async ({ page }) => {
    await page.getByRole('button', { name: /logout|sign out/i }).click()
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
    const token = await page.evaluate(() => localStorage.getItem('si_token'))
    expect(token).toBeNull()
  })
})
