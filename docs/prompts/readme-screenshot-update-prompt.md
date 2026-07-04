# Claude Prompt: README + Screenshot Refresh

Update the repository README to match the current ServerInventory application and use Playwright MCP to capture clean screenshots for the README.

Do not invent features. Inspect the current codebase first and use it as the source of truth.

Inspect these files/directories before editing:

- `README.md`
- `frontend/package.json`
- `frontend/src/routes/`
- `frontend/src/components/`
- `frontend/src/hooks/`
- `frontend/src/lib/`
- `backend/app/routers/`
- `backend/app/providers/`
- `docker-compose.yml`

## Goals

1. Modernize `README.md`.
2. Add a screenshot-first presentation.
3. Add a screenshot gallery.
4. Fix outdated stack, testing, and project-structure details.
5. Document current dashboard features accurately.
6. Document Provider Credentials safely.
7. Add Playwright screenshot capture workflow.
8. Make sure README commands match actual package scripts.
9. Never expose real credentials, tokens, passwords, emails, or screenshots containing secrets.

## README updates

### 1. Hero section

Keep the existing project name and open-source positioning.

Add a hero screenshot below the title/subtitle:

```md
<p align="center">
  <img src="docs/screenshots/dashboard-light.png" alt="ServerInventory Dashboard" width="100%" />
</p>
```

Add quick links below the hero:

```md
<p align="center">
  <a href="#screenshots">Screenshots</a> ·
  <a href="#features">Features</a> ·
  <a href="#quick-start">Quick Start</a> ·
  <a href="#security">Security</a> ·
  <a href="#contributing">Contributing</a>
</p>
```

### 2. Table of contents

Update the table of contents so it includes all new sections:

- Screenshots
- Why ServerInventory
- Features
- Stack
- Quick Start
- Environment Variables
- Cloud Provider Setup
- Development
- Testing
- Screenshot Maintenance
- Architecture
- Credential Security
- Contributing
- Security
- License

### 3. Screenshots section

Add this section after “Why ServerInventory”.

Use these image paths:

```md
## Screenshots

### Fleet Dashboard
![Fleet Dashboard](docs/screenshots/dashboard-light.png)

### Server Inventory with Smart Pagination
![Server Inventory](docs/screenshots/server-inventory.png)

### Secure Provider Credentials
![Provider Credentials](docs/screenshots/provider-credentials.png)

### DNS / Domain Inventory
![Domain Inventory](docs/screenshots/domain-inventory.png)

### Resource Topology Map
![Resource Map](docs/screenshots/resource-map.png)

### Settings / Branding
![Settings Branding](docs/screenshots/settings-branding.png)

### Collapsed Sidebar
![Collapsed Sidebar](docs/screenshots/collapsed-sidebar.png)
```

Only include screenshots that actually exist. If a screenshot cannot be captured, do not link it.

### 4. Features section

Update the features section to accurately describe the current app.

Include these feature areas only if they exist in code:

- Fleet overview dashboard
- Multi-cloud server sync
- Managed databases
- Kubernetes clusters
- Block storage
- DNS/domain inventory
- DNS provider credentials
- Resource topology map
- Secure provider credentials inventory
- SSH credentials and SSH data collection
- Smart tables with adaptive rows/page
- Direct page jump and compact pagination
- Sticky table headers and pagination footers
- Collapsible sidebar
- WebSocket-driven sync updates
- Cron scheduler
- RBAC / IAM policies
- MFA / TOTP
- Branding/logo/favicon upload
- Light/dark/AMOLED theme, only if still implemented

Do not claim a feature if it is not implemented.

### 5. Stack section

Read `frontend/package.json` and backend requirements before editing.

Make the Stack table accurate. Expected current frontend stack may include:

- React 19
- TypeScript
- TanStack Start
- TanStack Router
- TanStack Query
- Tailwind CSS 4
- Recharts
- Lucide React
- Sonner
- Playwright

Remove outdated references if they are no longer true.

### 6. Testing section

Compare README testing commands against `frontend/package.json`.

If Playwright tests/config exist but package scripts are missing, add these scripts to `frontend/package.json`:

```json
{
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui",
  "test:e2e:update": "playwright test --update-snapshots"
}
```

If Playwright is not fully configured, document only the working commands.

Keep README commands accurate.

### 7. Project structure

Replace outdated frontend structure with the current TanStack route-based structure.

Mention important files such as:

```text
frontend/
├── src/
│   ├── components/
│   │   ├── app-shell.tsx
│   │   ├── SmartTable.tsx
│   │   ├── SmartPagination.tsx
│   │   └── ui-bits.tsx
│   ├── hooks/
│   │   └── useAdaptivePageSize.ts
│   ├── lib/
│   │   ├── api.ts
│   │   ├── auth.ts
│   │   ├── branding.ts
│   │   └── ws.ts
│   └── routes/
│       ├── _app.servers.tsx
│       ├── _app.provider-credentials.tsx
│       ├── _app.domains.tsx
│       └── ...
```

Adjust paths if actual files differ.

### 8. Credential Security section

Add a dedicated section for credential safety.

Document:

- Provider passwords/API keys are masked by default.
- Reveal/copy actions should be permission-controlled.
- Admin accounts should enable MFA.
- Production deployments must use TLS.
- `SECRET_KEY` and admin password must be changed before production.
- Do not commit `.env` files.
- Do not commit screenshots containing real secrets.
- Do not store production credentials in README, tests, fixtures, or docs.

### 9. Screenshot Maintenance section

Add a section explaining how screenshots are captured and updated.

Example content:

```md
## Screenshot Maintenance

Screenshots are stored in `docs/screenshots/` and should use demo or sanitized data only.

Recommended viewport: `1600x1000`.

```bash
cd frontend
npm run dev
```

Then use Playwright MCP or Playwright tests to capture/update screenshots.

Never capture real credentials, production accounts, browser chrome, bookmarks, OS UI, or private user data.
```

## Playwright MCP screenshot tasks

Use Playwright MCP to capture clean README screenshots.

Rules:

- Use only demo/local/sanitized data.
- Mask all credentials, passwords, API keys, tokens, and private emails.
- Do not capture browser chrome.
- Do not capture bookmarks bar.
- Do not capture OS UI.
- Capture only the app viewport.
- Prefer light theme.
- Use viewport `1600x1000`.
- Save screenshots to `docs/screenshots/`.
- Verify every screenshot before committing.

Capture these routes if available:

1. `/` → `docs/screenshots/dashboard-light.png`
2. `/servers` → `docs/screenshots/server-inventory.png`
3. `/provider-credentials` → `docs/screenshots/provider-credentials.png`
4. `/domains` → `docs/screenshots/domain-inventory.png`
5. `/resource-map` → `docs/screenshots/resource-map.png`
6. `/settings` → `docs/screenshots/settings-branding.png`
7. Collapsed sidebar state → `docs/screenshots/collapsed-sidebar.png`

If a route requires login:

- Use environment variables for credentials.
- Do not hardcode passwords in code.
- Do not commit login credentials.

Suggested environment variables:

```bash
E2E_USERNAME=admin
E2E_PASSWORD='your-local-dev-password'
```

## Screenshot validation

After capturing screenshots:

1. Open every screenshot.
2. Confirm no secrets are visible.
3. Confirm no private user info is visible.
4. Confirm no browser/OS UI is visible.
5. Confirm image paths match README links.
6. Delete screenshots that show real credentials or private data.

## Quality checks

After README and screenshot changes:

```bash
cd frontend
npm run lint
npm run build
```

If Playwright scripts exist:

```bash
npm run test:e2e
```

Fix any errors caused by your changes.

## Final response format

Report:

- README sections updated
- Screenshot files added
- Package scripts added or verified
- Files changed
- Any screenshots skipped and why
- Any assumptions made

Do not expose secrets in the final response.
