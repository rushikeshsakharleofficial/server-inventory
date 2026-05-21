# Playwright Setup + Frontend Design Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install Playwright with E2E + visual regression tests, and fix two theme-inconsistent hardcoded values in the frontend.

**Architecture:** Two independent workstreams run in parallel. Worker A creates Playwright infra (new files only). Worker B fixes existing component files. After both complete, run `npx playwright test` to capture golden snapshots. Auth fixture uses localStorage injection (sets `si_token` + `si_user`) to avoid repeated login form flows. Visual tests screenshot all 9 views in dark + light theme.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS 3, `@playwright/test`, `@tanstack/react-query`, lucide-react, recharts

**Prerequisite:** Backend running on `http://localhost:8000` (via `docker-compose up backend` or `uvicorn`). Default admin creds: `admin` / `admin123`.

**Spec note:** `DashboardPage.tsx` chart tooltips already use CSS vars (`var(--bg-s2)`, `var(--bd)`). No fix needed there — spec item 2 was incorrect on review.

---

## File Map

### Worker A — New files (Playwright)
| File | Purpose |
|------|---------|
| `frontend/playwright.config.ts` | Playwright config: 2 projects, webServer, screenshot dir |
| `frontend/e2e/fixtures/auth.ts` | Extend `test` with auto-login via localStorage injection |
| `frontend/e2e/auth.spec.ts` | Login success, bad creds, logout flows |
| `frontend/e2e/navigation.spec.ts` | Navigate to all 9 views, assert header title |
| `frontend/e2e/visual.spec.ts` | Screenshot all pages × dark + light theme |
| `frontend/e2e/.gitignore` | Ignore `.auth/` token files + `screenshots/*.png` |

### Worker B — Modified files (Fixes)
| File | Change |
|------|--------|
| `frontend/src/components/StatsCards.tsx:33` | `stroke="#1A1A28"` → `stroke="var(--bd)"` |
| `frontend/src/components/LoginPage.tsx:168–175` | Remove inline `style` + `onMouseEnter/Leave`, add `btn-primary` class |

---

## Task 1: Install Playwright

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Install `@playwright/test`**

```bash
cd frontend && npm install -D @playwright/test
```

Expected: `@playwright/test` appears in `package.json` devDependencies.

- [ ] **Step 2: Install Chromium browser**

```bash
cd frontend && npx playwright install chromium
```

Expected: Downloads Chromium binary, prints "Chromium X.X.X installed".

- [ ] **Step 3: Add test script to `package.json`**

Open `frontend/package.json`. Add to `"scripts"`:

```json
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui"
```

- [ ] **Step 4: Commit**

```bash
cd frontend && git add package.json package-lock.json
git commit -m "chore: install @playwright/test + chromium"
```

---

## Task 2: Playwright Config

**Files:**
- Create: `frontend/playwright.config.ts`

- [ ] **Step 1: Create config**

Create `frontend/playwright.config.ts`:

```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium-dark',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium-light',
      use: {
        ...devices['Desktop Chrome'],
        storageState: undefined,
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
})
```

- [ ] **Step 2: Create `.gitignore` for e2e artifacts**

Create `frontend/e2e/.gitignore`:

```
.auth/
test-results/
playwright-report/
screenshots/
```

- [ ] **Step 3: Commit**

```bash
git add frontend/playwright.config.ts frontend/e2e/.gitignore
git commit -m "chore: add playwright.config.ts + e2e .gitignore"
```

---

## Task 3: Auth Fixture

**Files:**
- Create: `frontend/e2e/fixtures/auth.ts`

- [ ] **Step 1: Create fixtures directory and auth fixture**

Create `frontend/e2e/fixtures/auth.ts`:

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add frontend/e2e/fixtures/auth.ts
git commit -m "test: add Playwright auth fixture (localStorage injection)"
```

---

## Task 4: Auth E2E Tests

**Files:**
- Create: `frontend/e2e/auth.spec.ts`

- [ ] **Step 1: Create auth spec**

Create `frontend/e2e/auth.spec.ts`:

```typescript
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
```

- [ ] **Step 2: Run auth tests**

Ensure backend is running on `:8000`, then:

```bash
cd frontend && npx playwright test e2e/auth.spec.ts --project=chromium-dark
```

Expected: 4 tests pass. If "shows error on bad credentials" fails, check error `role="alert"` on the error div in `LoginPage.tsx` (line 80).

- [ ] **Step 3: Commit**

```bash
git add frontend/e2e/auth.spec.ts
git commit -m "test: add Playwright auth E2E tests"
```

---

## Task 5: Navigation E2E Tests

**Files:**
- Create: `frontend/e2e/navigation.spec.ts`

- [ ] **Step 1: Create navigation spec**

Create `frontend/e2e/navigation.spec.ts`:

```typescript
import { authedTest, expect } from './fixtures/auth'

const VIEWS = [
  { nav: 'Dashboard',      heading: 'Dashboard'        },
  { nav: 'Servers',        heading: 'Server Inventory'  },
  { nav: 'Databases',      heading: 'Databases'         },
  { nav: 'Kubernetes',     heading: 'Kubernetes'        },
  { nav: 'Cloud Providers',heading: 'Cloud Providers'   },
  { nav: 'Sync Logs',      heading: 'Sync Logs'         },
  { nav: 'Cron Jobs',      heading: 'Cron Jobs'         },
  { nav: 'SSH',            heading: 'SSH Credentials'   },
  { nav: 'Settings',       heading: 'Settings'          },
]

authedTest.describe('Navigation', () => {
  for (const { nav, heading } of VIEWS) {
    authedTest(`navigates to ${heading}`, async ({ page }) => {
      // Inventory sub-items need expanding the Inventory group first
      if (['Servers', 'Databases', 'Kubernetes'].includes(nav)) {
        const inventoryBtn = page.getByRole('button', { name: /inventory/i })
        const isOpen = await page.locator('text=Servers').isVisible().catch(() => false)
        if (!isOpen) await inventoryBtn.click()
      }
      await page.getByRole('button', { name: nav }).click()
      await expect(page.getByRole('heading', { name: heading })).toBeVisible({ timeout: 5000 })
    })
  }
})
```

- [ ] **Step 2: Run navigation tests**

```bash
cd frontend && npx playwright test e2e/navigation.spec.ts --project=chromium-dark
```

Expected: 9 tests pass. If heading text doesn't match, check `VIEW_TITLE` in `Layout.tsx:42-52`.

- [ ] **Step 3: Commit**

```bash
git add frontend/e2e/navigation.spec.ts
git commit -m "test: add Playwright navigation E2E tests (9 views)"
```

---

## Task 6: Visual Regression Tests

**Files:**
- Create: `frontend/e2e/visual.spec.ts`

- [ ] **Step 1: Create visual spec**

Create `frontend/e2e/visual.spec.ts`:

```typescript
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
```

- [ ] **Step 2: Commit test file before first run**

```bash
git add frontend/e2e/visual.spec.ts
git commit -m "test: add Playwright visual regression spec (9 views × 2 themes)"
```

- [ ] **Step 3: Generate initial golden snapshots**

```bash
cd frontend && npx playwright test e2e/visual.spec.ts --project=chromium-dark --update-snapshots
```

Expected: Creates `.png` snapshot files in `e2e/visual.spec.ts-snapshots/`. Each view gets a baseline screenshot.

---

## Task 7: Fix StatsCards — Hardcoded Stroke Color

**Files:**
- Modify: `frontend/src/components/StatsCards.tsx:33`

- [ ] **Step 1: Fix hardcoded `#1A1A28` stroke**

In `frontend/src/components/StatsCards.tsx`, find the `DonutSVG` function. Line 33 has:

```tsx
<circle cx="18" cy="18" r="16" fill="none" stroke="#1A1A28" strokeWidth="4" />
```

Change to:

```tsx
<circle cx="18" cy="18" r="16" fill="none" stroke="var(--bd)" strokeWidth="4" />
```

Note: line 27 has a second identical `<circle>` for the empty state:
```tsx
if (total === 0) return <circle cx="18" cy="18" r="16" fill="none" stroke="#1A1A28" strokeWidth="4" />
```

Fix this one too:
```tsx
if (total === 0) return <circle cx="18" cy="18" r="16" fill="none" stroke="var(--bd)" strokeWidth="4" />
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/StatsCards.tsx
git commit -m "fix: use CSS var for donut chart ring stroke (light theme)"
```

---

## Task 8: Fix LoginPage — Inline Hover Handlers

**Files:**
- Modify: `frontend/src/components/LoginPage.tsx:168–175`

The submit button currently has an inline `style` attribute that overrides the CSS class, requiring JS `onMouseEnter/Leave` handlers to fake hover. Fix by using `.btn-primary` class (which already has `:hover` handling) and removing the inline style + handlers.

- [ ] **Step 1: Replace submit button**

In `frontend/src/components/LoginPage.tsx`, find the submit button (starts around line 168):

```tsx
<button
  type="submit"
  disabled={loading || !username.trim() || !password}
  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-bold
             transition-colors disabled:opacity-40 disabled:cursor-not-allowed mt-2"
  style={{ background: 'var(--ac)', color: 'var(--btn-primary-fg)' }}
  onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = 'var(--ach)' }}
  onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'var(--ac)'}
>
```

Replace with:

```tsx
<button
  type="submit"
  disabled={loading || !username.trim() || !password}
  className="btn-primary w-full py-3 justify-center gap-2 mt-2"
>
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/LoginPage.tsx
git commit -m "fix: remove inline hover handlers on login submit, use btn-primary class"
```

---

## Task 9: Run Full Test Suite + Update Snapshots

- [ ] **Step 1: Run all Playwright tests**

Ensure backend is running on `:8000`.

```bash
cd frontend && npx playwright test --project=chromium-dark
```

Expected: All tests pass. Visual tests may fail if snapshots don't exist yet — run with `--update-snapshots` if needed.

- [ ] **Step 2: Update visual snapshots after fixes**

The `StatsCards` fix changes donut ring color in light theme. Regenerate snapshots:

```bash
cd frontend && npx playwright test e2e/visual.spec.ts --update-snapshots
```

Expected: Snapshots regenerated. Donut ring now uses `--bd` color.

- [ ] **Step 3: Run both projects to confirm dark + light theme**

```bash
cd frontend && npx playwright test --project=chromium-dark && npx playwright test --project=chromium-light
```

Expected: All pass.

- [ ] **Step 4: Commit final state**

```bash
git add frontend/e2e/
git commit -m "test: add golden Playwright snapshots (9 views × dark + light)"
```

---

## Summary

| Task | Files | Type |
|------|-------|------|
| 1 | `package.json` | Install |
| 2 | `playwright.config.ts`, `e2e/.gitignore` | Config |
| 3 | `e2e/fixtures/auth.ts` | Test infra |
| 4 | `e2e/auth.spec.ts` | E2E tests |
| 5 | `e2e/navigation.spec.ts` | E2E tests |
| 6 | `e2e/visual.spec.ts` | Visual tests |
| 7 | `src/components/StatsCards.tsx` | Bug fix |
| 8 | `src/components/LoginPage.tsx` | Bug fix |
| 9 | Run + snapshots | Verification |

Tasks 1–6 (Playwright) and 7–8 (fixes) are independent and can run in parallel. Task 9 requires both complete.
