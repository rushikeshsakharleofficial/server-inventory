import { test as base, expect } from '@playwright/test'

const E2E_USERNAME = process.env.E2E_USERNAME ?? 'admin'
const E2E_PASSWORD = process.env.E2E_PASSWORD ?? 'Admin@1234'
const BACKEND = process.env.VITE_BACKEND_URL ?? 'http://localhost:8000'

async function loginAndInject(
  page: import('@playwright/test').Page,
  username: string,
  password: string,
): Promise<void> {
  const res = await page.request.post(`${BACKEND}/api/auth/login`, {
    form: { username, password, remember_me: 'false' },
  })
  const bodyText = await res.text()
  expect(res.ok(), `Login failed for ${username} — status ${res.status()}: ${bodyText}`).toBeTruthy()
  const { access_token, role } = await res.json() as { access_token: string; role: string }
  await page.goto('/')
  await page.evaluate(
    ({ token, user }) => {
      localStorage.setItem('si_token', token)
      localStorage.setItem('si_user', JSON.stringify(user))
    },
    { token: access_token, user: { username, role } },
  )
  await page.reload()
  await page.waitForSelector('aside', { timeout: 5000 })
}

export const authedTest = base.extend({
  page: async ({ page }, use) => {
    await loginAndInject(page, E2E_USERNAME, E2E_PASSWORD)
    await use(page)
  },
})

export const test = base

export { expect } from '@playwright/test'
