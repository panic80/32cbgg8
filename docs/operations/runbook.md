# Operations Runbook

Use this playbook for day‑to‑day management of the production stack. It merges
the troubleshooting, monitoring, and maintenance guidance from the legacy
deployment markdowns.

## 1. Service Management

| Component              | Manager                         | Key Commands                                                                              |
| ---------------------- | ------------------------------- | ----------------------------------------------------------------------------------------- |
| Express gateway (Node) | PM2                             | `pm2 status`, `pm2 reload ecosystem.config.cjs`, `pm2 logs cf-travel-bot`                 |
| Vite static assets     | Served by Express               | `npm run build`, verify `dist/`                                                           |
| RAG service (FastAPI)  | systemd (`rag-service.service`) | `sudo systemctl restart rag-service.service`, `sudo journalctl -u rag-service.service -f` |
| Redis                  | systemd (`redis-server`)        | `sudo systemctl status redis-server`, `redis-cli ping`                                    |
| Nginx                  | systemd (`nginx`)               | `sudo systemctl reload nginx`, check `/etc/nginx/sites-available/cbthis`                  |

### Common Actions

```bash
# Restart everything in release order
npm run build
sudo systemctl restart rag-service.service
pm2 reload ecosystem.config.cjs --only cf-travel-bot

# Restart PM2 completely
pm2 restart all
pm2 save

# Restart Redis
sudo systemctl restart redis-server

# Tail RAG or PM2 logs
sudo journalctl -u rag-service.service -f
pm2 logs cf-travel-bot --lines 100
```

## 2. Health Checks & Monitoring

```bash
curl -f http://localhost:3000/health           # Express gateway
curl -f http://localhost:8000/api/v1/health    # RAG service
curl -Ifs https://32cbgg8.com/health           # External, via Nginx/SSL
redis-cli ping                                 # Redis availability
```

Useful dashboards:

- `pm2 monit` – live CPU/memory
- `htop`, `iotop`, `nethogs` – system utilisation
- `tail -f /var/log/nginx/32cbgg8.com.access.log` – ingress traffic
- Custom charts in `docs/performance-dashboard.md`

## 3. Backups & Disaster Recovery

Nightly backup script (see `scripts/backup.sh` historical example):

```bash
BACKUP_ROOT=/var/backups/cbthis
mkdir -p "$BACKUP_ROOT"

# Redis snapshot
redis-cli BGSAVE
sleep 5
cp /var/lib/redis/dump.rdb "$BACKUP_ROOT/redis_$(date +%Y%m%d).rdb"

# ChromaDB artifacts
tar -czf "$BACKUP_ROOT/chromadb_$(date +%Y%m%d).tar.gz" -C /var/www/cbthis/rag-service chroma_db

# Env files
tar -czf "$BACKUP_ROOT/env_$(date +%Y%m%d).tar.gz" /etc/cbthis/env /etc/cbthis/rag-env

# Retention (7 days)
find "$BACKUP_ROOT" -type f -mtime +7 -delete
```

Add to root crontab: `0 3 * * * /usr/local/sbin/cbthis-backup.sh`

## 4. Troubleshooting

### PM2 Process Stuck in Restart Loop

```bash
pm2 logs cf-travel-bot --lines 200
pm2 delete cf-travel-bot
pm2 start ecosystem.config.cjs --only cf-travel-bot
pm2 save
```

If PM2 still reports “waiting restart”, rebuild the bundle:

```bash
npm run build
pm2 restart cf-travel-bot
```

### RAG Service Failing to Start

```bash
sudo journalctl -u rag-service.service -n 200
/var/www/cbthis/rag-service/venv/bin/python --version
/var/www/cbthis/rag-service/venv/bin/pip list
```

Fix missing dependencies:

```bash
cd /var/www/cbthis/rag-service
source venv/bin/activate
pip install --no-cache-dir -r requirements.txt
deactivate
sudo systemctl restart rag-service.service
```

### Port Conflicts

```bash
sudo lsof -i :3000 -sTCP:LISTEN
sudo lsof -i :8000 -sTCP:LISTEN
sudo fuser -k 3000/tcp
sudo fuser -k 8000/tcp
```

### Memory Pressure During Pip Install

```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### SSL Renewal

```bash
sudo certbot renew --dry-run
sudo certbot renew
sudo systemctl reload nginx
```

### Redis Troubles

```bash
redis-cli ping
redis-cli INFO memory
journalctl -u redis-server -n 100
```

If configuration changed, restart using `/etc/redis/redis.conf.local` overrides.

## 5. Maintenance Cadence

| Task                                         | Frequency              | Notes                                                                     |
| -------------------------------------------- | ---------------------- | ------------------------------------------------------------------------- |
| System updates (`apt update && apt upgrade`) | Monthly                | Reboot if kernel updates                                                  |
| `npm audit` / dependency review              | Monthly or pre-release | Document any production-impacting changes                                 |
| Check disk usage (`df -h`, `du`)             | Monthly                | Clean old artifacts under `/var/backups`                                  |
| SSL certificate renewal                      | Automatic (certbot)    | Verify expiry quarterly                                                   |
| Log rotation review                          | Quarterly              | Nginx under `/etc/logrotate.d/nginx`, custom apps follow systemd defaults |
| Redis persistence health                     | Quarterly              | Confirm `dump.rdb` updated and AOF, if enabled                            |

## 6. Incident Response

1. Confirm blast radius (which services impacted).
2. Gather logs: PM2, systemd, Nginx, application.
3. Communicate via incident channel (see `docs/security/index.md` for contacts).
4. Mitigate (rollback, feature flag, restart).
5. Document the incident and remediation in `docs/operations/runbook.md` or a
   linked report until a dedicated incident log exists.

## 7. Reference Commands

```bash
# Git sanity
git log --oneline -10

# Process snapshot
ps -eo pid,ppid,cmd,%mem,%cpu --sort=-%cpu | head

# Network status
sudo ss -tulpn | grep -E '3000|3001|8000|6379'

# Firewall check
sudo ufw status verbose

# Nginx syntax
sudo nginx -t
```

Keep this file updated whenever new operational procedures are introduced or
retired.
