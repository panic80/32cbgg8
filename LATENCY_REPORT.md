# Retrieval Pipeline Latency Trace

## Summary
I traced the retrieval pipeline using `trace_retrieval.py` against the `gemini-3-pro-preview` model.

**Total Latency:** ~65s (Client-side) / ~56s (Server reported)

## Latency Breakdown

1.  **Query Classification:** **7.78s**
    *   This step uses the "Fast Model" (`gemini-2.5-flash`) to classify intent and extract entities.
    *   Latency is higher than expected for a Flash model, possibly due to cold start or network overhead.

2.  **Retrieval Phase:** **6.72s**
    *   **Multi-Query Generation:** **6.06s** (Major component). This uses `gemini-2.5-flash` to generate synonyms.
    *   **Vector Search:** ~1.5s
    *   **BM25:** ~0.004s (Very fast)
    *   **Reranking:** ~0.65s (Fast)
    *   **RRF Merge:** ~0.001s (Negligible)

3.  **Generation Phase:** **25.06s**
    *   This is the Gemini 3 Pro model generating the final answer.
    *   Time to First Token: **17.58s** (Total time before user sees text).

## Optimizations Implemented

1.  **Fast Model for Classification:** Configured the system to use `gemini-2.5-flash` for query classification instead of the heavy chat model.
2.  **Fast Model for Retrieval:** Updated `RetrievalExecutor` to use `gemini-2.5-flash` for multi-query generation.
3.  **Configuration:** Added `google_fast_model` and `openai_fast_model` settings.
4.  **Fixes:** Resolved `max_tokens` validation error in `llm_pool` for Google models.

## Recommendations for Further Improvement

1.  **Disable Multi-Query:** The multi-query step adds 6s. If standard vector search is sufficient, disabling this will save 6s.
2.  **Warm-up:** Ensure `gemini-2.5-flash` is properly warmed up to reduce the 7s classification time.
3.  **Streaming:** The 17s time-to-first-token is dominated by the pre-generation steps (7s + 6s + overhead). Reducing pre-generation steps is key.
