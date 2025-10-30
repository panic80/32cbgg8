# Deployment Workflow

This guide consolidates the legacy manuals (`HOWTODEPLOY.md`, `NEWDEPLOY.md`,
`PM2_DEPLOYMENT.md`, `docs/deployment.md`, `server/DEPLOYMENT.md`) into a
single reference for deploying the CF Travel Bot stack to the production VPS
(`46.202.177.230`, Hostinger, Ubuntu 24.04).

## Roles & Responsibilities

- **Primary operator:** SSH user with sudo access (`root` or `deploy`)
- **Stack components:** Vite/React client, Express gateway (PM2), FastAPI RAG
  service (systemd), Redis cache, Nginx reverse proxy
- **Source of truth:** All changes must be committed and merged to `main`
  before deploying. Never edit production-only files without mirroring them in
  git or documenting the delta here.

## Prerequisites

| Requirement | Notes                                                                       |
| ----------- | --------------------------------------------------------------------------- |
| SSH access  | `ssh root@46.202.177.230` or privileged `deploy` user                       |
| Node.js     | v20.x installed on the VPS (`node --version`)                               |
| Python      | 3.12 with virtualenv support                                                |
| Redis       | `redis-server` service enabled and running                                  |
| PM2         | Globally installed (`pm2 -v`) and boot-enabled (`pm2 startup && pm2 save`)  |
| SSL         | Let’s Encrypt configured for `32cbgg8.com` (managed via `certbot`)          |
| Env files   | `/etc/cbthis/env` and `/etc/cbthis/rag-env` up to date with current secrets |

## High-Level Flow

1. **Local prep** – merge to `main`, push, confirm CI.
2. **Pull + build** – update `/var/www/cbthis`, install new deps if required.
3. **Backend refresh** – upgrade RAG service deps, restart systemd unit.
4. **Frontend/gateway build** – `npm run build`, reload PM2.
5. **Verification** – health checks (Express, RAG, Redis, Nginx) and smoke tests.

## 1. Local Preparation

```bash
git status        # ensure clean working tree
git pull origin main
git add .
git commit -m "Deploy <feature>"
git push origin main
```

Confirm CI passes (lint, tests, build). If the refactor plan introduced a
release branch (`refactor/staged-rollout`), cut a weekly tag before promoting to
`main`.

## 2. Update the VPS

```bash
ssh root@46.202.177.230
cd /var/www/cbthis
git pull origin main
```

If dependencies changed:

```bash
# Node dependencies
npm ci

# Python dependencies
cd rag-service
source venv/bin/activate
pip install -r requirements.txt
deactivate
cd ..
```

Keep the virtualenv pinned to Python 3.12. If the `venv` is missing, create it:

```bash
python3 -m venv rag-service/venv
source rag-service/venv/bin/activate
pip install --upgrade pip
pip install -r rag-service/requirements.txt
deactivate
```

## 3. Build & Restart Services

```bash
# React bundle
npm run build

# FastAPI / RAG
sudo systemctl restart rag-service.service
sudo systemctl status rag-service.service --no-pager

# Express / PM2
pm2 reload ecosystem.config.cjs --only cf-travel-bot || pm2 restart all
pm2 save
```

If you are deploying both Express and RAG changes together, follow the documented
production order (also referenced in `docs/refactor/staged-plan.md`):

1. `npm run build`
2. `sudo systemctl restart rag-service.service`
3. `npm run reload` (PM2 reload wrapper)
4. Optional: `systemctl status rag-service.service --no-pager` and `pm2 status`

## 4. Health Checks & Smoke Tests

Run these from the VPS:

```bash
curl -f http://localhost:3000/health             # Express gateway
curl -f http://localhost:8000/api/v1/health      # RAG service
redis-cli ping                                   # Redis
pm2 status                                       # Process list
sudo journalctl -u rag-service.service -n 50     # Last RAG logs
```

For a consolidated gateway check (health, config, travel instructions), use:

```bash
./scripts/verify-gateway.sh http://localhost:3000
./scripts/verify-gateway.sh http://localhost:3000 --verify-sse   # requires ADMIN_USER/ADMIN_PASS env vars
```

Remote verification:

```bash
curl -Ifs https://32cbgg8.com/health
curl -Ifs https://32cbgg8.com/api/deployment-info
```

Manual UI smoke tests:

- `/chat` conversation flow (standard + streaming)
- `/admin-tools` for feature flag toggles
- Trip planner submission end-to-end

Capture results in `docs/refactor/reports/<stage>.md` if you are in the staged
refactor flow.

## 5. Automation Helpers

- `scripts/deploy-langgraph.sh` – orchestrates LangGraph/RAG deployments (pull,
  pip install, restart, verification).
- `scripts/vps-setup.sh` – initial server provisioning (packages, users, PM2
  bootstrap).
- `scripts/vps-discovery.sh` – collects current server state for audits.
- `scripts/verify-gateway.sh` – curls key Express endpoints (health, config, SSE guard) after deploys.

Always dry-run scripts or inspect their contents before executing on production.

## 6. Environment & Configuration Notes

- Env files live in `/etc/cbthis/env` (Express) and `/etc/cbthis/rag-env` (RAG).
  Keep file permissions restricted (`chmod 600`) and document updates.
- Nginx site definition for `32cbgg8.com` is stored under
  `/etc/nginx/sites-available/cbthis`; reload via `sudo systemctl reload nginx`
  after changes.
- Redis uses the local instance (`redis://localhost:6379`) with optional AOF
  persistence and 1 GB memory cap (see `NEWDEPLOY.md` history). Adjust the local
  override at `/etc/redis/redis.conf.local`.
- RAG stateful retrieval toggles are managed via `/etc/cbthis/rag-env`:
  ```bash
  RAG_ENABLE_STATEFUL_RETRIEVAL=true
  RAG_MAX_RETRIEVAL_ITERATIONS=2
  RAG_RELEVANCE_THRESHOLD=0.4
  RAG_REDIS_URL=redis://localhost:6379
  ```
  Tune thresholds/iterations based on latency and refinement rate (see LangGraph
  deployment notes in `docs/rag/` once consolidated).

## 7. Post-Deployment Monitoring

```bash
pm2 logs --lines 50
sudo journalctl -u rag-service.service -f
tail -f /var/log/nginx/32cbgg8.com.access.log
```

Target latency (from LangGraph rollout notes):

| Scenario            | Expected Latency  |
| ------------------- | ----------------- |
| High-quality query  | Base + 100‑200 ms |
| 1 refinement cycle  | Base + 3‑5 s      |
| 2 refinement cycles | Base + 6‑10 s     |

Alert thresholds and dashboards are documented in `docs/performance-dashboard.md`.

## 8. Maintenance Tasks

- Re-run `npm ci` / `pip install` after dependency upgrades.
- Check disk usage (`df -h`, `du -sh /var/www/cbthis/*`) monthly.
- Rotate logs via system logrotate configuration (`/etc/logrotate.d/` entries
  created during initial setup).
- Renew SSL certificates with `certbot renew` (already cron’d; monitor expiry).
- Backup strategy: nightly script capturing Redis dump, ChromaDB artifacts, and
  env files (see `runbook.md` for sample cron).

## 9. Deployment Records

Document each production release in `CHANGELOG.md` (root) and/or the refactor
reports with:

- Git commit/tag
- Date/time
- Operator
- Notable changes (features, migrations)
- Validation commands + results
- Any follow-up actions

Keeping these notes current simplifies audits and rollback decisions (see
`rollback.md`).
