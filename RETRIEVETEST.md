# RAG Retrieval Baseline (No-Code) — Test Log and Commands

## Purpose

- Establish a baseline for RAG retrieval latency without modifying code.
- Measure fast, read-only paths and isolate retrieval where possible.

## Endpoints

- Public base: `https://32cbgg8.com/api/rag/api/v1`
- Health: `GET /health`
- Source stats (Chroma scan): `GET /sources/stats`
- Retrieval-only (no LLM): `POST /sources/search`
- End-to-end chat (includes LLM): `POST /chat`

## Commands

Health

- `curl -sS -D - -o /dev/null -w "code=%{http_code} ttfb=%{time_starttransfer}s total=%{time_total}s\n" https://32cbgg8.com/api/rag/api/v1/health`
- `curl -sS -D - -o /dev/null https://32cbgg8.com/api/rag/api/v1/health | tr -d '\r' | grep -i X-Process-Time`

Chroma stats (collection scan)

- `curl -sS -D - -o /dev/null -w "code=%{http_code} ttfb=%{time_starttransfer}s total=%{time_total}s\n" https://32cbgg8.com/api/rag/api/v1/sources/stats`

Retrieval-only (no answer generation)

- One-shot with correlation:
  - `TRACE_ID="t-$(date +%s%3N)"; curl -sS -D - -o /dev/null -H "Content-Type: application/json" -H "X-Trace-Id: $TRACE_ID" -w "trace=$TRACE_ID code=%{http_code} ttfb=%{time_starttransfer}s total=%{time_total}s\n" https://32cbgg8.com/api/rag/api/v1/sources/search --data '{"query":"incidental allowance quebec","limit":5,"include_scores":true}'`
- 20-run sample for p50/p95:
  - `for i in {1..20}; do curl -s -o /dev/null -H "Content-Type: application/json" -w "%{time_total}\n" https://32cbgg8.com/api/rag/api/v1/sources/search --data '{"query":"incidental allowance quebec","limit":5}'; done | awk '{print $1*1000}' | sort -n | awk 'BEGIN{sum=0}{a[NR]=$1;sum+=$1}END{n=NR;printf("count=%d mean=%.1f p50=%.1f p95=%.1f p99=%.1f\n",n,sum/n,a[int(n*0.50)],a[int(n*0.95)],a[int(n*0.99)])}'`

End-to-end chat (includes LLM time/cost)

- `TRACE_ID="t-$(date +%s%3N)"; curl -sS -D - -o /dev/null -H "Content-Type: application/json" -H "X-Trace-Id: $TRACE_ID" -w "trace=$TRACE_ID code=%{http_code} ttfb=%{time_starttransfer}s total=%{time_total}s\n" https://32cbgg8.com/api/rag/api/v1/chat --data '{"message":"What are the current incidental allowance rates for Quebec?","provider":"openai","use_rag":true,"include_sources":true,"use_hybrid_search":false}'`

## Results Observed (2025-08-29 UTC)

Health

- `code=200 ttfb≈0.062s total≈0.062s`
- `X-Process-Time` header present (FastAPI middleware), sub-50ms on warm checks.

Source stats (Chroma)

- First call showed cold path in header previously; warm call measured:
  - `code=200 ttfb≈0.441s total≈0.441s; X-Process-Time≈0.407s`

Retrieval-only `/sources/search`

- Current response: `500` with body `{"detail":"name 'settings' is not defined"}`
- Consequence: a 10-run sample produced fast times (p50≈31ms) because failures return quickly; these are NOT valid retrieval timings.

End-to-end chat `/chat`

- `code=200 ttfb≈18.129s total≈18.129s; X-Process-Time≈18.095s`
- This includes: retrieval pipeline + prompt build + LLM completion.

## Blocking Issue (Retrieval-only)

- Root cause: `DocumentStore.search` references `settings` without importing it.
- File: `rag-service/app/services/document_store.py`
- Minimal fix (no behavior change): add at top
  - `from app.core.config import settings`
- Requires redeploy of `rag-service` to enable `/sources/search` for accurate retrieval benchmarks.

## After Fix — Benchmark Plan

- Re-run retrieval-only 20-run sample to establish p50/p95/p99:
  - `for i in {1..20}; do curl -s -o /dev/null -H "Content-Type: application/json" -w "%{time_total}\n" https://32cbgg8.com/api/rag/api/v1/sources/search --data '{"query":"incidental allowance quebec","limit":5}'; done | awk '{print $1*1000}' | sort -n | awk 'BEGIN{sum=0}{a[NR]=$1;sum+=$1}END{n=NR;printf("count=%d mean=%.1f p50=%.1f p95=%.1f p99=%.1f\n",n,sum/n,a[int(n*0.50)],a[int(n*0.95)],a[int(n*0.99)])}'`
- Optional: run multiple representative queries and aggregate.
- Compare retrieval p95 to end-to-end p95 to estimate LLM contribution.

## Notes

- `X-Process-Time` is the app’s wall-clock processing time. Compare with client `total` for proxy/network overhead.
- Chroma warmup: the first stats request was slower previously; steady-state improved significantly on subsequent calls.

## Optional Proxy Correlation (no app code changes)

- Add correlation header and timing log in NGINX (already fronting `/api/rag/`).
- Example directives:
  - In `http` block:
    - `map $http_x_trace_id $trace_id { default $http_x_trace_id; "" $request_id; }`
    - `log_format rag '$time_iso8601 $trace_id $remote_addr $status $request_time $upstream_response_time $upstream_http_x_process_time $request_length $bytes_sent "$request"';`
  - In `location /api/rag/`:
    - `access_log /var/log/nginx/32cbgg8.com.rag.log rag;`
    - `proxy_set_header X-Trace-Id $trace_id;`
    - `add_header X-Trace-Id $trace_id always;`

## Next Steps

- Apply the one-line import fix and redeploy `rag-service`.
- Re-run retrieval-only benchmarks; record p50/p95/p99 here.
- If needed, enable OTel auto-instrumentation for richer stage timings.
