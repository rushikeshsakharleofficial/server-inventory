# ServerInventory — Deep UI QA Final Report

**Date:** 2026-05-23  
**Tester:** Claude Code (automated, Playwright MCP)  
**Environment:** Local dev — `http://localhost:5173` (Vite) + `http://localhost:8000` (FastAPI)  
**Auth:** Authenticated as `admin` (role: admin) for all protected routes  
**Viewports tested:** Desktop 1440×900, Mobile 390×844 (actual ~433px — Playwright MCP limitation)  
**Browsers:** Chromium only (Playwright MCP constraint)  
**Destructive actions:** Skipped (no real deletes/payments executed)  
**Testing method:** Playwright MCP live browser + source code inspection

---

## Summary

| Category | Count |
|---|---|
| Prior defects verified fixed | 11 |
| New defects found | 4 |
| Tests PASS | All routes reachable, auth flow correct |
| Tests FAIL | 0 blocking |
| Skipped | Back/forward full matrix, Firefox/WebKit |

---

## Prior Defect Verification

All 11 defects fixed in `fix/qa-defects` branch (merged to `main`) were verified working:

| ID | Description | Status |
|---|---|---|
| DEFECT-001 | WebSocket proxy for `/ws` endpoint | ✅ PASS |
| DEFECT-004 | Escape key closes Server Detail modal | ✅ PASS |
| DEFECT-005 | Escape key closes Add Server modal | ✅ PASS |
| DEFECT-006 | Add Server modal — all inputs have `<label for>` | ✅ PASS |
| DEFECT-007 | Add Server validation shows `role="alert"` error | ✅ PASS |
| DEFECT-009 | Icon-only buttons have `aria-label` | ✅ PASS |
| DEFECT-011 | SSH error messages sanitised before display | ✅ PASS |
| DEFECT-012 | Trust Host Key button appears after SSH sync failure | ✅ PASS |
| DEFECT-013 | Role decoded from JWT, not tampered `si_user` | ✅ PASS |
| DEFECT-014 | Unknown role shows "Unknown" badge (no crash) | ✅ PASS |
| DEFECT-015 | Empty password form shows specific error message | ✅ PASS |
| DEFECT-016 | Mobile sidebar starts closed (`open` init uses `window.innerWidth >= 768`) | ✅ PASS |
| DEFECT-017 | QR code SVG has `aria-label` | ✅ PASS |

---

## New Defects

### DEFECT-NEW-01 — Password inputs in SetupPage have no programmatic label association
**Severity:** High (WCAG 2.1 §1.3.1 failure)  
**File:** `frontend/src/components/SetupPage.tsx`  
**Details:** All 3 password `<Input>` elements (Current Password, New Password, Confirm New Password) have no `id`, no `aria-label`, no `aria-labelledby`, and no enclosing `<label>`. Screen readers cannot announce the field name. Only visual `<Text variant="label">` text is present.  
**Fix:** Add `id` to each input and `<label htmlFor="...">` wrapping the label text, OR add `aria-label` to each input.

```tsx
// Example fix
<label htmlFor="current-password">Current Password <span aria-hidden="true">*</span></label>
<Input id="current-password" type="password" ... />
```

---

### DEFECT-NEW-02 — Missing security response headers
**Severity:** Medium (security posture)  
**Details:** Backend (FastAPI) returns no security headers. Verified via response header inspection.

| Header | Present | Expected value |
|---|---|---|
| `Content-Security-Policy` | ❌ | restrict scripts/frames |
| `X-Frame-Options` | ❌ | `DENY` |
| `X-Content-Type-Options` | ❌ | `nosniff` |
| `Referrer-Policy` | ❌ | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | ❌ | restrict camera/mic/geo |
| `Strict-Transport-Security` | ❌ | relevant on HTTPS deployments |

**Fix:** Add middleware in `main.py`:

```python
from starlette.middleware.base import BaseHTTPMiddleware

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response

app.add_middleware(SecurityHeadersMiddleware)
```

---

### DEFECT-NEW-03 — Mobile sidebar: no backdrop, no Escape close, no auto-close on nav
**Severity:** Low (UX)  
**File:** `frontend/src/components/Layout.tsx`  
**Details:** When sidebar opens on mobile (<768px):
- No backdrop overlay renders — tapping content area does NOT close sidebar
- No `keydown` Escape listener — Escape key does NOT close sidebar  
- Clicking a nav item navigates but does NOT close sidebar — user must manually tap hamburger again

**Fix (all three):**
```tsx
// 1. Escape handler in useEffect
useEffect(() => {
  if (!open) return
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
  document.addEventListener('keydown', onKey)
  return () => document.removeEventListener('keydown', onKey)
}, [open])

// 2. Backdrop div (render when mobile + open)
{open && isMobile && (
  <div
    onClick={() => setOpen(false)}
    style={{ position: 'fixed', inset: 0, zIndex: 39, background: 'rgba(0,0,0,0.4)' }}
  />
)}

// 3. Auto-close on nav click
function handleNavClick(id: View) {
  onViewChange(id)
  if (window.innerWidth < 768) setOpen(false)
}
```

---

### DEFECT-NEW-04 — Add Server modal: `aria-invalid` not set on validation failure
**Severity:** Low (accessibility)  
**File:** `frontend/src/components/AddServerModal.tsx`  
**Details:** Empty form submit shows `role="alert"` with "Server name is required" ✅, but the `#field-name` input does not receive `aria-invalid="true"`. Screen readers cannot signal the field is in error state via the input itself.  
**Fix:** When validation fails, set `aria-invalid="true"` on the failing input and clear it on correction.

---

## Storage / Auth Observations

| Key | Value at login | Value at logout | Assessment |
|---|---|---|---|
| `si_token` | JWT string | cleared | ✅ correct |
| `si_user` | `{"username":"admin","role":"superadmin"}` | cleared | ⚠️ stale role (`superadmin` not a valid app role — pre-fix remnant); harmless since app uses JWT |
| `si_theme` | `light`/`dark` | retained | ✅ expected (non-sensitive) |

**Back-button after logout:** URL changes to `/setup` but SPA renders LoginPage (no token) — protected content NOT revealed ✅

---

## Theme (Dark Mode)

| Check | Result |
|---|---|
| Toggle switches `data-theme` on `<html>` | ✅ |
| `aria-label` updates to "Switch to light/dark mode" | ✅ |
| Preference persisted in `localStorage.si_theme` | ✅ |
| Toggle back to light restores theme | ✅ |

---

## Add Server Modal

| Check | Result |
|---|---|
| All inputs have `<label for="...">` associations | ✅ |
| Empty submit shows validation error | ✅ (`role="alert"` "Server name is required") |
| `aria-invalid` set on invalid field | ❌ DEFECT-NEW-04 |
| Escape key closes modal | ✅ |

---

## Routes Tested

| Route | Screenshot | Notes |
|---|---|---|
| `/inventory/servers` (desktop) | ✅ | Server table, detail panel split view |
| `/dashboard` | ✅ | Stats + charts |
| `/providers` | ✅ | Provider table |
| `/crons` | ✅ | Cron jobs table |
| `/ssh` | ✅ | SSH credentials table |
| `/settings` | ✅ | Settings form |
| `/users` | ✅ | User management table (converted from cards) |
| `/setup` | ✅ | Change password + MFA setup |
| `/inventory/servers` (mobile) | ✅ | Sidebar hidden, hamburger works |
| Login page (post-logout) | ✅ | Shows after sign-out and after back-nav |

---

## Not Tested / Coverage Gaps

- **Firefox / WebKit** — Playwright MCP only drives Chromium
- **Tablet viewport (1024×768)** — not covered
- **Mobile small (360×640)** — not covered  
- **Modal focus trap** — Add Server, Server Detail modal focus containment not verified
- **Sync Logs page** — no screenshot captured
- **Add User form** (inline in UsersPage) — validation and field labels not tested
- **SSH credentials page** — add/edit credential forms not tested
- **Keyboard-only navigation sweep** — Tab through full app not completed
- **Service worker / PWA** — no SW registered, not applicable
- **Offline state** — not simulated
- **Production HTTPS** — HSTS, Secure cookie flag only relevant on HTTPS; not testable locally
- **Concurrent sessions** — not tested
- **Cross-browser** — Chromium only

---

## Screenshots Index

```
qa-artifacts/screenshots/
├── servers/
│   ├── desktop/01-top.png
│   ├── desktop/02-detail-panel.png
│   ├── mobile-lg/01-top.png
│   └── mobile-lg/02-sidebar-open.png
├── dashboard/desktop/01-top.png
├── providers/desktop/01-top.png
├── crons/desktop/01-top.png
├── ssh/desktop/01-top.png
├── settings/desktop/01-top.png
├── users/desktop/01-top.png
├── setup/
│   ├── desktop/01-top.png
│   ├── desktop/02-empty-submit.png
│   └── desktop/03-mfa-setup.png
├── theme/dark-mode.png
├── add-server/
│   ├── 01-modal-open.png
│   └── 02-empty-submit.png
└── logout/
    ├── 01-after-logout.png
    └── 02-back-after-logout.png
```

---

## Fix Priority

| Priority | Defect | Effort |
|---|---|---|
| 1 | DEFECT-NEW-01 — SetupPage password label associations | Small (~10 lines) |
| 2 | DEFECT-NEW-02 — Security response headers | Small (middleware) |
| 3 | DEFECT-NEW-03 — Mobile sidebar UX (backdrop + Escape + auto-close) | Medium |
| 4 | DEFECT-NEW-04 — `aria-invalid` on Add Server validation | Small |
