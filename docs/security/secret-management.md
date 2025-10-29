# Secret Management

This document supersedes `KEYS.md`. It covers how to create, rotate, and audit
credentials for the CF Travel Bot stack.

## Storage Locations

| Component | Path | Notes |
| --- | --- | --- |
| Express / gateway | `/etc/cbthis/env` | Node/Express secrets (LLM keys, Redis password, feature flags) |
| RAG service | `/etc/cbthis/rag-env` | FastAPI secrets (LLM keys, `ADMIN_API_TOKEN`, `RAG_ENCRYPTION_KEY`) |
| Optional keyfile | `/etc/cbthis/rag-encryption.key` | Store Fernet key on disk if not using env var |

Set permissions to `600` and ensure files are owned by `root` (or the dedicated
deploy user if required). Never keep secrets in the repo or developer machines
without encryption.

## Required Secrets

1. `OPENAI_API_KEY`
2. `ANTHROPIC_API_KEY`
3. `GEMINI_API_KEY`
4. `GOOGLE_MAPS_API_KEY` / `VITE_GOOGLE_MAPS_API_KEY`
5. `REDIS_PASSWORD`
6. `ADMIN_API_TOKEN` (RAG admin endpoints)
7. `RAG_ENCRYPTION_KEY` (query log encryption)

## Managing Secrets

### Bootstrap / Update

```bash
./scripts/setup-secrets.sh          # interactive provisioning
sudo nano /etc/cbthis/env           # manual edit
sudo nano /etc/cbthis/rag-env
sudo chmod 600 /etc/cbthis/env /etc/cbthis/rag-env
```

After updates, restart services:

```bash
pm2 restart cf-travel-bot --update-env
sudo systemctl restart rag-service.service
```

### Validation & Auditing

- `./scripts/check-secrets.sh` – ensure no secrets were committed
- `pm2 logs cf-travel-bot | grep -i env` – verify env loaded (no secrets printed)
- `sudo ls -la /etc/cbthis` – confirm permissions

### Rotation Workflow

1. Generate new key in provider console.
2. Update `/etc/cbthis/env` or `/etc/cbthis/rag-env`.
3. Restart relevant services (`pm2`, systemd).
4. Run smoke tests.
5. Revoke old key.
6. Record rotation in deployment notes.

### Backup & Recovery

```bash
sudo mkdir -p /secure/backup/location
sudo cp /etc/cbthis/env /secure/backup/location/env.$(date +%Y%m%d)
sudo cp /etc/cbthis/rag-env /secure/backup/location/rag-env.$(date +%Y%m%d)
```

Store backups securely (encrypted, access-controlled). Never keep backups on the
same VPS without protection.

To recover:

```bash
sudo cp /secure/backup/location/env.<date> /etc/cbthis/env
sudo cp /secure/backup/location/rag-env.<date> /etc/cbthis/rag-env
sudo chmod 600 /etc/cbthis/env /etc/cbthis/rag-env
pm2 restart cf-travel-bot --update-env
sudo systemctl restart rag-service.service
```

### Troubleshooting

- **Services not loading keys**
  ```bash
  ls -la /etc/cbthis
  pm2 logs cf-travel-bot --lines 100
  sudo journalctl -u rag-service.service -n 100
  ```
- **Permission denied**
  ```bash
  sudo chown root:root /etc/cbthis/*
  sudo chmod 600 /etc/cbthis/*
  ```
- **API errors after rotation** – double-check for trailing spaces, quotes, and
  confirm restarts.

## Monitoring Usage

- OpenAI: https://platform.openai.com/usage
- Anthropic: https://console.anthropic.com/usage
- Google: https://console.cloud.google.com/apis/dashboard

Alert on anomalies (cost spikes, exhausted quotas).

## Development vs Production

- Development: `.env.development` with sandbox keys (never commit).
- Production: `/etc/cbthis` files only, with strict perms and rotation policy.

## Policies

- Avoid sharing secrets in plaintext channels.
- Run `./scripts/check-secrets.sh` before each commit.
- Keep an incident log if any secret is exposed; rotate immediately and document
  remediation steps.
