# Refactor Initiative Overview

This directory captures working artifacts for the staged refactor described in `staged-plan.md`. Use it to coordinate execution, keep audit trails, and surface decisions quickly.

## Goals

- Deliver the staged refactor with minimal regressions by following the exit criteria defined per stage in `staged-plan.md`.
- Provide transparent status and ownership for each stage so cross-functional teams can coordinate rollouts.
- Preserve historical context (metrics, validation evidence, diagrams) in one location to simplify reviews and retrospectives.

## Stage Tracker

| Stage | Focus                         | Owner(s) | Target Window | Status         | Notes                                                                                                                                       |
| ----- | ----------------------------- | -------- | ------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Initiative setup & guardrails | _TBD_    | _TBD_         | 🚧 In progress | Create documentation, metrics baseline, CI gate definition.                                                                                 |
| 1     | React surface consolidation   | _TBD_    | _TBD_         | 🚧 In progress | Routing rework, landing consolidation, Trip Planner modularization, and ChatPage controller extraction complete; final chat polish pending. |
| 2     | Express gateway stabilization | _TBD_    | _TBD_         | 🚧 In prep     | Controller/service split, logging, streaming dedupe. See `docs/refactor/stage2.md`.                                                         |
| 3     | RAG service modularization    | _TBD_    | _TBD_         | ⏳ Planned     | Pipeline decomposition, service layer extraction.                                                                                           |
| 4     | Tooling & docs enablement     | _TBD_    | _TBD_         | ⏳ Planned     | Lint/CI upgrades, architectural documentation.                                                                                              |
| 5     | Validation & cutover          | _TBD_    | _TBD_         | ⏳ Planned     | Final validation, rollout monitor, post-launch review.                                                                                      |

Update the table as owners and timelines become clear. Use emoji or status codes that make sense for the team (✅, 🚧, ⏳, etc.). Refer to `staged-plan.md` for full task lists.

## Branch & Release Strategy

- Primary integration branch: `refactor/staged-rollout`.
  - Create the branch off `main` once Stage 0 completes.
  - Require all staged work to merge into this branch before hitting `main`.
- Release cadence: weekly cuts (e.g., `refactor/staged-rollout@YYYY-MM-DD`) with clear changelogs.
- Feature gating: prefer configuration flags or route-level toggles to avoid regressions during partial rollouts.

Capture any deviations from this strategy in `docs/refactor/notes.md` (create as needed).

## Supporting Artifacts

- `metrics.md` – Current performance and size baselines plus tracking templates.
- `validation.md` – Command list and expectations for the validation gates.
- `codemods.md` – (Optional) Track codemods/scripts used to accelerate refactors.
- `reports/` – Stage-by-stage validation logs and metric diffs.

Extend this README whenever scope changes or new stakeholders join the initiative. All updates should align with the staged checklist in `staged-plan.md` and the backlog in `opportunity-tracker.md`.
