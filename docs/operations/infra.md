# Infrastructure Snapshot

This file captures the production environment details that were scattered across
`NEWDEPLOY.md`, `PM2_DEPLOYMENT.md`, and related notes. Update it whenever the
infrastructure footprint changes.

## Host Summary

| Item          | Value                            |
| ------------- | -------------------------------- |
| Provider      | Hostinger VPS                    |
| Hostname / IP | `46.202.177.230`                 |
| Domain        | `32cbgg8.com` (`www` CNAME)      |
| OS            | Ubuntu 24.04.2 LTS               |
| CPU           | AMD EPYC 9354P (2 vCPU assigned) |
| RAM           | 8 GB                             |
| Storage       | 96 GB (≈83 GB free)              |

## Installed Software

- Node.js 20.18 / npm 11
- Python 3.12 with venv
- PM2 5.4
- Redis server (AOF enabled, 1 GB cap)
- Nginx 1.24 (reverse proxy + SSL termination)
- Certbot (Let’s Encrypt)
- Fail2ban
- Build essentials (gcc, make, etc.)
- Monitoring utilities: `htop`, `iotop`, `nethogs`

## Application Layout

| Path                                    | Purpose                                |
| --------------------------------------- | -------------------------------------- |
| `/var/www/cbthis`                       | Application root                       |
| `/var/www/cbthis/dist`                  | Built Vite assets                      |
| `/var/www/cbthis/ecosystem.config.cjs`  | PM2 configuration                      |
| `/var/www/cbthis/rag-service`           | FastAPI service                        |
| `/var/www/cbthis/rag-service/venv`      | Python virtualenv                      |
| `/var/www/cbthis/rag-service/chroma_db` | Vector store artifacts                 |
| `/etc/cbthis/env`                       | Express/gateway environment file       |
| `/etc/cbthis/rag-env`                   | RAG env overrides                      |
| `/etc/nginx/sites-available/cbthis`     | Nginx site config                      |
| `/var/log/cbthis`                       | Application log directory (if enabled) |
| `/var/backups/cbthis`                   | Optional backup root                   |

## Services & Ports

| Service         | Port              | Manager                         |
| --------------- | ----------------- | ------------------------------- |
| Express gateway | `3000` (internal) | PM2 (`cf-travel-bot`)           |
| RAG FastAPI     | `8000` (internal) | systemd (`rag-service.service`) |
| Redis           | `6379`            | systemd (`redis-server`)        |
| Nginx           | `80`/`443`        | systemd (`nginx`)               |

## Authentication & Access

- Primary SSH users: `root`, optional `deploy` (sudo-enabled)
- SSH key-based authentication; password login disabled
- Firewall (UFW) allowing SSH (22), HTTP (80), HTTPS (443)
- PM2 managed under the chosen deploy user; ensure `pm2 startup` run after user
  changes

## Resource Allocation Guidelines

| Component             | CPU   | Memory    | Notes                    |
| --------------------- | ----- | --------- | ------------------------ |
| Node.js PM2 cluster   | ≤50 % | 2–3 GB    | 2 instances recommended  |
| RAG workers (uvicorn) | ≤30 % | 2 GB      | adjust workers per CPU   |
| Redis                 | ≤10 % | 1 GB      | enforce `maxmemory`      |
| System buffer         | ≤10 % | Remaining | keep headroom for spikes |

Review actual consumption via `pm2 monit`, `htop`, and system metrics after each
release.

## Networking

- HTTPS enforced via Nginx reverse proxy
- Health endpoints exposed publicly (`/health`, `/api/deployment-info`)
- Redis bound to localhost (`127.0.0.1`)
- SSE endpoints proxied through Express (see `docs/operations/deployment.md`)

## Backups & Persistence

- Redis snapshots stored under `/var/lib/redis/`
- Chroma DB archived via nightly backup script (see `runbook.md`)
- Env files backed up with timestamped tarballs
- PM2 process list saved with `pm2 save`

## Known Gaps / TODO

- Automate infrastructure inventory export (extends `scripts/vps-discovery.sh`)
- Establish monitoring/alerting webhook (platform TBD)
- Document object storage strategy for long-term vector-store backups

Keep this inventory synchronized with any changes made during refactor stages or
infrastructure upgrades.
