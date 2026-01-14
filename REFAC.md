# Code Refactoring Roadmap

This document outlines identified code smells, recommended design patterns, and a step-by-step guide for refactoring the RAG Service and Express Backend.

## 1. Code Smells & Architectural Issues

### A. Monolithic Pipeline (`EnhancedRetrievalPipeline`)

- **Issue**: The class handles graph definition, node logic, LLM interaction, and serialization.
- **Smell**: Single Responsibility Principle (SRP) violation.
- **Impact**: Hard to unit test individual retrieval steps; high cognitive load for maintainers.

### B. "God Method" Lifespan (`rag-service/app/main.py`)

- **Issue**: The FastAPI `lifespan` handles logging, container setup, legacy patching, and background tasks.
- **Smell**: Mixed levels of abstraction.
- **Impact**: Brittle startup logic; difficult to test application bootstrapping.

### C. Fat Controllers (`server/controllers/ingestionController.js`)

- **Issue**: Controllers contain HTTP retry logic, deep validation, and upstream error mapping.
- **Smell**: Feature Envy / Missing Service Layer.
- **Impact**: Duplicated logic for retries; tight coupling between controllers and the RAG API.

---

## 2. Proposed Design Patterns

| Pattern                  | Target                      | Benefit                                                       |
| :----------------------- | :-------------------------- | :------------------------------------------------------------ |
| **Builder**              | `EnhancedRetrievalPipeline` | Separates graph construction from node implementation.        |
| **Service Layer**        | Express Controllers         | Centralizes business logic and upstream API communication.    |
| **Prompt Repository**    | Retrieval Prompts           | Decouples prompt tuning from Python code changes.             |
| **Dependency Injection** | FastAPI Container           | Properly manages service lifetimes without `app.state` hacks. |

---

## 3. High-Impact Refactorings

### Task 1: Decompose the Retrieval Pipeline

**File**: `rag-service/app/pipelines/enhanced_retrieval.py`

1.  **Extract Nodes**: Create `app/pipelines/nodes/retrieval_nodes.py`. Move `_understand_query`, `_expand_query`, etc., into this class.
2.  **Separate Prompts**: Move hardcoded strings to `app/core/prompts/retrieval.py`.
3.  **Graph Builder**: Create `app/pipelines/builders/enhanced_graph.py` to define the LangGraph edges and nodes.
4.  **Result**: `EnhancedRetrievalPipeline` becomes a lightweight executor.

### Task 2: Implement Express Service Layer

**File**: `server/controllers/ingestionController.js`

1.  **Create `RagService`**: Extract `postWithRetry` and `prepareHeaders` into `server/services/RagService.js`.
2.  **Simplify Controller**: Update `handleIngest` to simply call `RagService.ingest(data)`.
3.  **Centralize Error Handling**: Use an Express error-handling middleware to map RAG errors to client responses.

### Task 3: Refactor FastAPI Entry Point

**File**: `rag-service/app/main.py`

1.  **Factory Pattern**: Create `app/core/app_factory.py` with a `create_app()` function.
2.  **Lifecycle Manager**: Move initialization logic to `app/core/lifecycle.py`.
3.  **Clean Dependencies**: Use FastAPI's native `Depends` for service access instead of `app.state`.

---

## 4. Implementation Strategy

### Phase 1: Preparation (Low Risk)

- [ ] Move constants to `config` or `constants` modules.
- [ ] Extract prompts to a dedicated `prompts.py` file.
- [ ] Add unit tests for existing "fat" methods before splitting them.

### Phase 2: Structural Refactoring (Medium Risk)

- [ ] Implement the `RagService` in the Express backend.
- [ ] Split `EnhancedRetrievalPipeline` into Nodes and Graph definition.
- [ ] Migrate one controller at a time to use the new service layer.

### Phase 3: Modernization (High Risk)

- [ ] Switch to the App Factory pattern in FastAPI.
- [ ] Remove `app.state` legacy patches.
- [ ] Implement centralized error middleware.

---

## 5. Verification Plan

1.  **Pre-Refactor**: Run `npm test` and `pytest` to establish a baseline.
2.  **Continuous Testing**: Run specific unit tests for extracted nodes/services immediately after extraction.
3.  **Integration Check**: Verify the `health` endpoints and a sample RAG query through the UI.
4.  **Performance**: Monitor `X-Process-Time` headers to ensure refactoring didn't introduce latency.
