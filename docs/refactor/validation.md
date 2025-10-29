# Validation Gates

Every stage in `staged-plan.md` must clear the commands below before merging into `refactor/staged-rollout` or promoting to `main`. Record results in `docs/refactor/reports/<stage>.md`.

## Core Commands

| Command                                       | Purpose                                                                        | When to Run                                                               | Expected Output                                             |
| --------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `npm run lint`                                | Ensure ESLint/Prettier pass across client + server.                            | Before Stage 1 merges, thereafter each stage.                             | Exit code `0`; no warnings that gate commits.               |
| `npm run test:coverage`                       | Verify Vitest suite and coverage thresholds.                                   | Each stage touching React client.                                         | Coverage ≥ configured thresholds.                           |
| `npm run build`                               | Confirm Vite build integrity and bundle metrics.                               | After React surface changes (Stage 1) and before final rollout (Stage 5). | Build succeeds; capture bundle stats for metrics.           |
| `npm run dev:server -- --check`               | Smoke Express gateway without starting long-lived server (use script wrapper). | Stage 2 onwards.                                                          | App boots, exits cleanly (no uncaught errors).              |
| `npm run test:server` (Supertest placeholder) | Run future Express integration tests.                                          | Stage 2+ once suite exists.                                               | All tests pass.                                             |
| `pytest`                                      | Run RAG unit/integration tests.                                                | Stage 3+ and final validation.                                            | All tests pass; coverage reported separately if configured. |

## Supplemental Checks

- `npm run preview` – Optional manual smoke test of built client prior to release.
- `scripts/verify-gateway.sh` – Curl key endpoints and verify SSE behavior (added Stage 2).
- `python -m app.cli health-check` – Planned CLI for RAG service; integrate when implemented.

## Recording Results

Create a report per stage (e.g., `docs/refactor/reports/stage1.md`) with:

- Date/time of each command run.
- Executor (if multiple people run checks).
- Summary of outputs or links to CI logs.
- Issues discovered and remediation notes.

If a command fails, document the failure, linked issue/PR, and the fix before re-running. The stage cannot exit until all core commands succeed.

## CI Enforcement

- Configure the CI pipeline to run the core commands on every PR targeting `refactor/staged-rollout`.
- Require passing status checks before merging.
- For long-running suites (pytest, Supertest), consider nightly runs in addition to per-PR runs if runtime is high.

Update this file whenever commands change or new validation steps are added. Keep references in sync with `staged-plan.md` and `docs/refactor/README.md`.
