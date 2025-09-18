# Deduplication & Refactor Roadmap

Purpose: Track a safe, incremental deduplication and refactor across the repo without changing behavior.

Scope: Frontend (React + Vite), Express server, and Python FastAPI RAG service.

Last updated: 2025-08-31

---

## Guardrails (No Behavior Changes)

- Endpoints: identical paths, methods, headers, status codes, and JSON shapes.
- UI: no DOM or copy changes; same user-visible behavior.
- Feature flags: preserve fallbacks and defaults.
- Performance: same or better response times and bundle sizes.
- Logging: keep existing log lines/locations unless explicitly improved.
- Infra: no changes to PM2/Nginx beyond internal imports/paths.

---

## Hotspots Observed

- Duplicate hooks in frontend:
  - `src/hooks` and `src/components/hooks` both define:
    - `use-copy-to-clipboard`
    - `use-autosize-textarea`
    - `use-audio-recording`
- Multiple ChatPage backups not imported:
  - `src/pages/ChatPage.tsx.*` (several variants: backup, bak2, bubble_backup, etc.)
- Server duplication between `server/main.js` and `server/proxy.js`:
  - Repeated helpers: `decodeUrlParams`, `processContent`, custom rate limiter, health/config endpoints, SSE proxying.
- Env and security setup spread across server entry; can be centralized.
- Numerous `._*` files (OS artifacts) and committed `dist/` (verify necessity before moving/deleting).
- RAG service is modular but may benefit from unified helpers (HTTP client, HTML/text cleaning) and stricter response models.

---

## Plan & Phases

### Phase 0 — Baseline & Invariants

- [ ] Inventory endpoints and snapshot response shapes:
  - [ ] `GET /health` (with/without `?admin=true`)
  - [ ] `GET /api/config`
  - [ ] `GET /api/travel-instructions`
  - [ ] `POST /api/gemini/generateContent`
  - [ ] `POST /api/v2/chat/rag`
  - [ ] `POST /api/v2/ingest`
  - [ ] `GET /api/v2/ingest/progress` (SSE proxy)
  - [ ] `GET /api/v2/sources`
  - [ ] `GET /api/v2/sources/stats`
  - [ ] `GET /api/v2/sources/count`
  - [ ] `POST /api/v2/database/purge`
  - [ ] `GET /api/v2/glossary/`
- [ ] Run tests (JS: `vitest`, Python: targeted RAG tests) for baseline.
- [ ] Record bundle sizes and build artifacts (`vite build`).

### Phase 1 — Frontend Dedup & Hygiene

- [x] Consolidate hooks to `src/hooks` and update imports:
  - [x] Unify `use-copy-to-clipboard`
  - [x] Unify `use-autosize-textarea`
  - [x] Unify `use-audio-recording`
  - [x] Replace imports in `src/components`, `src/pages`, `src/lib`
- [x] Handle ChatPage backups:
  - [x] Verify no imports of `src/pages/ChatPage.tsx.*`
  - [x] Move to `src/pages/ChatPage/archive/` or remove (removed)
- [x] Clean stray artifacts:
  - [x] Remove `._*` files in app/server/docs/scripts (rag-service pending for Phase 3)
  - [x] Decide on `dist/` retention (keep; required by server static serving)

### Phase 2 — Server Modularization (Express)

- [ ] Extract shared utilities to `server/utils`:
  - [ ] `http.js`: `decodeUrlParams`, axios instance with timeouts and sane defaults
  - [ ] `html.js`: `processContent` (cheerio-based)
  - [ ] `sse.js`: SSE headers + piping utilities
- [ ] Centralize security/CORS/helmet in `server/config/security.js` and consume in entry.
- [ ] Split routes into modules under `server/routes`:
  - [ ] Chat (legacy redirect), RAG proxy, ingestion, glossary, sources, health/config
  - [ ] Keep `maps` router as-is
- [ ] Reconcile `server/proxy.js`:
  - [ ] Make it import shared utils, or
  - [ ] If unused, mark as deprecated and remove only after verification
- [ ] Preserve logging behavior (`middleware/logging.js`, `services/logger.js`).

### Phase 3 — RAG Service (FastAPI) Unification

- [ ] Confirm single source of config (`app/core/config`) everywhere.
- [ ] Add/ensure shared async HTTP client with retry/timeouts.
- [ ] Extract HTML/text cleaning into `app/utils/text/html.py` used by ingestion.
- [ ] Apply/confirm Pydantic models for request/response shapes to lock behavior.

### Phase 4 — Validation & Safety Nets

- [ ] Re-run JS and Python test suites.
- [ ] Snapshot/diff endpoint responses vs. Phase 0.
- [ ] Verify static asset serving (favicon.ico, .svg, landing) in dev/prod.
- [ ] Confirm logs written to the same locations with similar content.

### Phase 5 — Documentation & Rollout

- [ ] Update `REFACTOR.md` to reference new modules and utilities.
- [ ] Add contributor migration notes (where to place new hooks/utils, route conventions).
- [ ] Optional: add minimal lint/format configs (ESLint/Prettier; Ruff/Black) without changing code style.
- [ ] Optional: CI workflow for build + tests + endpoint smoke checks.

---

## Acceptance Criteria

- All builds and tests pass unchanged.
- API responses: identical shapes/status codes/headers for all endpoints.
- No UI/UX/regression changes in main flows (landing, chat, ingestion).
- Logging unchanged in content and destination.
- No new deployment steps required (PM2/Nginx unaffected).

---

## Risks & Mitigations

- Drift between `main.js` and `proxy.js`: extract shared helpers first; refactor routes to depend on them.
- Static asset resolution: explicitly test favicon/SVG routes in dev and prod.
- RAG service availability: preserve current fallback behavior to regular chat.

---

## Work Log

- [x] 2025-08-31 — Draft comprehensive dedup/refactor plan and checklist.
- [ ] 2025-09-01 — Begin Phase 0 baseline snapshots and tests.

---

## Notes

- This plan is intentionally incremental; we can pause after any completed phase and ship.
- If any endpoint behavior must change for correctness, document and get approval before proceeding.
