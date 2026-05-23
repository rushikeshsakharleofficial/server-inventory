# ServerInventory

<div align="center">

### Free, Open-Source Multi-Cloud Server Inventory & Infrastructure Management Dashboard

**Self-hosted · Zero vendor lock-in · 100% free forever**

Track servers, databases, Kubernetes clusters, and block storage across AWS, GCP, Azure, DigitalOcean, Linode, OVH, and on-premise — all from one unified dashboard.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![CodeQL](https://github.com/rushikeshsakharleofficial/server-inventory/actions/workflows/codeql.yml/badge.svg)](https://github.com/rushikeshsakharleofficial/server-inventory/actions/workflows/codeql.yml)
[![GitHub Stars](https://img.shields.io/github/stars/rushikeshsakharleofficial/server-inventory?style=social)](https://github.com/rushikeshsakharleofficial/server-inventory/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/rushikeshsakharleofficial/server-inventory?style=social)](https://github.com/rushikeshsakharleofficial/server-inventory/network/members)
[![GitHub Issues](https://img.shields.io/github/issues/rushikeshsakharleofficial/server-inventory)](https://github.com/rushikeshsakharleofficial/server-inventory/issues)

</div>

---

> **Looking for a free, self-hosted alternative to paid cloud inventory tools?** ServerInventory is an open-source server inventory management system that gives you full visibility across every cloud provider and on-premise datacenter — with no SaaS fees, no data leaving your infrastructure, and no artificial limits.

---

## Table of Contents

- [Why ServerInventory](#why-serverinventory)
- [Features](#features)
- [Stack](#stack)
- [Getting Started](#getting-started)
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

- **Live sync via WebSocket** — real-time progress with ability to stop mid-sync
- **SSH data collection** — pulls CPU, RAM, kernel, OS, IPs from on-premise servers via paramiko
- **Cron scheduler** — APScheduler-backed cron jobs with standard 5-field expressions
- **Role-based access control** — Admin, Write, and Read roles with JWT auth and 90-day remember-me tokens
- **MFA / TOTP** — per-user two-factor authentication using authenticator apps (Google Authenticator, Authy, etc.)
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

## Installation

```bash
git clone https://github.com/rushikeshsakharleofficial/server-inventory.git
cd server-inventory
docker compose up -d
```

Open http://localhost:5173 — default login: `admin` / `Admin@1234`.

See [Getting Started](#getting-started) for full local setup, environment variables, and production configuration.

---

## Getting Started

### Prerequisites

**Docker path (recommended):**
- Docker + Docker Compose

**Local path:**
- Python 3.11+
- Node.js 20+
- PostgreSQL 16 running on `localhost:5432`

### Quick Start — Docker

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

> **Security:** Change `ADMIN_PASSWORD` and `SECRET_KEY` before any production or internet-facing deployment. See [Environment Variables](#environment-variables).

### Quick Start — Local (no Docker)

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
cp .env.example .env                   # edit DATABASE_URL and SECRET_KEY
uvicorn app.main:app --reload --port 8000
```

```bash
# Terminal 2 — Frontend
cd frontend
npm install
npm run dev
```

PostgreSQL must be reachable at the `DATABASE_URL` set in `backend/.env`. Tables are created automatically on first startup.

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

Add credentials via **Cloud Providers → Add Credential** in the UI. Required fields per provider:

### AWS

Fields: `access_key_id`, `secret_access_key`, `regions` (comma-separated, e.g. `us-east-1,eu-west-1`)

Minimum IAM permissions required:
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
│   │   ├── main.py           # FastAPI app, lifespan, WebSocket endpoint
│   │   ├── models.py         # SQLAlchemy ORM models
│   │   ├── schemas.py        # Pydantic request/response schemas
│   │   ├── auth.py           # JWT auth, password hashing, MFA/TOTP, role guards
│   │   ├── database.py       # SQLAlchemy engine + session factory
│   │   ├── stats_utils.py    # Shared stats aggregation (SQL GROUP BY)
│   │   ├── scheduler.py      # APScheduler setup
│   │   ├── ws_manager.py     # WebSocket connection manager
│   │   ├── routers/          # FastAPI routers (servers, sync, stats, auth, …)
│   │   └── providers/        # Cloud provider sync implementations
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.tsx            # Root: routing, auth, modal state
│   │   ├── stitches.config.ts # Stitches design tokens and theme
│   │   ├── components/        # Page and UI components
│   │   ├── hooks/             # useAuth, useTheme, useToast, useWebSocket
│   │   ├── api.ts             # Axios client + API helpers
│   │   └── types.ts           # Shared TypeScript types
│   ├── e2e/                   # Playwright E2E tests
│   │   ├── auth.spec.ts
│   │   ├── navigation.spec.ts
│   │   └── visual.spec.ts
│   ├── playwright.config.ts
│   ├── tailwind.config.js
│   └── vite.config.ts
├── docker-compose.yml
├── start.sh                   # Local dev launcher (requires local Postgres)
├── install-docker.sh          # Docker installation helper
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

### Prerequisites

Backend must be running on `http://localhost:8000`. The Vite dev server is started automatically by Playwright's `webServer` config.

### Running Tests

```bash
cd frontend

# Run all tests (chromium, dark theme)
E2E_PASSWORD='Admin@1234' npm run test:e2e

# Update visual regression snapshots after UI changes
E2E_PASSWORD='Admin@1234' npx playwright test e2e/visual.spec.ts --update-snapshots

# Open interactive Playwright UI
npm run test:e2e:ui
```

### Test Environment Variables

| Variable | Default | Description |
|:---------|:--------|:------------|
| `E2E_USERNAME` | `admin` | Admin username for test login |
| `E2E_PASSWORD` | `Admin@1234` | Admin password — match `ADMIN_PASSWORD` |
| `VITE_BACKEND_URL` | `http://localhost:8000` | Backend URL for Vite proxy during tests |

### Test Coverage

| Suite | Tests | Description |
|:------|:-----:|:------------|
| `auth.spec.ts` | 4 | Login, bad credentials, logout |
| `navigation.spec.ts` | 9 | Navigate to all 9 views |
| `visual.spec.ts` | 20 | Screenshot per view × dark + light theme |

---

## Architecture

```
┌────────────┐     WebSocket     ┌─────────────────┐
│  React     │◄─────────────────►│  FastAPI        │
│  Frontend  │  REST API (JWT)   │  Backend        │
└────────────┘◄─────────────────►│                 │
                                  │  ┌───────────┐  │
                                  │  │ APScheduler│  │
                                  │  └───────────┘  │
                                  └────────┬────────┘
                                           │
                                  ┌────────▼────────┐
                                  │   PostgreSQL 16  │
                                  └─────────────────┘
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

ServerInventory is **100% open source and welcomes all contributions** — from small typo fixes to major new features. There are no gatekeepers and no restrictions on what you can build or change.

### What we'd love help with

**UI / Frontend**
- Redesign pages, components, or the entire dashboard
- Add new themes, improve mobile responsiveness
- Build new data visualizations or dashboards
- Migrate styling, add animations, improve accessibility

**Backend / API**
- Add new cloud providers (Hetzner, Vultr, Scaleway, Cloudflare, etc.)
- Extend existing provider sync coverage
- Add new resource types (container registries, CDN, DNS, etc.)
- Performance improvements, query optimization, caching

**Everything else**
- New features, integrations, alerting, export/import
- CLI tools, Terraform/Ansible integrations
- Documentation, guides, translations
- Bug fixes of any size

### How to contribute

1. **Fork** the repository on GitHub
2. **Clone** your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/server-inventory.git
   cd server-inventory
   ```
3. **Create a branch** for your change:
   ```bash
   git checkout -b feat/your-feature-name
   ```
4. **Set up the development environment** using Docker or the local path above
5. **Make your changes** — feel free to refactor, redesign, or add entirely new capabilities
6. **Verify the build** passes:
   ```bash
   cd frontend && npm run build
   ```
7. **Run E2E tests** (optional but appreciated):
   ```bash
   cd frontend && E2E_PASSWORD='Admin@1234' npm run test:e2e
   ```
8. **Open a pull request** against `main` with a clear description of what you changed and why

### Guidelines

- **No contribution is too small** — even fixing a typo is welcome
- **No contribution is too big** — complete rewrites and new subsystems are welcome
- **Breaking changes** — mention them clearly in the PR description so we can plan accordingly
- **New cloud providers** — add your implementation under `backend/app/providers/` following existing provider patterns
- **UI changes** — screenshots or a short description of the visual change helps reviewers

If you're unsure whether your idea fits or want feedback before writing code, [open an issue](https://github.com/rushikeshsakharleofficial/server-inventory/issues) first.

---

## Security

To report a security vulnerability, please use [GitHub Security Advisories](https://github.com/rushikeshsakharleofficial/server-inventory/security/advisories/new) rather than opening a public issue. This allows us to assess and address the issue before public disclosure.

**Production hardening checklist:**
- Set a strong, unique `SECRET_KEY` (use `openssl rand -hex 32`)
- Set a strong `ADMIN_PASSWORD` before first run
- Enable MFA on the admin account via **Settings → Two-Factor Authentication**
- Do not expose `http://localhost:8000` directly — place behind a reverse proxy with TLS
- Restrict PostgreSQL access to the backend container only

---

## License

This project is licensed under the **MIT License** — free to use, modify, distribute, and build on, including for commercial purposes.

See [LICENSE](LICENSE) for the full license text.

---

<div align="center">

**ServerInventory** — Free, open-source server inventory management for everyone.

[⭐ Star on GitHub](https://github.com/rushikeshsakharleofficial/server-inventory) · [🐛 Report a Bug](https://github.com/rushikeshsakharleofficial/server-inventory/issues/new?template=bug_report) · [💡 Request a Feature](https://github.com/rushikeshsakharleofficial/server-inventory/issues/new?template=feature_request) · [🤝 Contribute](https://github.com/rushikeshsakharleofficial/server-inventory/fork)

</div>
