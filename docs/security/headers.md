# HTTP Security Headers

This file replaces `docs/SECURITY_HEADERS.md` and tracks the expected Helmet and
Nginx header configurations. Review it whenever you touch `server/app.js`,
`server/utils/http.js`, or the Nginx site template.

## Content Security Policy (CSP)

Production target (align Helmet + Nginx):

- `default-src 'self'`
- `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com` (remove inline
  when practical)
- `script-src 'self' https://fonts.googleapis.com`  
  _Remove `'unsafe-eval'` and `'unsafe-inline'` in production; rely on nonces or
  hashes for any necessary inline code._
- `font-src 'self' https://fonts.gstatic.com https://r2cdn.perplexity.ai`
- `img-src 'self' data: https:`
- `connect-src 'self' https://api.openai.com https://api.anthropic.com https://generativelanguage.googleapis.com https://maps.googleapis.com https://maps.gstatic.com wss:`
- `frame-src 'none'`
- `object-src 'none'`
- `media-src 'none'`
- `child-src 'none'`
- `form-action 'self'`
- `upgrade-insecure-requests` (production)
- `block-all-mixed-content` (production)

Development mode can retain the more permissive settings needed for Vite (nonce
or `'unsafe-eval'` allowed) but never ship them to production.

## Additional Helmet Settings

- `app.set('trust proxy', 1)` (planned) and `app.disable('x-powered-by')`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`: disable accelerometer, camera, geolocation, gyroscope,
  magnetometer, microphone, payment, usb
- Remove legacy `X-XSS-Protection` header once CSP lock-down is complete.

## HSTS

Enabled in production with:

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

## Cross-Origin Policies

- `Cross-Origin-Embedder-Policy: require-corp`
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Resource-Policy: same-origin`

Ensure these remain in sync between Helmet and Nginx.

## CORS Allowlist

- Development: `http://localhost:3000`, `3001`, `5173`, plus `FRONTEND_URL`
- Production: `https://32cbgg8.com`, `https://www.32cbgg8.com`, optional
  `FRONTEND_URL`
- Return 403 + log when origin missing/invalid.

## Testing

```bash
curl -I https://32cbgg8.com/api/health                    # check headers
curl -H "Origin: https://32cbgg8.com" https://32cbgg8.com/api/health
curl -H "Origin: https://evil.com" https://32cbgg8.com/api/health
```

Monitor browser console for CSP violations after deployments. Consider enabling
CSP report URIs or using security scanners to confirm configuration.
