# Unified Retrieval Framework

A flexible, extensible retrieval framework for RAG systems that unifies various retrieval patterns through a configurable strategy pipeline.

## Overview

The Unified Retrieval Framework provides:

- **Strategy Pipeline Pattern**: Compose retrieval pipelines from modular strategies
- **Extensible Architecture**: Easy to add new retrieval strategies via plugins
- **Configuration-Driven**: Define retrievers through YAML/JSON configuration
- **Performance Monitoring**: Built-in metrics and performance tracking
- **Backward Compatible**: Works alongside existing retrievers

## Architecture

### Core Components

1. **UnifiedRetriever**: Main retriever class that orchestrates strategy execution
2. **RetrievalContext**: Shared context passed between strategies
3. **BaseStrategy**: Abstract base for all retrieval strategies
4. **StrategyPipeline**: Orchestrates sequential and parallel strategy execution
5. **Plugin System**: Dynamic loading of custom strategies

### Strategy Types

- **Query Enhancement**: Modify/expand queries before retrieval
- **Filtering**: Apply metadata or content filters
- **Retrieval**: Core document retrieval from various sources
- **Scoring**: Score and re-rank retrieved documents
- **Reranking**: Advanced re-ranking using ML models
- **Post-Processing**: Final processing like citation extraction

## Usage

### Basic Example

```python
from app.unified_retrieval import UnifiedRetrieverBuilder
from app.unified_retrieval.strategies.retrieval import VectorStoreStrategy

# Create a simple semantic retriever
retriever = UnifiedRetrieverBuilder.create_simple_retriever(
    name="my_retriever",
    retrieval_strategy=VectorStoreStrategy(
        vector_stores=[{
            "type": "chroma",
            "collection_name": "documents"
        }]
    )
)

# Use the retriever
docs = await retriever.aget_relevant_documents("What is travel policy?")
```

### Configuration-Based Setup

```python
from app.unified_retrieval import UnifiedRetrieverConfig, UnifiedRetrieverBuilder

# Load configuration
config = UnifiedRetrieverConfig(
    name="production_retriever",
    preset="hybrid",
    strategy_preset="full_pipeline",
    vector_stores=[{
        "type": "chroma",
        "collection_name": "documents"
    }],
    query_enhancement={
        "method": "llm_expansion",
        "expand_acronyms": True
    }
)

# Build retriever from config
retriever = UnifiedRetrieverBuilder.from_config(config.to_retriever_config())
```

### Custom Strategy

```python
from app.unified_retrieval import BaseStrategy, StrategyType, RetrievalContext

class CustomFilterStrategy(BaseStrategy):
    def __init__(self, **kwargs):
        super().__init__(
            strategy_type=StrategyType.FILTERING,
            name="custom_filter",
            required_inputs=["documents"],
            **kwargs
        )

    async def execute(self, context: RetrievalContext) -> RetrievalContext:
        # Custom filtering logic
        filtered_docs = [
            doc for doc in context.documents
            if self._custom_filter(doc)
        ]
        context.documents = filtered_docs
        return context
```

### Plugin Development

```python
from app.unified_retrieval import BasePlugin

class MyRetrievalPlugin(BasePlugin):
    def __init__(self):
        super().__init__(
            name="my_plugin",
            version="1.0.0",
            description="Custom retrieval strategies",
            strategies={
                "CustomFilter": CustomFilterStrategy,
                "CustomScorer": CustomScorerStrategy
            }
        )

# Register the plugin
from app.unified_retrieval import register_plugin
register_plugin(MyRetrievalPlugin())
```

## Configuration Schema

### Retriever Configuration

```yaml
name: 'my_retriever'
description: 'Description of the retriever'
preset: 'semantic' # simple, semantic, hybrid, multi_query, contextual, citation, custom
strategy_preset: 'full_pipeline' # basic, enhanced_query, filtered, scored, full_pipeline

# Vector store configuration
vector_stores:
  - type: 'chroma'
    collection_name: 'documents'
    embedding_model: 'text-embedding-ada-002'
    connection_params:
      host: 'localhost'
      port: 8000

# Strategy configurations
query_enhancement:
  method: 'llm_expansion'
  expand_acronyms: true
  add_synonyms: true
  language_model: 'gpt-3.5-turbo'

filtering:
  metadata_filters:
    status: 'active'
    language: 'en'
  date_range:
    start: '2023-01-01'
    end: '2024-12-31'

scoring:
  method: 'similarity'
  weights:
    similarity: 0.8
    recency: 0.2
  threshold: 0.5

# Performance settings
top_k: 10
timeout: 30
max_retries: 3

# Caching
cache:
  enabled: true
  ttl: 3600
  backend: 'memory' # or "redis"

# Monitoring
monitoring:
  enabled: true
  log_level: 'INFO'
  performance_tracking: true
```

### Pipeline Configuration

```yaml
name: 'custom_pipeline'
strategies:
  - strategy_class: 'app.unified_retrieval.strategies.query.QueryEnhancementStrategy'
    strategy_type: 'query_enhancement'
    enabled: true
    order: 1
    config:
      method: 'llm_expansion'

  - strategy_class: 'app.unified_retrieval.strategies.retrieval.VectorStoreStrategy'
    strategy_type: 'retrieval'
    enabled: true
    order: 2
    parallel_group: 'retrieval_group'
    config:
      top_k: 20

  - strategy_class: 'app.unified_retrieval.strategies.retrieval.BM25Strategy'
    strategy_type: 'retrieval'
    enabled: true
    order: 2
    parallel_group: 'retrieval_group'
    config:
      index_name: 'bm25_index'
```

## Migration Guide

### From Existing Retrievers

1. **Identify retriever type and configuration**
2. **Map to appropriate preset or create custom configuration**
3. **Test with fallback enabled**
4. **Gradually migrate traffic**

Example migration:

```python
# Old retriever
from app.retrievers.semantic import SemanticSearchRetriever
old_retriever = SemanticSearchRetriever(collection_name="docs")

# New unified retriever
from app.unified_retrieval import UnifiedRetrieverBuilder
new_retriever = UnifiedRetrieverBuilder.create_simple_retriever(
    name="migrated_semantic",
    retrieval_strategy=VectorStoreStrategy(
        vector_stores=[{
            "type": "chroma",
            "collection_name": "docs"
        }]
    ),
    fallback_retriever=old_retriever  # Use old retriever as fallback
)
```

## Performance Considerations

- **Strategy Order**: Place filtering strategies early to reduce document count
- **Parallel Execution**: Use parallel groups for independent strategies
- **Caching**: Enable caching for frequently used queries
- **Monitoring**: Track strategy timings to identify bottlenecks

## Best Practices

1. **Start Simple**: Begin with basic configurations and add complexity as needed
2. **Monitor Performance**: Use built-in metrics to track retriever performance
3. **Test Strategies**: Test individual strategies before combining
4. **Use Presets**: Leverage configuration presets for common patterns
5. **Document Custom Strategies**: Clearly document any custom strategy behavior

## Future Enhancements

- [ ] GraphQL configuration API
- [ ] Strategy marketplace for sharing custom strategies
- [ ] Auto-optimization based on query patterns
- [ ] A/B testing framework for strategy configurations
- [ ] Integration with LangSmith for debugging
