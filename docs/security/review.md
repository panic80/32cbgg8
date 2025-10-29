# Security Review (2025-09-26)

_Scope: Express gateway (`server/`), Vite/React client (`src/`), RAG service
(`rag-service/`), Nginx configuration, deployment/runtime configs._

Overall posture is solid (Helmet, CORS allowlists, admin gating, SSRF
guardrails, hardened Nginx). The findings below track outstanding work. Close or
update them as changes land.

## High Priority

1. **Express trust proxy & headers**  
   `app.set('trust proxy', 1)` and `app.disable('x-powered-by')` are missing;
   without them rate limiting and logging record the proxy IP.

2. **Production CSP**  
   Helmet/Nginx still allow `'unsafe-inline'` and `'unsafe-eval'`. Replace with
   nonces/hashes; keep broader allowances only in development.

3. **Admin endpoints**  
   Basic-auth admin routes need CSRF and brute-force protection. Add per-IP lockout,
   enforce `Content-Type: application/json` + custom header (`X-Admin-Request`),
   consider token auth.

4. **Cluster-aware rate limiting**  
   App-level limiter is per PM2 worker. Back it with Redis or rely solely on
   Nginx to prevent bypass.

## Medium Priority

5. **Dev proxy logging**  
   Redact sensitive headers (`authorization`, `cookie`, `x-api-key`) in
   `vite.config.js` proxy logs.

6. **Nginx CSP alignment**  
   Mirror tightened Helmet CSP; remove `'unsafe-eval'` and minimize
   `'unsafe-inline'`.

7. **Public config exposure**  
   `/api/config` should hide sensitive fields in production unless admin auth is
   present.

8. **.env permissions**  
   Ensure `.env` and `/etc/cbthis/env` are `chmod 600` and owned by the runtime
   user.

9. **Redis connection security**  
   Confirm Redis bound to localhost, authenticated, and secrets never logged.

## Low Priority / Hygiene

10. Remove legacy `X-XSS-Protection` once CSP hardened.  
11. Keep external links using `rel="noopener noreferrer"`.  
12. Limit `dangerouslySetInnerHTML` to static content.  
13. Redact sensitive data from error logs.  
14. Run `npm audit --production` and `pip-audit` regularly.

## RAG Service Focus

15. Admin bearer token enforcement (`Authorization: Bearer ...`) – keep token in
    `/etc/cbthis/rag-env`.  
16. CORS limited to gateway; continue proxying requests.  
17. Maintain SSRF guards in Node ingestion routes.  
18. Replace `pickle.loads` in embedding cache with safe JSON/binary format.  
19. Store `RAG_ENCRYPTION_KEY` securely (env or `/etc/cbthis/rag-encryption.key`).

## Nginx / Operational Items

20. Align security headers with Helmet (HSTS, CSP, nosniff, etc.).  
21. Default server returns 444; keep for host-header abuse protection.  
22. Deny dotfiles (`.env` etc.).  
23. Tune Nginx rate limiting to match app strategy.

## Validation Checklist

- Verify `req.ip` reflects client IP post `trust proxy`.  
- Confirm CSP in production rejects inline/eval content.  
- Test admin POSTs without custom header/content type (expect rejection).  
- Simulate brute-force attempts to ensure lockout works.  
- Run audits (`npm audit`, `pip-audit`) and remediate criticals.  
- Check file permissions on secrets directories.  
- Ensure Redis only accessible locally.

Update this review file as you eliminate findings or discover new ones. Link to
relevant PRs/issues for traceability.
