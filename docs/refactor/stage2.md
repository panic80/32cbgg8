# Stage 2 – Express Gateway Stabilization

The goal for Stage 2 is to complete the separation of concerns inside the Express gateway so that routing, business logic, configuration, and observability are cleanly layered. This roadmap captures the backlog, sequencing, and validation gates necessary before promoting Stage 2 work to `main`.

## Objectives

1. **Controller/Service Split**  
   - Extract request handling logic from `server/routes/*.js` into controller modules under `server/controllers/`.  
   - Move shared domain logic (e.g., RAG chat orchestration, ingestion flows) into services under `server/services/`.  
   - Ensure routes become thin delegators that perform validation, compose dependencies, and forward to controllers.

2. **Validation & Configuration**  
   - Introduce schema validation middleware (zod/joi/yup) so every POST/PATCH endpoint checks payload shape up front.  
   - Consolidate environment-derived configuration in `server/config/` (timeouts, upstream URLs, feature flags) and inject into routes/controllers.

3. **Streaming & Error Handling**  
   - Expand `server/services/streaming.js` into a reusable SSE toolkit (lifecycle hooks, heartbeat, structured logging).  
   - Standardize error responses (HTTP codes + `{ error, message, traceId }`) and ensure retries/timeouts are consistent across chat endpoints.

4. **Observability & Logging**  
   - Replace `console.*` calls with structured logging via `server/services/logger.js`.  
   - Add request-scoped metadata (route name, conversationId) to streaming logs and ingestion actions.  
   - Document logging expectations in `docs/DEPLOYMENT.md`.

5. **Testing & Guardrails**  
   - Grow the Supertest suite to cover chat, ingestion, maps, analytics, and support routes (happy path + failure scenarios).  
   - Ensure Vitest runs in CI with environment mocks for third-party clients; add fixtures for SSE metadata.  
   - Add contract tests verifying proxying to the RAG service with mocked axios responses.

## Sequencing

1. **Prep (Current step)**  
   - Create Supertest scaffolding per route group.  
   - Mock external clients (OpenAI, Anthropic, Gemini, axios) in a central test utility.  
   - Document refactor plan (this file) and link from `docs/refactor/README.md`.

2. **Controllers & Services**  
   - Migrate chat routes first (highest complexity), followed by ingestion, support, and maps.  
   - Remove duplicated helper logic (e.g., SSE parsing) while migrating.  
   - Add unit tests for new controllers/services.

3. **Validation & Config Hardening**  
   - Introduce shared validators; retrofit chat + ingestion payloads.  
   - Update tests to ensure 400 responses when validation fails.  
   - Extend `server/config/index.js` to supply typed config objects to controllers.

4. **Streaming Enhancements & Logging**  
   - Extend `pipeStreamingResponse` with heartbeat/timeout support and structured logging hooks.  
   - Standardize error handling for all streaming and proxy routes.

5. **Regression Sweep & Docs**  
   - Run full validation suite (`npm run test:coverage`, `npm run build`, Supertest suite).  
   - Update deployment/testing docs with new commands or environment flags.  
   - Capture Stage 2 outcomes in `docs/refactor/reports/stage2.md`.

## Exit Criteria

- All gateway routes delegate to controller/service layers.
- Payload validation enforced on every writable endpoint.
- Streaming utilities shared across chat endpoints with consistent logging.
- Supertest coverage for chat, ingestion, maps, analytics, and admin routes, including error cases.
- Documentation updated (deployment, testing, architecture diagrams).
- Full validation suite green.

Keep this roadmap updated as tasks complete. Cross-link relevant PRs/issues to maintain traceability.  
When Stage 2 is complete, record results in `docs/refactor/reports/stage2.md` and update the master checklist in `BIGPLAN.md`.
