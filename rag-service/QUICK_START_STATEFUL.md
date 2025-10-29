# Quick Start: LangGraph Stateful Retrieval

## TL;DR

LangGraph-based retrieval with Redis persistence and automatic refinement cycles is now enabled. Low-quality retrieval automatically retries with reformulated queries.

## How It Works

```
User Query ? Retrieve ? Quality Check
                           ?
            (Relevance < 0.4 && iterations < 2?)
                           ?
                    YES ?         ? NO
                        ?         ?
             Refine Query    Return Results
                    ?
             Retrieve Again
```

## Configuration

Default settings in `app/core/config.py`:

```python
enable_stateful_retrieval = True      # Enable/disable feature
max_retrieval_iterations = 2          # Max retry attempts
relevance_threshold = 0.4             # Minimum quality to proceed
stateful_retrieval_session_ttl = 3600 # Redis TTL (1 hour)
```

Override via environment:

```bash
RAG_ENABLE_STATEFUL_RETRIEVAL=true
RAG_MAX_RETRIEVAL_ITERATIONS=2
RAG_RELEVANCE_THRESHOLD=0.4
```

## Testing

### 1. Run Test Script

```bash
cd rag-service
python test_stateful_retrieval.py
```

**Expected output:**

```
? Pipeline created successfully
? Refinement cycle was triggered
? Query expansion working
? Query simplification working
? All tests passed!
```

### 2. Manual Testing

**Low-quality queries (should trigger refinement):**

```
"What meal rate?"
"Travel costs"
"POMV rates"
```

**High-quality queries (should NOT trigger refinement):**

```
"What is the meal allowance rate for Toronto, Ontario?"
"What are the kilometric rates for private vehicle travel?"
```

### 3. Check Logs

Look for refinement activity:

```bash
grep "Quality assessment" logs/app.log
grep "Refined query" logs/app.log
grep "Finalized retrieval" logs/app.log
```

**Example log output:**

```
INFO: Quality assessment: avg_relevance=0.32, threshold=0.40, quality=needs_refinement
INFO: Refined query using expansion: 'meal rate allowances amounts values'
INFO: Finalized retrieval: 15 documents, avg_relevance=0.67, iterations=2
```

### 4. Check Redis

View checkpoints:

```bash
redis-cli KEYS "langgraph:checkpoint:*"
redis-cli GET "langgraph:checkpoint:{thread_id}"
```

## Monitoring

### Key Metrics

View in performance dashboard:

- **retrieval_iterations_count** - Histogram (1, 2, or 3)
- **retrieval_cycles_triggered_total** - Counter
- **retrieval_avg_relevance** - Gauge (0-1)
- **stateful_retrieval_total_latency_ms** - Histogram

### Expected Behavior

- **85%** of queries: 1 iteration, no refinement (~200ms overhead)
- **12%** of queries: 2 iterations (+3-5s)
- **3%** of queries: 3 iterations (+6-10s)
- **Average overhead:** ~300-400ms

## Troubleshooting

### Issue: High latency (>500ms average)

**Solution 1:** Lower threshold to reduce refinements

```python
relevance_threshold = 0.3  # More lenient
```

**Solution 2:** Reduce max iterations

```python
max_retrieval_iterations = 1  # Only one retry
```

### Issue: Too many refinements (>20% of queries)

**Cause:** Threshold too high or reranker returning low scores

**Solution:** Lower threshold

```python
relevance_threshold = 0.3  # Accept lower quality
```

### Issue: Too few refinements (<5% of queries)

**Cause:** Threshold too low, refinement not adding value

**Solution:** Raise threshold

```python
relevance_threshold = 0.5  # Be more selective
```

### Issue: Redis connection errors

**Fallback:** System automatically falls back to in-memory checkpointing

**Fix:** Check Redis connection:

```bash
redis-cli ping
# Expected: PONG
```

Update Redis URL:

```bash
RAG_REDIS_URL=redis://localhost:6379
```

## Rollback

### Disable Feature

Set environment variable:

```bash
RAG_ENABLE_STATEFUL_RETRIEVAL=false
```

Or in `.env`:

```
RAG_ENABLE_STATEFUL_RETRIEVAL=false
```

Restart service:

```bash
sudo systemctl restart rag-service.service
# or
pm2 restart rag-service
```

### Verify Rollback

Check logs for:

```
INFO: Wrapping pipeline with stateful retrieval
```

Should NOT appear after rollback.

## Performance Impact

### Latency Breakdown

| Component                   | Time    |
| --------------------------- | ------- |
| Redis checkpoint (per node) | 10-50ms |
| Quality assessment          | 5-10ms  |
| Query refinement            | 5-10ms  |
| Retrieval cycle             | 3-5s    |

### No-Cycle Overhead

- **Redis checkpoints:** 3 nodes � ~30ms = ~90ms
- **Assessment logic:** ~10ms
- **Total:** ~100-200ms

### With Cycles

- **1 cycle:** Base (200ms) + Retrieval (3-5s) = 3.2-5.2s
- **2 cycles:** Base (200ms) + 2 � Retrieval (6-10s) = 6.2-10.2s

## API Usage

### Standard Request (No Changes)

```bash
curl -X POST http://localhost:8000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is the meal rate for Toronto?",
    "conversation_id": "test-123",
    "use_rag": true,
    "provider": "openai"
  }'
```

Stateful retrieval is automatic when enabled.

### Check Response Metadata

Response includes:

```json
{
  "response": "...",
  "sources": [...],
  "processing_time": 3.2,  // May be higher with cycles
  ...
}
```

## Files Changed

### Core Implementation

- `app/pipelines/stateful_retrieval.py` - Main logic
- `app/pipelines/parallel_retrieval.py` - Factory integration
- `app/api/chat.py` - API integration

### Supporting

- `app/pipelines/query_optimizer.py` - Refinement strategies
- `app/core/config.py` - Configuration
- `requirements.txt` - Dependencies

## Documentation

- **Full docs:** `LANGGRAPH_IMPLEMENTATION.md`
- **Summary:** `IMPLEMENTATION_SUMMARY.md`
- **This guide:** `QUICK_START_STATEFUL.md`

## Support

### Check Status

```bash
# Check if feature is enabled
grep "enable_stateful_retrieval" .env

# Check Redis connection
redis-cli ping

# Check service logs
tail -f logs/app.log | grep "stateful"
```

### Debug Mode

Enable debug logging:

```bash
RAG_LOG_LEVEL=DEBUG
```

Restart and check logs for detailed state transitions.

## Success Indicators

? Feature is working correctly if:

1. Service starts without errors
2. Test script passes all checks
3. Logs show refinement cycles for vague queries
4. Redis contains checkpoint keys
5. Average latency < 500ms
6. Performance metrics are recorded

---

**Questions?** See `LANGGRAPH_IMPLEMENTATION.md` for detailed documentation.
