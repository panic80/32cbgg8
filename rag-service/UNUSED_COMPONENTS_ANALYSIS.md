# Unused Components Analysis

## Summary

After analyzing the retriever components in `/var/www/cbthis/rag-service/app/components`, the following component was identified as completely unused:

### Unused Component

1. **TableMultiVectorRetriever** (`table_multi_vector_retriever.py`)
   - A specialized retriever for table data that stores table summaries for semantic search
   - Not imported or instantiated anywhere in the codebase
   - Can be safely removed

### Active Components

All other retriever components are actively used:

- **AuthorityReranker** & **AuthorityRerankingRetriever**: Used in retriever_factory.py
- **TravelBM25Retriever**: Used in multiple pipelines
- **ClassARetriever**: Used in improved_retrieval.py
- **ClassAQueryEnhancer**: Used in improved_retrieval.py
- **TravelCooccurrenceRetriever**: Used in retriever_factory.py
- **CooccurrenceIndexer**: Used in ingestion.py
- **TravelContextualCompressor**: Used in multiple pipelines
- **ContentBoostedEnsembleRetriever** & **WeightedEnsembleRetriever**: Used in pipelines
- **MultiQueryRetriever**: Used in retriever_factory.py and pipelines
- **TravelParentDocumentRetriever**: Used in retriever_factory.py
- **CrossEncoderReranker**: Used in chat.py
- **RestrictionAwareRetriever**: Used in improved_retrieval.py
- **ResultProcessor**: Used in chat.py
- **TravelSelfQueryRetriever**: Used in pipelines
- **TableQueryRewriter**: Used in enhanced_retrieval.py
- **TableRanker**: Used in enhanced and parallel retrieval

## Actions Taken

1. Updated `/app/components/__init__.py` to properly export all actively used components
2. Identified `TableMultiVectorRetriever` as safe to remove

## Recommended Next Steps

1. Delete `app/components/table_multi_vector_retriever.py`
2. Clean up backup files (*.backup_*) in the components directory
3. Consider implementing the TableMultiVectorRetriever functionality if table-specific retrieval becomes necessary in the future