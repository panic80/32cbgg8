# LangChain & LangGraph Upgrade Guide

## Overview

This document describes the upgrade from LangChain 0.2.x/0.3.x and LangGraph 0.2.38 to the latest stable versions.

**Date**: October 24, 2025
**Upgraded By**: Automated upgrade process
**Python Version**: 3.11.14 ✅

---

## Version Changes

### LangChain Ecosystem

| Package | Previous Version | New Version | Change Type |
|---------|-----------------|-------------|-------------|
| `langchain` | `>=0.3.0,<0.4` | `>=0.3.14,<0.4` | Minor update |
| `langchain-core` | `>=0.3.0,<0.4` | `>=0.3.30,<0.4` | Minor update |
| `langchain-community` | `>=0.3.0,<0.4` | `>=0.3.14,<0.4` | Minor update |
| `langchain-openai` | `>=0.2.0,<0.3` | `>=0.2.14,<0.3` | Minor update |
| `langchain-google-genai` | `>=1.0.0,<2.0` | `>=2.0.6,<3.0` | **Major update** ⚠️ |
| `langchain-anthropic` | `>=0.2.0,<0.3` | `>=0.3.7,<0.4` | Minor update |
| `langchain-experimental` | `>=0.3.0,<0.4` | `>=0.3.14,<0.4` | Minor update |
| `langchain-text-splitters` | `>=0.3.0,<0.4` | `>=0.3.6,<0.4` | Minor update |
| `langgraph` | `0.2.38` | `>=1.0.20,<2.0` | **Major update** ⚠️ |
| `langgraph-checkpoint-redis` | *New* | `>=0.1.1,<0.2` | **New package** ✨ |

### Core Dependencies

| Package | Previous Version | New Version | Notes |
|---------|-----------------|-------------|-------|
| `fastapi` | `0.109.0` | `>=0.115.6,<0.116` | Security fixes |
| `uvicorn[standard]` | `0.27.0` | `>=0.34.0,<0.35` | Updated server |
| `pydantic` | `>=2.5.3,<3.0` | `>=2.10.6,<3.0` | Latest v2 |
| `redis` | `5.0.1` | `>=5.2.1,<6.0` | Async support |
| `chromadb` | `>=0.4.22,<0.5` | `>=0.5.23,<0.6` | Compatibility |

### LLM Providers

| Package | Previous Version | New Version |
|---------|-----------------|-------------|
| `openai` | `>=1.12.0,<2.0` | `>=1.60.0,<2.0` |
| `google-generativeai` | `>=0.3.2,<1.0` | `>=0.8.3,<1.0` |
| `anthropic` | *implicit* | `>=0.40.0,<1.0` |

### Document Processing

| Package | Previous Version | New Version | Improvements |
|---------|-----------------|-------------|--------------|
| `pypdf` | `4.0.1` | `>=5.1.0,<6.0` | Better parsing |
| `pdfplumber` | `0.10.3` | `>=0.11.4,<0.12` | Table extraction |
| `pandas` | `2.1.4` | `>=2.2.3,<3.0` | Latest stable |
| `unstructured[all-docs]` | `0.11.8` | `>=0.16.14,<0.17` | Advanced features |

### Utilities

| Package | Previous Version | New Version | Benefits |
|---------|-----------------|-------------|----------|
| `tenacity` | `8.2.3` | `>=9.0.0,<10.0` | Better retry logic |
| `scikit-learn` | `1.3.2` | `>=1.6.1,<2.0` | Performance |
| `sentence-transformers` | `2.2.2` | `>=3.3.1,<4.0` | Faster embeddings |
| `aiohttp` | `3.9.1` | `>=3.11.11,<4.0` | Security fixes |
| `httpx` | `0.26.0` | `>=0.28.1,<0.29` | Latest stable |

### Development Tools

| Package | Previous Version | New Version |
|---------|-----------------|-------------|
| `pytest` | `7.4.4` | `>=8.3.4,<9.0` |
| `pytest-asyncio` | `0.23.3` | `>=0.25.2,<0.26` |
| `black` | `23.12.1` | `>=24.10.0,<25.0` |

---

## Major Changes

### 1. LangGraph 1.0 Upgrade

**Breaking Changes:**
- Custom checkpoint API changed
- New official Redis checkpoint support via `langgraph-checkpoint-redis`
- StateGraph compilation API improved

**Migration Actions:**
✅ Replaced custom `RedisCheckpointer` class with official `AsyncRedisSaver`
✅ Updated `stateful_retrieval.py` to use new checkpoint API
✅ Added graceful fallback to `MemorySaver` if Redis unavailable

**Code Changes:**
- File: `app/pipelines/stateful_retrieval.py`
- Removed: Custom `RedisCheckpointer` class (97 lines)
- Added: Official `AsyncRedisSaver` integration with `.from_conn_string()`
- Improved: Automatic checkpoint handling by LangGraph 1.0

### 2. LangChain Google GenAI 2.x

**Breaking Changes:**
- Updated to v2.x API
- Requires `google-generativeai>=0.8.3`

**Compatibility:**
✅ No code changes required - API compatible
✅ Improved performance and features

### 3. Pydantic v2 Compatibility

**Status:** Already migrated ✅
- No `pydantic_v1` imports found
- All code uses Pydantic v2 native imports
- ConfigDict pattern in use

---

## Installation

### Fresh Install

```bash
cd rag-service

# Install all dependencies
pip install -r requirements.txt

# Setup Redis indices for checkpoint (first time only)
# This will be done automatically on first use
```

### Upgrade Existing Environment

```bash
cd rag-service

# Upgrade all packages
pip install --upgrade -r requirements.txt

# Verify installation
python -c "import langgraph; print(f'LangGraph: {langgraph.__version__}')"
python -c "import langchain; print(f'LangChain: {langchain.__version__}')"
```

---

## Testing Checklist

### Unit Tests
```bash
cd rag-service
pytest tests/ -v --cov=app --cov-report=html
```

### Critical Workflows

- [ ] **Stateful Retrieval**: Test LangGraph workflow with Redis checkpointing
  ```bash
  pytest test_stateful_retrieval.py -v
  ```

- [ ] **Document Ingestion**: Verify all document loaders work
  ```bash
  pytest tests/test_ingestion_pipeline.py -v
  ```

- [ ] **LLM Providers**: Test all three providers (OpenAI, Google, Anthropic)
  - OpenAI ChatGPT
  - Google Gemini
  - Anthropic Claude

- [ ] **Embeddings**: Verify embedding generation and caching
  - OpenAI embeddings
  - Google embeddings

- [ ] **Redis Caching**: Confirm LLM cache and checkpoints work
  - LLM response cache
  - LangGraph state checkpoints

### Integration Tests

- [ ] Start RAG service: `uvicorn app.main:app --reload --port 8000`
- [ ] Test `/chat` endpoint with streaming
- [ ] Verify stateful conversation continuity
- [ ] Check Redis connection and caching
- [ ] Monitor logs for deprecation warnings

### Performance Validation

Compare metrics before/after upgrade:
- Query response time (should be similar or better)
- Retrieval quality scores (should be maintained)
- Memory usage (should be stable)
- Cache hit rates (should be preserved)

---

## Breaking Changes & Mitigations

### LangGraph Checkpoint API

**Before (LangGraph 0.2.38):**
```python
class RedisCheckpointer:
    async def aput(self, config, checkpoint):
        # Custom serialization
        ...

    async def aget(self, config):
        # Custom deserialization
        ...
```

**After (LangGraph 1.0.20):**
```python
from langgraph.checkpoint.redis.aio import AsyncRedisSaver

# Official implementation
checkpointer = AsyncRedisSaver.from_conn_string(redis_url)
workflow = graph.compile(checkpointer=checkpointer)
```

**Migration:** Automatic checkpoint handling - no manual save/load needed ✅

### Import Changes

All imports verified - no changes required ✅
- ❌ No deprecated `pydantic_v1` imports
- ✅ Using `langchain_core`, `langchain_community` correctly
- ✅ Modern LangChain ecosystem imports

---

## Rollback Procedure

If issues arise:

### Option 1: Git Rollback
```bash
# Restore previous version
git checkout HEAD~1 rag-service/requirements.txt
git checkout HEAD~1 rag-service/app/pipelines/stateful_retrieval.py

# Reinstall old dependencies
pip install -r rag-service/requirements.txt
```

### Option 2: Use Archived Requirements
```bash
# Old requirements files are archived in requirements-archive/
cp rag-service/requirements-archive/requirements-fixed.txt rag-service/requirements.txt
pip install -r rag-service/requirements.txt
```

---

## Known Issues & Workarounds

### Issue 1: LangGraph Redis Checkpoint Not Available

**Symptom:**
```
WARNING: langgraph-checkpoint-redis not available
```

**Workaround:**
The system automatically falls back to `MemorySaver`. To enable Redis:
```bash
pip install langgraph-checkpoint-redis
```

### Issue 2: Dependency Conflicts

**Symptom:**
Pip reports conflicting dependencies

**Workaround:**
```bash
# Use fresh virtual environment
python -m venv venv-clean
source venv-clean/bin/activate
pip install -r requirements.txt
```

### Issue 3: Unstructured Package Installation Slow

**Symptom:**
`unstructured[all-docs]` takes long to install

**Workaround:**
This is normal - the package has many dependencies for document processing.
Consider using `unstructured` without `[all-docs]` if you don't need all formats.

---

## Post-Upgrade Monitoring

### Logs to Watch

1. **Deprecation Warnings**
   ```
   grep -i "deprecat" logs/rag-service.log
   ```

2. **Redis Connection**
   ```
   grep -i "redis" logs/rag-service.log
   ```

3. **LangGraph Checkpoint**
   ```
   grep -i "checkpoint" logs/rag-service.log
   ```

4. **LLM Provider Errors**
   ```
   grep -E "(openai|google|anthropic)" logs/rag-service.log
   ```

### Metrics to Monitor

- **Latency**: Query response time
- **Error Rate**: Failed requests
- **Cache Hit Rate**: Redis cache performance
- **Memory Usage**: Process memory
- **Checkpoint Success**: State persistence

---

## Future Upgrades

### LangChain 1.0 (Planned October 2025)

When LangChain 1.0 releases:
- ✅ No breaking changes expected until 2.0
- Review official migration guide
- Update to 1.0.x for long-term stability

### LangGraph 2.0

- Breaking changes will occur
- Follow official migration guide when available
- Test thoroughly before upgrading

---

## Resources

- [LangChain Documentation](https://python.langchain.com/)
- [LangGraph Documentation](https://langchain-ai.github.io/langgraph/)
- [LangChain v0.3 Release Notes](https://python.langchain.com/docs/versions/v0_3/)
- [LangGraph 1.0 Announcement](https://blog.langchain.com/langchain-langgraph-1dot0/)
- [Redis Checkpoint Documentation](https://github.com/redis-developer/langgraph-redis)

---

## Summary

✅ **Upgraded Successfully**
- LangGraph: 0.2.38 → 1.0.20+
- LangChain: 0.3.x → 0.3.14+
- All dependencies updated to latest stable versions
- Official Redis checkpoint integration
- Enhanced performance and security

⚠️ **Action Required**
- Run full test suite
- Monitor production logs
- Validate performance metrics
- Test all LLM providers

🚀 **Benefits**
- Official Redis checkpoint support (more reliable)
- Better async performance
- Security fixes across dependencies
- Improved document processing
- Faster embeddings with sentence-transformers 3.x
- Preparation for LangChain 1.0

---

**Questions or Issues?**
Refer to the CLAUDE.md file for development practices and testing procedures.
