# LangGraph Stateful Retrieval Implementation

## Overview

This document describes the implementation of LangGraph-based stateful retrieval with persistence and iterative refinement cycles in the RAG service.

## What Was Implemented

### 1. Core Features

#### Persistence with Redis Checkpointing

- Custom `RedisCheckpointer` class for state persistence
- Stores retrieval state in Redis with configurable TTL (default: 1 hour)
- Enables conversation continuity across requests
- Provides audit trail for debugging and compliance

#### Iterative Refinement Cycles

- Automatic retry logic when retrieval quality is low (avg relevance < 0.4)
- Maximum 2 iterations to prevent excessive latency
- Query reformulation strategies:
  - **Iteration 1**: Expand query with domain terms and synonyms
  - **Iteration 2**: Simplify query to core keywords
- Early termination when relevance threshold is met

### 2. Architecture

```
StatefulRetrievalPipeline (LangGraph)
?
??? retrieve_node
?   ??? ParallelRetrievalPipeline (existing)
?
??? assess_quality_node
?   ??? Calculate avg relevance from reranked documents
?
??? refine_query_node (conditional)
?   ??? QueryOptimizer.expand_query_for_retry() or simplify_query_for_retry()
?
??? finalize_node
    ??? Return top-k results
```

### 3. StateGraph Workflow

```python
START
  ?
retrieve_node ? assess_quality_node
                      ?
                (avg_relevance < 0.4 && iterations < 2)?
                      ?
                 Yes  ?  No
                      ?
        refine_query_node ? finalize_node ? END
                ?_______________|
                (loop back to retrieve)
```

### 4. Configuration Settings

Added to `app/core/config.py`:

```python
# LangGraph Stateful Retrieval Configuration
enable_stateful_retrieval: bool = True
max_retrieval_iterations: int = 2
relevance_threshold: float = 0.4
checkpoint_critical_nodes_only: bool = True
stateful_retrieval_session_ttl: int = 3600  # 1 hour
```

### 5. Key Files Modified/Created

**New Files:**

- `rag-service/app/pipelines/stateful_retrieval.py` (450+ lines)
  - `RetrievalState` TypedDict
  - `RedisCheckpointer` class
  - `StatefulRetrievalPipeline` class with StateGraph workflow

**Modified Files:**

- `rag-service/requirements.txt` - Added `langgraph==0.2.38`
- `rag-service/app/core/config.py` - Added configuration settings
- `rag-service/app/pipelines/parallel_retrieval.py` - Added stateful wrapper option in factory
- `rag-service/app/pipelines/query_optimizer.py` - Added `expand_query_for_retry()` and `simplify_query_for_retry()`
- `rag-service/app/api/chat.py` - Integrated stateful pipeline with Redis client and session ID

### 6. Performance Metrics

Tracked via `PerformanceMonitor`:

- `stateful_retrieval_node_latency_ms` - Per-node execution time
- `retrieval_avg_relevance` - Average relevance scores
- `retrieval_refinements_total` - Count of refinement attempts
- `retrieval_iterations_count` - Histogram of iteration counts
- `retrieval_cycles_triggered_total` - Total queries requiring refinement
- `stateful_retrieval_total_latency_ms` - End-to-end latency

## Performance Impact

### Expected Latency

| Scenario                  | Added Latency  | Trigger Rate |
| ------------------------- | -------------- | ------------ |
| No cycles (high quality)  | +100-200ms     | ~85%         |
| 1 cycle (expansion)       | +3-5 seconds   | ~12%         |
| 2 cycles (simplification) | +6-10 seconds  | ~3%          |
| **Average**               | **~300-400ms** | -            |

### Latency Breakdown

- **Redis checkpoint per node**: ~10-50ms
- **Quality assessment**: ~5-10ms
- **Query refinement**: ~5-10ms
- **Retrieval + reranking per cycle**: ~3-5 seconds

## Usage

### In Chat API

The stateful pipeline is automatically enabled when `enable_stateful_retrieval=True` in settings:

```python
# Create pipeline (happens once per cache key)
pipeline = create_parallel_pipeline(
    vector_store_manager=vector_store,
    llm=llm,
    enable_stateful=True,  # Enable stateful wrapper
    redis_client=redis_client  # For checkpointing
)

# Use pipeline (happens per request)
results = await pipeline.retrieve(
    query=query,
    k=10,
    session_id=conversation_id  # For persistence
)
```

### Session ID Format

Thread IDs for Redis persistence follow the format:

```
{session_id}:{query_hash[:8]}
```

Example: `550e8400-e29b-41d4-a716-446655440000:a3f2e1d8`

## Rollback Strategy

### Feature Flag

Set `enable_stateful_retrieval=False` in settings to immediately disable:

```bash
# In .env or environment
RAG_ENABLE_STATEFUL_RETRIEVAL=false
```

### Graceful Degradation

If Redis is unavailable:

- Falls back to `MemorySaver` (in-memory checkpointing)
- Session persistence disabled but cycles still work
- No impact on core functionality

If stateful pipeline fails:

- Catches exception and falls back to `ParallelRetrievalPipeline`
- Logs error for monitoring
- User receives standard retrieval results

## Testing

### Manual Test Queries

**Low-quality queries that should trigger refinement:**

1. "What meal rate?" (vague, missing context)
2. "Travel costs" (too broad)
3. "POMV rates Ontario" (might retrieve wrong provinces)

**High-quality queries that should NOT trigger refinement:**

1. "What is the meal allowance rate for Toronto, Ontario?"
2. "What are the kilometric rates for private vehicle travel in 2024?"
3. "CBI 209.997 accommodation rates"

### Monitoring

Check logs for:

```
INFO: Quality assessment: avg_relevance=0.32, threshold=0.40, quality=needs_refinement
INFO: Refined query using expansion: 'meal rate allowances amounts values'
INFO: Finalized retrieval: 15 documents, avg_relevance=0.67, iterations=2
```

Check Redis for checkpoints:

```bash
redis-cli KEYS "langgraph:checkpoint:*"
```

## Future Enhancements

### Not Yet Implemented (from original plan)

1. **Human-in-the-Loop** - Interrupt before synthesis for manual verification
2. **Streaming intermediate results** - Stream state updates during retrieval
3. **Confidence-based LLM assessment** - Use LLM to evaluate answer quality
4. **Subgraphs** - Break workflow into modular subgraphs
5. **Advanced routing** - More sophisticated conditional logic

### Potential Improvements

1. **Adaptive thresholds** - Learn optimal relevance threshold per query type
2. **Query templates** - Pre-defined refinement strategies per domain
3. **Multi-strategy retrieval** - Try different retrievers in each cycle
4. **Cost optimization** - Skip expensive operations when not needed
5. **A/B testing** - Compare stateful vs standard pipeline performance

## Troubleshooting

### High Latency

If average latency > 500ms:

- Check `retrieval_iterations_count` histogram
- If many queries require 2+ iterations, lower `relevance_threshold` to 0.3
- Check if reranker is causing bottleneck

### Low Refinement Trigger Rate

If < 5% of queries trigger refinement:

- Raise `relevance_threshold` to 0.5 or 0.6
- Check if reranker scores are too optimistic

### Redis Memory Issues

If Redis memory grows too large:

- Reduce `stateful_retrieval_session_ttl` from 3600 to 1800 (30 min)
- Enable Redis eviction policy: `maxmemory-policy allkeys-lru`

## References

- LangGraph Documentation: https://langchain-ai.github.io/langgraph/
- Implementation Plan: `/add-langgraph-persistence-cycles.plan.md`
- Performance Dashboard: `/docs/performance-dashboard.md`
