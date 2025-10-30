# Security Controls

This document replaces the previous `docs/security.md` and captures the core
controls that protect the CF Travel Bot stack. Review it alongside the security
review findings (`review.md`) before shipping backlog items that touch auth,
network boundaries, or data handling.

## API Keys & Secrets

- Never commit secrets to git. Use `/etc/cbthis/env` (Express) and
  `/etc/cbthis/rag-env` (RAG) with `chmod 600`.
- Load secrets via environment variables only; do not pass them in URLs.
- Rotate keys regularly and document rotation in `secret-management.md`.
- Scripts:
  - `scripts/setup-secrets.sh` – bootstrap/update secrets
  - `scripts/check-secrets.sh` – scan for accidental leaks
  - `scripts/restart-services.sh` – reload services after changing env

## Rate Limiting

- Application layer: 60 requests/minute per client, returning 429 with
  `Retry-After`.
- Nginx layer: 20 requests/minute (burst 10) enforced via `limit_req`.
- Future hardening: migrate in-app limiter to Redis to stay consistent across
  PM2 workers (see `review.md`).

## Data Protection

- The app does not persist user PII; chat history stays client-side.
- Cached travel content is non-sensitive but validate all upstream data pre-cache.
- Ensure Redis cache never stores secrets (especially if pickle is replaced with
  JSON/HMAC as recommended).

## Error Handling

- Use sanitized error responses in production (no stack traces).
- Log structured errors with truncated payloads; redact `authorization`,
  `cookie`, and other sensitive headers.
- Align Express and FastAPI error formats to ease monitoring.

## Network Security

- HTTPS enforced via Nginx + Let’s Encrypt; HTTP requests redirect to HTTPS.
- HSTS enabled with preload for `32cbgg8.com`.
- CORS allowlist restricts production traffic to `https://32cbgg8.com` and
  `https://www.32cbgg8.com`.
- Express should call `app.set('trust proxy', 1)` once proxy handling gap is
  addressed (see `review.md`).

## Server Hardening

- SSH access via keys; disable password auth.
- Restrict sudo access to trusted operators.
- Firewall (UFW) open only for ports 22, 80, 443.
- Keep system and runtime dependencies patched (`apt upgrade`, `npm audit`,
  `pip-audit`).

## Secure Coding Practices

- Validate all user input (forms, query params, ingestion URLs).
- Prefer typed APIs and schema validation (zod/joi for Express, pydantic for
  FastAPI).
- Avoid `dangerouslySetInnerHTML` unless output is static and trusted.
- Enforce consistent escaping in front-end components.

## Monitoring & Incident Response

- Track failed auth attempts, rate limit hits, and unusual traffic in logs.
- Set alert thresholds for latency (LangGraph notes) and error rate spikes.
- In case of incident: revoke affected credentials, assess blast radius, patch,
  and document in the runbook (`docs/operations/runbook.md`).

## Developer Checklist

- [ ] Validate inputs and sanitize outputs.
- [ ] Ensure secrets only come from env files.
- [ ] Keep dependencies updated (Node + Python).
- [ ] Harden admin routes (auth + CSRF protections).
- [ ] Avoid logging sensitive data.
- [ ] Update `review.md` if a change closes a finding or introduces a new risk.
