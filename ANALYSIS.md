# RAG Service Reranker Analysis

## Executive Summary

The Canadian Forces Travel Instructions Chatbot RAG service already has a sophisticated multi-stage retrieval architecture with **existing reranking capabilities**. However, these reranking components are not consistently applied across all retrieval paths. The system would benefit from better integration and configuration of the existing rerankers rather than adding new ones.

### Key Findings
- ✅ **Reranking components exist**: CrossEncoder, Cohere, LLM, Authority, and Table rerankers are implemented
- ⚠️ **Inconsistent application**: The main `improved_retrieval.py` pipeline doesn't use reranking
- ✅ **Enhanced pipeline uses reranking**: The `enhanced_retrieval.py` properly integrates reranking
- 🎯 **Opportunity**: Significant precision improvements possible by enabling existing rerankers

## Current Architecture Analysis

### 1. Existing Reranking Components

The system includes five different reranker implementations in `/app/components/reranker.py`:

#### a) CrossEncoderReranker
- Uses sentence-transformers models (e.g., `cross-encoder/ms-marco-MiniLM-L-6-v2`)
- Provides neural relevance scoring between query-document pairs
- Includes caching for repeated query-document pairs
- Best for: General relevance improvement with good speed/accuracy trade-off

#### b) CohereReranker
- Integrates with Cohere's reranking API
- Cloud-based solution with high accuracy
- Best for: High-stakes queries where accuracy is paramount

#### c) LLMReranker
- Uses language models for relevance judgment
- Flexible prompt-based approach
- Best for: Complex queries requiring semantic understanding

#### d) AuthorityReranker (`authority_reranker.py`)
- Domain-specific reranker for Canadian Forces documents
- Boosts official sources (CFTDTI, NJC, Treasury Board, DND)
- Considers document recency and structure
- Best for: Policy and directive queries

#### e) TableRanker (`table_ranker.py`)
- Specialized for queries seeking tabular data
- Identifies and boosts documents containing tables
- Pattern matching for rates, allowances, and numeric values
- Best for: Rate/allowance queries

### 2. Current Retrieval Pipelines

#### a) Improved Retrieval Pipeline (`improved_retrieval.py`)
- **Status**: Main production pipeline
- **Reranking**: NOT IMPLEMENTED ❌
- **Architecture**:
  ```
  Query → Multi-Query → Ensemble (Vector + BM25 + MMR) → Compression → Results
  ```
- **Gap**: Missing reranking stage between ensemble retrieval and compression

#### b) Enhanced Retrieval Pipeline (`enhanced_retrieval.py`)
- **Status**: Advanced pipeline with LangGraph orchestration
- **Reranking**: FULLY IMPLEMENTED ✅
- **Architecture**:
  ```
  Query → Classification → Query Expansion → Retrieval → Compression → Reranking → Synthesis
  ```
- **Features**:
  - Query-type aware reranking
  - Special handling for table queries (TableRanker + main reranker)
  - Configurable reranker selection

### 3. Integration Analysis

#### Retriever Factory (`retriever_factory.py`)
- **Advanced mode**: Includes AuthorityRerankingRetriever
- **Configuration**: `use_reranking` flag available but only uses Authority reranker
- **Gap**: Doesn't integrate CrossEncoder or other rerankers

## Benefits Assessment

### 1. Current System Without Consistent Reranking

**Precision Issues Observed**:
- Initial retrieval returns 20-25 documents
- Relevance varies significantly within results
- Table queries often have relevant content buried in results
- Policy queries may prioritize outdated or unofficial sources

### 2. Potential Benefits of Enabling Reranking

#### a) **Improved Precision**
- Cross-encoder models can improve precision@5 by 20-40%
- Better handling of semantic similarity vs keyword matching
- More accurate ranking of partial matches

#### b) **Query-Specific Optimization**
```python
# Example: Different rerankers for different query types
query_type_rerankers = {
    QueryType.TABLE: [TableRanker(), CrossEncoderReranker()],
    QueryType.POLICY: [AuthorityReranker(), LLMReranker()],
    QueryType.SIMPLE: [CrossEncoderReranker()],
    QueryType.COMPLEX: [LLMReranker(), CrossEncoderReranker()]
}
```

#### c) **Reduced Latency Through Better Ranking**
- Retrieve more candidates initially (30-50)
- Rerank to top 5-10
- Send fewer, more relevant documents to LLM
- Overall faster response with better quality

#### d) **Better Handling of Edge Cases**
- Multi-hop queries benefit from LLM reranking
- Table queries get specialized handling
- Authority boosting for official sources

## Implementation Recommendations

### 1. High Priority: Enable Reranking in improved_retrieval.py

**Implementation Steps**:

```python
# In improved_retrieval.py, after line 287 (ensemble creation)
from app.components.reranker import RerankerFactory, RerankerType

# Add reranking configuration
if self.use_reranking and self.llm:
    # Create reranker based on query type
    reranker = RerankerFactory.create_reranker(
        RerankerType.CROSS_ENCODER,
        model_name="cross-encoder/ms-marco-MiniLM-L-6-v2"
    )
    
    # Wrap the final retriever with reranking
    from app.components.reranker import RerankingRetriever
    reranking_retriever = RerankingRetriever(
        base_retriever=current_retriever,
        reranker=reranker,
        top_k=10  # Reduce from 25 to 10 after reranking
    )
    self.retrievers["reranked"] = reranking_retriever
    current_retriever = reranking_retriever
```

### 2. Medium Priority: Query-Type Specific Reranker Selection

**Create a reranker selection strategy**:

```python
class RerankerSelector:
    @staticmethod
    def select_reranker(query: str, query_type: Optional[str] = None) -> List[BaseReranker]:
        """Select appropriate rerankers based on query characteristics."""
        rerankers = []
        
        # Always start with authority reranker for policy queries
        if any(term in query.lower() for term in ["policy", "directive", "regulation"]):
            rerankers.append(AuthorityReranker(boost_factor=2.0))
        
        # Add table ranker for rate/allowance queries
        if any(term in query.lower() for term in ["rate", "allowance", "table", "$"]):
            rerankers.append(TableRanker())
        
        # Add cross-encoder as general reranker
        rerankers.append(CrossEncoderReranker())
        
        return rerankers
```

### 3. Configuration Recommendations

**Add to environment configuration**:
```env
# Reranking Configuration
ENABLE_RERANKING=true
RERANKER_TYPE=cross_encoder
RERANKER_MODEL=cross-encoder/ms-marco-MiniLM-L-6-v2
RERANKER_TOP_K=10
RERANKER_CACHE_SIZE=1000

# Query-specific reranking
ENABLE_TABLE_RERANKING=true
ENABLE_AUTHORITY_RERANKING=true
```

### 4. Performance Optimization

**Caching Strategy**:
```python
# Implement document-level caching
class CachedReranker:
    def __init__(self, base_reranker, cache_size=1000):
        self.reranker = base_reranker
        self.cache = LRUCache(cache_size)
    
    async def rerank(self, query: str, documents: List[Document], top_k: int):
        # Create cache key from query + doc hashes
        cache_key = self._create_cache_key(query, documents)
        
        if cache_key in self.cache:
            return self.cache[cache_key][:top_k]
        
        # Rerank and cache
        results = await self.reranker.arerank(query, documents, top_k)
        self.cache[cache_key] = results
        return results
```

## Testing and Evaluation Plan

### 1. Benchmark Queries

Create test sets for each query type:

```python
benchmark_queries = {
    "table_queries": [
        "What is the meal allowance for Yukon?",
        "Show me Ontario incidental rates",
        "Private vehicle kilometric rate"
    ],
    "policy_queries": [
        "What is the policy on travel advances?",
        "Class A reserve travel entitlements",
        "Authority for international travel"
    ],
    "complex_queries": [
        "Can I claim meals if staying with friends?",
        "How do restrictions affect my PMV claim?",
        "Compare hotel vs private accommodation"
    ]
}
```

### 2. Metrics to Track

- **Precision@k**: Percentage of relevant documents in top k
- **MRR (Mean Reciprocal Rank)**: Position of first relevant result
- **Latency**: Time added by reranking
- **Cache hit rate**: Effectiveness of caching

### 3. A/B Testing Approach

```python
class ABTestingRetriever:
    def __init__(self, retriever_a, retriever_b, split_ratio=0.5):
        self.retriever_a = retriever_a  # Without reranking
        self.retriever_b = retriever_b  # With reranking
        self.split_ratio = split_ratio
        self.metrics = defaultdict(list)
    
    async def retrieve(self, query: str, k: int):
        use_b = random.random() < self.split_ratio
        retriever = self.retriever_b if use_b else self.retriever_a
        
        start_time = time.time()
        results = await retriever.retrieve(query, k)
        latency = time.time() - start_time
        
        # Log metrics
        self.metrics[f"latency_{'b' if use_b else 'a'}"].append(latency)
        self.metrics[f"results_{'b' if use_b else 'a'}"].append(len(results))
        
        return results
```

## Conclusion

The RAG service has a well-designed architecture with comprehensive reranking capabilities already built in. The primary opportunity is not to add new reranking functionality, but to:

1. **Enable existing rerankers** in the main retrieval pipeline
2. **Configure query-specific reranking** strategies
3. **Optimize performance** through caching and batching
4. **Monitor and tune** based on real-world usage

The system is architecturally ready for reranking - it just needs to be "turned on" and properly configured. This will provide significant improvements in retrieval precision with minimal additional development effort.

## Next Steps

1. **Immediate**: Enable CrossEncoderReranker in improved_retrieval.py
2. **Short-term**: Add configuration flags for reranking
3. **Medium-term**: Implement query-type specific reranker selection
4. **Long-term**: Fine-tune rerankers on domain-specific data

The existing components provide a solid foundation - the focus should be on integration and optimization rather than building new functionality.