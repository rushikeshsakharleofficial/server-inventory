# ServerInventory

A full-stack, multi-cloud server inventory dashboard with real-time sync, SSH data collection, resource topology mapping, and managed database/Kubernetes cluster tracking.

---

## Features

### Multi-Cloud Server Sync
- **AWS** — EC2 instances across all regions
- **GCP** — Compute Engine VMs via service account
- **Azure** — Virtual Machines across subscription
- **DigitalOcean** — Droplets
- **Linode / Akamai** — Linode instances
- **OVH Cloud** — Bare metal, VPS, Public Cloud
- **Custom DC** — Manually registered on-premise servers

### Databases
Auto-fetch managed database instances from:
- AWS RDS (PostgreSQL, MySQL, Aurora, MariaDB)
- GCP Cloud SQL
- Azure Database for PostgreSQL / MySQL
- DigitalOcean Managed Databases
- Linode Database Clusters

### Kubernetes
Auto-fetch managed cluster fleets from:
- AWS EKS, GCP GKE, Azure AKS, DigitalOcean DOKS, Linode LKE

### Resource Map
Per-resource topology viewer showing connected cloud resources:

| Provider | Coverage |
|---|---|
| **AWS** | VPC, Subnets, Security Groups, ENIs, IAM Profile, Elastic IPs, NAT Gateways, Auto Scaling Groups, ALB/NLB, Route Tables |
| **GCP** | VPC Network, Subnetworks, Alias IP ranges, Firewall Rules, Service Accounts, Disks |
| **Azure** | NICs, NSGs, VNets, Subnets, Public IPs, Managed Identity, Availability Sets |
| **DigitalOcean** | VPC, Floating IPs, Firewalls, Load Balancers, Tags |
| **Linode** | Firewalls, NodeBalancers, VLANs, Disks |
| **OVH** | IPs, Failover IPs, vRack, OVH Firewall, Backup Cloud, IPMI |

### Core Capabilities
- **Live sync** via WebSocket — real-time progress, stop mid-sync
- **SSH data collection** — pulls CPU, RAM, kernel, OS, IPs from Custom DC servers via paramiko
- **Cron scheduler** — APScheduler-backed cron jobs with standard 5-field expressions
- **User management** — Admin, Write, Read roles with JWT auth and 90-day remember-me
- **Light / Dark theme** — CSS variable system, AMOLED-optimized dark mode
- **Server snapshots** — daily history for dashboard growth charts
- **Housekeeping** — auto-prune logs and snapshots older than 365 days

---

## Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI, SQLAlchemy 2.x, PostgreSQL 16 |
| Auth | JWT (python-jose), bcrypt, role-based access |
| Scheduling | APScheduler BackgroundScheduler |
| SSH | paramiko |
| WebSockets | FastAPI native + asyncio broadcast |
| Frontend | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS 3 + CSS custom properties |
| Data fetching | TanStack Query v5 |
| Charts | Recharts |
| Icons | Lucide React |
| E2E Testing | Playwright |
| Container | Docker Compose (postgres + backend + frontend) |

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
|---|---|
| http://localhost:5173 | Frontend |
| http://localhost:8000/docs | Backend API (Swagger) |

Default credentials:

```
Username: admin
Password: Admin@1234
```

> **Production:** set `ADMIN_PASSWORD` and `SECRET_KEY` environment variables before first run. See [Environment Variables](#environment-variables).

### Quick Start — Local (no Docker)

```bash
# 1. Backend
cd backend
pip install -r requirements.txt
cp .env.example .env        # edit DATABASE_URL and SECRET_KEY
uvicorn app.main:app --reload --port 8000

# 2. Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

PostgreSQL must be reachable at the `DATABASE_URL` in `backend/.env`. Tables are created automatically on first startup.

---

## Environment Variables

Create `backend/.env` from the example:

```bash
cp backend/.env.example backend/.env
```

| Variable | Default | Required | Description |
|---|---|---|---|
| `DATABASE_URL` | `postgresql://inventory:inventory@localhost:5432/server_inventory` | Yes | PostgreSQL connection string |
| `ADMIN_USERNAME` | `admin` | No | Initial admin username (seeded once) |
| `ADMIN_PASSWORD` | `Admin@1234` | **Yes in prod** | Initial admin password |
| `SECRET_KEY` | `change-this-secret-key-in-production` | **Yes in prod** | JWT signing secret — generate with `openssl rand -hex 32` |

---

## Cloud Provider Setup

Add credentials via **Cloud Providers → Add Credential** in the UI. Required fields per provider:

### AWS
- `access_key_id`, `secret_access_key`, `regions` (comma-separated, e.g. `us-east-1,eu-west-1`)

IAM permissions: `ec2:Describe*`, `rds:Describe*`, `eks:List*`, `eks:Describe*`, `autoscaling:Describe*`, `elasticloadbalancing:Describe*`

### GCP
- `service_account_json` (full JSON content), `project_id`

APIs to enable: Compute Engine, Cloud SQL Admin, Kubernetes Engine

### Azure
- `subscription_id`, `tenant_id`, `client_id`, `client_secret`

### DigitalOcean
- `api_token`

### Linode
- `api_token`

### OVH
- `application_key`, `application_secret`, `consumer_key`, `endpoint` (`ovh-eu` / `ovh-ca` / `ovh-us`)

---

## Development

### Project Structure

```
.
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app, lifespan, WebSocket endpoint
│   │   ├── models.py        # SQLAlchemy ORM models
│   │   ├── schemas.py       # Pydantic request/response schemas
│   │   ├── auth.py          # JWT auth, password hashing, role guards
│   │   ├── database.py      # SQLAlchemy engine + session factory
│   │   ├── stats_utils.py   # Shared stats aggregation (SQL GROUP BY)
│   │   ├── scheduler.py     # APScheduler setup
│   │   ├── ws_manager.py    # WebSocket connection manager
│   │   ├── routers/         # FastAPI routers (servers, sync, stats, …)
│   │   └── providers/       # Cloud provider sync implementations
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.tsx           # Root: routing, auth, modal state
│   │   ├── components/       # Page and UI components
│   │   ├── hooks/            # useAuth, useTheme, useToast, useWebSocket
│   │   ├── api.ts            # Axios client + API helpers
│   │   └── types.ts          # Shared TypeScript types
│   ├── e2e/                  # Playwright E2E tests
│   │   ├── auth.spec.ts
│   │   ├── navigation.spec.ts
│   │   └── visual.spec.ts
│   ├── playwright.config.ts
│   ├── tailwind.config.js
│   └── vite.config.ts
├── docker-compose.yml
└── start.sh                  # Local dev launcher (requires local Postgres)
```

### Frontend Commands

Run from `frontend/`:

| Command | Purpose |
|---|---|
| `npm run dev` | Start Vite dev server on port 5173 |
| `npm run build` | TypeScript check + production build |
| `npm run preview` | Serve production build locally |
| `npm run test:e2e` | Run Playwright E2E tests (headless) |
| `npm run test:e2e:ui` | Open Playwright UI mode |

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

### Run

```bash
cd frontend

# Run all tests (chromium, dark theme)
E2E_PASSWORD='Admin@1234' npm run test:e2e

# Update visual regression snapshots
E2E_PASSWORD='Admin@1234' npx playwright test e2e/visual.spec.ts --update-snapshots

# Open interactive UI
npm run test:e2e:ui
```

### Environment variables for tests

| Variable | Default | Description |
|---|---|---|
| `E2E_USERNAME` | `admin` | Admin username |
| `E2E_PASSWORD` | `admin123` | Admin password (set to match `ADMIN_PASSWORD`) |
| `VITE_BACKEND_URL` | `http://localhost:8000` | Backend URL for Vite proxy during tests |

### Coverage

| Suite | Tests | Description |
|---|---|---|
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
                                  │  │ Scheduler │  │
                                  │  │ APSchedule│  │
                                  │  └───────────┘  │
                                  └────────┬────────┘
                                           │
                                  ┌────────▼────────┐
                                  │   PostgreSQL 16  │
                                  └─────────────────┘
```

### Data Models

| Model | Purpose |
|---|---|
| `Server` | Multi-cloud VM inventory with SSH info |
| `DatabaseInstance` | Managed database instances |
| `KubernetesCluster` | Managed K8s clusters |
| `Credential` | Provider credentials (per-provider config JSON) |
| `SSHCredential` | SSH key/password credentials for Custom DC |
| `SyncLog` | Sync run history with duration and result |
| `ServerSnapshot` | Daily server count snapshots for trend charts |
| `CronJob` | Scheduled sync jobs |
| `User` | Auth users with roles (admin / write / read) |
| `AppSetting` | Key-value settings (sync timeout, SSH port, etc.) |

### Database Performance

On startup the backend automatically applies:
- `pg_trgm` extension — enables trigram GIN indexes for efficient `ILIKE` search on `name`, `public_ip`, `hostname`
- Composite index `(provider, status)` for filtered server list queries
- Stats endpoints use SQL `GROUP BY` aggregation — no full table scans

---

## Contributing

1. Fork the repository and create a feature branch.
2. Run backend with `uvicorn app.main:app --reload` and frontend with `npm run dev`.
3. Make changes and verify with `npm run build` (TypeScript check) from `frontend/`.
4. Run E2E tests: `E2E_PASSWORD='Admin@1234' npm run test:e2e` from `frontend/`.
5. Open a pull request against `main`.

---

## License

MIT
