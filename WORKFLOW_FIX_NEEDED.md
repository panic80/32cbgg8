# Workflow Fix Required

## Issue
CI build is failing because Node.js version is too old for Vite 7.

**Error:**
```
You are using Node.js 18.20.8. Vite requires Node.js version 20.19+ or 22.12+.
```

## Fix Required

Edit `.github/workflows/deploy.yml` line 13:

**Change from:**
```yaml
env:
  NODE_VERSION: '18'
  PM2_HOME: '/home/${{ secrets.SERVER_USER }}/.pm2'
```

**Change to:**
```yaml
env:
  NODE_VERSION: '20'
  PM2_HOME: '/home/${{ secrets.SERVER_USER }}/.pm2'
```

## Why I Can't Push This

GitHub App security restrictions prevent me from modifying workflow files. You'll need to make this change manually.

## How to Apply

**Option 1: Edit on GitHub (Easiest)**
1. Go to your repository on GitHub
2. Navigate to `.github/workflows/deploy.yml`
3. Click "Edit this file" (pencil icon)
4. Change line 13: `NODE_VERSION: '18'` → `NODE_VERSION: '20'`
5. Commit the change

**Option 2: Edit locally**
1. Open `.github/workflows/deploy.yml` in your editor
2. Change line 13: `NODE_VERSION: '18'` → `NODE_VERSION: '20'`
3. Commit and push:
   ```bash
   git add .github/workflows/deploy.yml
   git commit -m "Update Node.js to v20 for Vite 7 compatibility"
   git push
   ```

## Status
- ✅ All bug fixes completed and pushed
- ✅ All tests passing
- ⚠️ Build failing due to Node.js version (manual fix needed)
