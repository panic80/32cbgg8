# Successful Ingestion & Retrieval: Lessons Learned

This note captures the exact steps (and supporting context) that got the Delegation of Authorities
documents ingested cleanly and retrievable via the chat interface, along with the issues we hit on
the way. Keep this around as the playbook for future runs.

---

## 1. Environment & Dependency Readiness

1. Activated the RAG virtual environment and installed the missing lexical dependency:
   ```bash
   cd /var/www/cbthis/rag-service
   source venv/bin/activate
   pip install rank_bm25
   ```
   `rank_bm25` allows the BM25 retriever to come online instead of silently failing.

2. Updated `requirements.txt` (and noted the new package) so the dependency is persisted.

3. Patched `app/components/multi_query_retriever.py` to align with the current LangChain API:
   - Constructed the `llm_chain` manually (`prompt | llm | parser`).
   - Passed callback managers explicitly (`AsyncCallbackManagerForRetrieverRun` for async, noop
     fallback otherwise).
   - Made sure cached query generation and dedup logic still works.

4. Added a query-sensitive “column” boost in `_process_retrieval_results` so any chunk containing
   a literal `column XX` survives deduplication and gets added to the final context. When no such
   chunk appears in the initial results, the helper issues a targeted search via the vector store to
   grab the matching chunk.

5. Restarted uvicorn manually (systemd/pm2 aren’t managing this instance):
   ```bash
   # ensure port 8000 is free
   sudo lsof -i:8000
   sudo kill <pids>

   cd /var/www/cbthis/rag-service
   source venv/bin/activate
   set -a && source /etc/cbthis/rag-env && set +a
   nohup uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 2 \
     >/var/log/cbthis/rag-service.log 2>&1 &
   ```
   The health check at `http://localhost:8000/api/v1/health` confirmed the service came back up.

---

## 2. Vector Store Hygiene (Duplicate Cleanup)

1. Used the admin token to purge the existing Chroma collection:
   ```bash
   export ADMIN_API_TOKEN='…'
   curl -X POST http://localhost:8000/api/v1/database/purge \
     -H "Authorization: Bearer $ADMIN_API_TOKEN"
   ```
   After purging, `document_count` dropped to zero.

2. Re-ingested the canonical Delegation of Authorities PDF:
   ```bash
   curl -X POST http://localhost:8000/api/v1/ingest \
     -H "Authorization: Bearer $ADMIN_API_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"file_path":"/var/www/cbthis/delegation-of-authorities-for-financial-administration-for-dnd-caf (1).pdf",
          "type":"pdf","force_refresh":true,
          "metadata":{"source":"dnd/delegation-of-authorities/financial-administration",
                      "original_filename":"delegation-of-authorities-for-financial-administration-for-dnd-caf.pdf"}}'
   ```
   Result: `doc_0993bcab5e05` with 424 chunks.

3. Re-ingested the Delegation of Authorities Matrix:
   ```bash
   curl -X POST http://localhost:8000/api/v1/ingest \
     -H "Authorization: Bearer $ADMIN_API_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"file_path":"/var/www/cbthis/delegation-of-authorities-matrix.pdf",
          "type":"pdf","force_refresh":true,
          "metadata":{"source":"dnd/delegation-of-authorities/matrix",
                      "original_filename":"delegation-of-authorities-matrix.pdf"}}'
   ```
   Result: `doc_8d2192bdc887` with 132 chunks.

4. Verified there were exactly two document prefixes left in Chroma:
   ```python
   prefixes = {'doc_0993bcab5e05': 424, 'doc_8d2192bdc887': 132}
   ```

---

## 3. Retrieval Verification

1. Direct vector-store sanity check (works inside the venv with env vars exported):
   ```python
   results = await vsm.search("column 15 Delegation Matrix", k=5)
   # top result: doc_0993bcab5e05_chunk_85 (contains the Column 15 authority text)
   ```

2. Exercised the pipeline via the app:
   ```python
   pipeline = await create_parallel_pipeline(...)
   stats = pipeline.parallel_pipeline.get_retriever_stats()
   # => retrievers include vector, MMR, bm25, multi_query, unified
   ```

3. Confirmed `_process_retrieval_results` returns the Column 15 chunk even if it wasn’t in the
   original top-k:
   ```python
   context, sources = await _process_retrieval_results(..., vector_store_manager=vsm)
   # first source id now includes doc_0993bcab5e05_chunk_85
   ```

4. Curling the streaming endpoint still returns `Streaming temporarily unavailable`. Root cause:
   `_run_streaming_flow` references `vector_store_manager` before it’s defined. This needs a follow-up
   fix (not covered here), but the underlying retrievers now produce the correct sources once that
   bug is resolved.

---

## 4. Gotchas & Follow-ups

- Restarting the RAG service must be done manually; neither pm2 nor systemd is supervising it in
  this environment. Use the `nohup uvicorn …` snippet above, and double-check port 8000 first.
- Redis auth errors in logs are expected unless the cached checkpoints need to be written; they’re
  harmless for standard retrieval.
- The streaming endpoint currently surfaces `"Streaming temporarily unavailable"` because of the
  `vector_store_manager` NameError in `_run_streaming_flow`. Fixing that (or adding a guard) should
  allow the frontend to render the Column 15 answer without error.
- With the new column-aware heuristic, if we ingest other policies that rely heavily on numbered
  columns, the mechanism should pick those chunks up automatically, but keep in mind it matches
  simple `column <digits>` literals (no fuzzy matching or roman numerals yet).

---

## Quick Reference Commands

```bash
# Purge Chroma and re-ingest both PDFs
export ADMIN_API_TOKEN='...'
curl -X POST http://localhost:8000/api/v1/database/purge \
  -H "Authorization: Bearer $ADMIN_API_TOKEN"
curl -X POST http://localhost:8000/api/v1/ingest ...delegation-of-authorities-for-financial...
curl -X POST http://localhost:8000/api/v1/ingest ...delegation-of-authorities-matrix...

# Restart RAG service (plain uvicorn)
sudo kill $(pgrep -f 'uvicorn app.main:app')
cd /var/www/cbthis/rag-service
source venv/bin/activate
set -a && source /etc/cbthis/rag-env && set +a
nohup uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 2 \
  >/var/log/cbthis/rag-service.log 2>&1 &
```

Use this guide as the canonical playbook for future ingestion or retrieval regressions involving
the Delegation of Authorities content. It captures not only the working commands but also the
reasoning behind each change so we can avoid rediscovering the pitfalls.

