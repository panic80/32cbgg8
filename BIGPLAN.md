# Big Refactor – Staged Checklist

This plan sequences the cross-stack refactor into guardrailed stages. Every stage concludes with explicit validation before moving on. Track completion status with the checklist items below.

## Stage 0 – Initiative Setup & Guardrails

- [ ] Create `docs/refactor/` with `README.md` summarizing stage goals, owners, and timelines; link from `REFACTOR.md`.
- [ ] Cut long-lived branch `refactor/staged-rollout` and configure weekly cut releases (feature flags where needed).
- [ ] Document baseline KPIs (bundle size, lighthouse score, API latency, ingestion throughput) in `docs/refactor/metrics.md`.
- [ ] Define validation gate commands in `docs/refactor/validation.md`: `npm run lint`, `npm run test:coverage`, `npm run build`, `npm run dev:server --check`, `pytest`.
- [ ] Update CI to run the new validation suite on the refactor branch; require green checks before merging later stages.

_Exit criteria_: Stage folder + metrics established, validation commands automated in CI, branch policy active.

## Stage 1 – React Surface Consolidation

**Routing & Page Composition**

- [ ] Replace `src/App.jsx` with typed `App.tsx` driven by `src/routes/config.ts`; migrate to a route map + lazy loader helper.
- [ ] Consolidate landing and OPI variants into `src/pages/LandingPage/` using data-driven `sections.tsx`; remove `LandingPage.jsx`, `LandingPageTest.jsx`, `LandingPageV2.jsx`, `OPIPage.jsx`, `OPIPageTest.jsx` after migration.
- [ ] Update route prefetch logic to consume the new config and add unit tests in `src/__tests__/routes.config.test.ts`.

**Admin & Config UX**

- [ ] Merge `src/pages/AdminToolsPage.jsx` and `src/pages/AdminToolsPage/*` into `AdminToolsShell.tsx` with lazy-loaded modules in `modules/`.
- [ ] Ensure shared tab primitives (`TabbedLayout`, `MetricCard`, `Hero`) live under `src/components/ui/`; add MDX docs in `src/components/ui/__docs__/`.
- [ ] Refactor `ConfigPage` tabs to consume shared primitives and typed props; extend tests in `src/pages/ConfigPage/__tests__/`.

**Trip Planner & Shared Hooks**

- [ ] Split `src/components/TripPlanner.tsx` into `TripPlannerForm`, `TripSummary`, and hooks (`useTripPlan`, `useDistanceMatrix`) under `src/pages/TripPlanner/`.
- [ ] Move Google Maps adapters to `src/api/maps/` and publish types in `src/types/tripPlanner.ts`.
- [ ] Extract travel constants to `src/constants/travel.ts` and utility helpers to `src/utils/travel.ts`; update dependents.

**Chat Surface Cleanup**

- [ ] Finish migrating orchestration from `src/pages/ChatPage.tsx` into `hooks/useChatOrchestrator.ts` and `utils/streaming.ts`.
- [ ] Retire legacy `src/components/ChatInterface*` once `ChatPage` consumes the new components; ensure tests exist in `src/pages/ChatPage/__tests__/`.
- [ ] Centralize chat constants (`historyWindow`, thresholds, truncation) under `src/constants/chat.ts`.

**State & Storage Alignment**

- [ ] Replace ad-hoc `localStorage` access with `useLocalStorage` and `StorageKeys` enum (expand `src/constants/storage.ts`).
- [ ] Run a codemod to normalize `@/` imports and prevent deep relative paths; document script in `docs/refactor/codemods.md`.
- [ ] Convert remaining `.jsx/.js` modules in `src/api/` and `src/pages/` to TypeScript, adding/updating types in `src/types/`.

**Testing & Validation**

- [ ] Add Vitest suites for `AdminToolsShell`, `TripPlannerForm`, consolidated landing sections, and chat orchestrator boundaries.
- [ ] Verify Stage 1 exit with `npm run lint`, `npm run test:coverage`, `npm run build`; capture bundle diff in `docs/refactor/reports/stage1.md`.

_Exit criteria_: New routing system live, duplicated pages removed, trip planner + chat modularized, tests green.

## Stage 2 – Express Gateway Stabilization

**Configuration & Bootstrap**

- [ ] Expand `server/config/index.js` to expose typed config (env, timeouts, origins); eliminate inline `process.env` reads in routes.
- [ ] Adjust `server/app.js` to accept injected config/logger; keep `server/main.js` limited to startup/shutdown wiring.

**Controller & Service Extraction**

- [ ] Move logic from `server/routes/chat.js`, `ingestion.js`, `maps.js`, `support.js` into `server/controllers/*.js`; keep routes as thin delegators.
- [ ] Introduce request validators using zod/joi under `server/middleware/validators/`; wire into all routes that accept JSON payloads.
- [ ] Enhance `server/services/streaming.js` with `createSseSession` helpers; refactor `/api/v2/chat*` endpoints to the shared streaming pipeline.

**Logging & Error Handling**

- [ ] Promote `server/services/logger.js` to structured logging (pino/winston) with child loggers; replace `console.*` everywhere.
- [ ] Standardize error responses with helper in `server/utils/http.js` returning `{ error, message, traceId }`.
- [ ] Audit caching (`server/services/cache.js`) and ensure single shared Redis client respecting config-driven TTLs.

**Testing & Observability**

- [ ] Add Supertest suites for chat, ingestion, analytics, maps, and SSE endpoints under `server/__tests__/`.
- [ ] Provide local health-check script (`scripts/verify-gateway.sh`) that curls key endpoints and verifies SSE flow.
- [ ] Update operational docs in `docs/DEPLOYMENT.md` to reflect new app entry and config usage.

**Validation**

- [ ] Run `npm run lint`, `npm run test:coverage`, targeted Supertest suites, and `npm run dev:server` smoke test.
- [ ] Document Stage 2 outcomes in `docs/refactor/reports/stage2.md`.

_Exit criteria_: Routes/controller split complete, streaming unified, logging standardized, tests and docs updated.

## Stage 3 – RAG Service Modularization

**Pipeline Decomposition**

- [ ] Break `rag-service/app/pipelines/ingestion.py` into `loaders/`, `normalizers/`, `chunkers/`, and `persistors/` packages with dependency-injected services.
- [ ] Create `app/pipelines/orchestrator.py` to coordinate the new modules; add unit tests in `rag-service/tests/pipelines/`.

**API & Service Layers**

- [ ] Extract business logic from `app/api/chat.py` and `app/api/admin.py` into `app/services/chat.py` and `app/services/admin.py`.
- [ ] Define pydantic schemas in `app/schemas/chat.py`, `app/schemas/admin.py`; ensure FastAPI routers remain thin.
- [ ] Implement shared error handlers and logging middleware to return consistent problem responses.

**Components & Utilities**

- [ ] Consolidate retrieval heuristics in `app/components/` into reusable utilities (`app/utils/retrieval.py`) and add focused tests.
- [ ] Introduce Typer CLI in `app/cli.py` to wrap ingestion/debug scripts; migrate existing scripts to the CLI entry.
- [ ] Centralize environment settings via `app/core/settings.py` (Pydantic BaseSettings) and ensure all modules consume it.

**Dependencies & Assets**

- [ ] Collapse `requirements-*.txt` into `requirements.txt` plus optional extras (`requirements.dev.txt`); update docs.
- [ ] Script relocating runtime artifacts (`chroma_db*`, logs) into gitignored directories; document retention policy in `rag-service/docs/storage.md`.
- [ ] Align logging configuration across CLI, uvicorn, and background jobs with rotation-friendly settings.

**Testing & Validation**

- [ ] Expand pytest coverage for pipelines, services, CLI, and retrieval heuristics; ensure contract tests with Express gateway exist.
- [ ] Run `pytest` (fast + integration) and record results in `docs/refactor/reports/stage3.md`.

_Exit criteria_: Pipelines modularized, service layers isolated, dependencies simplified, contract tests passing.

## Stage 4 – Tooling, Docs, & Rollout Enablement

- [ ] Replace placeholder lint script with ESLint + Prettier configuration; enforce via `npm run lint` and CI.
- [ ] Configure TypeScript project references and path mappings for both client and server; document setup in `docs/refactor/typescript.md`.
- [ ] Establish GitHub Actions (or equivalent) workflow running lint, build, Vitest coverage, Supertest, and pytest on every PR.
- [ ] Create architectural overviews in `docs/architecture/` (React feature map, Express flow, RAG pipeline diagram).
- [ ] Merge fragmented markdowns (`RAGFAST.md`, `FIXRAG.md`, `ANALYSIS.md`, etc.) into curated indexes (e.g., `docs/rag/index.md`).
- [ ] Publish `docs/testing.md` playbook with SSE payloads, ingestion fixtures, and cross-service contract expectations.
- [ ] Update `DEPLOYMENT_CHECKLIST.md` and `SECUR_REVIEW.md` with refactor readiness checklists and new commands.

_Exit criteria_: Tooling + docs standardized, CI exhaustive, knowledge base consolidated.

## Stage 5 – Validation, Cutover, & Regression Monitoring

- [ ] Run full validation suite (`npm run lint`, `npm run test:coverage`, `npm run build`, `npm run dev:server`, `pytest`) on a clean workspace.
- [ ] Capture before/after metrics (bundle size, latency) and store in `docs/refactor/reports/stage5.md`.
- [ ] Coordinate production rollout: follow `Production Rebuild & Restart` steps, execute smoke tests, and monitor logs.
- [ ] Schedule regression monitoring window; document findings and follow-ups in `docs/refactor/post-launch.md`.
- [ ] Close remaining tracking tasks in `REFACTOR.md` and archive the staged plan.

_Exit criteria_: Refactor deployed, metrics tracked, documentation closed out.

---

**How to use this file**: check off items as stages progress. Update the linked docs with artifacts (reports, scripts, diagrams) to keep the refactor auditable and reversible. Stages should not advance until exit criteria are met.
