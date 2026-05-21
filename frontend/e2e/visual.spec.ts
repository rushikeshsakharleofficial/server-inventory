import { test, expect } from '@playwright/test'
import { authedTest } from './fixtures/auth'

// Login page — no auth needed
test.describe('Visual — Login Page', () => {
  test('dark theme', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible()
    await expect(page).toHaveScreenshot('login-dark.png', { fullPage: true })
  })

  test('light theme', async ({ page }) => {
    // Set si_theme before page load so ThemeProvider reads 'light' on mount
    await page.addInitScript(() => localStorage.setItem('si_theme', 'light'))
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible()
    await expect(page).toHaveScreenshot('login-light.png', { fullPage: true })
  })
})

// Authenticated views
const AUTHENTICATED_VIEWS = [
  { name: 'dashboard',   path: '/dashboard'           },
  { name: 'servers',     path: '/inventory/servers'   },
  { name: 'databases',   path: '/inventory/databases' },
  { name: 'kubernetes',  path: '/inventory/kubernetes'},
  { name: 'block-storages', path: '/inventory/block-storages' },
  { name: 'providers',   path: '/providers'           },
  { name: 'sync-logs',   path: '/sync-logs'           },
  { name: 'crons',       path: '/crons'               },
  { name: 'ssh',         path: '/ssh'                 },
  { name: 'settings',    path: '/settings'            },
]

authedTest.describe('Visual — Authenticated views (dark)', () => {
  for (const { name, path } of AUTHENTICATED_VIEWS) {
    authedTest(`${name} — dark`, async ({ page }) => {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      await expect(page).toHaveScreenshot(`${name}-dark.png`, { fullPage: true })
    })
  }
})

authedTest.describe('Visual — Authenticated views (light)', () => {
  // beforeEach runs after auth fixture setup. Set si_theme in localStorage so the
  // next page.goto() in each test loads the app with light theme from the start.
  authedTest.beforeEach(async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('si_theme', 'light'))
  })

  for (const { name, path } of AUTHENTICATED_VIEWS) {
    authedTest(`${name} — light`, async ({ page }) => {
      // Full navigation after beforeEach sets si_theme — ThemeProvider reads 'light' on mount
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      await expect(page).toHaveScreenshot(`${name}-light.png`, { fullPage: true })
    })
  }
})
