# Security Review

Date: 2025-09-26

Scope: Express gateway (`server/`), Vite/React client (`src/`), RAG service (`rag-service/`), Nginx config (`nginx.conf`), deployment/runtime configs.

## Summary

Overall posture is solid: Helmet, CORS allowlists, admin gating, SSRF guardrails, and Nginx hardening are present. Key gaps remain around trusted proxy handling, CSP tightening in production, Basic Auth protections, cluster-consistent rate limiting, and a pickle-based cache in the Python service.

## High Priority

### 1) Express trust proxy and headers
- Risk: `req.ip` behind Nginx is the proxy IP without `trust proxy`, making rate limits/logs inaccurate and weakening abuse controls.
- Fix: Add early in `server/main.js`:
  - `app.set('trust proxy', 1)`
  - `app.disable('x-powered-by')`
- References: `server/main.js:24`, `server/main.js:575`

### 2) Production CSP hardening
- Risk: Helmet CSP includes `'unsafe-inline'` and `'unsafe-eval'` unconditionally; Nginx CSP also allows both. Raises XSS risk.
- Fix:
  - In production, remove `'unsafe-eval'` and avoid `'unsafe-inline'` by using nonces or hashes for any inline script/style.
  - Keep broad allowances only in development.
- References: `server/main.js:71–140`, `nginx.conf:37–47`

### 3) Admin endpoints: CSRF and brute force
- Risk: Admin routes use HTTP Basic Auth. With browser credential caching, CSRF on state-changing POSTs is plausible; brute force attempts aren’t explicitly throttled at the auth guard.
- Fix:
  - Add per‑IP auth‑failure counter with short lockout inside `requireAdminAuth`.
  - Require `Content-Type: application/json` and a custom header (e.g., `X-Admin-Request: 1`) on admin POSTs; reject `application/x-www-form-urlencoded` and `multipart/form-data` for admin APIs.
  - Optionally migrate admin API to Bearer tokens to avoid browser caching.
- References: `server/main.js:285–312`, `server/main.js:343–364`, `server/main.js:984–1210`

### 4) Centralized, cluster‑aware rate limiting
- Risk: Custom in‑memory limiter is per‑process and not shared across PM2 workers; limits can be bypassed by distributing requests across workers.
- Fix:
  - Back the limiter with Redis (you already have a cache connection) or rely solely on Nginx limits and disable the app‑level limiter to avoid inconsistencies.
- References: `server/main.js:575–640`, `ecosystem.config.cjs:7–13`

## Medium Priority

### 5) Dev proxy logs sensitive headers
- Risk: Vite dev proxy logs full `req.headers`, potentially including `authorization`/`cookie`.
- Fix: Redact or remove sensitive headers in `vite.config.js` proxy logging.
- Reference: `vite.config.js:18–48`

### 6) Nginx CSP alignment
- Risk: `nginx.conf` CSP allows `'unsafe-inline'` and `'unsafe-eval'` with broad CDNs; diverges from Helmet policy.
- Fix: Align Nginx CSP with tightened Helmet CSP; remove `'unsafe-eval'`, minimize `'unsafe-inline'`, prefer nonces/hashes and SRI for external scripts/styles.
- Reference: `nginx.conf:37–47`

### 7) Public config exposure
- Risk: `/api/config` returns environment and capability metadata that may be operationally sensitive.
- Fix: In production, trim fields (e.g., remove `rag.serviceUrl`, model availability) or gate expanded info behind admin auth (`?admin=true` + Basic).
- Reference: `server/main.js:1898–1954`

### 8) .env file permissions
- Risk: Root `.env` exists and may be world‑readable.
- Fix: `chmod 600 .env`; ensure `/etc/cbthis/env` is owned by the runtime user and `600` in production.

### 9) Redis connection security
- Observation: Node cache uses `redis://default:${REDIS_PASSWORD}@localhost:6379`.
- Fix: Ensure Redis binds to localhost only, requires strong password, and that env values are never logged.
- Reference: `server/main.js:460`

## Low Priority / Hygiene

### 10) Legacy header
- Note: `X-XSS-Protection` is deprecated; CSP is modern control.
- Fix: Remove `xssFilter` option or accept that Helmet sets equivalent legacy header; no security gain.
- Reference: `server/main.js:124`

### 11) SPA external links
- Status: `target="_blank"` links mostly include `rel="noopener noreferrer"`. Keep consistent.
- Reference: `src/pages/LandingPageV2.jsx:103–105`

### 12) Front-end HTML injection
- Status: `dangerouslySetInnerHTML` is used for static CSS text only. Keep it confined to static strings; never user input.
- Reference: `src/pages/ChatPage/components/CategorizedSuggestions.tsx:110`

### 13) Error logging hygiene
- Status: Global error handler logs truncated bodies and selected headers.
- Fix: Ensure `authorization`, `cookie` are not logged; keep truncation.
- Reference: `server/main.js:2203–2231`

### 14) Dependency audits
- Action: Run `npm audit --production`, `npm outdated`. For Python, run `pip-audit` in `rag-service` venv. Patch criticals and pin where necessary.

## RAG Service (Python)

### 15) Admin bearer token
- Status: Admin endpoints require `Authorization: Bearer <ADMIN_API_TOKEN>`.
- Keep: Ensure token matches gateway’s `ADMIN_API_TOKEN` and is stored outside repo with strict perms.
- References: `rag-service/app/api/security.py`, `rag-service/app/api/ingestion.py:16–21`

### 16) CORS
- Status: Defaults to localhost. In production, calls flow via Node gateway with server‑to‑server auth.
- Keep: Continue proxying via gateway; only expose CORS to gateway origin if direct browser calls are ever needed.
- Reference: `rag-service/app/core/config.py:21–33`

### 17) SSRF protections
- Status: Gateway validates ingestion URLs (protocol, DNS, private ranges blocked). Good.
- Guidance: Keep ingestion via gateway; do not add direct URL ingestion in RAG service without equivalent validation.
- References: `server/main.js:176–260`, `server/main.js:984–1210`

### 18) Pickle in embedding cache
- Risk: `pickle.loads` from Redis makes code execution possible if cache is poisoned/compromised.
- Fix: Replace pickle with safe formats: JSON arrays or validated binary plus integrity (e.g., HMAC). Avoid `pickle.loads` entirely.
- Reference: `rag-service/app/services/embedding_cache.py:36–76`

### 19) Query logging and encryption
- Status: `encrypt_query_logs: True`. Ensure key management via env (`RAG_ENCRYPTION_KEY`) or an external key file with strict permissions. Never commit keys.
- Reference: `rag-service/app/core/config.py:150–168`

## Nginx / Ops

### 20) Security headers
- Status: HSTS, X‑Frame‑Options, nosniff, referrer policy present.
- Improve: Tighten CSP as above; consider removing X‑XSS‑Protection.
- Reference: `nginx.conf`

### 21) Default server / host header
- Status: Catch‑all default server returns 444 to prevent host header abuse. Good.

### 22) Sensitive file denies
- Status: Dotfiles and `.env` access denied. Good.

### 23) Rate limiting
- Status: Zones defined for general/API. Confirm limits align with app‑level limits or prefer Nginx as the single enforcement point.

## Secrets & Hygiene

- No hard‑coded secrets discovered; templates/docs contain placeholders.
- Ensure runtime secrets live in `/etc/cbthis/env` (600) and are not logged.
- Keep `.env` out of VCS (already ignored); restrict permissions locally.

## Concrete Changes To Implement Now

1) `server/main.js` (early init):
   - `app.set('trust proxy', 1)`
   - `app.disable('x-powered-by')`
2) Helmet CSP (production): remove `'unsafe-eval'`; replace `'unsafe-inline'` with nonces/hashes; keep broader rules in development only.
3) `requireAdminAuth`: add IP‑based failure counter/lockout; for admin POSTs enforce `Content-Type: application/json` and `X-Admin-Request: 1`.
4) Rate limiting: back with Redis or rely solely on Nginx (disable app limiter to avoid per‑worker drift).
5) `vite.config.js`: redact `authorization`, `cookie`, `x-api-key` in proxy logs.
6) `nginx.conf`: align CSP with tightened Helmet policy (no `'unsafe-eval'`, minimal `'unsafe-inline'`, prefer nonces/hashes/SRI).
7) RAG embedding cache: replace pickle with safe JSON/binary + integrity; remove `pickle.loads`.
8) Permissions: set `chmod 600 .env` and `/etc/cbthis/env`; verify Redis bound to localhost with auth.

## Validation Steps

- Headers & proxy:
  - Confirm `X-Powered-By` absent and `req.ip` shows client IP after `trust proxy`.
  - Validate CSP in production (no `'unsafe-eval'`, minimal `'unsafe-inline'`).
- Rate limiting:
  - Verify consistent limits across workers (Redis‑backed) or exclusive Nginx enforcement.
- Admin protections:
  - Attempt CSRF via cross‑site form POST; confirm rejection due to content type/custom header.
  - Exercise lockout after repeated invalid Basic credentials.
- Secrets & perms:
  - Check file perms on `.env` and `/etc/cbthis/env`.
- Audits:
  - Node: `npm audit --production` and address criticals.
  - Python: `pip-audit` in `rag-service` venv and patch as needed.

## Notes

- The existing SSRF guard (`validateIngestionUrl`) is robust—keep ingestion via the Node gateway.
- Admin gating exists across routes; hardening around CSRF and brute force raises the bar materially.
- Consider consolidating all rate limiting at Nginx for simplicity unless you add Redis‑backed app limits.
