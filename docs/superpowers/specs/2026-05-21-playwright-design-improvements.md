# Playwright Setup + Frontend Design Fixes

**Date:** 2026-05-21  
**Status:** Approved

## Overview

Add Playwright E2E + visual regression coverage to the frontend. Fix three theme-inconsistent hardcoded color values found during review. Work runs in parallel across two workstreams.

## Scope

- Install and configure `@playwright/test`
- Write E2E tests: auth flows, navigation, per-page visual screenshots
- Fix hardcoded CSS values that break light theme correctness
- No backend changes. No new frontend dependencies beyond Playwright.

## Playwright Infrastructure

### Config (`frontend/playwright.config.ts`)

- `baseURL`: `http://localhost:5173`
- `webServer`: auto-starts `npm run dev`, waits for port
- 2 projects: `chromium-dark` (default), `chromium-light` (sets `data-theme="light"` via localStorage before each test)
- Screenshots stored in `frontend/e2e/screenshots/`
- `storageState` fixture captures logged-in session for reuse

### Test Files

```
frontend/e2e/
├── auth.spec.ts          # login success, bad credentials, logout
├── navigation.spec.ts    # navigate to every view, assert page title visible
├── visual.spec.ts        # full-page screenshot per view × dark + light theme
└── fixtures/
    └── auth.ts           # storageState fixture: login once, reuse across tests
```

### Auth fixture strategy

Login once via API (`POST /api/auth/login`), save `storageState` to `e2e/.auth/user.json`. All tests that need auth use this fixture — no repeated login UI flows.

## Code Fixes

### 1. `frontend/src/components/StatsCards.tsx:33`

```diff
- <circle cx="18" cy="18" r="16" fill="none" stroke="#1A1A28" strokeWidth="4" />
+ <circle cx="18" cy="18" r="16" fill="none" stroke="var(--bd)" strokeWidth="4" />
```

Hardcoded `#1A1A28` is a dark-theme border value. Light theme border is `#DDE1EF` — using `--bd` adapts correctly.

### 2. `frontend/src/components/DashboardPage.tsx` — chart tooltip

Tooltip div uses hardcoded background/border colors. Replace with `var(--bg-s2)` and `var(--bd)` so tooltip renders correctly in both themes.

### 3. `frontend/src/components/LoginPage.tsx:174-175`

```diff
- onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = 'var(--ach)' }}
- onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'var(--ac)'}
```

Remove both lines. The `.btn-primary` CSS class already handles `:hover` via `background-color: var(--ach)`. Inline handlers override the class and bypass the disabled state guard inconsistently.

## Execution Plan

Two parallel workstreams, merge when both complete:

| Worker A — Playwright | Worker B — Fixes |
|----------------------|-----------------|
| `npm install -D @playwright/test` | Fix `StatsCards.tsx` |
| Write `playwright.config.ts` | Fix `DashboardPage.tsx` tooltip |
| Write `e2e/fixtures/auth.ts` | Fix `LoginPage.tsx` hover handlers |
| Write `e2e/auth.spec.ts` | |
| Write `e2e/navigation.spec.ts` | |
| Write `e2e/visual.spec.ts` | |

After merge: run `npx playwright test`, update snapshots, commit golden state.

## Acceptance Criteria

- `npx playwright test` passes with 0 failures
- Visual snapshots captured for all 9 views × 2 themes (18 total)
- Light theme donut chart ring uses `--bd` color (not hardcoded dark value)
- Dashboard chart tooltips match active theme
- Login button hover state identical with/without JS (pure CSS)

## Out of Scope

- No mobile/responsive Playwright projects (future)
- No CI integration (future)
- No performance or a11y audits (future)
