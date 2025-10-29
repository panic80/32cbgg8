# TODO

## PM2 Log Rotation: Install pm2-logrotate Properly

Goal: Use pm2-logrotate for gateway logs instead of OS logrotate, then remove duplicate rotation for PM2 logs. OS logrotate is currently active as a safe fallback.

- Decide package manager for PM2 modules (avoid bun auto‑selection):
  - Prefer npm: export `PM2_PACKAGE_MANAGER=npm` in the PM2 environment, or ensure PM2 uses npm.

- Root PM2 (production app):
  - `pm2 install pm2-logrotate`
  - Configure:
    - `pm2 set pm2-logrotate:max_size 10M`
    - `pm2 set pm2-logrotate:retain 14`
    - `pm2 set pm2-logrotate:compress true`
    - `pm2 set pm2-logrotate:rotateInterval '0 0 * * *'`
    - `pm2 set pm2-logrotate:workerInterval 30`
    - `pm2 set pm2-logrotate:rotateModule true`
  - Verify with `pm2 module:list` and check `/root/.pm2/modules/pm2-logrotate` present.

- Nodeapp PM2 (staging app):
  - Ensure module directory is writable: `/home/nodeapp/.pm2/modules` (nodeapp:nodeapp, 775+).
  - `sudo -u nodeapp PM2_PACKAGE_MANAGER=npm pm2 install pm2-logrotate`
  - Apply same settings as above (run commands as `nodeapp`).
  - Verify with `sudo -u nodeapp pm2 module:list`.

- De‑duplication with OS logrotate:
  - Once pm2-logrotate is confirmed active in the target PM2 context(s), edit `/etc/logrotate.d/cbthis` to remove the `pm2-*.log` globs to avoid double rotation. Keep RAG logs in OS logrotate.
  - Test a rotation cycle (either wait for the schedule or `pm2 flush`/force a rotate) and confirm active PM2 logs shrink and rotated copies are created by the pm2-logrotate module.

- Troubleshooting Notes:
  - If install fails with “AccessDenied create package.json” under nodeapp, create `/home/nodeapp/.pm2/modules/package.json` (owned by nodeapp) and re‑run install.
  - If PM2 uses bun by default, set `PM2_PACKAGE_MANAGER=npm` before `pm2 install`.
  - If the system PM2 unit (`pm2-nodeapp.service`) restarts, ensure it still points at `/home/nodeapp/.pm2` and that dump files are intact (`pm2 save`).
