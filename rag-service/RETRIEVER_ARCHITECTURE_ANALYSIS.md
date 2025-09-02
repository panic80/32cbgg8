# RAG Service Retriever Architecture Analysis

## Executive Summary

The current RAG service implements a sophisticated multi-retriever architecture with 9 specialized retrievers, orchestrated through factory and parallel execution patterns. The system demonstrates good separation of concerns but has opportunities for further abstraction through the Strategy pattern.

## Current Retriever Inventory

### 1. **Multi-Query Retriever** (`multi_query_retriever.py`)
- **Purpose**: Generates multiple query variations to improve retrieval coverage
- **Key Features**:
  - Query expansion using LLM
  - Domain-specific prompt templates
  - Query caching with TTL
  - PMV-specific query enhancement
  - Deduplication by content hash and document ID

### 2. **Self-Query Retriever** (`self_query_retriever.py`)
- **Purpose**: Natural language to metadata filter conversion
- **Key Features**:
  - Structured query parsing
  - Travel document metadata schema (9 attributes)
  - Date range queries
  - Fallback to vector search on parse failure
  - Enhanced version with query examples

### 3. **BM25 Retriever** (`bm25_retriever.py`)
- **Purpose**: Keyword-based retrieval using BM25 algorithm
- **Key Features**:
  - Travel-specific query preprocessing
  - Abbreviation expansion
  - Keyword variation generation
  - Document index updates
  - Async wrapper for sync operations

### 4. **Ensemble Retriever** (`ensemble_retriever.py`)
- **Purpose**: Combines multiple retrieval strategies with weighted scoring
- **Key Features**:
  - Extends LangChain's EnsembleRetriever
  - Content-based boosting with regex patterns
  - Multiple reranking strategies
  - Weighted fusion of results
  - Round-robin and score-based merging

### 5. **Co-occurrence Retriever** (`cooccurrence_retriever.py`)
- **Purpose**: Concept-based retrieval using co-occurrence patterns
- **Key Features**:
  - Custom co-occurrence index
  - Travel-specific concept extraction
  - Query concept expansion
  - Persistent index storage
  - Value extraction (amounts, percentages, distances)

### 6. **Restriction-Aware Retriever** (`restriction_aware_retriever.py`)
- **Purpose**: Prioritizes documents with restrictions and limitations
- **Key Features**:
  - Restriction keyword scoring
  - Distance pattern detection
  - Class designation awareness
  - PMV/vehicle restriction boosting
  - Query enhancement for restriction context

### 7. **Contextual Compressor** (`contextual_compressor.py`)
- **Purpose**: Filters and extracts relevant content portions
- **Key Features**:
  - Multiple compression modes (extractive, filter, hybrid, embeddings-only)
  - Query-specific threshold adjustment
  - LLM-based extraction and filtering
  - Adaptive mode selection
  - Query-aware compression strategies

### 8. **Parent Document Retriever** (`parent_document_retriever.py`)
- **Purpose**: Returns full parent documents when child chunks match
- **Key Features**:
  - Parent-child document indexing
  - Natural break point chunking
  - Relevance score propagation
  - Fallback to child documents
  - Index persistence

### 9. **Class A Retriever** (`class_a_retriever.py`)
- **Purpose**: Specialized for Class A Reservist content
- **Key Features**:
  - Class A keyword boosting
  - Query enhancement with reservist context
  - Metadata tagging for relevance
  - Multi-level scoring boost

## Common Patterns Identified

### 1. **Query Enhancement Patterns**
- Multi-query expansion (Multi-Query Retriever)
- Domain-specific query preprocessing (BM25)
- Context injection (Class A, Restriction-Aware)
- Abbreviation expansion (BM25)

### 2. **Filtering Patterns**
- Metadata-based filtering (Self-Query)
- Content-based filtering (Contextual Compressor)
- Restriction-aware filtering (Restriction-Aware)
- Class-specific filtering (Class A)

### 3. **Scoring/Boosting Patterns**
- Content regex boosting (Ensemble)
- Keyword presence boosting (Class A, Restriction-Aware)
- Position-based scoring (Ensemble)
- Co-occurrence scoring (Co-occurrence)
- Multi-factor scoring (Restriction-Aware)

### 4. **Retrieval Methods**
- Vector similarity search (base for most)
- BM25 keyword search (BM25)
- MMR diversity search (factory creates)
- Hybrid search (Ensemble)
- Concept-based search (Co-occurrence)

### 5. **Result Processing Patterns**
- Deduplication (Multi-Query, Ensemble)
- Parent document resolution (Parent Document)
- Compression/extraction (Contextual Compressor)
- Score-based reranking (multiple retrievers)

## Unique Behaviors by Retriever

### Multi-Query Retriever
- LLM-powered query generation with caching
- Original query inclusion option
- Query-specific metadata tracking

### Self-Query Retriever
- Structured attribute extraction from natural language
- Temporal context inference
- Post-processing based on query intent

### Co-occurrence Retriever
- Graph-based concept relationships
- Persistent index management
- Value extraction and indexing

### Parent Document Retriever
- Hierarchical document management
- Smart chunking with natural boundaries
- Bidirectional parent-child mapping

### Contextual Compressor
- Multi-stage compression pipeline
- Dynamic mode selection based on query type
- Adaptive threshold adjustment

## Factory Pattern Analysis (`retriever_factory.py`)

### Key Components:
1. **RetrieverMode Enum**: SIMPLE, HYBRID, ADVANCED, CUSTOM
2. **RetrieverConfig**: Comprehensive configuration with 11 parameters
3. **HybridRetrieverFactory**: 
   - Creates retrievers from config or dict
   - Manages ensemble weights
   - Handles component failures gracefully
   - Supports profiling

### Factory Capabilities:
- Mode-based retriever creation
- Dynamic ensemble construction
- Component fallback handling
- Configuration validation
- Performance profiling

## Parallel Pipeline Analysis (`parallel_retrieval.py`)

### Key Components:
1. **CircuitBreaker**: Failure handling with thresholds and timeouts
2. **ParallelRetrievalPipeline**: Concurrent retriever execution
3. **Result Merging Strategies**: weighted, round_robin, score_based

### Orchestration Features:
- Concurrent execution with limits
- Per-retriever timeouts
- Circuit breaker for failing retrievers
- Multiple merge strategies
- Integrated reranking (CrossEncoder + TableRanker)
- Query-aware processing (table queries, trip planning)

## Performance Considerations

### Current Optimizations:
1. **Caching**: Multi-query retriever implements TTL-based caching
2. **Parallel Execution**: Up to 5 concurrent retrievers
3. **Circuit Breaking**: Automatic failure detection and bypass
4. **Lazy Loading**: Index loading on demand
5. **Async Support**: Most retrievers support async operations

### Potential Bottlenecks:
1. **Sequential Reranking**: Applied after all retrievers complete
2. **Index Building**: Co-occurrence index built synchronously
3. **LLM Calls**: Multi-query and self-query depend on LLM latency
4. **Memory Usage**: Multiple indices in memory

## Configuration Patterns

### Retriever-Specific Configs:
- Multi-Query: cache settings, query inclusion
- Self-Query: result limits, verbosity, compression
- Ensemble: boost patterns, rerank strategy
- Compression: mode selection, thresholds
- Parallel: concurrency, timeouts, weights

### Factory Configuration:
- Centralized through RetrieverConfig
- Mode-based defaults
- Component toggle flags
- Performance settings

## Integration Points

### With LangChain:
- All retrievers extend BaseRetriever
- Use LangChain document/embedding models
- Compatible with LangChain callbacks
- Leverage LangChain utilities

### With Custom Components:
- BaseComponent for monitoring/metrics
- Custom rerankers (Authority, Table)
- Performance monitoring decorators
- Retry logic wrappers

## Recommendations for Unified System

### 1. **Strategy Pattern Implementation**
- Create retrieval strategies for each pattern type
- Implement strategy interfaces for common operations
- Allow dynamic strategy composition

### 2. **Unified Configuration**
- Centralize all retriever configurations
- Implement configuration inheritance
- Support runtime reconfiguration

### 3. **Enhanced Monitoring**
- Standardize metrics across all retrievers
- Implement retriever health scoring
- Add query performance tracking

### 4. **Optimization Opportunities**
- Implement shared caching layer
- Parallelize index building
- Add retriever result pooling
- Implement adaptive timeout adjustment

### 5. **Testing Improvements**
- Create retriever benchmarks
- Implement A/B testing framework
- Add performance regression tests