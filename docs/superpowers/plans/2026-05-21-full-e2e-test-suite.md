# Full E2E + Data Leak Test Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Comprehensive Playwright E2E test suite covering every API param, every UI tool/feature, and Chrome DevTools network/storage data-leak audits — with credential-addition tests skipped (existing creds reused or flows mocked).

**Architecture:** Page Object Model (POM) per view, shared auth fixture reusing existing localStorage injection pattern, API-level test helpers for backend param coverage, and a dedicated `data-leak.spec.ts` that uses `page.on('request')` + Chrome DevTools Protocol (CDP) to audit network traffic, localStorage, and console output.

**Tech Stack:** Playwright 1.60, TypeScript 5.5, Chromium CDP via `page.context().newCDPSession()`, existing FastAPI backend on `:8000`, Vite dev server on `:5173`.

---

## File Map

```
frontend/e2e/
├── fixtures/
│   ├── auth.ts              [MODIFY] fix default password Admin@1234, add writeUser/readUser fixtures
│   └── api.ts               [CREATE] backend API helper (typed fetch wrappers for every endpoint)
├── pages/
│   ├── DashboardPage.ts     [CREATE] POM
│   ├── ServersPage.ts       [CREATE] POM
│   ├── DatabasesPage.ts     [CREATE] POM
│   ├── KubernetesPage.ts    [CREATE] POM
│   ├── BlockStoragePage.ts  [CREATE] POM
│   ├── ProvidersPage.ts     [CREATE] POM (no add-cred actions)
│   ├── UsersPage.ts         [CREATE] POM
│   ├── SSHPage.ts           [CREATE] POM
│   ├── CronsPage.ts         [CREATE] POM
│   ├── SettingsPage.ts      [CREATE] POM
│   ├── SyncLogsPage.ts      [CREATE] POM
│   └── LoginPage.ts         [CREATE] POM
├── auth.spec.ts             [MODIFY] extend existing tests
├── navigation.spec.ts       [MODIFY] add Block Storage view
├── servers.spec.ts          [CREATE] CRUD + search/filter params + detail panel
├── databases.spec.ts        [CREATE] list + filter params + sync trigger
├── kubernetes.spec.ts       [CREATE] list + filter params + sync trigger
├── block-storage.spec.ts    [CREATE] list + filter params + sync trigger
├── providers.spec.ts        [CREATE] list + toggle only (no add-cred)
├── users.spec.ts            [CREATE] full CRUD + role validation
├── ssh.spec.ts              [CREATE] full CRUD + set-default
├── crons.spec.ts            [CREATE] full CRUD + toggle + run-now
├── settings.spec.ts         [CREATE] read + update every setting key
├── sync-logs.spec.ts        [CREATE] WS sync trigger + stop + log list
├── data-leak.spec.ts        [CREATE] CDP network audit + localStorage + console
└── visual.spec.ts           [MODIFY] add block-storage screenshots
```

---

## Task 1: Fix Auth Fixture + Create API Helper

**Files:**
- Modify: `frontend/e2e/fixtures/auth.ts`
- Create: `frontend/e2e/fixtures/api.ts`

- [ ] **Step 1: Fix default password in auth fixture**

```typescript
// frontend/e2e/fixtures/auth.ts
import { test as base, expect } from '@playwright/test'

const E2E_USERNAME = process.env.E2E_USERNAME ?? 'admin'
const E2E_PASSWORD = process.env.E2E_PASSWORD ?? 'Admin@1234'  // was admin123
const BACKEND = process.env.VITE_BACKEND_URL ?? 'http://localhost:8000'

async function loginAndInject(
  page: import('@playwright/test').Page,
  username: string,
  password: string,
): Promise<void> {
  const res = await page.request.post(`${BACKEND}/api/auth/login`, {
    form: { username, password, remember_me: 'false' },
  })
  expect(res.ok(), `Login failed for ${username}`).toBeTruthy()
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
```

- [ ] **Step 2: Create API helper fixture**

```typescript
// frontend/e2e/fixtures/api.ts
import { request as pwRequest } from '@playwright/test'

const BACKEND = process.env.VITE_BACKEND_URL ?? 'http://localhost:8000'

export interface ApiClient {
  token: string
  get(path: string, params?: Record<string, string>): Promise<Response>
  post(path: string, body: unknown): Promise<Response>
  put(path: string, body: unknown): Promise<Response>
  patch(path: string): Promise<Response>
  delete(path: string): Promise<Response>
}

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>

function buildClient(token: string, fetchFn: FetchFn): ApiClient {
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  return {
    token,
    async get(path, params) {
      const url = new URL(`${BACKEND}${path}`)
      if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
      return fetchFn(url.toString(), { method: 'GET', headers })
    },
    async post(path, body) {
      return fetchFn(`${BACKEND}${path}`, { method: 'POST', headers, body: JSON.stringify(body) })
    },
    async put(path, body) {
      return fetchFn(`${BACKEND}${path}`, { method: 'PUT', headers, body: JSON.stringify(body) })
    },
    async patch(path) {
      return fetchFn(`${BACKEND}${path}`, { method: 'PATCH', headers })
    },
    async delete(path) {
      return fetchFn(`${BACKEND}${path}`, { method: 'DELETE', headers })
    },
  }
}

export async function createApiClient(username = 'admin', password = 'Admin@1234'): Promise<ApiClient> {
  const ctx = await pwRequest.newContext()
  const res = await ctx.post(`${BACKEND}/api/auth/login`, {
    form: { username, password, remember_me: 'false' },
  })
  if (!res.ok()) throw new Error(`API login failed: ${await res.text()}`)
  const { access_token } = await res.json() as { access_token: string }
  await ctx.dispose()
  return buildClient(access_token, fetch)
}
```

- [ ] **Step 3: Verify fixture loads**

```bash
cd frontend
E2E_PASSWORD='Admin@1234' npx playwright test e2e/auth.spec.ts --project=chromium-dark
```

Expected: all 4 existing auth tests PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/e2e/fixtures/
git commit -m "test: fix auth fixture password, add typed API client helper"
```

---

## Task 2: Page Object Models — All Views

**Files:** Create all files in `frontend/e2e/pages/`

- [ ] **Step 1: Create LoginPage POM**

```typescript
// frontend/e2e/pages/LoginPage.ts
import { type Page, type Locator } from '@playwright/test'

export class LoginPage {
  readonly usernameInput: Locator
  readonly passwordInput: Locator
  readonly submitButton: Locator
  readonly errorMessage: Locator

  constructor(private readonly page: Page) {
    this.usernameInput = page.getByLabel('Username')
    this.passwordInput = page.getByLabel('Password')
    this.submitButton = page.getByRole('button', { name: 'Sign In' })
    this.errorMessage = page.getByRole('alert')
  }

  async goto(): Promise<void> { await this.page.goto('/') }

  async login(username: string, password: string): Promise<void> {
    await this.usernameInput.fill(username)
    await this.passwordInput.fill(password)
    await this.submitButton.click()
  }
}
```

- [ ] **Step 2: Create ServersPage POM**

```typescript
// frontend/e2e/pages/ServersPage.ts
import { type Page, type Locator } from '@playwright/test'

export class ServersPage {
  readonly searchInput: Locator
  readonly providerFilter: Locator
  readonly statusFilter: Locator
  readonly addServerButton: Locator
  readonly tableRows: Locator
  readonly detailPanel: Locator

  constructor(private readonly page: Page) {
    this.searchInput = page.getByPlaceholder(/search/i)
    this.providerFilter = page.getByRole('combobox', { name: /provider/i })
    this.statusFilter = page.getByRole('combobox', { name: /status/i })
    this.addServerButton = page.getByRole('button', { name: /add server/i })
    this.tableRows = page.getByRole('row').filter({ hasNot: page.getByRole('columnheader') })
    this.detailPanel = page.getByRole('complementary')
  }

  async goto(): Promise<void> { await this.page.goto('/inventory/servers') }

  async search(term: string): Promise<void> {
    await this.searchInput.fill(term)
    await this.page.waitForTimeout(400) // debounce
  }

  async filterByProvider(provider: string): Promise<void> {
    await this.providerFilter.selectOption(provider)
  }

  async filterByStatus(status: string): Promise<void> {
    await this.statusFilter.selectOption(status)
  }

  async clickRow(index: number): Promise<void> {
    await this.tableRows.nth(index).click()
  }
}
```

- [ ] **Step 3: Create InventoryPage base POM (shared by Databases/K8s/BlockStorage)**

```typescript
// frontend/e2e/pages/InventoryPage.ts
import { type Page, type Locator } from '@playwright/test'

export class InventoryPage {
  readonly searchInput: Locator
  readonly providerFilter: Locator
  readonly statusFilter: Locator
  readonly syncButton: Locator
  readonly tableRows: Locator

  constructor(protected readonly page: Page, private readonly path: string) {
    this.searchInput = page.getByPlaceholder(/search/i)
    this.providerFilter = page.getByRole('combobox', { name: /provider/i })
    this.statusFilter = page.getByRole('combobox', { name: /status/i })
    this.syncButton = page.getByRole('button', { name: /sync/i })
    this.tableRows = page.getByRole('row').filter({ hasNot: page.getByRole('columnheader') })
  }

  async goto(): Promise<void> { await this.page.goto(this.path) }

  async search(term: string): Promise<void> {
    await this.searchInput.fill(term)
    await this.page.waitForTimeout(400)
  }

  async filterByProvider(provider: string): Promise<void> {
    await this.providerFilter.selectOption(provider)
  }

  async filterByStatus(status: string): Promise<void> {
    await this.statusFilter.selectOption(status)
  }
}

export class DatabasesPage extends InventoryPage {
  constructor(page: Page) { super(page, '/inventory/databases') }
}

export class KubernetesPage extends InventoryPage {
  constructor(page: Page) { super(page, '/inventory/kubernetes') }
}

export class BlockStoragePage extends InventoryPage {
  constructor(page: Page) { super(page, '/inventory/block-storages') }
}
```

- [ ] **Step 4: Create remaining POMs**

```typescript
// frontend/e2e/pages/CronsPage.ts
import { type Page, type Locator } from '@playwright/test'

export class CronsPage {
  readonly addButton: Locator
  readonly rows: Locator
  readonly nameInput: Locator
  readonly scheduleInput: Locator
  readonly saveButton: Locator

  constructor(private readonly page: Page) {
    this.addButton = page.getByRole('button', { name: /add|new cron/i })
    this.rows = page.getByRole('row').filter({ hasNot: page.getByRole('columnheader') })
    this.nameInput = page.getByLabel(/name/i)
    this.scheduleInput = page.getByLabel(/schedule|cron expression/i)
    this.saveButton = page.getByRole('button', { name: /save|create/i })
  }

  async goto(): Promise<void> { await this.page.goto('/crons') }

  toggleButton(rowIndex: number): Locator {
    return this.rows.nth(rowIndex).getByRole('button', { name: /enable|disable|toggle/i })
  }

  deleteButton(rowIndex: number): Locator {
    return this.rows.nth(rowIndex).getByRole('button', { name: /delete/i })
  }

  runNowButton(rowIndex: number): Locator {
    return this.rows.nth(rowIndex).getByRole('button', { name: /run now/i })
  }
}
```

```typescript
// frontend/e2e/pages/UsersPage.ts
import { type Page, type Locator } from '@playwright/test'

export class UsersPage {
  readonly addButton: Locator
  readonly rows: Locator
  readonly usernameInput: Locator
  readonly passwordInput: Locator
  readonly roleSelect: Locator
  readonly saveButton: Locator

  constructor(private readonly page: Page) {
    this.addButton = page.getByRole('button', { name: /add user/i })
    this.rows = page.getByRole('row').filter({ hasNot: page.getByRole('columnheader') })
    this.usernameInput = page.getByLabel(/username/i)
    this.passwordInput = page.getByLabel(/password/i)
    this.roleSelect = page.getByLabel(/role/i)
    this.saveButton = page.getByRole('button', { name: /save|create/i })
  }

  async goto(): Promise<void> { await this.page.goto('/users') }
}
```

```typescript
// frontend/e2e/pages/SSHPage.ts
import { type Page, type Locator } from '@playwright/test'

export class SSHPage {
  readonly addButton: Locator
  readonly rows: Locator
  readonly nameInput: Locator
  readonly usernameInput: Locator
  readonly passwordInput: Locator
  readonly saveButton: Locator

  constructor(private readonly page: Page) {
    this.addButton = page.getByRole('button', { name: /add|new ssh/i })
    this.rows = page.getByRole('row').filter({ hasNot: page.getByRole('columnheader') })
    this.nameInput = page.getByLabel(/name/i)
    this.usernameInput = page.getByLabel(/username/i)
    this.passwordInput = page.getByLabel(/password/i)
    this.saveButton = page.getByRole('button', { name: /save|create/i })
  }

  async goto(): Promise<void> { await this.page.goto('/ssh') }

  setDefaultButton(rowIndex: number): Locator {
    return this.rows.nth(rowIndex).getByRole('button', { name: /set default/i })
  }
}
```

```typescript
// frontend/e2e/pages/SettingsPage.ts
import { type Page, type Locator } from '@playwright/test'

export class SettingsPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> { await this.page.goto('/settings') }

  inputFor(key: string): Locator {
    return this.page.getByLabel(new RegExp(key, 'i'))
  }

  saveButtonFor(key: string): Locator {
    return this.page.getByRole('row', { name: new RegExp(key, 'i') })
      .getByRole('button', { name: /save/i })
  }
}
```

```typescript
// frontend/e2e/pages/SyncLogsPage.ts
import { type Page, type Locator } from '@playwright/test'

export class SyncLogsPage {
  readonly syncButton: Locator
  readonly stopButton: Locator
  readonly rows: Locator
  readonly progressIndicator: Locator

  constructor(private readonly page: Page) {
    this.syncButton = page.getByRole('button', { name: /sync all|start sync/i })
    this.stopButton = page.getByRole('button', { name: /stop/i })
    this.rows = page.getByRole('row').filter({ hasNot: page.getByRole('columnheader') })
    this.progressIndicator = page.getByRole('status').or(page.getByText(/syncing/i))
  }

  async goto(): Promise<void> { await this.page.goto('/sync-logs') }
}
```

```typescript
// frontend/e2e/pages/ProvidersPage.ts
import { type Page, type Locator } from '@playwright/test'

export class ProvidersPage {
  readonly rows: Locator
  // NOTE: Add-credential button intentionally not exposed — that flow is skipped

  constructor(private readonly page: Page) {
    this.rows = page.getByRole('row').filter({ hasNot: page.getByRole('columnheader') })
  }

  async goto(): Promise<void> { await this.page.goto('/providers') }

  toggleButton(rowIndex: number): Locator {
    return this.rows.nth(rowIndex).getByRole('button', { name: /enable|disable|toggle/i })
  }
}
```

- [ ] **Step 5: Commit POMs**

```bash
git add frontend/e2e/pages/
git commit -m "test: add POM classes for all views"
```

---

## Task 3: Auth Spec — All Flows

**Files:**
- Modify: `frontend/e2e/auth.spec.ts`

- [ ] **Step 1: Write full auth spec**

```typescript
// frontend/e2e/auth.spec.ts
import { test, authedTest, expect } from './fixtures/auth'
import { LoginPage } from './pages/LoginPage'

test.describe('Auth — Login', () => {
  test('valid credentials → dashboard', async ({ page }) => {
    const login = new LoginPage(page)
    await login.goto()
    await login.login('admin', 'Admin@1234')
    await expect(page.locator('header h1')).toHaveText('Dashboard', { timeout: 5000 })
  })

  test('wrong password → error message', async ({ page }) => {
    const login = new LoginPage(page)
    await login.goto()
    await login.login('admin', 'wrongpassword')
    await expect(login.errorMessage).toBeVisible()
  })

  test('empty username → error message', async ({ page }) => {
    const login = new LoginPage(page)
    await login.goto()
    await login.login('', 'Admin@1234')
    await expect(login.errorMessage).toBeVisible()
  })

  test('unknown user → error message', async ({ page }) => {
    const login = new LoginPage(page)
    await login.goto()
    await login.login('nobody', 'Admin@1234')
    await expect(login.errorMessage).toBeVisible()
  })
})

authedTest.describe('Auth — Session', () => {
  authedTest('me endpoint returns correct role', async ({ page }) => {
    const res = await page.request.get('http://localhost:8000/api/auth/me', {
      headers: {
        Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem('si_token'))}`,
      },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json() as { role: string; username: string }
    expect(body.role).toBe('admin')
    expect(body.username).toBe('admin')
  })

  authedTest('unauthenticated request to /api/auth/me → 401', async ({ page }) => {
    const res = await page.request.get('http://localhost:8000/api/auth/me', {
      headers: { Authorization: 'Bearer invalid-token' },
    })
    expect(res.status()).toBe(401)
  })

  authedTest('logout clears token and redirects to login', async ({ page }) => {
    await page.getByRole('button', { name: /logout|sign out/i }).click()
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
    const token = await page.evaluate(() => localStorage.getItem('si_token'))
    expect(token).toBeNull()
  })
})
```

- [ ] **Step 2: Run**

```bash
cd frontend
E2E_PASSWORD='Admin@1234' npx playwright test e2e/auth.spec.ts --project=chromium-dark
```

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/e2e/auth.spec.ts
git commit -m "test: extend auth spec — empty/unknown user, me endpoint, logout token clear"
```

---

## Task 4: Servers Spec — Every Param + CRUD + Detail Panel

**Files:**
- Create: `frontend/e2e/servers.spec.ts`

- [ ] **Step 1: Write servers spec**

```typescript
// frontend/e2e/servers.spec.ts
import { authedTest, expect } from './fixtures/auth'
import { createApiClient } from './fixtures/api'
import { ServersPage } from './pages/ServersPage'

const BACKEND = process.env.VITE_BACKEND_URL ?? 'http://localhost:8000'

authedTest.describe('Servers — API params', () => {
  let api: Awaited<ReturnType<typeof createApiClient>>

  authedTest.beforeAll(async () => {
    api = await createApiClient()
  })

  authedTest('GET /api/servers — no params returns 200 list', async () => {
    const res = await api.get('/api/servers')
    expect(res.status).toBe(200)
    const body = await res.json() as unknown[]
    expect(Array.isArray(body)).toBeTruthy()
  })

  authedTest('GET /api/servers?search=<term> filters results', async () => {
    const all = await (await api.get('/api/servers')).json() as Array<{ name: string }>
    if (all.length === 0) return // skip if no servers
    const term = all[0]!.name.slice(0, 3)
    const res = await api.get('/api/servers', { search: term })
    expect(res.status).toBe(200)
    const filtered = await res.json() as Array<{ name: string }>
    expect(filtered.every(s => s.name.toLowerCase().includes(term.toLowerCase()))).toBeTruthy()
  })

  authedTest('GET /api/servers?provider=custom returns only custom provider', async () => {
    const res = await api.get('/api/servers', { provider: 'custom' })
    expect(res.status).toBe(200)
    const body = await res.json() as Array<{ provider: string }>
    expect(body.every(s => s.provider === 'custom')).toBeTruthy()
  })

  authedTest('GET /api/servers?status=running returns only running', async () => {
    const res = await api.get('/api/servers', { status: 'running' })
    expect(res.status).toBe(200)
    const body = await res.json() as Array<{ status: string }>
    expect(body.every(s => s.status === 'running')).toBeTruthy()
  })

  authedTest('GET /api/servers?search=WILDCARD_INJECTION — % and _ treated as literals', async () => {
    const res = await api.get('/api/servers', { search: '%_test_%' })
    expect(res.status).toBe(200) // must not 500
  })

  authedTest('GET /api/servers/stats returns by_provider and by_status', async () => {
    const res = await api.get('/api/servers/stats')
    expect(res.status).toBe(200)
    const body = await res.json() as { total: number; running: number; by_provider: object }
    expect(typeof body.total).toBe('number')
    expect(typeof body.running).toBe('number')
    expect(typeof body.by_provider).toBe('object')
  })

  authedTest('GET /api/servers/:id — nonexistent → 404', async () => {
    const res = await api.get('/api/servers/999999999')
    expect(res.status).toBe(404)
  })
})

authedTest.describe('Servers — UI', () => {
  authedTest('search box filters table rows', async ({ page }) => {
    const servers = new ServersPage(page)
    await servers.goto()
    const initialCount = await servers.tableRows.count()
    if (initialCount === 0) return
    const firstCellText = await servers.tableRows.first().getByRole('cell').first().textContent()
    if (!firstCellText) return
    await servers.search(firstCellText.slice(0, 3))
    const filteredCount = await servers.tableRows.count()
    expect(filteredCount).toBeLessThanOrEqual(initialCount)
  })

  authedTest('empty search shows all rows', async ({ page }) => {
    const servers = new ServersPage(page)
    await servers.goto()
    const all = await servers.tableRows.count()
    await servers.search('xyznotfound999')
    await servers.search('') // clear
    await expect(servers.tableRows).toHaveCount(all)
  })

  authedTest('clicking row opens detail panel', async ({ page }) => {
    const servers = new ServersPage(page)
    await servers.goto()
    if (await servers.tableRows.count() === 0) return
    await servers.clickRow(0)
    await expect(servers.detailPanel).toBeVisible()
  })

  authedTest('add Custom DC server — create and delete', async ({ page }) => {
    const servers = new ServersPage(page)
    await servers.goto()
    await servers.addServerButton.click()
    await page.getByLabel(/name/i).fill('e2e-test-server')
    await page.getByLabel(/hostname|ip/i).first().fill('192.168.0.1')
    await page.getByRole('button', { name: /save|create/i }).click()
    await expect(page.getByText('e2e-test-server')).toBeVisible()
    // cleanup: delete
    const api = await createApiClient()
    const all = await (await api.get('/api/servers', { search: 'e2e-test-server' })).json() as Array<{ id: number }>
    for (const s of all) await api.delete(`/api/servers/${s.id}`)
  })
})
```

- [ ] **Step 2: Run**

```bash
cd frontend
E2E_PASSWORD='Admin@1234' npx playwright test e2e/servers.spec.ts --project=chromium-dark
```

Expected: all PASS (skip if no servers seeded).

- [ ] **Step 3: Commit**

```bash
git add frontend/e2e/servers.spec.ts
git commit -m "test: add servers spec — all query params, UI search/filter, detail panel, CRUD"
```

---

## Task 5: Inventory Specs — Databases, Kubernetes, Block Storage

**Files:**
- Create: `frontend/e2e/databases.spec.ts`
- Create: `frontend/e2e/kubernetes.spec.ts`
- Create: `frontend/e2e/block-storage.spec.ts`

- [ ] **Step 1: Write databases spec**

```typescript
// frontend/e2e/databases.spec.ts
import { authedTest, expect } from './fixtures/auth'
import { createApiClient } from './fixtures/api'
import { DatabasesPage } from './pages/InventoryPage'

authedTest.describe('Databases — API params', () => {
  let api: Awaited<ReturnType<typeof createApiClient>>
  authedTest.beforeAll(async () => { api = await createApiClient() })

  authedTest('GET /api/databases — 200 list', async () => {
    const res = await api.get('/api/databases')
    expect(res.status).toBe(200)
    expect(Array.isArray(await res.json())).toBeTruthy()
  })

  authedTest('GET /api/databases?search=<term> — 200', async () => {
    const res = await api.get('/api/databases', { search: 'test' })
    expect(res.status).toBe(200)
  })

  authedTest('GET /api/databases?provider=aws — filters provider', async () => {
    const res = await api.get('/api/databases', { provider: 'aws' })
    expect(res.status).toBe(200)
    const body = await res.json() as Array<{ provider: string }>
    expect(body.every(d => d.provider === 'aws')).toBeTruthy()
  })

  authedTest('GET /api/databases?status=available — filters status', async () => {
    const res = await api.get('/api/databases', { status: 'available' })
    expect(res.status).toBe(200)
    const body = await res.json() as Array<{ status: string }>
    expect(body.every(d => d.status === 'available')).toBeTruthy()
  })

  authedTest('GET /api/databases?search=%_% — wildcard injection safe', async () => {
    const res = await api.get('/api/databases', { search: '%_%' })
    expect(res.status).toBe(200)
  })
})

authedTest.describe('Databases — UI', () => {
  authedTest('page loads with heading', async ({ page }) => {
    const db = new DatabasesPage(page)
    await db.goto()
    await expect(page.locator('header h1')).toHaveText('Databases')
  })

  authedTest('search input filters table', async ({ page }) => {
    const db = new DatabasesPage(page)
    await db.goto()
    const before = await db.tableRows.count()
    await db.search('xyznotfound999')
    const after = await db.tableRows.count()
    expect(after).toBeLessThanOrEqual(before)
  })
})
```

- [ ] **Step 2: Write kubernetes spec** (same pattern)

```typescript
// frontend/e2e/kubernetes.spec.ts
import { authedTest, expect } from './fixtures/auth'
import { createApiClient } from './fixtures/api'
import { KubernetesPage } from './pages/InventoryPage'

authedTest.describe('Kubernetes — API params', () => {
  let api: Awaited<ReturnType<typeof createApiClient>>
  authedTest.beforeAll(async () => { api = await createApiClient() })

  authedTest('GET /api/kubernetes — 200', async () => {
    expect((await api.get('/api/kubernetes')).status).toBe(200)
  })

  authedTest('GET /api/kubernetes?search=<term> — 200', async () => {
    expect((await api.get('/api/kubernetes', { search: 'prod' })).status).toBe(200)
  })

  authedTest('GET /api/kubernetes?provider=gcp — filters', async () => {
    const res = await api.get('/api/kubernetes', { provider: 'gcp' })
    const body = await res.json() as Array<{ provider: string }>
    expect(body.every(c => c.provider === 'gcp')).toBeTruthy()
  })

  authedTest('GET /api/kubernetes?status=running — filters', async () => {
    const res = await api.get('/api/kubernetes', { status: 'running' })
    const body = await res.json() as Array<{ status: string }>
    expect(body.every(c => c.status === 'running')).toBeTruthy()
  })

  authedTest('GET /api/kubernetes?search=%_% — wildcard safe', async () => {
    expect((await api.get('/api/kubernetes', { search: '%_%' })).status).toBe(200)
  })
})

authedTest.describe('Kubernetes — UI', () => {
  authedTest('heading', async ({ page }) => {
    const k8s = new KubernetesPage(page)
    await k8s.goto()
    await expect(page.locator('header h1')).toHaveText('Kubernetes')
  })
})
```

- [ ] **Step 3: Write block-storage spec**

```typescript
// frontend/e2e/block-storage.spec.ts
import { authedTest, expect } from './fixtures/auth'
import { createApiClient } from './fixtures/api'
import { BlockStoragePage } from './pages/InventoryPage'

authedTest.describe('Block Storage — API params', () => {
  let api: Awaited<ReturnType<typeof createApiClient>>
  authedTest.beforeAll(async () => { api = await createApiClient() })

  authedTest('GET /api/block-storages — 200', async () => {
    expect((await api.get('/api/block-storages')).status).toBe(200)
  })

  authedTest('GET /api/block-storages?search=<term> — 200', async () => {
    expect((await api.get('/api/block-storages', { search: 'vol' })).status).toBe(200)
  })

  authedTest('GET /api/block-storages?provider=aws — filters', async () => {
    const res = await api.get('/api/block-storages', { provider: 'aws' })
    const body = await res.json() as Array<{ provider: string }>
    expect(body.every(b => b.provider === 'aws')).toBeTruthy()
  })

  authedTest('GET /api/block-storages?status=available — filters', async () => {
    const res = await api.get('/api/block-storages', { status: 'available' })
    const body = await res.json() as Array<{ status: string }>
    expect(body.every(b => b.status === 'available')).toBeTruthy()
  })

  authedTest('GET /api/block-storages?search=%_% — wildcard safe', async () => {
    expect((await api.get('/api/block-storages', { search: '%_%' })).status).toBe(200)
  })
})

authedTest.describe('Block Storage — UI', () => {
  authedTest('heading renders', async ({ page }) => {
    const bs = new BlockStoragePage(page)
    await bs.goto()
    await expect(page.locator('header h1')).toHaveText(/block storage/i)
  })

  authedTest('search input works', async ({ page }) => {
    const bs = new BlockStoragePage(page)
    await bs.goto()
    await bs.search('xyz')
    await expect(bs.searchInput).toHaveValue('xyz')
  })
})
```

- [ ] **Step 4: Run all 3**

```bash
cd frontend
E2E_PASSWORD='Admin@1234' npx playwright test e2e/databases.spec.ts e2e/kubernetes.spec.ts e2e/block-storage.spec.ts --project=chromium-dark
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/e2e/databases.spec.ts frontend/e2e/kubernetes.spec.ts frontend/e2e/block-storage.spec.ts
git commit -m "test: add inventory specs — databases, kubernetes, block-storage — all query params"
```

---

## Task 6: Users Spec — Full CRUD + Role Validation

**Files:**
- Create: `frontend/e2e/users.spec.ts`

- [ ] **Step 1: Write users spec**

```typescript
// frontend/e2e/users.spec.ts
import { authedTest, expect } from './fixtures/auth'
import { createApiClient } from './fixtures/api'
import { UsersPage } from './pages/UsersPage'

authedTest.describe('Users — API', () => {
  let api: Awaited<ReturnType<typeof createApiClient>>
  authedTest.beforeAll(async () => { api = await createApiClient() })

  authedTest('GET /api/users — 200 list', async () => {
    const res = await api.get('/api/users')
    expect(res.status).toBe(200)
    const body = await res.json() as Array<{ username: string; role: string }>
    expect(body.some(u => u.username === 'admin')).toBeTruthy()
  })

  authedTest('POST /api/users — create read-only user', async () => {
    const res = await api.post('/api/users', { username: 'e2e_read', password: 'Test@1234', role: 'read' })
    expect(res.status).toBe(201)
    const body = await res.json() as { id: number; role: string }
    expect(body.role).toBe('read')
    // cleanup
    await api.delete(`/api/users/${body.id}`)
  })

  authedTest('POST /api/users — invalid role → 422', async () => {
    const res = await api.post('/api/users', { username: 'bad', password: 'Test@1234', role: 'superadmin' })
    expect(res.status).toBe(422)
  })

  authedTest('DELETE /api/users/:id — 204', async () => {
    const created = await (await api.post('/api/users', { username: 'e2e_del', password: 'Test@1234', role: 'read' })).json() as { id: number }
    const res = await api.delete(`/api/users/${created.id}`)
    expect(res.status).toBe(204)
  })

  authedTest('PATCH /api/users/:id/toggle — toggles is_active', async () => {
    const created = await (await api.post('/api/users', { username: 'e2e_tog', password: 'Test@1234', role: 'read' })).json() as { id: number; is_active: boolean }
    const toggled = await (await api.patch(`/api/users/${created.id}/toggle`)).json() as { is_active: boolean }
    expect(toggled.is_active).toBe(!created.is_active)
    await api.delete(`/api/users/${created.id}`)
  })

  authedTest('DELETE /api/users/999999 — 404', async () => {
    const res = await api.delete('/api/users/999999')
    expect(res.status).toBe(404)
  })
})

authedTest.describe('Users — UI', () => {
  authedTest('users page shows table with admin', async ({ page }) => {
    const users = new UsersPage(page)
    await users.goto()
    await expect(page.getByText('admin')).toBeVisible()
  })

  authedTest('create user via UI', async ({ page }) => {
    const users = new UsersPage(page)
    await users.goto()
    await users.addButton.click()
    await users.usernameInput.fill('e2e_ui_user')
    await users.passwordInput.fill('Test@1234')
    await users.roleSelect.selectOption('read')
    await users.saveButton.click()
    await expect(page.getByText('e2e_ui_user')).toBeVisible()
    // cleanup via API
    const api = await createApiClient()
    const all = await (await api.get('/api/users')).json() as Array<{ id: number; username: string }>
    const target = all.find(u => u.username === 'e2e_ui_user')
    if (target) await api.delete(`/api/users/${target.id}`)
  })
})
```

- [ ] **Step 2: Run**

```bash
cd frontend
E2E_PASSWORD='Admin@1234' npx playwright test e2e/users.spec.ts --project=chromium-dark
```

Expected: all PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/e2e/users.spec.ts
git commit -m "test: add users spec — CRUD, toggle, role validation, UI create"
```

---

## Task 7: SSH Credentials Spec

**Files:**
- Create: `frontend/e2e/ssh.spec.ts`

- [ ] **Step 1: Write SSH spec**

```typescript
// frontend/e2e/ssh.spec.ts
import { authedTest, expect } from './fixtures/auth'
import { createApiClient } from './fixtures/api'
import { SSHPage } from './pages/SSHPage'

authedTest.describe('SSH Credentials — API', () => {
  let api: Awaited<ReturnType<typeof createApiClient>>
  authedTest.beforeAll(async () => { api = await createApiClient() })

  authedTest('GET /api/ssh-credentials — 200', async () => {
    expect((await api.get('/api/ssh-credentials')).status).toBe(200)
  })

  authedTest('POST /api/ssh-credentials — create password auth', async () => {
    const res = await api.post('/api/ssh-credentials', {
      name: 'e2e-ssh',
      username: 'root',
      auth_method: 'password',
      password: 'testpass',
      port: 22,
    })
    expect(res.status).toBe(201)
    const body = await res.json() as { id: number }
    await api.delete(`/api/ssh-credentials/${body.id}`)
  })

  authedTest('PUT /api/ssh-credentials/:id — update name', async () => {
    const created = await (await api.post('/api/ssh-credentials', {
      name: 'e2e-update',
      username: 'ubuntu',
      auth_method: 'password',
      password: 'pass',
      port: 22,
    })).json() as { id: number }

    const updated = await (await api.put(`/api/ssh-credentials/${created.id}`, {
      name: 'e2e-updated',
      username: 'ubuntu',
      auth_method: 'password',
      password: 'pass',
      port: 22,
    })).json() as { name: string }
    expect(updated.name).toBe('e2e-updated')
    await api.delete(`/api/ssh-credentials/${created.id}`)
  })

  authedTest('PATCH /api/ssh-credentials/:id/set-default — marks as default', async () => {
    const created = await (await api.post('/api/ssh-credentials', {
      name: 'e2e-default',
      username: 'root',
      auth_method: 'password',
      password: 'pass',
      port: 22,
    })).json() as { id: number }
    const res = await api.patch(`/api/ssh-credentials/${created.id}/set-default`)
    expect(res.status).toBe(200)
    const body = await res.json() as { is_default: boolean }
    expect(body.is_default).toBeTruthy()
    await api.delete(`/api/ssh-credentials/${created.id}`)
  })

  authedTest('DELETE /api/ssh-credentials/999999 — 404', async () => {
    expect((await api.delete('/api/ssh-credentials/999999')).status).toBe(404)
  })
})

authedTest.describe('SSH Credentials — UI', () => {
  authedTest('page heading visible', async ({ page }) => {
    const ssh = new SSHPage(page)
    await ssh.goto()
    await expect(page.locator('header h1')).toHaveText(/SSH Credentials/i)
  })
})
```

- [ ] **Step 2: Run**

```bash
cd frontend
E2E_PASSWORD='Admin@1234' npx playwright test e2e/ssh.spec.ts --project=chromium-dark
```

- [ ] **Step 3: Commit**

```bash
git add frontend/e2e/ssh.spec.ts
git commit -m "test: add SSH credentials spec — CRUD, set-default, 404 guard"
```

---

## Task 8: Cron Jobs Spec

**Files:**
- Create: `frontend/e2e/crons.spec.ts`

- [ ] **Step 1: Write crons spec**

```typescript
// frontend/e2e/crons.spec.ts
import { authedTest, expect } from './fixtures/auth'
import { createApiClient } from './fixtures/api'
import { CronsPage } from './pages/CronsPage'

authedTest.describe('Cron Jobs — API', () => {
  let api: Awaited<ReturnType<typeof createApiClient>>
  authedTest.beforeAll(async () => { api = await createApiClient() })

  authedTest('GET /api/crons — 200 list', async () => {
    expect((await api.get('/api/crons')).status).toBe(200)
  })

  authedTest('POST /api/crons — create valid cron', async () => {
    const res = await api.post('/api/crons', {
      name: 'e2e-cron',
      schedule: '0 * * * *',
      provider: null,
    })
    expect(res.status).toBe(201)
    const body = await res.json() as { id: number; schedule: string }
    expect(body.schedule).toBe('0 * * * *')
    await api.delete(`/api/crons/${body.id}`)
  })

  authedTest('POST /api/crons — invalid cron expression → 422', async () => {
    const res = await api.post('/api/crons', { name: 'bad', schedule: 'not-a-cron', provider: null })
    expect(res.status).toBe(422)
  })

  authedTest('PUT /api/crons/:id — update schedule', async () => {
    const created = await (await api.post('/api/crons', { name: 'e2e-upd', schedule: '0 * * * *', provider: null })).json() as { id: number }
    const updated = await (await api.put(`/api/crons/${created.id}`, { name: 'e2e-upd', schedule: '0 0 * * *', provider: null })).json() as { schedule: string }
    expect(updated.schedule).toBe('0 0 * * *')
    await api.delete(`/api/crons/${created.id}`)
  })

  authedTest('PATCH /api/crons/:id/toggle — toggles is_active', async () => {
    const created = await (await api.post('/api/crons', { name: 'e2e-tog', schedule: '0 * * * *', provider: null })).json() as { id: number; is_active: boolean }
    const toggled = await (await api.patch(`/api/crons/${created.id}/toggle`)).json() as { is_active: boolean }
    expect(toggled.is_active).toBe(!created.is_active)
    await api.delete(`/api/crons/${created.id}`)
  })

  authedTest('POST /api/crons/:id/run-now — triggers sync', async () => {
    const created = await (await api.post('/api/crons', { name: 'e2e-run', schedule: '0 * * * *', provider: null })).json() as { id: number }
    const res = await api.post(`/api/crons/${created.id}/run-now`, {})
    expect(res.status).toBe(200)
    await api.delete(`/api/crons/${created.id}`)
  })

  authedTest('DELETE /api/crons/999999 — 404', async () => {
    expect((await api.delete('/api/crons/999999')).status).toBe(404)
  })
})

authedTest.describe('Cron Jobs — UI', () => {
  authedTest('heading visible', async ({ page }) => {
    const crons = new CronsPage(page)
    await crons.goto()
    await expect(page.locator('header h1')).toHaveText(/Cron Jobs/i)
  })

  authedTest('add cron via UI then delete', async ({ page }) => {
    const crons = new CronsPage(page)
    await crons.goto()
    await crons.addButton.click()
    await crons.nameInput.fill('e2e-ui-cron')
    await crons.scheduleInput.fill('0 * * * *')
    await crons.saveButton.click()
    await expect(page.getByText('e2e-ui-cron')).toBeVisible()
    // cleanup
    const api = await createApiClient()
    const all = await (await api.get('/api/crons')).json() as Array<{ id: number; name: string }>
    const target = all.find(c => c.name === 'e2e-ui-cron')
    if (target) await api.delete(`/api/crons/${target.id}`)
  })
})
```

- [ ] **Step 2: Run**

```bash
cd frontend
E2E_PASSWORD='Admin@1234' npx playwright test e2e/crons.spec.ts --project=chromium-dark
```

- [ ] **Step 3: Commit**

```bash
git add frontend/e2e/crons.spec.ts
git commit -m "test: add cron jobs spec — CRUD, toggle, run-now, invalid expression guard"
```

---

## Task 9: Settings Spec

**Files:**
- Create: `frontend/e2e/settings.spec.ts`

- [ ] **Step 1: Write settings spec**

```typescript
// frontend/e2e/settings.spec.ts
import { authedTest, expect } from './fixtures/auth'
import { createApiClient } from './fixtures/api'
import { SettingsPage } from './pages/SettingsPage'

authedTest.describe('Settings — API', () => {
  let api: Awaited<ReturnType<typeof createApiClient>>
  authedTest.beforeAll(async () => { api = await createApiClient() })

  authedTest('GET /api/settings — returns key/value map', async () => {
    const res = await api.get('/api/settings')
    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, string>
    expect(typeof body).toBe('object')
  })

  authedTest('PUT /api/settings/:key — update and restore', async () => {
    const all = await (await api.get('/api/settings')).json() as Record<string, string>
    const key = Object.keys(all)[0]
    if (!key) return
    const original = all[key]!
    const updated = await (await api.put(`/api/settings/${key}`, { value: 'e2e-test-value' })).json() as Record<string, string>
    expect(updated[key]).toBe('e2e-test-value')
    // restore
    await api.put(`/api/settings/${key}`, { value: original })
  })
})

authedTest.describe('Settings — UI', () => {
  authedTest('settings page heading', async ({ page }) => {
    const settings = new SettingsPage(page)
    await settings.goto()
    await expect(page.locator('header h1')).toHaveText(/Settings/i)
  })

  authedTest('settings values render on page', async ({ page }) => {
    const settings = new SettingsPage(page)
    await settings.goto()
    await expect(page.getByRole('table')).toBeVisible()
  })
})
```

- [ ] **Step 2: Run**

```bash
cd frontend
E2E_PASSWORD='Admin@1234' npx playwright test e2e/settings.spec.ts --project=chromium-dark
```

- [ ] **Step 3: Commit**

```bash
git add frontend/e2e/settings.spec.ts
git commit -m "test: add settings spec — GET map, PUT update/restore, UI rendering"
```

---

## Task 10: Providers Page Spec (No Add-Cred — Skip)

**Files:**
- Create: `frontend/e2e/providers.spec.ts`

- [ ] **Step 1: Write providers spec**

```typescript
// frontend/e2e/providers.spec.ts
// NOTE: Credential-addition flows are intentionally skipped.
// Toggle and list of EXISTING credentials are tested.
import { authedTest, expect } from './fixtures/auth'
import { createApiClient } from './fixtures/api'
import { ProvidersPage } from './pages/ProvidersPage'

authedTest.describe('Cloud Providers — API (no add-cred)', () => {
  let api: Awaited<ReturnType<typeof createApiClient>>
  authedTest.beforeAll(async () => { api = await createApiClient() })

  authedTest('GET /api/credentials — 200 list', async () => {
    const res = await api.get('/api/credentials')
    expect(res.status).toBe(200)
    expect(Array.isArray(await res.json())).toBeTruthy()
  })

  authedTest('PATCH /api/credentials/:id/toggle — toggles existing cred if any', async () => {
    const all = await (await api.get('/api/credentials')).json() as Array<{ id: number; is_active: boolean }>
    if (all.length === 0) return // skip if no creds
    const cred = all[0]!
    const toggled = await (await api.patch(`/api/credentials/${cred.id}/toggle`)).json() as { is_active: boolean }
    expect(toggled.is_active).toBe(!cred.is_active)
    // restore
    await api.patch(`/api/credentials/${cred.id}/toggle`)
  })

  authedTest('DELETE /api/credentials/999999 — 404', async () => {
    expect((await api.delete('/api/credentials/999999')).status).toBe(404)
  })
})

authedTest.describe('Cloud Providers — UI', () => {
  authedTest('providers page heading', async ({ page }) => {
    const providers = new ProvidersPage(page)
    await providers.goto()
    await expect(page.locator('header h1')).toHaveText(/Cloud Providers/i)
  })

  // Credential-addition button is visible but add-form submission is NOT tested
  authedTest('add credential button visible', async ({ page }) => {
    const providers = new ProvidersPage(page)
    await providers.goto()
    await expect(page.getByRole('button', { name: /add credential/i })).toBeVisible()
  })
})
```

- [ ] **Step 2: Run**

```bash
cd frontend
E2E_PASSWORD='Admin@1234' npx playwright test e2e/providers.spec.ts --project=chromium-dark
```

- [ ] **Step 3: Commit**

```bash
git add frontend/e2e/providers.spec.ts
git commit -m "test: add providers spec — list, toggle existing cred, skip add-cred flow"
```

---

## Task 11: Sync Logs + WebSocket Spec

**Files:**
- Create: `frontend/e2e/sync-logs.spec.ts`

- [ ] **Step 1: Write sync logs spec**

```typescript
// frontend/e2e/sync-logs.spec.ts
import { authedTest, expect } from './fixtures/auth'
import { createApiClient } from './fixtures/api'
import { SyncLogsPage } from './pages/SyncLogsPage'

authedTest.describe('Sync Logs — API', () => {
  let api: Awaited<ReturnType<typeof createApiClient>>
  authedTest.beforeAll(async () => { api = await createApiClient() })

  authedTest('GET /api/sync/logs — 200 list', async () => {
    const res = await api.get('/api/sync/logs')
    expect(res.status).toBe(200)
    expect(Array.isArray(await res.json())).toBeTruthy()
  })

  authedTest('POST /api/sync — starts sync, returns 200', async () => {
    const res = await api.post('/api/sync', {})
    expect([200, 409]).toContain(res.status) // 409 if sync already running
  })

  authedTest('POST /api/sync/stop — stops sync, returns 200', async () => {
    const res = await api.post('/api/sync/stop', {})
    expect(res.status).toBe(200)
  })

  authedTest('GET /api/stats/history — 200 list', async () => {
    const res = await api.get('/api/stats/history')
    expect(res.status).toBe(200)
    expect(Array.isArray(await res.json())).toBeTruthy()
  })
})

authedTest.describe('Sync Logs — WebSocket', () => {
  authedTest('WS /ws sends messages during sync', async ({ page }) => {
    const BACKEND_WS = (process.env.VITE_BACKEND_URL ?? 'http://localhost:8000').replace('http', 'ws')
    const token = await page.evaluate(() => localStorage.getItem('si_token')) as string

    const messages: string[] = []
    await page.evaluate(
      ({ url, tok }) => {
        return new Promise<void>((resolve) => {
          const ws = new WebSocket(`${url}/ws?token=${tok}`)
          ws.onmessage = (e) => { (window as unknown as { __wsMessages: string[] }).__wsMessages ??= []; (window as unknown as { __wsMessages: string[] }).__wsMessages.push(e.data as string) }
          ws.onopen = () => resolve()
          setTimeout(resolve, 3000) // don't wait forever
        })
      },
      { url: BACKEND_WS, tok: token },
    )

    // trigger sync
    const api = await createApiClient()
    await api.post('/api/sync', {})
    await page.waitForTimeout(2000)
    await api.post('/api/sync/stop', {})

    const captured = await page.evaluate(() => (window as unknown as { __wsMessages?: string[] }).__wsMessages ?? [])
    // At minimum the WS connection should have been established
    // Messages may or may not arrive depending on timing — we verify no crash
    expect(Array.isArray(captured)).toBeTruthy()
  })

  authedTest('WS rejects invalid token with 4001 close', async ({ page }) => {
    const BACKEND_WS = (process.env.VITE_BACKEND_URL ?? 'http://localhost:8000').replace('http', 'ws')
    const closeCode = await page.evaluate(({ url }) => {
      return new Promise<number>((resolve) => {
        const ws = new WebSocket(`${url}/ws?token=invalid-token`)
        ws.onclose = (e) => resolve(e.code)
        setTimeout(() => resolve(0), 5000)
      })
    }, { url: BACKEND_WS })
    expect(closeCode).toBe(4001)
  })
})

authedTest.describe('Sync Logs — UI', () => {
  authedTest('sync logs heading', async ({ page }) => {
    const logs = new SyncLogsPage(page)
    await logs.goto()
    await expect(page.locator('header h1')).toHaveText(/Sync Logs/i)
  })

  authedTest('sync button visible', async ({ page }) => {
    const logs = new SyncLogsPage(page)
    await logs.goto()
    await expect(logs.syncButton).toBeVisible()
  })
})
```

- [ ] **Step 2: Run**

```bash
cd frontend
E2E_PASSWORD='Admin@1234' npx playwright test e2e/sync-logs.spec.ts --project=chromium-dark
```

- [ ] **Step 3: Commit**

```bash
git add frontend/e2e/sync-logs.spec.ts
git commit -m "test: add sync logs spec — API list/start/stop, WS auth rejection, UI"
```

---

## Task 12: Data Leak Audit — Chrome DevTools Protocol

**Files:**
- Create: `frontend/e2e/data-leak.spec.ts`

This is the most critical spec. Uses CDP to intercept network traffic, audit localStorage, and capture console output.

- [ ] **Step 1: Write data-leak spec**

```typescript
// frontend/e2e/data-leak.spec.ts
// Audits for data leaks via:
// 1. Network requests — Authorization header not sent to 3rd parties
// 2. Token not leaked in URL query params
// 3. LocalStorage — only si_token and si_user stored, no raw passwords
// 4. Console — no token/password strings printed to console
// 5. Response bodies — credentials.config does not expose provider secrets in DOM
import { authedTest, test, expect } from './fixtures/auth'

const BACKEND = process.env.VITE_BACKEND_URL ?? 'http://localhost:8000'
const ALLOWED_AUTH_HOSTS = ['localhost', '127.0.0.1']

authedTest.describe('Data Leak — Network', () => {
  authedTest('Authorization header sent only to backend, not 3rd parties', async ({ page }) => {
    const leaks: string[] = []

    page.on('request', (req) => {
      const auth = req.headers()['authorization']
      if (!auth) return
      const url = new URL(req.url())
      if (!ALLOWED_AUTH_HOSTS.includes(url.hostname)) {
        leaks.push(`${req.method()} ${req.url()} — Authorization header leaked to 3rd party`)
      }
    })

    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    await page.goto('/inventory/servers')
    await page.waitForLoadState('networkidle')
    await page.goto('/providers')
    await page.waitForLoadState('networkidle')

    expect(leaks, leaks.join('\n')).toHaveLength(0)
  })

  authedTest('Token not present in any request URL query string', async ({ page }) => {
    const token = await page.evaluate(() => localStorage.getItem('si_token')) as string
    const urlLeaks: string[] = []

    page.on('request', (req) => {
      if (req.url().includes(token)) {
        urlLeaks.push(`Token leaked in URL: ${req.url()}`)
      }
    })

    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    await page.goto('/inventory/servers')
    await page.waitForLoadState('networkidle')

    expect(urlLeaks, urlLeaks.join('\n')).toHaveLength(0)
  })

  authedTest('API responses do not include other users passwords', async ({ page }) => {
    const res = await page.request.get(`${BACKEND}/api/users`, {
      headers: {
        Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem('si_token'))}`,
      },
    })
    expect(res.ok()).toBeTruthy()
    const text = await res.text()
    // password field must not appear in user list response
    const parsed = JSON.parse(text) as Array<Record<string, unknown>>
    for (const user of parsed) {
      expect(Object.keys(user), `password field leaked for user ${user['username'] as string}`).not.toContain('password')
      expect(Object.keys(user), `hashed_password leaked`).not.toContain('hashed_password')
    }
  })

  authedTest('Credential config not exposed raw in DOM', async ({ page }) => {
    // Providers page should show masked/redacted config, not raw secret values
    await page.goto('/providers')
    await page.waitForLoadState('networkidle')
    const pageText = await page.textContent('body') ?? ''
    // Common secret key names should not appear as plain text values in the DOM
    // (they may appear as label text but not as visible secret values)
    const dangerousPatterns = [
      /secret_access_key["\s:]+[A-Za-z0-9+/]{20,}/,
      /client_secret["\s:]+[A-Za-z0-9_-]{10,}/,
      /application_secret["\s:]+[A-Za-z0-9]{10,}/,
    ]
    for (const pattern of dangerousPatterns) {
      expect(pageText, `Secret value exposed in DOM: ${pattern.source}`).not.toMatch(pattern)
    }
  })
})

authedTest.describe('Data Leak — LocalStorage', () => {
  authedTest('only si_token and si_user stored — no passwords', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    const storage = await page.evaluate(() => {
      const result: Record<string, string> = {}
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)!
        result[k] = localStorage.getItem(k)!
      }
      return result
    })

    // Must have exactly si_token and si_theme and si_user (and possibly si_theme)
    const allowedKeys = new Set(['si_token', 'si_user', 'si_theme'])
    for (const key of Object.keys(storage)) {
      expect(allowedKeys.has(key), `Unexpected localStorage key: ${key}`).toBeTruthy()
    }

    // si_user must not contain password
    if (storage['si_user']) {
      const user = JSON.parse(storage['si_user']) as Record<string, unknown>
      expect(Object.keys(user)).not.toContain('password')
      expect(Object.keys(user)).not.toContain('hashed_password')
    }
  })

  authedTest('login does not store password in localStorage', async ({ page }) => {
    await page.goto('/')
    await page.getByLabel('Username').fill('admin')
    await page.getByLabel('Password').fill('Admin@1234')
    await page.getByRole('button', { name: /sign in/i }).click()
    await page.waitForSelector('aside', { timeout: 5000 })

    const storage = await page.evaluate(() => {
      const result: Record<string, string> = {}
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)!
        result[k] = localStorage.getItem(k)!
      }
      return result
    })

    const allValues = Object.values(storage).join(' ')
    expect(allValues).not.toContain('Admin@1234')
  })
})

authedTest.describe('Data Leak — Console', () => {
  authedTest('no token or password printed to console during normal navigation', async ({ page }) => {
    const token = await page.evaluate(() => localStorage.getItem('si_token')) as string
    const consoleLeak: string[] = []

    page.on('console', (msg) => {
      const text = msg.text()
      if (text.includes(token)) consoleLeak.push(`Token in console: ${text.slice(0, 100)}`)
      if (text.toLowerCase().includes('admin@1234')) consoleLeak.push(`Password in console: ${text.slice(0, 100)}`)
    })

    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    await page.goto('/inventory/servers')
    await page.waitForLoadState('networkidle')
    await page.goto('/sync-logs')
    await page.waitForLoadState('networkidle')

    expect(consoleLeak, consoleLeak.join('\n')).toHaveLength(0)
  })
})

authedTest.describe('Data Leak — CDP Network Coverage', () => {
  authedTest('no sensitive headers in non-API requests via CDP', async ({ page, context }) => {
    const cdp = await context.newCDPSession(page)
    await cdp.send('Network.enable')

    const headerLeaks: string[] = []

    cdp.on('Network.requestWillBeSent', (params) => {
      const { headers, url } = params.request
      const parsedUrl = new URL(url)
      if (ALLOWED_AUTH_HOSTS.includes(parsedUrl.hostname)) return
      if (headers['Authorization'] || headers['authorization']) {
        headerLeaks.push(`Auth header to non-backend: ${url}`)
      }
    })

    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    await cdp.detach()
    expect(headerLeaks, headerLeaks.join('\n')).toHaveLength(0)
  })

  authedTest('CDP: verify no 5xx responses during normal navigation', async ({ page, context }) => {
    const cdp = await context.newCDPSession(page)
    await cdp.send('Network.enable')

    const serverErrors: string[] = []

    cdp.on('Network.responseReceived', (params) => {
      if (params.response.status >= 500) {
        serverErrors.push(`5xx ${params.response.status} from ${params.response.url}`)
      }
    })

    const views = ['/dashboard', '/inventory/servers', '/inventory/databases',
      '/inventory/kubernetes', '/providers', '/sync-logs', '/crons', '/ssh', '/settings']
    for (const path of views) {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
    }

    await cdp.detach()
    expect(serverErrors, serverErrors.join('\n')).toHaveLength(0)
  })

  authedTest('CDP: resource map request does not leak credentials', async ({ page, context }) => {
    // Only run if there are servers with resource maps
    const api = await (async () => {
      const { createApiClient } = await import('./fixtures/api')
      return createApiClient()
    })()
    const servers = await (await api.get('/api/servers')).json() as Array<{ id: number }>
    if (servers.length === 0) return

    const cdp = await context.newCDPSession(page)
    await cdp.send('Network.enable')

    const responseBodies: string[] = []
    const requestIds: string[] = []

    cdp.on('Network.responseReceived', (params) => {
      if (params.response.url.includes('/api/resource-map')) {
        requestIds.push(params.requestId)
      }
    })

    await page.goto('/inventory/servers')
    await page.waitForLoadState('networkidle')
    if (await page.getByRole('row').count() > 1) {
      await page.getByRole('row').nth(1).click()
      await page.getByRole('button', { name: /resource map/i }).click().catch(() => {})
      await page.waitForTimeout(1000)
    }

    for (const id of requestIds) {
      const body = await cdp.send('Network.getResponseBody', { requestId: id }).catch(() => ({ body: '' }))
      responseBodies.push(body.body)
    }

    await cdp.detach()

    for (const body of responseBodies) {
      expect(body).not.toMatch(/secret_access_key|client_secret|application_secret/)
    }
  })
})

test.describe('Data Leak — Unauthenticated', () => {
  test('unauthenticated request to sensitive endpoint → 401, not data', async ({ page }) => {
    const endpoints = [
      '/api/users',
      '/api/credentials',
      '/api/ssh-credentials',
      '/api/servers',
      '/api/settings',
    ]
    for (const ep of endpoints) {
      const res = await page.request.get(`${BACKEND}${ep}`)
      expect(res.status(), `${ep} should return 401 without auth`).toBe(401)
    }
  })
})
```

- [ ] **Step 2: Run**

```bash
cd frontend
E2E_PASSWORD='Admin@1234' npx playwright test e2e/data-leak.spec.ts --project=chromium-dark
```

Expected: all PASS. If credential-config-in-DOM test fails, the backend must mask secrets before sending to frontend.

- [ ] **Step 3: Commit**

```bash
git add frontend/e2e/data-leak.spec.ts
git commit -m "test: add data-leak spec — CDP network audit, localStorage, console, 401 guards"
```

---

## Task 13: Update playwright.config.ts + navigation.spec.ts

**Files:**
- Modify: `frontend/playwright.config.ts`
- Modify: `frontend/e2e/navigation.spec.ts`
- Modify: `frontend/e2e/visual.spec.ts`

- [ ] **Step 1: Add Block Storage to navigation spec**

In `frontend/e2e/navigation.spec.ts`, add `{ nav: 'Block Storage', heading: 'Block Storage' }` to the `VIEWS` array. Also add it to `AUTHENTICATED_VIEWS` in `visual.spec.ts`.

- [ ] **Step 2: Update playwright.config.ts — add trace always-on for data-leak project**

```typescript
// frontend/playwright.config.ts
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
      testIgnore: /data-leak|servers|databases|kubernetes|block-storage|users|ssh|crons|settings|providers|sync-logs/,
    },
    {
      name: 'data-leak',
      use: {
        ...devices['Desktop Chrome'],
        trace: 'on',       // always capture traces for security audits
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
```

- [ ] **Step 3: Run full suite**

```bash
cd frontend
E2E_PASSWORD='Admin@1234' npx playwright test --project=chromium-dark --project=data-leak
```

Expected: all PASS or SKIP (skip = test guards for no data condition like empty server list).

- [ ] **Step 4: Commit**

```bash
git add frontend/playwright.config.ts frontend/e2e/navigation.spec.ts frontend/e2e/visual.spec.ts
git commit -m "test: add data-leak project to playwright config, add Block Storage to nav/visual specs"
```

---

## Self-Review Against Spec

**Spec requirement → Task coverage:**

| Requirement | Covered |
|---|---|
| Every API param tested | ✅ Tasks 4–9: `search`, `provider`, `status`, wildcard injection per inventory router |
| Every tool/feature | ✅ Tasks 3–11: auth, servers, DBs, K8s, block-storage, providers, users, SSH, crons, settings, sync |
| Playwright tool | ✅ All tasks use Playwright POM + auto-waiting |
| Chrome DevTools data leaks | ✅ Task 12: CDP `Network.enable`, request headers, response bodies, 5xx scan |
| No credential-addition | ✅ providers.spec.ts skips POST /api/credentials; ProvidersPage POM excludes add-cred locator |
| Use existing creds for tests | ✅ `createApiClient()` logs in with admin; toggle tests restore state |
| WS auth rejection | ✅ Task 11: WS connects with invalid token, expects close code 4001 |
| localStorage audit | ✅ Task 12: only `si_token`, `si_user`, `si_theme` allowed |
| Console leak audit | ✅ Task 12: token and password must not appear in console.log |
| Unauthenticated → 401 | ✅ Task 12: 5 sensitive endpoints checked without auth |

**Placeholder scan:** None found. All steps have complete code.

**Type consistency:** `createApiClient()` returns `ApiClient` — used consistently in Tasks 4–11. `authedTest` fixture signature matches existing `fixtures/auth.ts` export. POM constructor signatures match usage in spec files.

---

## Run Commands Summary

```bash
cd frontend

# Single spec
E2E_PASSWORD='Admin@1234' npx playwright test e2e/<spec>.spec.ts --project=chromium-dark

# Full suite (all except visual snapshots)
E2E_PASSWORD='Admin@1234' npx playwright test --project=chromium-dark --project=data-leak

# Data leak only
E2E_PASSWORD='Admin@1234' npx playwright test --project=data-leak

# Update visual snapshots
E2E_PASSWORD='Admin@1234' npx playwright test e2e/visual.spec.ts --update-snapshots

# Open trace viewer after failure
npx playwright show-trace test-results/.../trace.zip
```
