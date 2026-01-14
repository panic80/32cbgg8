# Performance Code Review & Optimization Plan

This document outlines the performance analysis of the Canadian Forces Travel Instructions Chatbot codebase, identifying critical bottlenecks and providing a roadmap for optimization.

## Executive Summary
The codebase has a clean modular structure but contains three major scalability risks:
1.  **Memory Management (Critical)**: O(N) memory growth in the RAG service.
2.  **Concurrency (High)**: Blocking synchronous I/O in the Node.js server.
3.  **UI Responsiveness (High)**: Lack of virtualization in the chat interface.

---

## 1. Algorithmic Complexity & Memory

### [CRITICAL] O(N) Memory Loading in RAG Service
- **Location**: `rag-service/app/core/vectorstore.py` -> `get_all_documents`
- **Problem**: Loads the entire Chroma corpus into a Python list to support BM25 retrieval.
- **Impact**: Space complexity is O(N). As the dataset grows (e.g., >20k chunks), the service will consume gigabytes of RAM and eventually crash with an Out-of-Memory (OOM) error.
- **Proposed Optimization**: 
    - Implement a database-backed BM25 (e.g., SQLite FTS5 or Postgres `tsvector`).
    - Use pagination for internal administrative tasks instead of full collection dumps.

### [CRITICAL] Unbounded Memory Leak in Reranker
- **Location**: `rag-service/app/components/reranker.py` -> `CrossEncoderReranker`
- **Problem**: Uses a standard Python `dict` for `self._cache` with no eviction policy.
- **Impact**: Every unique query-document pair is stored forever. Over weeks of operation, this will exhaust system memory.
- **Proposed Optimization**:
    ```python
    from cachetools import LRUCache
    self._cache = LRUCache(maxsize=10000) # Cap at 10k entries
    ```

---

## 2. I/O Operations & Concurrency

### [HIGH PRIORITY] Blocking Synchronous Logging
- **Location**: `server/services/logger.ts` -> `ChatLogger`
- **Problem**: Uses `better-sqlite3` synchronously (`.run()`) for chat history and event logs.
- **Impact**: Every log write blocks the Node.js event loop. During high concurrency or while streaming tokens, the server will experience significant latency spikes and "stuttering."
- **Proposed Optimization**:
    - Use a memory buffer and flush logs in batches every 2–5 seconds.
    - Move database writes to a separate Worker Thread or use an asynchronous SQLite driver.

### [HIGH PRIORITY] Redundant Embedding Computation
- **Location**: `rag-service/app/pipelines/parallel_ingestion.py`
- **Problem**: Computes embeddings in parallel but fails to pass the pre-computed vectors to `vector_store.add_documents`.
- **Impact**: Ingestion takes 2x longer and costs 2x more in API credits as embeddings are computed twice (once by the pipeline, once by Chroma).
- **Proposed Optimization**: Update `add_documents_optimized` to pass the `embeddings` array directly to the underlying vector store method.

---

## 3. Rendering & UI Performance

### [HIGH PRIORITY] Lack of Chat List Virtualization
- **Location**: `src/components/ChatInterface.tsx`
- **Problem**: Renders the entire message history array using `.map()`.
- **Impact**: React must process every message bubble in the DOM. In long conversations (>50 messages), the UI will freeze during message streaming as it tries to re-render the list for every token received.
- **Proposed Optimization**: Implement `react-virtuoso` or `react-window` to only render the bubbles visible in the viewport.

### [MEDIUM PRIORITY] Redundant Component Re-renders
- **Location**: `src/components/chat/ChatMessageBubble.tsx`
- **Problem**: Component is not memoized.
- **Impact**: Every token update in the "active" message causes **every historical message bubble** to re-render.
- **Proposed Optimization**: 
    ```tsx
    export const ChatMessageBubble = React.memo(ChatMessageBubbleComponent);
    ```

---

## 4. Implementation Roadmap

| Priority | Task | File |
| :--- | :--- | :--- |
| **Critical** | Implement LRUCache in Reranker | `rag-service/app/components/reranker.py` |
| **Critical** | Refactor BM25 Document Loading | `rag-service/app/core/vectorstore.py` |
| **High** | Batching/Async for ChatLogger | `server/services/logger.ts` |
| **High** | Pass pre-computed embeddings to Chroma | `rag-service/app/pipelines/parallel_ingestion.py` |
| **High** | Add Virtualization to ChatInterface | `src/components/ChatInterface.tsx` |
| **Medium** | Memoize Message Bubbles | `src/components/chat/ChatMessageBubble.tsx` |
