# Security Headers Configuration

## Overview

This document describes the security headers implemented in the Canadian Forces Travel Instructions Chatbot to protect against common web vulnerabilities.

## Implemented Security Headers

### 1. Content Security Policy (CSP)

Controls which resources can be loaded and executed:

- **default-src**: 'self' only
- **style-src**: 'self', 'unsafe-inline' (required for React), fonts.googleapis.com
- **script-src**: 'self', 'unsafe-inline' (required for index.html), 'unsafe-eval' (React dev tools), fonts.googleapis.com
- **font-src**: 'self', fonts.gstatic.com
- **img-src**: 'self', data:, https:
- **connect-src**: 'self', OpenAI API, Anthropic API, Google Gemini API, WebSocket connections
- **frame-src**: 'none' (prevents iframe embedding)
- **object-src**: 'none' (blocks plugins)
- **media-src**: 'none' (blocks audio/video)
- **child-src**: 'none' (blocks nested contexts)
- **form-action**: 'self' (restricts form submissions)

Production only:

- **upgrade-insecure-requests**: Forces HTTPS for all requests
- **block-all-mixed-content**: Blocks HTTP content on HTTPS pages

### 2. HTTP Strict Transport Security (HSTS)

Production only:

- **max-age**: 31536000 (1 year)
- **includeSubDomains**: true
- **preload**: true (eligible for browser preload lists)

### 3. X-Frame-Options

- **Setting**: DENY
- **Purpose**: Prevents clickjacking attacks by blocking all iframe embedding

### 4. X-Content-Type-Options

- **Setting**: nosniff
- **Purpose**: Prevents MIME type sniffing attacks

### 5. X-XSS-Protection

- **Setting**: 1; mode=block (legacy but still useful)
- **Purpose**: Enables browser XSS filter

### 6. Referrer-Policy

- **Setting**: strict-origin-when-cross-origin
- **Purpose**: Controls referrer information sent with requests

### 7. Permissions-Policy

Disabled browser features:

- accelerometer, camera, geolocation, gyroscope, magnetometer, microphone, payment, usb

### 8. Additional Production Headers

- **Cross-Origin-Embedder-Policy**: require-corp
- **Cross-Origin-Opener-Policy**: same-origin
- **Cross-Origin-Resource-Policy**: same-origin

### 9. CORS Configuration

Development:

- Allows localhost ports (3000, 3001, 5173)
- Allows configured FRONTEND_URL

Production:

- Only allows https://32cbgg8.com and https://www.32cbgg8.com
- Blocks all other origins with logging

## Environment-Specific Behavior

### Development Mode

- HSTS disabled (to allow HTTP localhost)
- CORS allows localhost origins
- Cross-Origin policies relaxed
- CSP allows localhost connections

### Production Mode

- All security headers enforced
- HSTS enabled with preload
- Strict CORS origin validation
- Cross-Origin policies enforced
- Mixed content blocked

## Testing Security Headers

### Check Headers

```bash
curl -I https://32cbgg8.com/api/health
```

### Verify CSP

Check browser console for CSP violations when loading the application.

### Test CORS

```bash
# Should succeed from allowed origin
curl -H "Origin: https://32cbgg8.com" https://32cbgg8.com/api/health

# Should fail from disallowed origin
curl -H "Origin: https://evil.com" https://32cbgg8.com/api/health
```

## Known Limitations

1. **'unsafe-inline' in CSP**: Required for React inline styles and index.html font loading script. Consider refactoring to use CSS files and external scripts in the future.

2. **'unsafe-eval' in CSP**: Required for some React development tools. Could be removed in production builds if not needed.

## Security Recommendations

1. **Monitor CSP Violations**: Implement CSP reporting to track violations
2. **Regular Reviews**: Review allowed domains quarterly
3. **Remove 'unsafe-inline'**: Refactor code to use external stylesheets and scripts
4. **Implement Subresource Integrity (SRI)**: For external resources like Google Fonts

## References

- [MDN Web Docs - CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [OWASP Secure Headers](https://owasp.org/www-project-secure-headers/)
- [Helmet.js Documentation](https://helmetjs.github.io/)
