# PR Title

> Summarize the change in one sentence (e.g., "Enable true BM25+vector hybrid, add warmup endpoint, cache retrieval pipelines").

## Summary

- Problem: What issue or gap does this fix/improve?
- Approach: Briefly describe the solution and alternatives considered.
- Scope: Which components are touched (backend/frontend/infra)?

## Changes

- [ ] True hybrid retrieval enabled (BM25 + Vector) with real BM25 corpus from Chroma
- [ ] Retrieval pipeline caching (keyed by provider/model/hybrid) to speed repeat requests
- [ ] Automatic BM25 corpus refresh and pipeline cache invalidation after ingestion/purge
- [ ] Admin warmup endpoint: `POST /api/v1/api/admin/warmup/retrieval`
- [ ] Retrieval-only endpoint fix (settings import)
- [ ] Version bump and CHANGELOG update

## Verification

Functional

- [ ] RAG health: `GET /api/v1/health` returns 200
- [ ] Warmup: `POST /api/v1/api/admin/warmup/retrieval` returns `bm25_corpus_docs > 0` and caches pipeline
- [ ] Hybrid chat (`use_hybrid_search: true`) retrieves with BM25 + Vector; logs show BM25 events
- [ ] Vector-only chat path sanity (if configured) still works
- [ ] Retrieval-only: `POST /api/v1/sources/search` returns results (no 500)
- [ ] Table content ranking preserved (table queries surface correct chunks)

Performance

- [ ] First request builds pipeline; subsequent runs reuse cached pipeline (logs show "Using cached retrieval pipeline")
- [ ] BM25 adds minimal overhead vs. improved accuracy on numeric/ID queries
- [ ] No significant regression to end-to-end latency

Safety

- [ ] Admin warmup endpoint is protected by `Authorization: Bearer <ADMIN_API_TOKEN>`
- [ ] No secrets in logs; no extra verbose logging in production

Backward Compatibility

- [ ] No breaking API changes (paths, request/response models)
- [ ] Feature flags respected (hybrid toggle behavior is documented)

## Rollout Steps

- [ ] Deploy changes
- [ ] Restart rag-service and proxy
- [ ] Warmup pipelines (hybrid and vector if needed)
- [ ] Spot check top user queries

## Rollback Plan

- [ ] Revert to previous commit/tag
- [ ] Restart services
- [ ] Verify retrieval-only and chat endpoints

## Screenshots / Logs (optional)

## Related Issues / Tickets

- Closes #\_\_\_\_

## Checklist

- [ ] Tests updated/added (if applicable)
- [ ] CHANGELOG updated
- [ ] Version bumped
- [ ] Docs updated (README/operational runbook)
