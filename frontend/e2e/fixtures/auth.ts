import { test as base, expect } from '@playwright/test'

const E2E_USERNAME = process.env.E2E_USERNAME ?? 'admin'
const E2E_PASSWORD = process.env.E2E_PASSWORD ?? 'admin123'

export const test = base.extend<object, object>({})

export const authedTest = base.extend({
  page: async ({ page }, use) => {
    // Get token via API (backend must be running on :8000)
    const res = await page.request.post('http://localhost:8000/api/auth/login', {
      form: {
        username: E2E_USERNAME,
        password: E2E_PASSWORD,
        remember_me: 'false',
      },
    })
    expect(res.ok()).toBeTruthy()
    const { access_token, role } = await res.json() as { access_token: string; role: string }

    // Inject auth into localStorage before app loads
    await page.goto('/')
    await page.evaluate(
      ({ token, user }) => {
        localStorage.setItem('si_token', token)
        localStorage.setItem('si_user', JSON.stringify(user))
      },
      { token: access_token, user: { username: E2E_USERNAME, role } },
    )
    await page.reload()
    await page.waitForSelector('aside', { timeout: 5000 })

    await use(page)
  },
})

export { expect } from '@playwright/test'
