<div align="center">

# ServerInventory

### Free, Open-Source Multi-Cloud Server Inventory & Infrastructure Management Dashboard

**Self-hosted · Zero vendor lock-in · 100% free forever**

Track servers, databases, Kubernetes clusters, and block storage across AWS, GCP, Azure, DigitalOcean, Linode, OVH, and on-premise — all from one unified dashboard.

[![License](https://img.shields.io/github/license/rushikeshsakharleofficial/server-inventory?style=for-the-badge)](https://github.com/rushikeshsakharleofficial/server-inventory/blob/main/LICENSE)
[![Stars](https://img.shields.io/github/stars/rushikeshsakharleofficial/server-inventory?style=for-the-badge)](https://github.com/rushikeshsakharleofficial/server-inventory/stargazers)
[![CodeQL](https://img.shields.io/github/actions/workflow/status/rushikeshsakharleofficial/server-inventory/codeql.yml?style=for-the-badge&label=CodeQL)](https://github.com/rushikeshsakharleofficial/server-inventory/actions/workflows/codeql.yml)
[![SonarCloud](https://img.shields.io/github/actions/workflow/status/rushikeshsakharleofficial/server-inventory/sonar.yml?style=for-the-badge&label=SonarCloud)](https://github.com/rushikeshsakharleofficial/server-inventory/actions/workflows/sonar.yml)
[![Issues](https://img.shields.io/github/issues/rushikeshsakharleofficial/server-inventory?style=for-the-badge)](https://github.com/rushikeshsakharleofficial/server-inventory/issues)

</div>

---

> **Looking for a free, self-hosted alternative to paid cloud inventory tools?** ServerInventory gives you full visibility across every cloud provider and on-premise datacenter — no SaaS fees, no data leaving your infrastructure, no artificial limits.

---

## Table of Contents

- [Why ServerInventory](#why-serverinventory)
- [Features](#features)
- [Stack](#stack)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Cloud Provider Setup](#cloud-provider-setup)
- [Development](#development)
- [Testing](#testing)
- [Architecture](#architecture)
- [Contributing](#contributing)
- [Security](#security)
- [License](#license)

---

## Why ServerInventory

Most server inventory and cloud asset management tools are either expensive SaaS products or require complex enterprise setups. ServerInventory is different:

- **100% free and open source** — MIT license, fork it, modify it, deploy it anywhere
- **Self-hosted** — your credentials and server data never leave your infrastructure
- **Multi-cloud from day one** — AWS, GCP, Azure, DigitalOcean, Linode, OVH, and custom datacenters
- **No agent required** — syncs via cloud APIs; SSH data collection available for on-premise servers
- **Production-ready** — JWT auth, MFA/TOTP, role-based access, WebSocket real-time sync, cron scheduling, E2E tested

---

## Features

### Multi-Cloud Server Sync

Automatically pull and track all VM instances from:

- **AWS** — EC2 instances across all regions
- **GCP** — Compute Engine VMs via service account
- **Azure** — Virtual Machines across subscription
- **DigitalOcean** — Droplets
- **Linode / Akamai** — Linode instances
- **OVH Cloud** — Bare metal, VPS, Public Cloud
- **Custom DC** — Manually registered on-premise servers

### Managed Databases

Auto-fetch managed database instances from:

- AWS RDS (PostgreSQL, MySQL, Aurora, MariaDB)
- GCP Cloud SQL
- Azure Database for PostgreSQL / MySQL
- DigitalOcean Managed Databases
- Linode Database Clusters

### Kubernetes Clusters

Auto-fetch managed cluster fleets from:
- AWS EKS, GCP GKE, Azure AKS, DigitalOcean DOKS, Linode LKE

### Block Storage Volumes

Auto-fetch managed block storage from:
- AWS EBS, Azure Managed Disks, GCP Persistent Disks, DigitalOcean Volumes, Linode Volumes

### Resource Topology Map

Per-resource network topology viewer showing connected cloud resources:

| Provider | Resources Mapped |
|:---------|:----------------|
| **AWS** | VPC, Subnets, Security Groups, ENIs, IAM Profile, Elastic IPs, NAT Gateways, Auto Scaling Groups, ALB/NLB, Route Tables |
| **GCP** | VPC Network, Subnetworks, Alias IP ranges, Firewall Rules, Service Accounts, Disks |
| **Azure** | NICs, NSGs, VNets, Subnets, Public IPs, Managed Identity, Availability Sets |
| **DigitalOcean** | VPC, Floating IPs, Firewalls, Load Balancers, Tags |
| **Linode** | Firewalls, NodeBalancers, VLANs, Disks |
| **OVH** | IPs, Failover IPs, vRack, OVH Firewall, Backup Cloud, IPMI |

### Core Platform Capabilities

- **Live sync via WebSocket** — real-time batch progress with ability to stop mid-sync
- **Throttled DB writes** — assets written in 25-item batches with pacing to prevent write bursts
- **SSH data collection** — pulls CPU, RAM, kernel, OS, IPs from on-premise servers via paramiko
- **Cron scheduler** — APScheduler-backed cron jobs with standard 5-field expressions
- **Role-based access control** — Admin, Write, and Read roles with JWT auth and 90-day remember-me tokens
- **MFA / TOTP** — per-user two-factor authentication using authenticator apps
- **Light / Dark / AMOLED theme** — CSS variable system with AMOLED-optimized dark mode
- **Server snapshots** — daily history powering dashboard growth charts
- **Auto housekeeping** — prunes logs and snapshots older than 365 days

---

## Stack

| Layer | Technology |
|:------|:-----------|
| Backend | FastAPI, SQLAlchemy 2.x, PostgreSQL 16 |
| Auth | JWT (python-jose), bcrypt, TOTP MFA (pyotp), role-based access |
| Scheduling | APScheduler BackgroundScheduler |
| SSH | paramiko |
| WebSockets | FastAPI native + asyncio broadcast |
| Frontend | React 19 + TypeScript + Vite |
| Styling | Stitches CSS-in-JS + Tailwind CSS 4 + CSS custom properties |
| Data fetching | TanStack Query v5 |
| Charts | Recharts |
| Icons | Lucide React |
| E2E Testing | Playwright |
| Container | Docker Compose (postgres + backend + frontend) |

---

## Quick Start

### Docker (recommended)

```bash
git clone https://github.com/rushikeshsakharleofficial/server-inventory.git
cd server-inventory
docker compose up -d
```

| URL | Purpose |
|:----|:--------|
| http://localhost:5173 | Frontend dashboard |
| http://localhost:8000/docs | Backend API (Swagger UI) |

Default credentials:

```
Username: admin
Password: Admin@1234
```

> **Security:** Change `ADMIN_PASSWORD` and `SECRET_KEY` before any production or internet-facing deployment.

### Local (no Docker)

Use `start.sh` to launch both services in one step (requires local PostgreSQL):

```bash
cp backend/.env.example backend/.env   # edit DATABASE_URL and SECRET_KEY
./start.sh
```

Or manually in two terminals:

```bash
# Terminal 1 — Backend
cd backend
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

```bash
# Terminal 2 — Frontend
cd frontend
npm install
npm run dev
```

---

## Environment Variables

Create `backend/.env` from the example:

```bash
cp backend/.env.example backend/.env
```

| Variable | Default | Required | Description |
|:---------|:--------|:--------:|:------------|
| `DATABASE_URL` | `postgresql://inventory:inventory@localhost:5432/server_inventory` | Yes | PostgreSQL connection string |
| `ADMIN_USERNAME` | `admin` | No | Initial admin username (seeded once on first run) |
| `ADMIN_PASSWORD` | `Admin@1234` | **Yes in prod** | Initial admin password — change before deploying |
| `SECRET_KEY` | `change-this-secret-key-in-production` | **Yes in prod** | JWT signing secret — generate with `openssl rand -hex 32` |

---

## Cloud Provider Setup

Add credentials via **Cloud Providers → Add Credential** in the UI.

### AWS

Fields: `access_key_id`, `secret_access_key`, `regions` (comma-separated, e.g. `us-east-1,eu-west-1`)

Minimum IAM permissions:
```
ec2:Describe*
rds:Describe*
eks:List*, eks:Describe*
autoscaling:Describe*
elasticloadbalancing:Describe*
```

### GCP

Fields: `service_account_json` (full JSON content), `project_id`

APIs to enable: Compute Engine API, Cloud SQL Admin API, Kubernetes Engine API

### Azure

Fields: `subscription_id`, `tenant_id`, `client_id`, `client_secret`

### DigitalOcean

Fields: `api_token`

### Linode

Fields: `api_token`

### OVH Cloud

Fields: `application_key`, `application_secret`, `consumer_key`, `endpoint` (`ovh-eu` / `ovh-ca` / `ovh-us`)

---

## Development

### Project Structure

```
server-inventory/
├── backend/
│   ├── app/
│   │   ├── providers/        # Cloud provider sync implementations (aws, gcp, azure, …)
│   │   ├── routers/          # FastAPI routers (servers, sync, databases, kubernetes, …)
│   │   ├── auth.py           # JWT auth, password hashing, MFA/TOTP, role guards
│   │   ├── database.py       # SQLAlchemy engine + session factory
│   │   ├── main.py           # FastAPI app, lifespan, WebSocket endpoint
│   │   ├── models.py         # SQLAlchemy ORM models
│   │   ├── scheduler.py      # APScheduler setup
│   │   ├── schemas.py        # Pydantic request/response schemas
│   │   ├── stats_utils.py    # Shared stats aggregation (SQL GROUP BY)
│   │   └── ws_manager.py     # WebSocket connection manager
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── e2e/                  # Playwright E2E tests
│   ├── public/
│   ├── src/
│   │   ├── components/       # Page and UI components
│   │   ├── hooks/            # useAuth, useTheme, useToast, useWebSocket
│   │   ├── App.tsx           # Root: routing, auth, modal state
│   │   ├── api.ts            # Axios client + API helpers
│   │   └── types.ts          # Shared TypeScript types
│   ├── Dockerfile
│   ├── package.json
│   ├── playwright.config.ts
│   └── vite.config.ts
├── docker-compose.yml
├── install-docker.sh         # Docker installation helper
├── start.sh                  # Local dev launcher (requires local Postgres)
└── LICENSE
```

### Frontend Commands

Run from `frontend/`:

| Command | Purpose |
|:--------|:--------|
| `npm run dev` | Start Vite dev server on port 5173 |
| `npm run build` | TypeScript check + production build |
| `npm run preview` | Serve production build locally |
| `npm run test:e2e` | Run Playwright E2E tests (headless) |
| `npm run test:e2e:ui` | Open Playwright interactive UI mode |

### Backend Commands

Run from `backend/`:

```bash
uvicorn app.main:app --reload --port 8000   # dev server with hot reload
```

---

## Testing

Playwright E2E tests cover auth flows, navigation, and visual regression across dark and light themes.

Backend must be running on `http://localhost:8000`. The Vite dev server is started automatically by Playwright's `webServer` config.

```bash
cd frontend

# Run all tests
E2E_PASSWORD='Admin@1234' npm run test:e2e

# Update visual regression snapshots after UI changes
E2E_PASSWORD='Admin@1234' npx playwright test e2e/visual.spec.ts --update-snapshots

# Open interactive Playwright UI
npm run test:e2e:ui
```

| Variable | Default | Description |
|:---------|:--------|:------------|
| `E2E_USERNAME` | `admin` | Admin username for test login |
| `E2E_PASSWORD` | `Admin@1234` | Admin password — match `ADMIN_PASSWORD` |
| `VITE_BACKEND_URL` | `http://localhost:8000` | Backend URL for Vite proxy during tests |

| Suite | Tests | Description |
|:------|:-----:|:------------|
| `auth.spec.ts` | 7 | Login, bad credentials, logout, MFA challenge |
| `navigation.spec.ts` | 10 | Navigate to all 10 views |
| `servers.spec.ts` | 11 | Server table, search, detail panel |
| `users.spec.ts` | 8 | User management CRUD |
| `data-leak.spec.ts` | 10 | Auth data leak and role isolation |
| `providers.spec.ts` | 5 | Cloud provider credential management |
| `block-storage.spec.ts` | 7 | Block storage list |
| `crons.spec.ts` | 8 | Cron scheduler |
| `databases.spec.ts` | 7 | Managed databases list |
| `kubernetes.spec.ts` | 7 | Kubernetes clusters list |
| `sync-logs.spec.ts` | 8 | Sync log history |
| `ssh.spec.ts` | 6 | SSH credentials |
| `settings.spec.ts` | 4 | App settings |
| `visual.spec.ts` | 2 | Screenshot per theme (dark + light) |

---

## Architecture

```mermaid
graph LR
    Browser[React Frontend] -- REST + JWT --> API[FastAPI Backend]
    Browser <-- WebSocket sync events --> API
    API --> Scheduler[APScheduler]
    API --> DB[(PostgreSQL 16)]
    Scheduler --> API
    API -- fetch_servers / fetch_databases / ... --> Cloud[Cloud Provider APIs]
```

### Data Models

| Model | Purpose |
|:------|:--------|
| `Server` | Multi-cloud VM inventory with SSH info |
| `DatabaseInstance` | Managed database instances |
| `KubernetesCluster` | Managed K8s clusters |
| `BlockStorage` | Managed block storage volumes |
| `Credential` | Provider credentials (per-provider config JSON) |
| `SSHCredential` | SSH key/password credentials for Custom DC servers |
| `SyncLog` | Sync run history with duration and result |
| `ServerSnapshot` | Daily server count snapshots for trend charts |
| `CronJob` | Scheduled sync jobs |
| `User` | Auth users with roles (admin / write / read) and optional MFA secret |
| `AppSetting` | Key-value settings (sync timeout, SSH port, etc.) |

### Database Performance

On startup the backend automatically applies:
- `pg_trgm` extension — enables trigram GIN indexes for efficient `ILIKE` search on `name`, `public_ip`, `hostname`
- Composite index `(provider, status)` for filtered server list queries
- Stats endpoints use SQL `GROUP BY` aggregation — no full table scans

---

## Contributing

ServerInventory is **100% open source and welcomes all contributions** — from small typo fixes to major new features.

**What we'd love help with:**

- **UI / Frontend** — redesign pages, add themes, improve accessibility, new visualizations
- **Backend / API** — new cloud providers (Hetzner, Vultr, Scaleway, Cloudflare, etc.), new resource types, performance improvements
- **Everything else** — integrations, alerting, export/import, CLI tools, documentation, translations

**How to contribute:**

1. **Fork** the repository
2. **Create a branch**: `git checkout -b feat/your-feature-name`
3. **Set up** using Docker or the local path above
4. **Build check**: `cd frontend && npm run build`
5. **Open a PR** against `main` with a clear description of what you changed and why

No contribution is too small. [Open an issue](https://github.com/rushikeshsakharleofficial/server-inventory/issues) first if you want feedback before writing code.

<a href="https://github.com/rushikeshsakharleofficial/server-inventory/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=rushikeshsakharleofficial/server-inventory" />
</a>

---

## Security

To report a security vulnerability, use [GitHub Security Advisories](https://github.com/rushikeshsakharleofficial/server-inventory/security/advisories/new) rather than opening a public issue.

**Production hardening checklist:**
- Set a strong, unique `SECRET_KEY` (`openssl rand -hex 32`)
- Set a strong `ADMIN_PASSWORD` before first run
- Enable MFA on the admin account via **Admin Setup → Two-Factor Authentication**
- Do not expose `http://localhost:8000` directly — place behind a reverse proxy with TLS
- Restrict PostgreSQL access to the backend container only

---

## License

MIT — free to use, modify, distribute, and build on, including for commercial purposes. See [LICENSE](LICENSE).

---

<div align="center">

[⭐ Star on GitHub](https://github.com/rushikeshsakharleofficial/server-inventory) · [🐛 Report a Bug](https://github.com/rushikeshsakharleofficial/server-inventory/issues/new?template=bug_report) · [💡 Request a Feature](https://github.com/rushikeshsakharleofficial/server-inventory/issues/new?template=feature_request) · [🤝 Contribute](https://github.com/rushikeshsakharleofficial/server-inventory/fork)

[![Star History Chart](https://api.star-history.com/svg?repos=rushikeshsakharleofficial/server-inventory&type=Date)](https://star-history.com/#rushikeshsakharleofficial/server-inventory&Date)

</div>
