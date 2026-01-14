# Performance Remediation Plan

This document tracks the confirmed performance issues and a concrete plan to fix each one. Other items were removed because they were not verified against current code paths.

## Status Checklist

- [x] RAG BM25 corpus loading is bounded and no longer loads the full corpus at request time.
- [x] Streaming markdown detection/formatting is throttled or deferred.
- [x] SSE parsing is single-pass (no double JSON parsing on the backend).

## 1. RAG BM25: Unbounded Corpus Loading

**Where it happens**
- `rag-service/app/core/vectorstore.py` (`get_all_documents`)
- `rag-service/app/services/bm25.py`
- `rag-service/app/pipelines/improved_retrieval.py`

**Current behavior**
- The full Chroma corpus is loaded into a Python list to build BM25. This is O(M) memory and will not scale beyond small corpora.

**Plan**
- Short term (guardrails and safer defaults):
  - Make BM25 initialization use a prebuilt on-disk index if available, and avoid `from_documents` on request paths.
  - Add a hard cap (configurable) for max documents to load when building BM25; log a warning and skip BM25 if exceeded.
  - Ensure `get_all_documents(refresh=True)` is only used in offline rebuilds (admin/ingest), not during request-time lazy init.
- Medium term (remove full-corpus memory dependency):
  - Replace in-memory BM25 with a disk-backed index (Tantivy/Whoosh) or migrate to a vector store that supports hybrid search.
  - Introduce a small interface for keyword retrieval so switching backends does not touch pipeline logic.

**Checklist**
- [x] `rag-service/app/pipelines/improved_retrieval.py`: initialize BM25 from persisted index when available and skip request-time builds when `bm25_require_index` is enabled.
- [x] `rag-service/app/core/vectorstore.py`: add configurable max-doc cap and telemetry when `get_all_documents` is invoked.
- [x] `rag-service/app/core/config.py`: add `enable_bm25`, `bm25_require_index`, and `bm25_max_corpus_docs` flags.

**Success criteria**
- No request-time path loads the full corpus into memory.
- BM25 can be disabled or downgraded without crashing retrieval.

## 2. Frontend: Per-Token Markdown Formatting

**Where it happens**
- `src/pages/ChatPage/hooks/useStreamingChat.ts`
- `src/pages/ChatPage/utils/formatting.ts`

**Current behavior**
- For each token, the full accumulated string is regex-tested and potentially re-formatted. This leads to O(n^2) work in long streams and UI jank.

**Plan**
- Short term (throttle work on main thread):
  - Keep raw streaming text in a ref and only run markdown detection/formatting on a timer (e.g., every 100 ms) or every N tokens.
  - Run full formatting once on the `complete` event only, which is already required for final output.
  - Only set `isFormatted` when the throttled formatter runs or on completion.
- Medium term (reduce work further):
  - Replace the global regex test with a simpler incremental heuristic (track if markdown markers appeared).
  - Consider running formatting off the main thread (worker) if long responses are common.

**Checklist**
- [x] `src/pages/ChatPage/hooks/useStreamingChat.ts`: stream raw content during tokens and defer markdown formatting to completion.
- [x] Keep `streamingContent` as the raw source of truth; update the final formatted content in the `complete` handler.

**Success criteria**
- Smooth streaming with no noticeable input lag during long responses.
- Formatting still correct on final message completion.

## 3. Backend: Double JSON Parsing

**Where it happens**
- `server/services/streaming.ts`
- `server/controllers/chatController.ts`

**Current behavior**
- The same SSE chunks are parsed twice: once for metadata in `pipeStreamingResponse`, and once in the controller for `aggregatedAnswer`.

**Plan**
- Short term (avoid unnecessary parsing):
  - Only aggregate `aggregatedAnswer` when logging is enabled. Skip the `response.data.on('data')` parser otherwise.
  - Cap `aggregatedAnswer` length (configurable) to prevent unbounded memory in long streams.
- Medium term (single-pass parsing):
  - Extend `pipeStreamingResponse` to accept `onToken` alongside `onMetadata`, and invoke it during the single parse pass.
  - Remove the second parser in the controller and rely on the new callback for aggregation.

**Checklist**
- [x] `server/services/streaming.ts`: add optional `onToken` callback and call it when `event.type === 'token'`.
- [x] `server/controllers/chatController.ts`: drop the direct `response.data.on('data')` parser and use `onToken` when logging is enabled.
- [x] Add a small cap and truncate `aggregatedAnswer` if required for log safety.

**Success criteria**
- SSE chunks are parsed once per request.
- Logging behavior remains unchanged, with lower CPU overhead.
