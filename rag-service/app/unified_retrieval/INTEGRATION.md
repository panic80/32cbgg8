# Unified Retrieval Integration Guide

This document describes how the unified retrieval system has been integrated with the existing RAG pipeline.

## Overview

The unified retrieval system is now fully integrated as an opt-in feature that maintains complete backward compatibility with existing code. It can be enabled at multiple levels and provides a more flexible and extensible approach to document retrieval.

## Integration Points

### 1. Retriever Factory (`app/pipelines/retriever_factory.py`)

Added support for `RetrieverMode.UNIFIED`:

```python
# Create a unified retriever
config = RetrieverConfig(
    mode=RetrieverMode.UNIFIED,
    k=10,
    unified_config={
        "pipeline_config": {...}  # Or use a named config
    }
)
retriever = factory.create_retriever(config)
```

The factory now:
- Recognizes `UNIFIED` as a retriever mode
- Creates UnifiedRetriever instances with proper configuration
- Maps legacy configurations to unified format when needed
- Adds fallback retrievers for reliability

### 2. Parallel Retrieval (`app/pipelines/parallel_retrieval.py`)

Enhanced to support UnifiedRetriever:

```python
# Create parallel pipeline with unified retriever
pipeline = create_parallel_pipeline(
    vector_store_manager=vsm,
    llm=llm,
    enable_unified=True  # Enables unified retriever
)
```

Updates include:
- Special handling for UnifiedRetriever's `top_k` parameter
- Metrics collection from unified retrievers
- Proper weight assignment in ensemble

### 3. Streaming Chat Endpoint (`app/api/streaming_chat.py`)

Added unified retrieval support:

```python
# In chat request
chat_request = ChatRequest(
    message="...",
    use_rag=True,
    enable_unified_retrieval=True  # New optional field
)
```

The endpoint:
- Checks for `enable_unified_retrieval` flag
- Passes configuration to parallel pipeline
- Maintains all existing functionality

### 4. Configuration (`app/core/config.py`)

New configuration options:

```python
# Environment variables
RAG_ENABLE_UNIFIED_RETRIEVAL=false  # Opt-in feature
RAG_UNIFIED_RETRIEVAL_MODE=balanced  # simple, balanced, or advanced
RAG_UNIFIED_RETRIEVAL_CACHE_TTL=3600
RAG_UNIFIED_RETRIEVAL_FALLBACK=true
```

## Migration Utilities (`app/unified_retrieval/migration.py`)

Provides tools for migrating existing configurations:

### LegacyConfigMapper

Maps existing retriever configurations to unified format:

```python
mapper = LegacyConfigMapper(
    vectorstore=vectorstore,
    llm=llm,
    embeddings=embeddings,
    all_documents=documents
)

# Convert legacy config
unified_retriever = mapper.map_retriever_config(legacy_config)
```

### Configuration Helpers

```python
# Validate configurations
validate_unified_config(config_dict)

# Create example configs
config = create_example_unified_config("balanced")
```

## Configuration Loading (`app/unified_retrieval/config/loader.py`)

Flexible configuration management:

```python
# Load from predefined configs
retriever = load_unified_retriever("balanced")

# Or with overrides
retriever = load_unified_retriever(
    "advanced",
    cache_ttl=7200,
    enable_caching=True
)
```

## Usage Examples

### 1. Enable via Factory

```python
from app.pipelines.retriever_factory import HybridRetrieverFactory, RetrieverConfig, RetrieverMode

config = RetrieverConfig(
    mode=RetrieverMode.UNIFIED,
    unified_config=create_example_unified_config("balanced")
)

factory = HybridRetrieverFactory(vectorstore, llm, embeddings)
retriever = factory.create_retriever(config)
```

### 2. Enable in Parallel Pipeline

```python
pipeline = create_parallel_pipeline(
    vector_store_manager,
    llm,
    enable_unified=True
)

results = await pipeline.retrieve(query, k=10)
```

### 3. Enable in API Request

```json
POST /api/v1/streaming_chat
{
    "message": "What are the meal allowances?",
    "use_rag": true,
    "enable_unified_retrieval": true,
    "provider": "openai",
    "model": "gpt-4"
}
```

### 4. Enable via Environment

```bash
export RAG_ENABLE_UNIFIED_RETRIEVAL=true
export RAG_UNIFIED_RETRIEVAL_MODE=advanced
```

## Available Configurations

Pre-built configurations in `unified_examples.yaml`:

- **simple**: Basic vector similarity search
- **balanced**: Query enhancement + parallel retrieval + scoring
- **advanced**: Full pipeline with all features
- **table_focused**: Optimized for table/rate queries
- **custom_travel_planning**: Specialized for trip planning

## Backward Compatibility

The integration maintains full backward compatibility:

1. **Default behavior unchanged**: Unified retrieval is opt-in
2. **Existing APIs work**: No changes to existing retriever configurations
3. **Gradual migration**: Can run unified and legacy retrievers side-by-side
4. **Fallback support**: Unified retrievers can fall back to legacy ones

## Performance Considerations

1. **Caching**: Unified retrievers include built-in caching
2. **Parallel execution**: Strategies can run in parallel groups
3. **Metrics**: Detailed metrics for monitoring and optimization
4. **Circuit breaking**: Handled by existing parallel pipeline

## Next Steps

To use unified retrieval in production:

1. Enable via environment variable or request parameter
2. Monitor metrics to compare with existing retrievers
3. Adjust configuration based on performance
4. Gradually increase usage as confidence grows

## Troubleshooting

If unified retrieval fails:
1. Check logs for strategy-specific errors
2. Verify all required components are initialized
3. Use fallback retrievers for reliability
4. Review configuration for missing strategies