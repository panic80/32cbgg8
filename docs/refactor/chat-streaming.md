# Chat Streaming Unification Plan (CHATREDO)

## Decision

Streaming becomes the only supported chat execution path. The synchronous `/chat` endpoint is deprecated and will return HTTP 410 Gone with an actionable message to use `/chat/stream` (and legacy alias `/streaming_chat`).

All capabilities previously implemented only in the synchronous handler are ported to the streaming path to preserve and improve behavior while eliminating duplication.

## Objectives

- Single orchestration path for RAG chat with Server‑Sent Events (SSE).
- Zero duplication of retrieval, prompts, telemetry, and logging logic.
- Preserve backward compatibility for gateway clients and UI.
- Provide a clean foundation for future features (tools, new providers, rerankers).

## Out of Scope (Non‑Goals)

- Changing the external SSE event contract in a breaking way.
- Introducing new providers beyond those already configured.
- Tool/Function calling and tool streaming (can be layered later).

## Current State (Summary)

- Two handlers: `rag-service/app/api/chat.py` (sync) and `rag-service/app/api/streaming_chat.py` (SSE).
- Duplicated logic across files: retrieval pipeline config + caching, query optimization, prompts, telemetry.
- Some features exist only in sync (advanced L3 cache usage pattern, no‑context prompt, richer logging/auditing).

## Target Architecture (Streaming‑Only)

- Keep `rag-service/app/api/streaming_chat.py` as the single orchestration module for chat execution.
- Deprecate sync: `rag-service/app/api/chat.py` retains router but responds with 410 Gone, pointing to streaming routes.
- Extract tiny utilities used by streaming to shared helpers to keep the file lean:
  - `app/utils/streaming_utils.py`: token text extraction, token usage parsing.
  - `app/utils/message_utils.py`: history conversion.
  - `app/api/prompt_constants.py`: system prompts and short‑answer prompt.
- Unify LLM acquisition: pool‑first via `llm_pool`, fallback to `get_llm`.
- Unify retrieval pipeline creation and caching.
- Stream end‑to‑end with deterministic events while adding missing sync features.

## Feature Parity (What Streaming Will Inherit)

The streaming path will inherit these features that were only present or richer in the sync handler:

1) Advanced L3 Response Cache (read + metrics + write‑through)
- Pre‑check L3 cache using (`AdvancedCacheService.get_response`) based on `query` + `context_hash` + `model`.
- On hit: record metrics (`record_cache_hit('l3', True)`), emit `metadata`, optional `sources`, a single `token` with the cached body (or chunk deterministically), then `complete`.
- On miss: record miss (`record_cache_hit('l3', False)`), proceed normally; after completion, write‑through (`set_response`) with the computed context hash.

2) Stateful Retrieval Pipeline and Cache‑Key Parity
- Use the same cache key shape for the retrieval pipeline (hybrid/unified/provider/model) as sync to maximize reuse.
- Pass through `enable_stateful_retrieval` and `redis_client` from `app.state` to `create_parallel_pipeline` so streaming benefits from stateful retrieval when enabled.

3) No‑Context Fallback Prompting
- If `use_rag` is true and retrieval returns no documents, inject the sync’s explicit “no documentation found” prompt so the model clearly informs the user rather than hallucinating.

4) Prompt Unification and Short‑Answer Mode
- Promote the sync base system prompt (stricter constraints: don’t invent rates; include restrictions; preserve tables) to `prompt_constants` and reuse in streaming.
- Keep `SHORT_ANSWER_PROMPT` and apply when `chat_request.short_answer_mode` is set.
- Preserve trip‑plan instruction: do not show a summary table up front; present details then summary at end.

5) Include‑Sources Semantics
- Gate the SSE `sources` event on `chat_request.include_sources` so streaming matches sync’s response semantics.

6) Glossary Finalization Pass (GMT)
- If the query suggests GMT and a glossary block is injected but the model output omits the key wording, emit a final clarification token before `complete` to ensure the definition is visible in the streamed answer.

7) Source Auditing + Richer Query Logs
- Persist source usage for auditing via `source_repository.record_query_sources`.
- Extend streaming’s query logging metadata to include `source_ids` and parity fields used by sync (temperature, max_tokens, include_sources, counts, timings, token usage).

8) Telemetry Parity
- Ensure the same metric keys are emitted for latency buckets and counters, including: `total_requests`, `streaming_requests`, `search_latency_ms`, `context_build_latency_ms`, `first_token_latency_ms`, `answer_generation_latency_ms`, `llm_latency_ms`, `total_request_latency_ms`, token usage, cache hit/miss.

9) Model Knobs Parity (OpenAI)
- Apply `reasoning.effort` and `reasoning.verbosity` on O‑series models, and `max_tokens` when provided, mirroring sync handling.

## API Surface and Event Contract

- Keep routes for backward compatibility:
  - `POST {api_prefix}/chat/stream` (primary) → SSE.
  - `POST {api_prefix}/streaming_chat` (legacy alias) → SSE.
  - `POST {api_prefix}/chat` (deprecated) → 410 Gone with pointer to `/chat/stream`.
- Event sequence (unchanged):
  - `connection` → `metadata(conversation_id)` → `retrieval_start` → `retrieval_complete` → `sources` (optional) → `first_token` → `token*` → `complete` → optional `metadata(follow_up_questions)`.

## Implementation Plan (Steps)

1) Centralize Prompts and Utilities
- Move the stricter sync system prompt to `app/api/prompt_constants.py` and import it in streaming.
- Extract `_coerce_to_text`, `_extract_chunk_text`, `_extract_token_usage_from_chunk` to `app/utils/streaming_utils.py`.
- Extract `_build_history_messages` to `app/utils/message_utils.py`.

2) Add AdvancedCache to Streaming
- Acquire `cache_service` from `request.app.state`; wrap as `AdvancedCacheService`.
- Compute `context_hash` after retrieval using `create_context_hash(query, documents, model)`.
- Pre‑check L3 cache before optimization/retrieval; if hit, stream cached result and short‑circuit.
- After completion, write‑through L3 response and record cache metrics.

3) Unify Retrieval Pipeline
- Reuse the same pipeline cache key shape and building logic: hybrid config, smart‑model vector settings, unified retrieval flag.
- Pass `enable_stateful_retrieval` and `redis_client` to `create_parallel_pipeline`.

4) No‑Context Fallback + Trip‑Plan Instruction
- If `use_rag` and no results: build the explicit fallback prompt (from sync) before generation.
- Ensure trip‑plan instruction is present in the context prompt for streaming.

5) Include‑Sources Gating
- Conditionally emit the `sources` SSE event only if `chat_request.include_sources` is true.

6) Glossary Finalization
- Preserve streaming‑time glossary injection.
- After streaming all tokens, append a final clarification token if the wording is missing.

7) Query Logging and Auditing
- Log success/failure with parity fields and `source_ids`.
- Call `source_repository.record_query_sources(query_id, sources)` on success when sources exist.

8) Deprecate Sync
- Change `/chat` implementation to return HTTP 410 Gone with a JSON payload pointing to `/chat/stream`.
- Add deprecation note in docs (README, API docs, and changelog).

9) Tests
- Unit tests: prompt builder, retrieval builder (keys and flags), glossary injection, cache adapter (hit/miss/write‑through), event gating for `include_sources`.
- Integration tests: full SSE sequence (success), cache‑hit stream, RAG empty (no‑context prompt), abort mid‑stream, error path.

10) Rollout
- Ship behind a short‑lived feature flag if needed; shadow test in staging.
- Monitor metrics and logs for parity; then remove old sync logic after soak.

## Monitoring and Telemetry

- Counters: `total_requests`, `streaming_requests`, `successful_requests`, `failed_requests`.
- Latency histograms: `search_latency_ms`, `context_build_latency_ms`, `first_token_latency_ms`, `answer_generation_latency_ms`, `llm_latency_ms`, `total_request_latency_ms`.
- Token usage per provider/model.
- Cache metrics: `record_cache_hit('l3', True|False)` and optional cache warming stats.

## Risks and Mitigations

- Prompt drift: centralize prompts and unit‑test assembly.
- Cache correctness: compute `context_hash` deterministically (sorted doc IDs + content preview) and test round‑trip.
- SSE contract: keep event names/shape; add tests against the gateway proxy route.
- Pool fallback: retain try/fallback to direct client if pool acquisition fails.

## Configuration

- Flags/Settings used: `enable_unified_retrieval`, `enable_llm_pool`, `enable_stateful_retrieval`, `smart_mode_max_chunks`, `smart_mode_context_char_limit`, `default_location`.

## Acceptance Criteria

- `/chat` returns 410 Gone with guidance; `/chat/stream` and `/streaming_chat` are unchanged for clients.
- Streaming exhibits feature parity with sync (cache, no‑context, prompts, logging, telemetry, glossary clarification, include_sources gating).
- No duplicated retrieval/prompt/telemetry logic remains between routers.
- Tests cover success, cache, empty‑RAG, error, and abort flows.

## Work Checklist

- [ ] Centralize system prompt and short‑answer prompt import for streaming.
- [ ] Extract streaming utils (text and usage extraction) and message utils (history).
- [ ] Add AdvancedCache read/write to streaming.
- [ ] Unify retrieval pipeline build with stateful flag and identical cache keys.
- [ ] Implement no‑context fallback prompt in streaming.
- [ ] Gate `sources` event on `include_sources`.
- [ ] Add glossary clarification token if needed.
- [ ] Extend query logging metadata; add source auditing call.
- [ ] Deprecate `/chat` with 410 Gone.
- [ ] Update docs (README/CHANGELOG) and add tests.

