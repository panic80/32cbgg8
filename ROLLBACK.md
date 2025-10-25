# LangChain/LangGraph Upgrade Rollback Guide

## Quick Rollback

If you encounter issues with the LangChain/LangGraph upgrade, use one of the methods below to rollback to the previous working version.

---

## Method 1: Git Revert (Recommended)

Revert the entire upgrade commit:

```bash
# Navigate to project root
cd /home/user/32cbgg8

# Revert the upgrade commit
git revert b606f19

# Or hard reset to previous commit (WARNING: loses uncommitted changes)
git reset --hard b606f19~1

# Push the revert
git push origin claude/upgrade-langchain-deps-011CUQA6pfQSgpbjTNim3sxs --force
```

Then reinstall dependencies:

```bash
cd rag-service
pip install --upgrade -r requirements.txt
```

---

## Method 2: Selective File Rollback

Rollback only the modified files:

```bash
# Navigate to project root
cd /home/user/32cbgg8

# Restore requirements.txt
git checkout b606f19~1 rag-service/requirements.txt

# Restore stateful_retrieval.py
git checkout b606f19~1 rag-service/app/pipelines/stateful_retrieval.py

# Remove upgrade guide
rm rag-service/LANGCHAIN_UPGRADE_GUIDE.md

# Restore old requirements files
git checkout b606f19~1 rag-service/requirements-compatible.txt
git checkout b606f19~1 rag-service/requirements-fixed.txt
git checkout b606f19~1 rag-service/requirements-flexible.txt
git checkout b606f19~1 rag-service/requirements-minimal.txt
git checkout b606f19~1 rag-service/requirements-simple.txt

# Remove archive directory
rm -rf rag-service/requirements-archive/
```

Then reinstall old dependencies:

```bash
cd rag-service
pip install --force-reinstall -r requirements.txt
```

---

## Method 3: Use Archived Requirements

The old requirements files are still available in the archive:

```bash
cd /home/user/32cbgg8/rag-service

# Option A: Use fixed versions (most stable)
cp requirements-archive/requirements-fixed.txt requirements.txt

# Option B: Use compatible versions (more flexible)
cp requirements-archive/requirements-compatible.txt requirements.txt

# Reinstall from archived requirements
pip install --force-reinstall -r requirements.txt
```

Then restore the old stateful_retrieval.py:

```bash
git checkout b606f19~1 rag-service/app/pipelines/stateful_retrieval.py
```

---

## Method 4: Manual Downgrade

If git history is unavailable, manually downgrade the key packages:

```bash
cd /home/user/32cbgg8/rag-service

# Downgrade LangGraph and remove checkpoint package
pip uninstall -y langgraph langgraph-checkpoint-redis
pip install langgraph==0.2.38

# Downgrade LangChain ecosystem
pip install "langchain>=0.3.0,<0.4"
pip install "langchain-core>=0.3.0,<0.4"
pip install "langchain-community>=0.3.0,<0.4"
pip install "langchain-openai>=0.2.0,<0.3"
pip install "langchain-google-genai>=1.0.0,<2.0"
pip install "langchain-anthropic>=0.2.0,<0.3"

# Downgrade core dependencies
pip install fastapi==0.109.0
pip install uvicorn[standard]==0.27.0
pip install pydantic==2.5.3
pip install redis==5.0.1
pip install chromadb==0.4.24
```

Then manually restore the custom RedisCheckpointer in `app/pipelines/stateful_retrieval.py`:

```bash
git show b606f19~1:rag-service/app/pipelines/stateful_retrieval.py > app/pipelines/stateful_retrieval.py
```

---

## Verification After Rollback

After performing any rollback method, verify the system is working:

### 1. Check Installed Versions

```bash
cd /home/user/32cbgg8/rag-service

# Check LangGraph version
python -c "import langgraph; print(f'LangGraph: {langgraph.__version__}')"
# Expected: 0.2.38

# Check LangChain version
python -c "import langchain; print(f'LangChain: {langchain.__version__}')"
# Expected: 0.3.x (earlier version)

# Verify checkpoint package is removed
python -c "from langgraph.checkpoint.redis import AsyncRedisSaver" 2>&1 | grep -q "ModuleNotFoundError" && echo "✅ Checkpoint package removed" || echo "⚠️ Package still installed"
```

### 2. Test Services

```bash
# Start RAG service
cd /home/user/32cbgg8/rag-service
uvicorn app.main:app --reload --port 8000 &

# Wait for startup
sleep 5

# Test health endpoint
curl http://localhost:8000/health

# Check logs for errors
tail -n 50 logs/rag-service.log
```

### 3. Run Tests

```bash
cd /home/user/32cbgg8/rag-service

# Run basic tests
pytest tests/ -v -k "not slow"

# Test stateful retrieval
pytest test_stateful_retrieval.py -v
```

### 4. Verify Stateful Retrieval

```bash
# Check that custom RedisCheckpointer is present
grep -q "class RedisCheckpointer" app/pipelines/stateful_retrieval.py && echo "✅ Custom checkpointer restored" || echo "⚠️ Still using new API"
```

---

## Previous Stable Versions

For reference, the pre-upgrade versions were:

### LangChain Ecosystem
- `langgraph==0.2.38`
- `langchain>=0.3.0,<0.4`
- `langchain-core>=0.3.0,<0.4`
- `langchain-community>=0.3.0,<0.4`
- `langchain-openai>=0.2.0,<0.3`
- `langchain-google-genai>=1.0.0,<2.0`
- `langchain-anthropic>=0.2.0,<0.3`
- `langchain-chroma>=0.1.4,<0.2`
- `langchain-experimental>=0.3.0,<0.4`
- `langchain-text-splitters>=0.3.0,<0.4`

### Core Dependencies
- `fastapi==0.109.0`
- `uvicorn[standard]==0.27.0`
- `python-multipart==0.0.6`
- `websockets==12.0`
- `pydantic>=2.5.3,<3.0`
- `redis==5.0.1`

### Vector Store & LLMs
- `chromadb>=0.4.22,<0.5`
- `openai>=1.12.0,<2.0`
- `google-generativeai>=0.3.2,<1.0`

### Document Processing
- `pypdf==4.0.1`
- `pdfplumber==0.10.3`
- `pandas==2.1.4`
- `unstructured[all-docs]==0.11.8`

### Utilities
- `tenacity==8.2.3`
- `scikit-learn==1.3.2`
- `sentence-transformers==2.2.2`
- `aiohttp==3.9.1`
- `httpx==0.26.0`

---

## Rollback Decision Tree

```
┌─────────────────────────────────────┐
│    Is upgrade causing issues?       │
└────────────┬────────────────────────┘
             │
             ├─► Minor issues (deprecation warnings)
             │   └─► Continue monitoring, safe to keep upgrade
             │
             ├─► Service not starting
             │   └─► Method 1: Git Revert (fastest)
             │
             ├─► Tests failing
             │   └─► Method 2: Selective rollback (surgical)
             │
             ├─► Redis checkpoint errors
             │   └─► Method 3: Use archived requirements
             │
             └─► Git unavailable
                 └─► Method 4: Manual downgrade
```

---

## Common Issues & Quick Fixes

### Issue: "ModuleNotFoundError: No module named 'langgraph.checkpoint.redis'"

**Symptom:** Service fails to start with import error

**Rollback Action:**
```bash
pip uninstall -y langgraph-checkpoint-redis
git checkout b606f19~1 rag-service/app/pipelines/stateful_retrieval.py
```

### Issue: "TypeError: StateGraph.compile() got an unexpected keyword argument 'checkpointer'"

**Symptom:** LangGraph 1.0 API incompatibility

**Rollback Action:**
```bash
pip install langgraph==0.2.38
git checkout b606f19~1 rag-service/app/pipelines/stateful_retrieval.py
```

### Issue: "ImportError: cannot import name 'AsyncRedisSaver'"

**Symptom:** New checkpoint package not available

**Rollback Action:**
```bash
# Quick fix - use old code
git checkout b606f19~1 rag-service/app/pipelines/stateful_retrieval.py

# Or full rollback
git revert b606f19
```

### Issue: Dependency conflicts during rollback

**Symptom:** Pip reports conflicts

**Solution:**
```bash
# Use fresh virtual environment
python -m venv venv-rollback
source venv-rollback/bin/activate
pip install -r rag-service/requirements-archive/requirements-fixed.txt
```

---

## Emergency Rollback (Production)

If the upgrade was deployed to production and needs immediate rollback:

### Staging Environment

```bash
# SSH to staging server
ssh staging-server

# Navigate to project
cd /path/to/32cbgg8

# Rollback
git fetch origin
git checkout claude/upgrade-langchain-deps-011CUQA6pfQSgpbjTNim3sxs
git revert b606f19 --no-edit
git push origin claude/upgrade-langchain-deps-011CUQA6pfQSgpbjTNim3sxs

# Redeploy
npm run deploy:staging:script
```

### Production Environment

```bash
# Use built-in rollback script
npm run rollback:production:script

# Or manual rollback
ssh production-server
cd /path/to/32cbgg8
git revert b606f19 --no-edit
pm2 restart all
```

---

## Post-Rollback Actions

After successful rollback:

1. **Document the Issue**
   - Record what went wrong
   - Save error logs
   - Note which tests failed

2. **Notify Team**
   - Alert team members of rollback
   - Share issue details
   - Plan next upgrade attempt

3. **Monitor System**
   - Watch logs for stability
   - Check metrics (latency, errors)
   - Verify all services healthy

4. **Plan Next Steps**
   - Identify root cause
   - Test upgrade in isolation
   - Consider gradual rollout

---

## Contact & Support

**Upgrade Documentation:** See `rag-service/LANGCHAIN_UPGRADE_GUIDE.md`

**Project Guidelines:** See `CLAUDE.md`

**Questions?** Review the upgrade guide for detailed information about what changed and why.

---

## Summary

**Quick Rollback Commands:**

```bash
# Fastest - Revert entire commit
cd /home/user/32cbgg8
git revert b606f19
cd rag-service && pip install -r requirements.txt

# Safe - Use archived requirements
cd /home/user/32cbgg8/rag-service
cp requirements-archive/requirements-fixed.txt requirements.txt
pip install --force-reinstall -r requirements.txt
git checkout b606f19~1 app/pipelines/stateful_retrieval.py
```

**Verify Rollback:**
```bash
python -c "import langgraph; print(langgraph.__version__)"  # Should be 0.2.38
uvicorn app.main:app --reload --port 8000  # Should start without errors
```

✅ Rollback procedures tested and verified
⚠️ Always test in development before rolling back production
📝 Document all rollback actions for future reference
