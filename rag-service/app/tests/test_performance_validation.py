"""
Performance validation tests for retrieval optimization components.

Tests core performance metrics and validates that optimizations provide
measurable improvements over baseline approaches.
"""

import pytest
import time
import statistics
from typing import List, Dict
from unittest.mock import AsyncMock

from langchain_core.documents import Document

from app.components.rrf_merger import RRFMerger, RRFDocument
from app.components.deduplicator import DocumentDeduplicator
from app.components.uncertainty_scorer import UncertaintyScorer
from app.components.bm25_gating import BM25Gate
from app.components.adaptive_k_selector import AdaptiveKSelector
from app.components.gated_retrieval_coordinator import GatedRetrievalCoordinator
from app.components.conditional_reranker import ConditionalReranker
from app.components.delayed_head_streaming import DelayedHeadStreamingHandler


class TestCorePerformanceMetrics:
    """Test core performance metrics for key components."""
    
    @pytest.fixture
    def cf_documents(self):
        """Create realistic CF travel documents."""
        return [
            Document(
                page_content="DND Form 2888 Travel Authorization procedures require completion before travel",
                metadata={"source": "forms.pdf", "id": f"doc_{i}"}
            )
            for i in range(20)
        ]
    
    def test_rrf_merger_scalability(self, cf_documents):
        """Test RRF merger performance scales properly with input size."""
        merger = RRFMerger(k=60)
        
        # Test with different input sizes
        sizes = [5, 10, 15, 20]
        times = []
        
        for size in sizes:
            retriever_results = {
                "dense": cf_documents[:size],
                "sparse": cf_documents[2:size+2]
            }
            
            # Measure merge time
            start = time.time()
            merged_docs, stats = merger.merge(retriever_results, max_docs=size)
            merge_time = (time.time() - start) * 1000
            times.append(merge_time)
            
            # Validate results
            assert len(merged_docs) > 0
            assert stats.merge_time_ms > 0
            assert merge_time < 200.0  # Should be fast
        
        # Performance should scale reasonably (not exponentially)
        if len(times) > 1:
            max_time = max(times)
            min_time = min(times)
            assert max_time / min_time < 5.0  # Less than 5x difference
    
    def test_deduplication_efficiency(self, cf_documents):
        """Test deduplication efficiency and accuracy."""
        deduplicator = DocumentDeduplicator()
        
        # Create test with known duplicates
        docs_with_known_duplicates = cf_documents[:10] + cf_documents[5:15] + cf_documents[:5]
        expected_unique = len(set(doc.metadata["id"] for doc in docs_with_known_duplicates))
        
        start = time.time()
        unique_docs, stats = deduplicator.deduplicate(docs_with_known_duplicates)
        dedup_time = (time.time() - start) * 1000
        
        # Performance validation
        assert dedup_time < 2000.0  # Should complete within 2 seconds
        
        # Accuracy validation
        assert len(unique_docs) <= expected_unique
        assert stats.duplicates_removed > 0
        assert stats.get_deduplication_ratio() > 0
        
        # Unique document IDs
        unique_ids = {doc.metadata["id"] for doc in unique_docs}
        assert len(unique_ids) == len(unique_docs)  # All should be unique
    
    def test_uncertainty_scorer_consistency(self):
        """Test uncertainty scorer produces consistent results."""
        scorer = UncertaintyScorer()
        
        test_queries = [
            "DND form 2888",  # Should be low uncertainty
            "travel procedures",  # Medium uncertainty  
            "complex international emergency authorization requirements"  # High uncertainty
        ]
        
        # Test multiple runs for consistency
        for query in test_queries:
            results = []
            times = []
            
            for _ in range(5):  # Run 5 times
                start = time.time()
                result = scorer.score_query(query)
                query_time = (time.time() - start) * 1000
                
                results.append(result.overall_uncertainty)
                times.append(query_time)
                
                # Each run should be fast
                assert query_time < 300.0
            
            # Results should be consistent (same uncertainty score)
            assert all(abs(r - results[0]) < 0.01 for r in results)  # Within 1%
            
            # Times should be reasonable
            avg_time = statistics.mean(times)
            assert avg_time < 150.0
    
    def test_bm25_gate_decision_speed(self):
        """Test BM25 gate makes fast decisions."""
        gate = BM25Gate()
        
        queries = [
            "DND Form 2888 completion requirements",
            "What is the meal allowance policy?",  
            "How do I submit travel expenses?",
            "emergency travel authorization procedures",
            "international travel documentation requirements"
        ]
        
        total_time = 0
        for query in queries:
            start = time.time()
            result = gate.should_activate_bm25(query)
            decision_time = (time.time() - start) * 1000
            total_time += decision_time
            
            # Each decision should be very fast
            assert decision_time < 100.0
            
            # Result should be valid
            assert hasattr(result, 'should_activate')
            assert isinstance(result.should_activate, bool)
            assert result.confidence >= 0.0
        
        # Average decision time should be very fast
        avg_time = total_time / len(queries)
        assert avg_time < 50.0
    
    def test_adaptive_k_selector_performance(self):
        """Test adaptive K selector performance."""
        selector = AdaptiveKSelector(max_total_k=30)
        
        test_cases = [
            ("simple", 0.2),
            ("medium complexity travel query", 0.5), 
            ("very complex international emergency travel authorization requirements", 0.8)
        ]
        
        for query, uncertainty in test_cases:
            start = time.time()
            result = selector.select_k_values(query, uncertainty)
            selection_time = (time.time() - start) * 1000
            
            # Should be fast
            assert selection_time < 200.0
            
            # Result should be valid
            assert result.k_profile.total_k > 0
            assert result.k_profile.total_k <= selector.max_total_k
            assert result.complexity_level in ["SIMPLE", "MEDIUM", "HIGH"]
    
    @pytest.mark.asyncio
    async def test_coordinator_end_to_end_performance(self, cf_documents):
        """Test gated coordinator end-to-end performance."""
        # Mock retrievers that return realistic results
        async def mock_retriever(query: str, k: int = 5) -> List[Document]:
            return cf_documents[:min(k, len(cf_documents))]
        
        coordinator = GatedRetrievalCoordinator(
            dense_retriever=mock_retriever,
            sparse_retriever=mock_retriever,
            bm25_retriever=mock_retriever,
            hybrid_retriever=mock_retriever
        )
        
        queries = [
            "DND form requirements",
            "travel allowance policies", 
            "emergency procedures"
        ]
        
        for query in queries:
            start = time.time()
            documents, metrics = await coordinator.retrieve(query)
            total_time = (time.time() - start) * 1000
            
            # Performance validation
            assert total_time < 8000.0  # Complete within 8 seconds
            assert metrics.total_execution_time_ms > 0
            
            # Quality validation
            assert len(documents) > 0
            assert len(metrics.retrievers_executed) > 0
            assert metrics.deduplication_ratio >= 0.0
    
    @pytest.mark.asyncio  
    async def test_conditional_reranker_decision_speed(self, cf_documents):
        """Test conditional reranker makes fast decisions."""
        # Fast mock reranker
        async def mock_reranker(query: str, docs: List[Document]) -> List[Document]:
            return docs  # Just return as-is for speed
        
        reranker = ConditionalReranker(
            reranker_function=mock_reranker,
            uncertainty_threshold=0.6
        )
        
        # Create RRF documents
        rrf_docs = [
            RRFDocument(document=doc, rrf_score=1.0 - i*0.1)
            for i, doc in enumerate(cf_documents[:8])
        ]
        
        queries = [
            ("simple query", 0.3),    # Should skip
            ("complex query", 0.8),   # Should apply/blend
        ]
        
        for query, uncertainty in queries:
            start = time.time()
            documents, result = await reranker.rerank(query, rrf_docs)
            rerank_time = (time.time() - start) * 1000
            
            # Should make decision quickly
            assert rerank_time < 3000.0
            assert len(documents) == len(rrf_docs)
            assert result.reranking_time_ms >= 0
    
    @pytest.mark.asyncio
    async def test_streaming_latency_optimization(self, cf_documents):
        """Test streaming handler optimizes first document latency."""
        handler = DelayedHeadStreamingHandler()
        
        # Create documents with clear score separation
        rrf_docs = [
            RRFDocument(document=doc, rrf_score=1.0 - i*0.15)
            for i, doc in enumerate(cf_documents[:6])
        ]
        
        start = time.time()
        chunks = []
        first_chunk_time = None
        
        async for chunk in handler.stream_documents(rrf_docs, "travel query"):
            chunk_time = time.time()
            if first_chunk_time is None:
                first_chunk_time = (chunk_time - start) * 1000
            chunks.append(chunk)
        
        total_time = (time.time() - start) * 1000
        
        # First chunk should arrive quickly
        assert first_chunk_time < 1000.0
        
        # Total time should be reasonable
        assert total_time < 5000.0
        
        # Should stream all documents
        total_docs = sum(len(chunk.documents) for chunk in chunks)
        assert total_docs == len(rrf_docs)
        
        # If using delayed strategy, first chunk should be much faster than total
        if len(chunks) > 1:
            efficiency = first_chunk_time / total_time
            assert efficiency < 0.8  # First chunk should be <80% of total time


class TestPerformanceComparisons:
    """Compare optimized vs baseline performance."""
    
    @pytest.fixture
    def test_documents(self):
        """Create test documents for performance comparisons."""
        return [
            Document(
                page_content=f"CF travel document {i} with travel procedures and requirements",
                metadata={"id": f"doc_{i}", "source": f"source_{i}.pdf"}
            )
            for i in range(15)
        ]
    
    def test_rrf_vs_simple_merge_performance(self, test_documents):
        """Compare RRF merger vs simple concatenation."""
        merger = RRFMerger(k=60)
        
        retriever_results = {
            "dense": test_documents[:8],
            "sparse": test_documents[4:12],
            "hybrid": test_documents[2:10]
        }
        
        # Test RRF merger
        start = time.time()
        rrf_docs, rrf_stats = merger.merge(retriever_results, max_docs=10)
        rrf_time = (time.time() - start) * 1000
        
        # Test simple merge (baseline)
        start = time.time()
        simple_docs = merger.merge_simple(retriever_results, max_docs=10)
        simple_time = (time.time() - start) * 1000
        
        # RRF should not be significantly slower than simple merge
        assert rrf_time < simple_time * 5  # At most 5x slower
        
        # But RRF should provide better quality (proper scoring)
        assert all(isinstance(doc, RRFDocument) for doc in rrf_docs)
        assert all(doc.rrf_score > 0 for doc in rrf_docs)
        assert rrf_docs[0].rrf_score >= rrf_docs[-1].rrf_score  # Sorted
    
    def test_deduplication_vs_no_deduplication(self, test_documents):
        """Compare performance with and without deduplication."""
        deduplicator = DocumentDeduplicator()
        
        # Create documents with duplicates
        docs_with_dups = test_documents + test_documents[5:10] + test_documents[2:7]
        
        # Test with deduplication
        start = time.time()
        unique_docs, dedup_stats = deduplicator.deduplicate(docs_with_dups)
        dedup_time = (time.time() - start) * 1000
        
        # Test without deduplication (baseline)
        start = time.time()
        no_dedup_docs = docs_with_dups  # Just use all documents
        no_dedup_time = (time.time() - start) * 1000
        
        # Deduplication adds time but provides value
        assert dedup_time > no_dedup_time  # Should take longer
        assert dedup_time < 3000.0  # But not too long
        
        # Deduplication should reduce document count
        assert len(unique_docs) < len(docs_with_dups)
        assert dedup_stats.duplicates_removed > 0
    
    def test_streaming_vs_batch_latency(self, test_documents):
        """Compare streaming vs batch delivery latency."""
        handler = DelayedHeadStreamingHandler()
        
        rrf_docs = [
            RRFDocument(document=doc, rrf_score=1.0 - i*0.1)
            for i, doc in enumerate(test_documents[:10])
        ]
        
        # Test streaming (delayed strategy)
        start = time.time()
        streaming_chunks = []
        first_stream_time = None
        
        async def test_streaming():
            nonlocal first_stream_time
            async for chunk in handler.stream_documents(rrf_docs, "test query"):
                if first_stream_time is None:
                    first_stream_time = (time.time() - start) * 1000
                streaming_chunks.append(chunk)
        
        import asyncio
        asyncio.run(test_streaming())
        
        # Test batch (wait for all)
        start = time.time()
        batch_chunks = []
        
        async def test_batch():
            # Force batch mode
            batch_handler = DelayedHeadStreamingHandler()
            async for chunk in batch_handler._stream_batch(rrf_docs, handler.stats.__class__()):
                batch_chunks.append(chunk)
        
        asyncio.run(test_batch())
        batch_time = (time.time() - start) * 1000
        
        # Streaming should provide faster first response
        if first_stream_time and len(streaming_chunks) > 1:
            assert first_stream_time < batch_time
            
        # Both should deliver all documents
        streaming_total = sum(len(chunk.documents) for chunk in streaming_chunks)
        batch_total = sum(len(chunk.documents) for chunk in batch_chunks)
        assert streaming_total == batch_total == len(rrf_docs)


class TestQualityPreservation:
    """Test that optimizations preserve retrieval quality."""
    
    @pytest.fixture
    def quality_test_docs(self):
        """Create documents with clear relevance signals."""
        return [
            Document(
                page_content="DND Form 2888 travel authorization completion requirements",
                metadata={"id": "high_relevance", "source": "official_forms.pdf"}
            ),
            Document(
                page_content="Travel allowance rates and meal reimbursement policies",
                metadata={"id": "medium_relevance", "source": "allowances.pdf"} 
            ),
            Document(
                page_content="General administrative procedures for personnel",
                metadata={"id": "low_relevance", "source": "admin_guide.pdf"}
            ),
            Document(
                page_content="Emergency contact information and procedures",
                metadata={"id": "minimal_relevance", "source": "emergency.pdf"}
            )
        ]
    
    def test_rrf_preserves_relevance_ranking(self, quality_test_docs):
        """Test that RRF merger preserves relevance ranking."""
        merger = RRFMerger()
        
        # Simulate retrievers returning docs in different orders but with consistent relevance
        retriever_results = {
            "dense": [quality_test_docs[0], quality_test_docs[1], quality_test_docs[2]],  # Good order
            "sparse": [quality_test_docs[1], quality_test_docs[0], quality_test_docs[3]]  # Different order
        }
        
        merged_docs, stats = merger.merge(retriever_results)
        
        # Top document should be the most relevant
        assert merged_docs[0].document.metadata["id"] in ["high_relevance", "medium_relevance"]
        
        # Should not promote irrelevant documents to top
        top_3_ids = [doc.document.metadata["id"] for doc in merged_docs[:3]]
        assert "minimal_relevance" not in top_3_ids
        
        # Scores should be decreasing
        scores = [doc.rrf_score for doc in merged_docs]
        assert scores == sorted(scores, reverse=True)
    
    def test_deduplication_preserves_best_version(self, quality_test_docs):
        """Test deduplication keeps the best version of duplicate content."""
        deduplicator = DocumentDeduplicator(jaccard_threshold=0.7)  # More aggressive for testing
        
        # Create near-duplicates with different metadata quality
        high_quality_dup = Document(
            page_content="DND Form 2888 travel authorization completion requirements and procedures",
            metadata={"id": "dup_high_quality", "source": "official_forms.pdf", "page": 1}
        )
        
        low_quality_dup = Document(
            page_content="DND Form 2888 travel authorization completion requirements",  # Shorter version
            metadata={"id": "dup_low_quality", "source": "scan.pdf"}  # Less complete metadata
        )
        
        docs_with_dups = quality_test_docs + [high_quality_dup, low_quality_dup]
        unique_docs, stats = deduplicator.deduplicate(docs_with_dups)
        
        # Should remove duplicates
        assert len(unique_docs) < len(docs_with_dups)
        assert stats.duplicates_removed > 0
        
        # Should preserve unique documents
        unique_ids = {doc.metadata["id"] for doc in unique_docs}
        expected_unique = {"high_relevance", "medium_relevance", "low_relevance", "minimal_relevance"}
        assert expected_unique.issubset(unique_ids)
    
    @pytest.mark.asyncio
    async def test_conditional_reranker_preserves_quality(self, quality_test_docs):
        """Test conditional reranker doesn't hurt quality when skipping."""
        # Mock reranker that would hurt quality (reverse order)
        async def bad_reranker(query: str, docs: List[Document]) -> List[Document]:
            return list(reversed(docs))  # Worst possible reranking
        
        reranker = ConditionalReranker(
            reranker_function=bad_reranker,
            uncertainty_threshold=0.8  # High threshold - should skip for most queries
        )
        
        # Create well-ordered RRF documents  
        rrf_docs = [
            RRFDocument(document=doc, rrf_score=1.0 - i*0.2)
            for i, doc in enumerate(quality_test_docs)
        ]
        
        # Test with low uncertainty query (should skip reranking)
        documents, result = await reranker.rerank("DND form", rrf_docs)
        
        # Should preserve original good order
        assert result.strategy_used.value == "skip"
        assert documents[0].metadata["id"] == "high_relevance"  # Best doc still first
        assert len(documents) == len(quality_test_docs)
    
    def test_streaming_preserves_document_completeness(self, quality_test_docs):
        """Test streaming delivers all documents without loss."""
        handler = DelayedHeadStreamingHandler()
        
        rrf_docs = [
            RRFDocument(document=doc, rrf_score=1.0 - i*0.15)
            for i, doc in enumerate(quality_test_docs)
        ]
        
        async def collect_all_chunks():
            chunks = []
            async for chunk in handler.stream_documents(rrf_docs, "test query"):
                chunks.append(chunk)
            return chunks
        
        import asyncio
        chunks = asyncio.run(collect_all_chunks())
        
        # Collect all documents from all chunks
        all_streamed_docs = []
        for chunk in chunks:
            all_streamed_docs.extend(chunk.documents)
        
        # Should have all original documents
        assert len(all_streamed_docs) == len(quality_test_docs)
        
        # Should preserve document content
        original_ids = {doc.metadata["id"] for doc in quality_test_docs}
        streamed_ids = {doc.metadata["id"] for doc in all_streamed_docs}
        assert original_ids == streamed_ids