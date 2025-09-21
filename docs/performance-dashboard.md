# Performance Dashboard

The performance dashboard provides near real-time visibility into the retrieval-augmented generation (RAG) pipeline. It exposes latency, quality, and throughput insights for both the Python RAG service and the Node gateway.

## Architecture

- **RAG service (`rag-service/`)**
  - `PerformanceMonitor` now tracks retrieval, context assembly, answer generation, and quality ratios.
  - Telemetry is recorded for both synchronous (`/api/v1/chat`) and streaming (`/api/v1/streaming_chat`) chat flows.
  - Metrics are exposed via `GET /api/v1/metrics/summary` (FastAPI router in `app/api/metrics.py`).
- **Gateway (`server/`)**
  - `performanceService` fetches and lightly normalises RAG metrics, with a configurable in-memory cache (default 5s TTL).
  - `GET /api/admin/performance` proxies the RAG metrics for the client.
- **Client (`src/`)**
  - `fetchPerformanceMetrics` normalises payloads into typed objects.
  - `usePerformanceMetrics` handles polling with abort support and exposes manual refresh.
  - `PerformanceDashboard` renders latency, quality, and throughput sections, accessible at `/admin/performance`.

## Metrics Overview

| Category  | Metric                  | Description                                      | Target (P75 / Mean) |
|-----------|-------------------------|--------------------------------------------------|---------------------|
| Latency   | Answer Time             | Full request latency                             | ≤ 2.5s P75          |
|           | Search Time             | Retrieval pipeline duration                       | ≤ 500ms P75         |
|           | Retrieval Assembly      | Context build + serialization                     | ≤ 300ms P75         |
|           | First Token             | Streaming first token latency                     | ≤ 1s P75            |
| Quality   | Context Coverage        | Share of answers with supporting context          | ≥ 90% mean          |
|           | Hallucination Rate      | Responses with missing evidence (heuristic)       | ≤ 5% mean           |
|           | Error Rate              | Failed requests vs total                          | ≤ 1% mean           |
| Throughput| Requests Per Minute     | Recent volume snapshot                            | —                   |

`PerformanceMonitor` retains the latest 1,000 samples per metric; percentiles and recent sparkline data are returned with each response.

## Configuration

| Variable                        | Default | Description |
|--------------------------------|---------|-------------|
| `RAG_METRICS_TIMEOUT_MS`       | 7000 ms | Gateway timeout for the RAG metrics call. |
| `PERFORMANCE_METRICS_CACHE_MS` | 5000 ms | Gateway cache TTL before refetching metrics. |
| `RAG_METRICS_TOKEN`            | —       | Optional bearer token forwarded to the RAG metrics endpoint. |

## Usage

- Visit **`/admin/performance`** while authenticated on the admin gateway to view the dashboard.
- The dashboard auto-refreshes every 45 seconds and supports manual refresh.
- Link available via the Admin Resource Library header (`Admin Tools`).

## Testing

- Backend metrics endpoint tests: `rag-service/tests/test_metrics_api.py`.
- Gateway service & route tests: `server/__tests__/performanceService.test.ts` and `server/__tests__/performanceRoutes.test.ts`.
- Client normalisation & UI tests: `src/api/performance.test.ts` and `src/pages/PerformanceDashboard/__tests__/PerformanceDashboard.test.tsx`.

Run the full suite:

```bash
npm run test
```

Or target the RAG service metrics tests:

```bash
pytest rag-service/tests/test_metrics_api.py
```

(Ensure the `rag-service` virtualenv is active when executing Python tests.)
