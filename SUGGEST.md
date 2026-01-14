# Retrieval Optimization Suggestions

Based on the analysis of the `rag-service` architecture (production-grade RAG with hybrid search, RRF, and cross-encoder reranking), the following optimizations are recommended to improve latency, precision, and data freshness.

## 1. Optimize Embedding Dimensions (Latency & Memory)

**Current:** `text-embedding-3-large` at **3072** dimensions.
**Recommendation:** Truncate to **1024** dimensions.

- **Why:** OpenAI's models support Matryoshka Representation Learning, allowing dimension reduction with negligible accuracy loss (~99% retention).
- **Benefit:**
  - **3x Faster** vector similarity calculations.
  - **66% Reduction** in vector database storage and memory usage.
  - Critical optimization for running on limited resources (2-core VPS).
- **Action:** Update `openai_embedding_dimensions` in `app/core/config.py`.

## 2. Fix "Offline" BM25 with Hybrid Strategy (Freshness)

**Current:** Incremental BM25 updates are disabled in `ingestion.py` to prevent OOM errors, meaning new documents are not keyword-searchable until a full rebuild.
**Recommendation:** Implement "Small-Index" Incremental Updates.

- **Why:** Full index rebuilds are too heavy for real-time ingestion.
- **How:**
  - Maintain a tiny, temporary "Fresh BM25 Index" for the current batch of new documents.
  - At query time, search both `Main_BM25` and `Fresh_BM25` and merge results.
  - Trigger a background merge only when the fresh index grows beyond a threshold (e.g., 100 docs).

## 3. Implement "Small-to-Big" Retrieval (Precision)

**Current:** Chunks are **1024 tokens**. Specific values (e.g., "$50.00") are diluted in large blocks of text.
**Recommendation:** Adopt Parent Document Retrieval.

- **Why:** Embedding vectors for large chunks become "muddy," leading to poor retrieval of specific rules.
- **How:**
  - **Index Small:** Create "Child Chunks" of ~256 tokens to capture specific rules precise semantic meaning.
  - **Retrieve Big:** When a child chunk is a hit, return its **Parent Chunk** (1024 tokens) to the LLM.
  - Ensures the LLM gets full context (exceptions, dates) while search remains precise.

## 4. Upgrade Reranking Model (Quality)

**Current:** `cross-encoder/ms-marco-MiniLM-L-6-v2` (2021 model, web-search focused).
**Recommendation:** Upgrade to `BAAI/bge-reranker-v2-m3` (or `v2-m3`).

- **Why:**
  - **Multilingual:** Handles English/French content natively (crucial for Canadian gov docs).
  - **Nuance:** Significantly better at distinguishing fine-grained policy details than the older MiniLM.
  - **Context:** Supports longer context windows (8192 tokens vs 512).

## 5. Dynamic BM25 Boosting for "Rate" Queries (Accuracy)

**Current:** Static BM25 weight (~0.3).
**Recommendation:** Dynamically boost BM25 weight to **0.6+** for queries containing specific tokens.

- **Trigger Tokens:** "rate", "$", "allowance", "per diem", numbers.
- **Why:** Vector embeddings capture _meaning_ (semantics), not _exact values_. "Rate is $50" and "Rate is $55" have nearly identical vectors.
- **Benefit:** Forces the engine to prioritize documents containing the **exact** numbers or rate codes requested by the user, reducing hallucination of values.

## 6. Increase Retrieval Fetch Depth (Recall)

**Current:** `retrieval_fetch_k` is **40**.
**Recommendation:** Increase to **60+**.

- **Why:** Reciprocal Rank Fusion (RRF) works best when it has a deep pool of candidates to find consensus between sparse (BM25) and dense (Vector) retrievers.
- **Benefit:** Increases the likelihood of finding the "correct" document that might have been ranked slightly lower by one method but high by the other.
