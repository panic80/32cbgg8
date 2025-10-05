# FIXRAG

## Ingestion Pipeline Bugs (2025-07-07)

- **High** `rag-service/app/core/vectorstore.py:173` divides by the optional `batch_size` parameter. When callers omit it (common path via `_store_documents_with_retry`), the log statement executes `i//batch_size` with `batch_size=None`, raising `TypeError` before any chunks are stored. Use the resolved `actual_batch_size` for logging.
- **High** `rag-service/app/pipelines/ingestion.py:133-137` derives `operation_id` from `int(datetime.utcnow().timestamp())`. Concurrent ingestions started within the same second collide, overwriting progress trackers and checkpoints. Use a per-request UUID or hash of request-specific data instead.
- **High** `rag-service/app/pipelines/ingestion.py:186-212` clears `documents`/`chunks` when resuming past loading or splitting. Since nothing repopulates them, the subsequent guards raise `ParsingError("No content extracted...")`, so resume always fails. Persist or reload the intermediate artifacts before skipping stages.
- **Medium** `rag-service/app/pipelines/ingestion.py:314-323` starts the progress step `embedding`, but if `OptimizedVectorStoreWriter.add_documents_optimized` raises and the code falls back to `_store_documents_with_retry`, nothing completes the step. Runs succeed yet the UI stalls at “Generating embeddings”. Complete or cancel the step in the fallback path.
