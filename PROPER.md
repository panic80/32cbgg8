# Vector Store Configuration Lessons Learned

## Problem Summary

The RAG service's vector store was reporting as "error" in health checks despite having 1,863 indexed documents. Retrieval requests would find documents via BM25 but fail to generate LLM responses due to vector store initialization failures.

```
Health Check Error:
"Collection [585f6690-a0b5-42a7-be50-befc897e8ebc] does not exists"
```

## Root Cause Analysis

### The Issue: Multiple Chroma Databases

We discovered **three separate Chroma database instances**:

1. **`/var/www/cbthis/rag-service/chroma_db/`** (30MB, 1,863 embeddings)
   - Collection ID: `4bfe3d94-160f-4a61-a5db-9ec0a60587e2`
   - **Contains all indexed documents** ✅

2. **`/var/www/cbthis/chroma_db/`** (160KB, 0 embeddings)
   - Collection ID: `1d32c234-9c80-4ee0-a417-5598c5f2c297`
   - **Service was checking this empty one** ❌

3. **Backup databases** in `/var/www/cbthis/backups/` (560MB each)

### Why This Happened: Relative Path Resolution

The configuration used a **relative path**:

```python
# config.py line 44
chroma_persist_directory: str = "./chroma_db"
```

Depending on the working directory when the service started:

- From `/var/www/cbthis/rag-service/` → resolves to `/var/www/cbthis/rag-service/chroma_db` ✅
- From `/var/www/cbthis/` → resolves to `/var/www/cbthis/chroma_db` ❌

The systemd service runs with:

```ini
WorkingDirectory=/var/www/cbthis/rag-service
```

But something caused it to try initializing a database at the wrong location, creating an empty collection there.

### Why It Persisted: Permissions Issue

Even after fixing the path, the service failed with:

```
chromadb.errors.InternalError: (code: 8) attempt to write a readonly database
```

The `chroma.sqlite3` file had root ownership:

```
-rw-r--r-- 1 root root 30457856 Nov 3 00:00 chroma.sqlite3
```

But the service runs as `www-data` user, which couldn't write to a root-owned file.

## Solution

### Step 1: Use Absolute Path

**File**: `/var/www/cbthis/rag-service/.env`

```diff
- RAG_CHROMA_PERSIST_DIRECTORY=./chroma_db
+ RAG_CHROMA_PERSIST_DIRECTORY=/var/www/cbthis/rag-service/chroma_db
```

**Why**: Absolute paths are unambiguous regardless of working directory.

### Step 2: Fix Database Permissions

```bash
chown -R www-data:www-data /var/www/cbthis/rag-service/chroma_db
chmod -R u+w /var/www/cbthis/rag-service/chroma_db
```

**Why**: The service user (`www-data`) must have write access to the Chroma database for locks and writes.

### Step 3: Restart Service

```bash
systemctl restart rag-service
```

### Results

```json
{
  "status": "healthy",
  "components": {
    "vector_store": {
      "status": "healthy",
      "collection": "travel_instructions",
      "document_count": 1863,
      "persist_directory": "/var/www/cbthis/rag-service/chroma_db"
    }
  }
}
```

## How to Prevent This

### 1. Configuration Best Practices

✅ **DO**: Always use absolute paths for persistent data directories

```python
RAG_CHROMA_PERSIST_DIRECTORY=/var/www/cbthis/rag-service/chroma_db
RAG_REDIS_URL=redis://localhost:6379  # This is fine - hostname, not path
```

❌ **DON'T**: Use relative paths that depend on working directory

```python
RAG_CHROMA_PERSIST_DIRECTORY=./chroma_db  # Dangerous!
RAG_CHROMA_PERSIST_DIRECTORY=rag-service/chroma_db  # Ambiguous
```

### 2. Permissions Setup

When setting up the service:

```bash
# Ensure service user owns the data directory
sudo chown -R www-data:www-data /var/www/cbthis/rag-service/chroma_db
sudo chmod 755 /var/www/cbthis/rag-service/chroma_db
sudo chmod 644 /var/www/cbthis/rag-service/chroma_db/*.sqlite3
```

### 3. Health Checks

Monitor the health endpoint regularly:

```bash
curl http://localhost:8000/api/v1/health | jq '.components.vector_store'
```

Expected healthy output:

```json
{
  "status": "healthy",
  "type": "chroma",
  "collection": "travel_instructions",
  "document_count": 1863,
  "persist_directory": "/var/www/cbthis/rag-service/chroma_db"
}
```

### 4. Database Management

Keep one canonical Chroma database:

```bash
# List all Chroma databases on system
find /var/www -name "chroma.sqlite3" 2>/dev/null

# If multiple exist, identify which has documents
sqlite3 /var/www/cbthis/rag-service/chroma_db/chroma.sqlite3 "SELECT COUNT(*) FROM embeddings"
sqlite3 /var/www/cbthis/chroma_db/chroma.sqlite3 "SELECT COUNT(*) FROM embeddings"

# Remove empty/obsolete databases
rm -rf /var/www/cbthis/chroma_db/  # The empty one
```

## Verification Checklist

When setting up or troubleshooting the RAG service:

- [ ] Configuration uses **absolute paths** for `RAG_CHROMA_PERSIST_DIRECTORY`
- [ ] Service user (`www-data`) owns the Chroma directory
- [ ] Service user has write permissions on `chroma.sqlite3` file
- [ ] Only ONE Chroma database exists in production
- [ ] Health check shows `vector_store.status: "healthy"`
- [ ] Health check shows correct `document_count` (expect ~1863 for current corpus)
- [ ] Sample query retrieves documents AND generates LLM response
- [ ] No `readonly database` errors in logs

## Testing the Fix

```bash
# Test 1: Check health
curl http://localhost:8000/api/v1/health | jq '.components.vector_store.document_count'
# Expected: 1863

# Test 2: Test retrieval
curl -X POST http://localhost:8000/api/v1/chat/stream \
  -H "Content-Type: application/json" \
  -d '{
    "message": "when am i entitled to lunch",
    "useRAG": true,
    "includeSources": true
  }' | grep -E '"type"' | head -10
# Expected: connection, metadata, retrieval_start, retrieval_complete, sources, token...
```

## Related Files

- **Configuration**: `/var/www/cbthis/rag-service/.env`
- **Service definition**: `/etc/systemd/system/rag-service.service`
- **Vector store code**: `/var/www/cbthis/rag-service/app/core/vectorstore.py`
- **Ingestion script**: `/var/www/cbthis/ingest_sources_cli.py`
- **Health endpoint**: `/var/www/cbthis/rag-service/app/api/health.py`

## Key Takeaways

1. **Relative paths are dangerous** for persistent data - they depend on working directory and can cause silent failures
2. **File permissions matter** - SQLite needs write access to create locks and transaction logs
3. **Health checks are essential** - they revealed the issue immediately but it took investigation to understand why
4. **Document state tracking** (`.ingest_state.json`) is accurate - it showed documents were successfully ingested even though the service couldn't see them
5. **Path debugging** - multiple databases can exist silently; always verify which one is active via health checks

## Future Improvements

Consider implementing:

1. Startup validation that confirms the configured Chroma path contains documents
2. Migration detection - warn if multiple Chroma databases exist
3. Automatic permission validation on service start
4. Consolidated logging of which database is being used
5. Configuration documentation that emphasizes absolute paths
