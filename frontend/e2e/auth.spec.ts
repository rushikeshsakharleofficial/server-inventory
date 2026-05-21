import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('shows login page when unauthenticated', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'ServerInventory' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible()
  })

  test('shows error on bad credentials', async ({ page }) => {
    await page.goto('/')
    await page.getByLabel('Username').fill('notauser')
    await page.getByLabel('Password').fill('wrongpass')
    await page.getByRole('button', { name: 'Sign In' }).click()
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 5000 })
  })

  test('logs in successfully and shows sidebar', async ({ page }) => {
    const username = process.env.E2E_USERNAME ?? 'admin'
    const password = process.env.E2E_PASSWORD ?? 'admin123'

    await page.goto('/')
    await page.getByLabel('Username').fill(username)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Sign In' }).click()
    await expect(page.getByRole('navigation')).toBeVisible({ timeout: 8000 })
    await expect(page.getByRole('main')).toBeVisible()
  })

  test('logout clears session and returns to login', async ({ page }) => {
    const username = process.env.E2E_USERNAME ?? 'admin'
    const password = process.env.E2E_PASSWORD ?? 'admin123'

    await page.goto('/')
    await page.getByLabel('Username').fill(username)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Sign In' }).click()
    await page.waitForSelector('aside', { timeout: 8000 })

    await page.getByLabel('Sign out').click()
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible({ timeout: 5000 })
    const token = await page.evaluate(() => localStorage.getItem('si_token'))
    expect(token).toBeNull()
  })
})
