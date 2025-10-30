# Rollback Procedures

The older guides (`HOWTODEPLOY.md`, `NEWDEPLOY.md`, `DEPLOYMENT_COMPLETE.md`)
documented multiple ad-hoc rollback strategies. This file consolidates the
approved paths. Use the lightest-touch option that restores service safely.

## 1. Application Rollback (Git Based)

1. Identify the last known good commit:
   ```bash
   cd /var/www/cbthis
   git log --oneline -10
   ```
2. Reset to that commit:
   ```bash
   git reset --hard <commit-hash>
   git clean -fd
   ```
3. Rebuild and restart:
   ```bash
   npm ci
   npm run build
   sudo systemctl restart rag-service.service
   pm2 restart cf-travel-bot
   pm2 save
   ```
4. Verify health checks (see `checklists.md`) and document the rollback in
   deployment notes.

> **Note:** Only use `git reset --hard` when you are certain the target commit is
> healthy. For partial rollbacks, consider `git revert` and redeploy instead.

## 2. RAG Service Only

If the React/Express stack is healthy but the RAG service regressions need to be
reverted:

```bash
cd /var/www/cbthis
git checkout <good-commit> rag-service
cd rag-service
source venv/bin/activate
pip install -r requirements.txt
deactivate
sudo systemctl restart rag-service.service
```

Optionally restore vector store backups if the schema changed (see
`docs/rag/storage.md` once published).

## 3. PM2 / Frontend Rollback

When the PM2-managed gateway bundle is the issue:

```bash
cd /var/www/cbthis
git checkout <good-commit> src package-lock.json
npm ci
npm run build
pm2 delete cf-travel-bot
pm2 start ecosystem.config.cjs --only cf-travel-bot
pm2 save
```

If `dist/` is corrupted but code is fine, rebuild only:

```bash
rm -rf dist
npm run build
pm2 restart cf-travel-bot
```

## 4. Infrastructure Rollback

- **Nginx config:** restore from backup
  ```bash
  sudo cp /etc/nginx/sites-available/cbthis.backup /etc/nginx/sites-available/cbthis
  sudo ln -sfn /etc/nginx/sites-available/cbthis /etc/nginx/sites-enabled/cbthis
  sudo nginx -t
  sudo systemctl reload nginx
  ```
- **Environment files:** copy the last known-good version from
  `/var/backups/cbthis/env_<date>.tar.gz` and restart affected services.
- **Redis data:** copy `dump.rdb` backup into `/var/lib/redis/` and restart
  `redis-server`.

## 5. Emergency Restore from Backup

If deployment leaves the environment in a broken state and git rollback fails:

```bash
# Stop services
pm2 stop all
sudo systemctl stop rag-service.service

# Restore backup directory
rsync -a /home/root/apps/cf-travel-bot/backup-<date>/ /var/www/cbthis/

# Restart services
npm run build
sudo systemctl restart rag-service.service
pm2 start ecosystem.config.cjs
pm2 save
```

Verify DNS / SSL settings (`certbot certificates`) if Nginx files were touched.

## 6. Documentation & Follow-up

- Record the incident, rollback steps, and root cause in `docs/operations/runbook.md`
  (or an incident log if created).
- File issues for permanent fixes (code change, playbook update, automation).
- Update any relevant sections in `docs/operations/deployment.md` if the rollback
  revealed gaps in the forward deploy process.
