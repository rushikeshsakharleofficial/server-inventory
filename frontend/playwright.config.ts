import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html'], ['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium-dark',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /data-leak/,
    },
    {
      name: 'chromium-light',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /visual\.spec\.ts/,
      testIgnore: /data-leak/,
    },
    {
      name: 'data-leak',
      use: {
        ...devices['Desktop Chrome'],
        trace: 'on',
      },
      testMatch: /data-leak\.spec\.ts/,
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    env: { VITE_BACKEND_URL: process.env.VITE_BACKEND_URL ?? 'http://localhost:8000' },
  },
})
