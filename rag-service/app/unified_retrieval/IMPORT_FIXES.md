# Unified Retrieval System Import Fixes

This document summarizes the import issues that were fixed in the unified retrieval system.

## Fixed Issues

### 1. Missing Helper Functions
- **Problem**: The code was trying to import `get_vectorstore` and `get_embeddings` from modules that didn't export these functions
- **Solution**: Created `app/core/dependencies.py` module that provides these helper functions as singletons

### 2. LLM Pool Import
- **Problem**: Import error for `get_llm_from_pool` in `unified_retriever.py`
- **Solution**: Already fixed - changed to correct import from `app.services.llm_pool`

### 3. Old LangChain Imports
- **Problem**: Using deprecated imports like `from langchain.schema import Document`
- **Solution**: Updated to new imports:
  - `from langchain_core.documents import Document`
  - `from langchain_core.messages import BaseMessage`
  - `from langchain_core.embeddings import Embeddings`

### 4. Context Type Mismatch
- **Problem**: `enhanced_strategies.py` was using `StrategyContext` instead of `RetrievalContext`
- **Solution**: Replaced all occurrences of `StrategyContext` with `RetrievalContext`

### 5. Enhanced Strategies Dependencies
- **Problem**: Enhanced strategies depend on `spacy` which isn't installed
- **Solution**: Temporarily disabled enhanced strategies import in `__init__.py` until dependencies are installed

### 6. Parallel Retrieval Import
- **Problem**: UnifiedRetriever import was commented out in `parallel_retrieval.py`
- **Solution**: Re-enabled the import

## Available Strategies

The following strategies are now properly imported and available:

### Retrieval Strategies
- `VectorRetrievalStrategy`
- `BM25RetrievalStrategy`
- `HybridRetrievalStrategy`
- `ParentDocumentStrategy`

### Query Enhancement Strategies
- `MultiQueryStrategy`
- `SelfQueryStrategy`
- `QueryExpansionStrategy`
- `AbbreviationExpansionStrategy`

### Filtering Strategies
- `ContextAwareFilterStrategy`
- `RestrictionAwareFilterStrategy`
- `ClassAFilterStrategy`
- `MetadataFilterStrategy`

### Scoring Strategies
- `ContentBoostStrategy`
- `AuthorityBoostStrategy`
- `CooccurrenceScoreStrategy`
- `HybridScoreStrategy`

## Next Steps

To fully enable the enhanced strategies:
1. Install missing dependencies: `pip install spacy`
2. Download spacy language model: `python -m spacy download en_core_web_sm`
3. Uncomment the enhanced strategies import in `app/unified_retrieval/strategies/__init__.py`