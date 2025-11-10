# RAG Service Retrieval Improvements

This upgrade plan covers the remediation steps required to make the Delegation of Authorities
documents reliably retrievable through the chat interface. The effort touches three main areas:
retriever availability, vector-store hygiene, and optional heuristic boosts.

---

## Overview

1. **Re-enable the full retriever stack**
   - Install the missing `rank_bm25` dependency inside the RAG virtual environment.
   - Patch `MultiQueryRetriever` wiring so it is supplied with a fully constructed `llm_chain`
     and parser key. This prevents the validation errors currently disabling multi-query
     expansion.

2. **Cull duplicate documents**
   - The Delegation of Authorities PDF exists under several document IDs
     (`doc_2216…`, `doc_8930…`, `doc_cee2…`, `doc_420…`). Remove the stale copies to stop
     duplicate chunks from dominating the top-k results, then re-ingest a single canonical
     copy.

3. **(Optional) tighten ranking heuristics**
   - Detect queries that explicitly reference a column number (e.g., “column 15”) and guarantee
     that any chunk containing that exact string is present in the final retrieval context.

---

## Detailed Plan

### Preparation & Baseline

- [ ] Capture current dependency snapshot from `rag-service/venv`  
      `pip freeze > requirements.current.txt`
- [ ] Record baseline `/api/v1/streaming_chat` output for the “column 15” question.
- [ ] List current Chroma document IDs associated with the Delegation PDF.

### Task 1 – Enable Missing Retrievers

- [ ] Install `rank_bm25` inside the `rag-service` virtual environment.
- [ ] Update project requirements (if tracked) to include `rank_bm25`.
- [ ] Audit `retriever_factory.py` and supporting components so `MultiQueryRetriever`
      receives a valid `llm_chain` and parser key on initialization.
- [ ] Run the pipeline creation path to confirm:
      - No ImportError for BM25.
      - Multi-query retriever initializes successfully.
      - Logs reflect BM25/multi-query participation.
- [ ] Document the dependency + code changes (e.g., in README/CHANGELOG).

### Task 2 – Cull Duplicate Documents

- [ ] Decide approach: full `/api/v1/database/purge` followed by re-ingestion, or selective
      deletes.
- [ ] Export the current doc-ID list for audit purposes.
- [ ] Execute the purge/delete operation and verify the Chroma collection is empty afterward.
- [ ] Re-ingest the canonical PDF (and any other required docs) with `force_refresh=true`.
- [ ] Confirm auxiliary indexes (BM25, co-occurrence) are refreshed automatically or rebuild if
      necessary.
- [ ] Validate that only one document ID exists for the Delegation PDF in Chroma.

### Task 3 – Optional Ranking Heuristic

- [ ] Implement query-inspection logic to detect “column <number>” patterns.
- [ ] Add a lightweight post-filter/boost in `ResultProcessor` or `_process_retrieval_results`
      that ensures matching chunks survive deduplication.
- [ ] Gate the heuristic behind a config flag or clearly document the behaviour.
- [ ] Add targeted tests (or scripts) verifying the heuristic works and does not regress other
      scenarios.

### Verification & QA

- [ ] Re-run `/api/v1/streaming_chat` for the “column 15” query; ensure the response cites the
      correct chunk.
- [ ] Check logs to confirm BM25 and multi-query retrievers are active without errors.
- [ ] Verify no duplicate Delegation PDF IDs remain in Chroma.
- [ ] Regression-test an unrelated query to confirm overall behaviour is intact.
- [ ] Update any relevant documentation/changelog entries.

### Finalization

- [ ] Commit code and dependency updates.
- [ ] Share the new verification steps and outcomes with the team.

---

## Implementation Notes

- Running retriever-pipeline tests after each major change is recommended to catch regressions
  early.
- When purging and re-ingesting, remember to clear any caching layers (Redis/embedding cache)
  to avoid stale metadata.
- The optional ranking heuristic should remain configurable so it can be toggled off if it
  interferes with unrelated workflows.

