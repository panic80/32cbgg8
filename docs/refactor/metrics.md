# Refactor Metrics Baseline

Track the quantitative impact of the staged refactor here. Update the “Current” column at the start of each stage and log deltas in the “Notes” column. Use additional sections for deeper analysis when needed.

## Frontend (Vite/React)

| Metric                               | Target  | Current | Stage Delta | Notes                                              |
| ------------------------------------ | ------- | ------- | ----------- | -------------------------------------------------- |
| Bundle size (main JS, kB)            | ≤ _TBD_ | _TBD_   | _TBD_       | Capture via `npm run build` + `dist/assets` stats. |
| Initial Lighthouse performance score | ≥ _TBD_ | _TBD_   | _TBD_       | Use CI run or local audit on `/chat`.              |
| Vitest coverage (%)                  | ≥ _TBD_ | _TBD_   | _TBD_       | Pull from `npm run test:coverage`.                 |

## Express Gateway

| Metric                           | Target  | Current | Stage Delta | Notes                                             |
| -------------------------------- | ------- | ------- | ----------- | ------------------------------------------------- |
| P99 `/api/v2/chat` latency (ms)  | ≤ _TBD_ | _TBD_   | _TBD_       | Use production or staging logs; note environment. |
| Error rate (5xx per 1k requests) | ≤ _TBD_ | _TBD_   | _TBD_       | Track via logging/monitoring tooling.             |
| Supertest suite duration (s)     | ≤ _TBD_ | _TBD_   | _TBD_       | Measure post Stage 2 test additions.              |

## RAG Service

| Metric                          | Target  | Current | Stage Delta | Notes                                       |
| ------------------------------- | ------- | ------- | ----------- | ------------------------------------------- |
| Ingestion throughput (docs/min) | ≥ _TBD_ | _TBD_   | _TBD_       | Capture via pipeline debug logs.            |
| Retrieval latency (ms)          | ≤ _TBD_ | _TBD_   | _TBD_       | Use API timing with representative queries. |
| pytest coverage (%)             | ≥ _TBD_ | _TBD_   | _TBD_       | Record from `pytest --cov` runs.            |

## Operational

| Metric                        | Target  | Current | Stage Delta | Notes                                   |
| ----------------------------- | ------- | ------- | ----------- | --------------------------------------- |
| Deployment duration (min)     | ≤ _TBD_ | _TBD_   | _TBD_       | Record from PM2/systemctl pipeline.     |
| Incident count during rollout | 0       | _TBD_   | _TBD_       | Document any incidents with root cause. |

### How to Update

1. Capture baseline values at the start of each stage (or confirm they remain unchanged).
2. After completing stage work, record the new values and compute the delta.
3. Move detailed analysis (e.g., charts, log excerpts) into `docs/refactor/reports/<stage>.md` and link from the notes column.

Keep this file lean—link out to supporting data rather than embedding large tables or screenshots.
