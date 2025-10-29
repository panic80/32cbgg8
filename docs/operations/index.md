# Operations Overview

The files in this directory replace the scattered deployment and runbook
markdowns that used to live at the repository root, under `docs/`, and inside
`server/`. Use these guides to deploy, monitor, and operate the stack on the
Hostinger VPS (`46.202.177.230`) that powers `32cbgg8.com`.

| Document | When to Use It |
| --- | --- |
| `deployment.md` | End-to-end deployment workflow covering frontend, Express gateway, and RAG service. |
| `runbook.md` | Day-to-day operations, service management, health checks, and troubleshooting. |
| `checklists.md` | Pre-flight, post-deploy, and maintenance checklists plus quick references. |
| `rollback.md` | Verified rollback paths for emergency recovery. |
| `infra.md` | Current server inventory, network layout, and resource allocations. |

Common scripts live in `scripts/`. Always read the companion notes inside the
runbook before executing automation on the VPS.

## Quick Links

- Production root: `/var/www/cbthis`
- PM2 ecosystem file: `/var/www/cbthis/ecosystem.config.cjs`
- RAG systemd unit: `rag-service.service`
- Env configuration: `/etc/cbthis/env` and `/etc/cbthis/rag-env`
- Deployment automation: `scripts/deploy-langgraph.sh`, `scripts/vps-setup.sh`

If you modify any operational behaviour (ports, services, cron jobs, env files),
update the relevant section in this folder so future deployments stay in sync.
