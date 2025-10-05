# RAG Improvements Log

## 2025-09-17 — Source Catalog and Ingestion Enhancements

- Tagged every chunk with stable provenance fields (`source_id`, `canonical_url`, `reference_path`) during ingestion so downstream retrieval can cite canonical documents reliably.
- Wired ingestion to persist those records into a dedicated SQLite-backed `SourceRepository`, keeping chunk-to-source and query-to-source mappings in sync without re-embedding data.
- Updated chat (sync + streaming) flows to emit canonical IDs in `Source` payloads and log the exact citations used per response for later auditing.
- Replaced the ad-hoc `/sources` API with catalog-driven endpoints, plus a helper script (`rag-service/scripts/backfill_source_catalog.py`) to backfill existing corpora.
- Added checkpoint persistence/resume support (documents + chunks), deduping against existing sources, table metadata capture for richer catalog entries, Prometheus-friendly ingestion metrics, a health check script, and a pytest harness with dummy embeddings.
