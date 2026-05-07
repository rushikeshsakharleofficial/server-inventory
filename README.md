# ServerInventory

A full-stack, multi-cloud server inventory dashboard with AMOLED dark UI, real-time sync, SSH collection, resource topology mapping, and managed database/Kubernetes cluster tracking.

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
- AWS EKS
- GCP GKE
- Azure AKS
- DigitalOcean DOKS
- Linode LKE

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
- **Light / Dark theme** — full CSS variable system, AMOLED-optimized dark mode
- **Server snapshots** — daily history for dashboard growth charts
- **Housekeeping** — auto-prune logs and snapshots older than 365 days

---

## Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI, SQLAlchemy 2.x, PostgreSQL, Alembic-free (create_all) |
| Auth | JWT (python-jose), bcrypt, role-based access |
| Scheduling | APScheduler BackgroundScheduler |
| SSH | paramiko |
| WebSockets | FastAPI native + asyncio broadcast |
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS 3 + CSS custom properties |
| Data fetching | TanStack Query v5 |
| Charts | Recharts |
| Icons | Lucide React |
| Container | Docker Compose (postgres + backend + frontend) |

---

## Getting Started

### Prerequisites
- Docker + Docker Compose

### Run

```bash
git clone https://github.com/rushikeshsakharleofficial/server-inventory.git
cd server-inventory
docker compose up -d
```

Frontend: http://localhost:5173  
Backend API: http://localhost:8000/docs  

Default credentials:
```
Username: admin
Password: Admin@1234
```

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `ADMIN_USERNAME` | `admin` | Initial admin username |
| `ADMIN_PASSWORD` | `Admin@1234` | Initial admin password |
| `SECRET_KEY` | `change-this-secret-key-in-production` | JWT signing secret |
| `DATABASE_URL` | postgres connection string | PostgreSQL DSN |

---

## Cloud Provider Setup

### AWS
Required config keys: `access_key_id`, `secret_access_key`, `regions` (comma-separated)

IAM permissions needed: `ec2:Describe*`, `rds:Describe*`, `eks:List*`, `eks:Describe*`, `autoscaling:Describe*`, `elasticloadbalancing:Describe*`

### GCP
Required: `service_account_json` (full JSON), `project_id`

APIs to enable: Compute Engine, Cloud SQL Admin, Kubernetes Engine

### Azure
Required: `subscription_id`, `tenant_id`, `client_id`, `client_secret`

### DigitalOcean
Required: `api_token`

### Linode
Required: `api_token`

### OVH
Required: `application_key`, `application_secret`, `consumer_key`, `endpoint` (`ovh-eu` / `ovh-ca` / `ovh-us`)

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
                                  │   PostgreSQL     │
                                  └─────────────────┘
```

### Data Models
- `Server` — multi-cloud VM inventory with SSH info
- `DatabaseInstance` — managed database instances
- `KubernetesCluster` — managed K8s clusters
- `Credential` — provider credentials (per-provider config JSON)
- `SSHCredential` — SSH key/password credentials for Custom DC
- `SyncLog` — sync run history with duration and result
- `ServerSnapshot` — daily server count snapshots for trend charts
- `CronJob` — scheduled sync jobs
- `User` — auth users with roles
- `AppSetting` — key-value settings (sync timeout, SSH port, etc.)

---

## Screenshots

### Dashboard
Stats cards with Syne typography, server growth line chart, provider breakdown bar chart.

### Server Inventory
Sortable, filterable table with status badges, provider badges, IP display, SSH sync for Custom DC servers.

### Inventory → Databases
Managed database instances with engine badges (PostgreSQL, MySQL, Redis, MongoDB), endpoint, port, storage.

### Inventory → Kubernetes
Cluster fleet with version, node count, endpoint, provider badges, per-cluster Resource Map.

### Resource Map
Categorized topology view showing connected cloud resources — VPCs, subnets, security groups, IAM roles, load balancers, NAT gateways, and more. Click any node to expand details.

### Cloud Providers
Credential management table with per-provider sync trigger and active/inactive toggle.

---

## License

MIT
