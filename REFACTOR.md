# Refactoring Opportunity Tracker

_Last updated: 2025-08-19_

> Parallel review ran four focused "agents": UI/UX (React), Gateway (Express), Retrieval (Python), and Ops/Docs. Each block below captures that agent's findings and the actionable backlog we should execute or groom.

## High-Impact Quick Wins
- [x] Collapse duplicate chat utilities in `src/utils/chatUtils.{js,ts}` and migrate consumers to the typed version to eliminate dual maintenance and subtle divergence.
- [x] Convert `src/api/travelInstructions.js` + `travelInstructions.d.ts` and `src/api/gemini.jsx` to TypeScript modules with shared fetch helpers so the network layer has compile-time validation.
- [x] Promote environment/config loading in `server/main.js:1` to a reusable config module to decouple app bootstrap from configuration parsing.
- [x] Retire unused UI prototypes and utilities (`BackButtonShowcase`, `Logo`, `SimpleIngestionProgress`, `LandingConceptPage`, `OPIPageConcept`, `OPIPage/FluentDesignView`, `bubbleExtractor`, `useRetry`, `server/travelData`).
- [ ] Remove committed runtime artifacts (`*.log`, `public_html.backup`, `rag-service/venv/`, tarballs) or relocate them under a gitignored `backups/` directory to keep deploy diffs readable.
- [ ] Add Vitest smoke coverage for `src/pages/ChatPage.tsx`, `src/components/TripPlanner.tsx`, and `src/pages/ConfigPage.tsx` before deep refactors to guard behaviour.

## Workstream A – React Client (UI Agent)
- **Hotspots to restructure**
  - `src/pages/ConfigPage/index.tsx:1` (shrinking but still busy) mixes analytics, ingestion console, and model toggles—extract domain slices into subroutes/components (e.g. `ConfigLayout`, `AnalyticsPanel`, `IngestionQueue`, `ModelCatalog`). *(Model selection, ingestion, database, and logs tabs now live under `src/pages/ConfigPage/tabs/` with the page acting as an orchestrator.)*
  - `src/pages/OPIPage/ReimaginedOPIView.jsx:1` and `src/pages/LandingPage*.jsx` share large hero/section blocks—replace with data-driven section config and shared layout primitives. *(Legacy prototypes `OPIPageConcept` and `OPIPage/FluentDesignView` have been removed.)*
  - `src/components/TripPlanner.tsx:1` (482 LOC) interleaves fetching, autocomplete management, and presentation—split hooks (`useTripPlan`, `useDistanceMatrix`) and move Google-maps adapters under `src/api/maps/`.
  - `src/pages/AdminToolsPage/*.jsx` replicate similar tab structures; consolidate under a single `AdminToolsShell` with lazy-loaded feature modules.
  - `src/pages/ChatPage.tsx:1` still holds orchestration logic (e.g. export helpers, streaming glue); finish extraction into `src/pages/ChatPage/utils` and create integration tests for the new hook boundaries.
- **Supporting refactors**
  - [ ] Replace scattered `useState` + `localStorage` access with existing `useLocalStorage` hook and a centralized `StorageKeys` map in `src/constants`.
  - [ ] Move command palette data, follow-up questions, and suggestion builders into dedicated modules to simplify memo dependencies.
  - [ ] Introduce a typed API client in `src/api/index.ts` that wraps `fetch`/`axios` usage; update pages/components to consume it instead of importing server URLs directly.
  - [ ] Normalize component styling by creating shared layout primitives (e.g., `Section`, `MetricCard`) under `src/components/ui` to reduce repeated Tailwind groupings across landing/admin pages.
  - [ ] Audit `src/components` for dead exports (e.g., legacy `ChatInterface*`, unused CSS files) and remove or archive them alongside Storybook-like docs.
  - [ ] Tighten bundle splitting: ensure heavy admin/config pages register with `React.lazy` plus route-level code-splitting hints (prefetch only chat essentials).
  - [ ] Add `src/pages/ConfigPage` and `src/components/TripPlanner` story-driven tests in `src/__tests__/` or colocated test files before reorganizing UI logic.

## Workstream B – Express Gateway (Gateway Agent)
- **Structural debt**
  - `server/main.js:1` (2,373 LOC) acts as bootstrapper, router, controller, and service. Extract into `server/app.js` (app factory), `server/routes/*`, and `server/controllers/*` so each endpoint calls a dedicated handler.
  - SSE/chat streaming logic repeats across `/api/v2/chat`, `/api/v2/chat/stream`, `/api/v2/chat/rag`; consolidate into a streaming service module and share error handling + retry policies.
  - Ingestion endpoints (`/api/rag/ingest`, `/api/v2/ingest`, `/api/v2/ingest/canada-ca`) share validation and logging—create schema validators (e.g., zod or custom) under `server/middleware/validators`.
  - Environment bootstrap currently reads `/etc/cbthis/env` synchronously every start; move to `server/config/index.js` with memoized load order and unit tests.
- **Operational improvements**
  - [ ] Introduce a centralized logger (wrap `chatLogger`) and replace raw `console.*` calls across `server/main.js` and routes for consistent context.
  - [ ] Surface proper HTTP status codes when upstream APIs fail (currently some fall back to 200 with error text).
  - [ ] Add integration tests with Supertest (already listed in `devDependencies`) covering key routes before slicing files.
  - [ ] Evaluate caching strategy in `server/services/cache.js:1`; ensure Redis connection lifecycle does not spawn unawaited intervals during tests.
  - [ ] Tighten CORS/origin checks by moving the allowlist builder into config and unit testing private IP detection.
  - [ ] Refactor Google Maps proxy routes to reside under `server/routes/maps.js` with shared parameter validation utilities.

## Workstream C – RAG Service (Retrieval Agent)
- **Pipeline modularity**
  - `rag-service/app/pipelines/ingestion.py:1` (1,377 LOC) should be split into loader, normalizer, chunker, and persistence modules with dependency-injected services.
  - `rag-service/app/api/chat.py:1` and `rag-service/app/api/admin.py:1` mix FastAPI routing and business logic; extract service layers and pydantic models under `app/services` and `app/schemas`.
  - `rag-service/app/components/*` (e.g., `gated_retrieval_coordinator.py:1`, `adaptive_k_selector.py:1`) contain complex logic without tests—add unit tests covering retrieval heuristics before refactoring.
- **Configurability & tooling**
  - [ ] Consolidate multiple `requirements-*.txt` into a single `requirements` hierarchy or generate lock files to avoid drift between environments.
  - [ ] Remove/ignore the checked-in `rag-service/venv/` and large backups (`chroma_db*`, logs) from source control; replace with scripted exports documented under `rag-service/docs/`.
  - [ ] Introduce a shared logging configuration so ingestion scripts (`ingest_*`, `debug_*`) use the same log format and rotate outputs.
  - [ ] Build CLI entry points (e.g., `python -m app.cli ingest --source ...`) to wrap the ad-hoc scripts in the repository root.
  - [ ] Add contract tests ensuring the Express gateway and RAG API stay aligned (request/response schemas).

## Workstream D – Tooling, Quality, and Observability (Ops Agent)
- [ ] Replace the placeholder lint script in `package.json` with ESLint + Prettier, and wire it into CI before large-scale refactors.
- [ ] Configure TypeScript project references (e.g., reuse `tsconfig.node.json`) to support incremental builds during module extraction.
- [ ] Enable Vitest coverage thresholds in `vitest.config.js` and document expected minimums in `src/setupTests.js`.
- [ ] Add smoke CI pipelines (build + lint + vitest + `npm run test:coverage`) to catch regressions from structural moves.
- [ ] Document recommended test data/responses for SSE and ingestion endpoints in `docs/testing.md` (new file) to guide QA during refactors.
- [ ] Ensure PM2/ecosystem scripts consume the refactored server entry (after splitting `server/main.js`).

## Workstream E – Documentation & Knowledge Capture (Docs Agent)
- [ ] Create or update architectural overviews in `docs/` that mirror the new module boundaries (React feature map, Express flow, RAG pipeline diagram).
- [ ] Merge ad-hoc markdowns (`RAGFAST.md`, `FIXRAG.md`, `ANALYSIS.md`, etc.) into a curated `docs/rag/` index to reduce fragmentation.
- [ ] Record migration steps for moving persistent assets out of the repo and into object storage/backups.
- [ ] Refresh `DEPLOYMENT_CHECKLIST.md` to reflect any new build/test commands introduced by refactors.
- [ ] Append a "refactor readiness" checklist to `SECUR_REVIEW.md` when security-sensitive modules (auth, ingestion) change.

## Validation Guardrails
- [ ] `npm run test:coverage` (React)
- [ ] `npm run build` (React bundle integrity)
- [ ] `npm run dev:server` smoke test after Express changes
- [ ] `npm run health-check:local` and `curl` SSE endpoint sanity checks
- [ ] `pytest` or `uvicorn` test suite inside `rag-service` (document command in `rag-service/README.md`)

## Notes & References
- Previous ChatPage extraction plan (2025-08-15) lives in this file's git history; outstanding tasks are folded into **Workstream A** items above.
- Track progress using the checkboxes per workstream and update this document alongside major refactoring PRs.
