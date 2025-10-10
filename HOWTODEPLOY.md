# How to Deploy to VPS

This guide explains how to commit, push, and deploy changes to the VPS at **46.202.177.230**.

## Prerequisites

- Git repository access
- SSH access to VPS: `ssh root@46.202.177.230`
- Node.js and npm installed locally
- Python 3.11+ on VPS (already set up)

---

## Quick Deployment (3 Steps)

### 1. Commit and Push Changes

```bash
# Check what's changed
git status

# Add all changes
git add .

# Commit with descriptive message
git commit -m "Your descriptive message here"

# Push to GitHub
git push origin main
```

### 2. Deploy Backend (RAG Service)

```bash
# SSH to VPS
ssh root@46.202.177.230

# Navigate to app directory
cd /var/www/cbthis

# Pull latest code
git pull origin main

# Update Python dependencies (if requirements.txt changed)
cd rag-service
source venv/bin/activate
pip install -r requirements.txt

# Restart RAG service
sudo systemctl restart rag-service.service

# Check status
sudo systemctl status rag-service.service --no-pager

# View logs (optional)
sudo journalctl -u rag-service.service -f
```

### 3. Deploy Frontend

```bash
# Still in /var/www/cbthis
cd /var/www/cbthis

# Rebuild frontend
npm run build

# Restart PM2
pm2 restart all

# Check PM2 status
pm2 list
```

---

## Automated Deployment Script

For LangGraph/backend updates, use the automated script:

```bash
# From your local machine
./scripts/deploy-langgraph.sh
```

This script automatically:
- Pulls latest code
- Installs Python dependencies
- Restarts services
- Verifies health checks

---

## Detailed Step-by-Step

### Backend-Only Deployment

When you change Python code, configuration, or RAG service:

```bash
# 1. Commit and push locally
git add rag-service/
git commit -m "Update RAG service: [describe changes]"
git push origin main

# 2. Deploy on VPS
ssh root@46.202.177.230
cd /var/www/cbthis
git pull origin main

# 3. Update dependencies (if needed)
cd rag-service
source venv/bin/activate
pip install -r requirements.txt

# 4. Restart service
sudo systemctl restart rag-service.service

# 5. Verify
curl http://localhost:8000/api/v1/health
```

### Frontend-Only Deployment

When you change React/TypeScript code in `src/`:

```bash
# 1. Commit and push locally
git add src/
git commit -m "Update frontend: [describe changes]"
git push origin main

# 2. Deploy on VPS
ssh root@46.202.177.230
cd /var/www/cbthis
git pull origin main

# 3. Rebuild frontend
npm run build

# 4. Restart PM2
pm2 restart all

# 5. Clear browser cache and test
# Visit your website in incognito mode
```

### Full-Stack Deployment

When you change both frontend and backend:

```bash
# 1. Commit and push locally
git add .
git commit -m "Update full stack: [describe changes]"
git push origin main

# 2. Deploy on VPS
ssh root@46.202.177.230
cd /var/www/cbthis
git pull origin main

# 3. Update backend
cd rag-service
source venv/bin/activate
pip install -r requirements.txt
sudo systemctl restart rag-service.service

# 4. Update frontend
cd /var/www/cbthis
npm run build
pm2 restart all

# 5. Verify both services
curl http://localhost:8000/api/v1/health  # Backend
curl http://localhost:3000 | head -10     # Frontend
```

---

## Environment Configuration Changes

When updating environment variables (e.g., API keys, feature flags):

```bash
# SSH to VPS
ssh root@46.202.177.230

# Edit environment file
sudo nano /etc/cbthis/rag-env

# Make your changes, save and exit (Ctrl+X, Y, Enter)

# Restart service to pick up new config
sudo systemctl restart rag-service.service

# Verify
systemctl status rag-service.service --no-pager
```

---

## Common Deployment Scenarios

### Updating "What's New" Section

```bash
# 1. Edit locally
# File: src/pages/ChatPage/constants/whatsNew.tsx
# - Update WHATS_NEW_VERSION
# - Add new date group at top of array

# 2. Commit and push
git add src/pages/ChatPage/constants/whatsNew.tsx
git commit -m "Update What's New for [date]"
git push origin main

# 3. Deploy frontend only
ssh root@46.202.177.230
cd /var/www/cbthis
git pull origin main
npm run build
pm2 restart all
```

### Adding New Python Dependencies

```bash
# 1. Add to requirements.txt locally
echo "new-package==1.0.0" >> rag-service/requirements.txt

# 2. Commit and push
git add rag-service/requirements.txt
git commit -m "Add new-package dependency"
git push origin main

# 3. Deploy on VPS
ssh root@46.202.177.230
cd /var/www/cbthis/rag-service
source venv/bin/activate
pip install -r requirements.txt
sudo systemctl restart rag-service.service
```

### Updating Configuration Settings

```bash
# 1. Edit config locally
# File: rag-service/app/core/config.py

# 2. Commit and push
git add rag-service/app/core/config.py
git commit -m "Update configuration: [describe]"
git push origin main

# 3. Deploy
ssh root@46.202.177.230
cd /var/www/cbthis
git pull origin main
sudo systemctl restart rag-service.service
```

---

## Verification Checklist

After deployment, verify:

- [ ] Services are running:
  ```bash
  sudo systemctl status rag-service.service
  sudo systemctl status redis-server
  pm2 list
  ```

- [ ] Health checks pass:
  ```bash
  curl http://localhost:8000/api/v1/health
  curl http://localhost:3000 | head -5
  ```

- [ ] Check logs for errors:
  ```bash
  sudo journalctl -u rag-service.service -n 50 --no-pager
  pm2 logs --lines 20
  ```

- [ ] Test on website in incognito mode

---

## Troubleshooting

### Issue: Git pull fails

```bash
# Stash local changes
git stash

# Pull again
git pull origin main

# Reapply stashed changes (if needed)
git stash pop
```

### Issue: RAG service won't start

```bash
# Check detailed logs
sudo journalctl -u rag-service.service -n 100 --no-pager

# Common fixes:
# 1. Check Python syntax errors
# 2. Verify dependencies installed
# 3. Check environment variables
# 4. Restart Redis if needed
sudo systemctl restart redis-server
```

### Issue: PM2 processes in "waiting restart"

```bash
# Delete and recreate
pm2 delete all
pm2 start /var/www/cbthis/ecosystem.config.cjs
pm2 save
```

### Issue: Frontend not updating

```bash
# Hard refresh build
cd /var/www/cbthis
rm -rf dist/
npm run build
pm2 restart all

# Clear browser cache or test in incognito mode
```

### Issue: Permission errors

```bash
# Fix ownership
sudo chown -R root:root /var/www/cbthis

# Fix permissions
sudo chmod -R 755 /var/www/cbthis
```

---

## Rollback Procedure

If something breaks after deployment:

```bash
# 1. Check git log for last working commit
git log --oneline -10

# 2. Revert to previous commit
git revert HEAD
# or
git reset --hard <commit-hash>

# 3. Push rollback
git push origin main --force

# 4. Deploy rolled-back version
ssh root@46.202.177.230
cd /var/www/cbthis
git pull origin main --force
npm run build
sudo systemctl restart rag-service.service
pm2 restart all
```

---

## Best Practices

1. **Always test locally first** before deploying to VPS
2. **Use descriptive commit messages** - explain what changed and why
3. **Deploy during low-traffic times** when possible
4. **Monitor logs** after deployment for a few minutes
5. **Keep a backup** of working configuration
6. **Document changes** in commit messages and changelogs
7. **Test in incognito** to avoid cached assets
8. **One feature per commit** for easier rollbacks

---

## Quick Reference Commands

```bash
# Status checks
sudo systemctl status rag-service.service
sudo systemctl status redis-server
pm2 list

# Restart services
sudo systemctl restart rag-service.service
pm2 restart all

# View logs
sudo journalctl -u rag-service.service -f
pm2 logs --lines 50

# Health checks
curl http://localhost:8000/api/v1/health
curl http://localhost:3000

# Git operations
git status
git add .
git commit -m "message"
git push origin main
git pull origin main
```

---

## VPS Information

- **IP Address:** 46.202.177.230
- **SSH User:** root
- **App Directory:** /var/www/cbthis
- **Backend Port:** 8000 (internal)
- **Frontend Port:** 3000 (internal)
- **Public Access:** Through Nginx (ports 80/443)

## Service Locations

- **RAG Service:** `/etc/systemd/system/rag-service.service`
- **Environment Config:** `/etc/cbthis/rag-env`
- **PM2 Config:** `/var/www/cbthis/ecosystem.config.cjs`
- **Nginx Config:** `/etc/nginx/sites-available/`

---

## Support

For issues or questions:
1. Check logs first (above commands)
2. Review recent commits: `git log`
3. Check service status
4. Review documentation in `/docs` directory

---

**Remember:** Always commit and push first, then deploy to VPS. Never make changes directly on the VPS that aren't in git!

