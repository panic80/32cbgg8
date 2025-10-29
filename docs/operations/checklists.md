# Operational Checklists

These checklists replace `DEPLOYMENT_CHECKLIST.md`, the quick-reference blocks
inside `HOWTODEPLOY.md`, and the status tables from `DEPLOYMENT_COMPLETE.md`.
Update them as processes evolve.

## Pre-Deployment

- [ ] Confirm SSH access (`ssh root@46.202.177.230`)
- [ ] Ensure production branch up to date and CI green
- [ ] Validate API keys and secrets in `/etc/cbthis/env` & `/etc/cbthis/rag-env`
- [ ] Review open incidents or maintenance windows
- [ ] Capture current git commit (`git rev-parse HEAD`) for rollback reference
- [ ] Run `scripts/vps-discovery.sh` if server drift audit required

## Deployment Execution

- [ ] `git pull origin main` in `/var/www/cbthis`
- [ ] `npm ci` (if dependencies changed)
- [ ] `npm run build`
- [ ] `pip install -r rag-service/requirements.txt` inside venv (if needed)
- [ ] `sudo systemctl restart rag-service.service`
- [ ] `pm2 reload ecosystem.config.cjs --only cf-travel-bot`
- [ ] `pm2 save`

## Post-Deployment Verification

- [ ] `curl -f http://localhost:3000/health`
- [ ] `curl -f http://localhost:8000/api/v1/health`
- [ ] `curl -Ifs https://32cbgg8.com/health`
- [ ] `redis-cli ping`
- [ ] `pm2 status` shows `online`
- [ ] `sudo journalctl -u rag-service.service -n 50` clean
- [ ] Manual UI smoke tests (chat, admin tools, trip planner)
- [ ] Update deployment notes / changelog

## Maintenance Cadence

- [ ] Monthly system updates (`apt update && apt upgrade`)
- [ ] Monthly dependency audit (Node + Python)
- [ ] Quarterly SSL expiry check (`certbot renew --dry-run`)
- [ ] Quarterly Redis persistence verification
- [ ] Quarterly log rotation review
- [ ] Nightly backups confirmed (cron + retention)

## Security Checklist

- [ ] Non-root deploy user used for day-to-day operations
- [ ] SSH key auth enforced; password auth disabled
- [ ] Firewall limits ports to 22, 80, 443 (and any required internals)
- [ ] Environment files owned by root (`chmod 600`)
- [ ] Rate limiting active (Express + Nginx)
- [ ] Fail2ban running (`sudo systemctl status fail2ban`)
- [ ] Secrets rotated per policy (see `docs/security/`)

## Monitoring & Alerting

- [ ] `pm2 monit` or alternative monitoring running during rollout
- [ ] `tail -f /var/log/nginx/32cbgg8.com.error.log` during deploy
- [ ] Alert thresholds for latency (LangGraph) reviewed (see `deployment.md`)

## Rollback Prep

- [ ] Latest healthy commit annotated in notes
- [ ] Backups verified (Redis dump, Chroma, env files)
- [ ] PM2 process snapshot saved (`pm2 save`)
- [ ] System health snapshot captured (optional `scripts/vps-discovery.sh`)

Mark items with ✅/❌ in release notes for traceability.
