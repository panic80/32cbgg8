# Retrieval Optimization Deployment Guide

This guide covers the safe deployment of retrieval optimizations using A/B testing and gradual rollout.

## Overview

The optimization system includes:
- **Gated Retrieval Coordinator**: Orchestrates all retrieval components
- **Conditional Reranking**: Intelligent reranking decisions
- **Delayed Head Streaming**: Optimized response streaming
- **Performance Caching**: L2 cache for merged results
- **Smart Deduplication**: Conservative duplicate detection

## Deployment Strategy

### Phase 1: Development Testing (0% Production)
```bash
# Use development settings
cp .env.optimization .env
python3 scripts/rollback_retrieval.py status
```

### Phase 2: Staging Validation (25% Traffic)
```bash
# Copy staging config
cp .env.staging .env

# Verify settings
python3 scripts/rollback_retrieval.py status

# Restart service
sudo systemctl restart rag-service
```

### Phase 3: Production Rollout (10% → 25% → 50% → 100%)

#### Step 1: Initial 10% rollout
```bash
# Enable with 10% rollout
python3 scripts/rollback_retrieval.py enable --percentage 0.1

# Monitor for 24 hours
# Check logs: journalctl -f -u rag-service
```

#### Step 2: Gradual increase to 50%
```bash
# Gradual rollout with 5-minute steps
python3 scripts/rollback_retrieval.py rollout --percentage 0.5 --step-size 0.1 --step-delay 300
```

#### Step 3: Full rollout
```bash
# After 72 hours of successful 50% rollout
python3 scripts/rollback_retrieval.py enable --percentage 1.0
```

## Emergency Rollback

If issues occur, immediately disable gated retrieval:

```bash
# Emergency rollback (reverts to legacy pipeline)
python3 scripts/rollback_retrieval.py disable

# Restart service
sudo systemctl restart rag-service

# Verify rollback
python3 scripts/rollback_retrieval.py status
```

## Monitoring Commands

### Check Current Status
```bash
python3 scripts/rollback_retrieval.py status
```

### Monitor Service Logs
```bash
# General service logs
journalctl -f -u rag-service

# Filter for gated retrieval logs
journalctl -f -u rag-service | grep -i "gated\|retrieval\|optimization"

# Check for A/B testing assignments
journalctl -f -u rag-service | grep "A/B test"
```

### Performance Monitoring
```bash
# Check latency metrics
curl -X POST http://localhost:8000/api/v1/streaming_chat \
  -H "Content-Type: application/json" \
  -d '{"message": "meal allowance Toronto", "stream": true}' | \
  grep -E "retrieval_complete|rerank_complete|streaming_delay"
```

## Success Criteria

Before proceeding to next phase, verify:

✅ **Accuracy**: F1 score within ±1% of baseline  
✅ **Performance**: P50 latency < 250ms, P95 < 500ms  
✅ **Reliability**: No increase in error rates  
✅ **Cache Hit Rate**: L2 cache hit rate > 40%  

## Rollback Triggers

Automatically rollback if:
- F1 score drops >1% from baseline
- P95 latency increases >30%
- Error rate increases >5%
- Service becomes unresponsive

## Configuration Files

- `.env.optimization` - Full optimization configuration
- `.env.staging` - 25% rollout for staging
- `.env.production` - 50% rollout for production
- `scripts/rollback_retrieval.py` - Rollback management tool

## A/B Testing Details

The system uses MD5 hash of query message for consistent A/B assignments:
- Users get the same experience across sessions
- Traffic split is deterministic and stable
- Can be monitored via "A/B test" log entries

## Support

For issues during deployment:
1. Check service logs: `journalctl -f -u rag-service`
2. Verify configuration: `python3 scripts/rollback_retrieval.py status`
3. Emergency rollback: `python3 scripts/rollback_retrieval.py disable`
4. Restore from backup: `python3 scripts/rollback_retrieval.py restore`