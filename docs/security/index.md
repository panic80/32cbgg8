# Security Overview

This directory consolidates the project’s security documentation, previously
spread across `docs/security.md`, `docs/SECURITY_HEADERS.md`, `SECUR_REVIEW.md`,
and `KEYS.md`. Refer to these files whenever you update authentication, rate
limiting, headers, or secret storage.

| Document               | Purpose                                                         |
| ---------------------- | --------------------------------------------------------------- |
| `controls.md`          | Day-to-day security practices, rate limiting, coding standards. |
| `headers.md`           | HTTP header configuration (Helmet + Nginx).                     |
| `secret-management.md` | Managing API keys and sensitive configuration.                  |
| `review.md`            | Latest formal security review and outstanding remediations.     |

When you ship security-impacting changes, update the relevant file(s) and keep
`review.md` aligned with the current posture.
