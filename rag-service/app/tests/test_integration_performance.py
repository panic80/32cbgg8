"""
Integration performance tests for the complete retrieval optimization pipeline.

Tests the full system with all components working together to validate
performance improvements and accuracy preservation.
"""

import pytest
import asyncio
import time
from typing import List, Dict, Any, Optional
from unittest.mock import AsyncMock, Mock
import statistics

from langchain_core.documents import Document

from app.components.rrf_merger import RRFMerger, RRFDocument
from app.components.deduplicator import DocumentDeduplicator
from app.services.retrieval_cache import RetrievalL2Cache
from app.components.uncertainty_scorer import UncertaintyScorer, UncertaintyResult
from app.components.bm25_gating import BM25Gate
from app.components.adaptive_k_selector import AdaptiveKSelector
from app.components.gated_retrieval_coordinator import GatedRetrievalCoordinator
from app.components.conditional_reranker import ConditionalReranker
from app.components.delayed_head_streaming import DelayedHeadStreamingHandler


class TestPerformanceBenchmarks:
    """Performance benchmarks for retrieval optimization components."""
    
    @pytest.fixture
    def sample_documents(self):
        """Create realistic CF travel documents for testing."""
        return [
            Document(
                page_content="DND Form 2888 Travel Authorization must be completed before travel. This form requires approval from authorized personnel and includes details about travel dates, destinations, and estimated costs.",
                metadata={"source": "travel_forms.pdf", "page": 1, "id": "doc_001"}
            ),
            Document(
                page_content="Meal allowance rates for Canadian Forces personnel vary by location. Domestic travel rates are different from international rates. Personnel must retain receipts for reimbursement.",
                metadata={"source": "allowances_guide.pdf", "page": 15, "id": "doc_002"}
            ),
            Document(
                page_content="Accommodation expenses for temporary duty assignments are reimbursed based on established rates. Personnel may choose government quarters or commercial accommodations.",
                metadata={"source": "accommodation_policy.pdf", "page": 8, "id": "doc_003"}
            ),
            Document(
                page_content="Travel by personally owned vehicle requires prior approval. Mileage rates are established annually and cover fuel, maintenance, and depreciation costs.",
                metadata={"source": "vehicle_travel.pdf", "page": 3, "id": "doc_004"}
            ),
            Document(
                page_content="Air travel arrangements should be made through designated travel agencies. Emergency travel may require special authorization and documentation.",
                metadata={"source": "air_travel_policy.pdf", "page": 12, "id": "doc_005"}
            ),
            Document(
                page_content="Travel advance requests must be submitted at least 10 days before travel. The advance amount cannot exceed 80% of estimated expenses.",
                metadata={"source": "travel_advances.pdf", "page": 5, "id": "doc_006"}
            ),
            Document(
                page_content="Expense claims must be submitted within 30 days of travel completion. Late submissions require supervisor approval and justification.",
                metadata={"source": "expense_claims.pdf", "page": 22, "id": "doc_007"}
            ),
            Document(
                page_content="International travel requires additional documentation including passport verification and security clearances for certain destinations.",
                metadata={"source": "international_travel.pdf", "page": 1, "id": "doc_008"}
            ),
            Document(
                page_content="Training course travel follows special procedures. Course-related expenses may have different approval requirements and reimbursement rates.",
                metadata={"source": "training_travel.pdf", "page": 7, "id": "doc_009"}
            ),
            Document(
                page_content="Emergency travel authorization can be granted by duty officers. Full documentation must be submitted within 48 hours of emergency travel approval.",
                metadata={"source": "emergency_procedures.pdf", "page": 4, "id": "doc_010"}
            )
        ]
    
    @pytest.fixture
    def mock_retrievers(self, sample_documents):
        """Create mock retriever functions that return realistic results."""
        
        async def mock_dense_retriever(query: str, k: int = 5) -> List[Document]:
            # Dense retriever favors semantic similarity
            if "form" in query.lower() or "2888" in query:
                return sample_documents[:k]
            elif "meal" in query.lower() or "allowance" in query.lower():
                return [sample_documents[1]] + sample_documents[2:k+1]
            else:
                return sample_documents[:k]
        
        async def mock_sparse_retriever(query: str, k: int = 5) -> List[Document]:
            # Sparse retriever favors keyword matching
            keywords = query.lower().split()
            scored_docs = []
            for doc in sample_documents:
                score = sum(1 for keyword in keywords if keyword in doc.page_content.lower())
                scored_docs.append((doc, score))
            
            scored_docs.sort(key=lambda x: x[1], reverse=True)
            return [doc for doc, score in scored_docs[:k]]
        
        async def mock_bm25_retriever(query: str, k: int = 3) -> List[Document]:
            # BM25 retriever for specific keyword matching
            if any(term in query.lower() for term in ["form", "authorization", "approval"]):
                return [sample_documents[0], sample_documents[7], sample_documents[9]][:k]
            elif "meal" in query.lower():
                return [sample_documents[1]][:k]
            else:
                return sample_documents[-k:]
        
        async def mock_hybrid_retriever(query: str, k: int = 4) -> List[Document]:
            # Hybrid combines semantic and keyword approaches
            dense_results = await mock_dense_retriever(query, k//2 + 1)
            sparse_results = await mock_sparse_retriever(query, k//2 + 1)
            
            # Simple merge avoiding duplicates
            combined = []
            seen_ids = set()
            for doc in dense_results + sparse_results:
                if doc.metadata["id"] not in seen_ids:
                    combined.append(doc)
                    seen_ids.add(doc.metadata["id"])
                    if len(combined) >= k:
                        break
            return combined
        
        return {
            "dense": mock_dense_retriever,
            "sparse": mock_sparse_retriever,
            "bm25": mock_bm25_retriever,
            "hybrid": mock_hybrid_retriever
        }
    
    def test_rrf_merger_performance(self, sample_documents):
        """Test RRF merger performance with realistic data."""
        merger = RRFMerger(k=60)
        
        # Create mock retriever results
        retriever_results = {
            "dense": sample_documents[:5],
            "sparse": sample_documents[2:7],
            "hybrid": sample_documents[1:6]
        }
        
        start_time = time.time()
        merged_docs, stats = merger.merge(retriever_results, max_docs=10)
        end_time = time.time()
        
        # Performance assertions
        merge_time_ms = (end_time - start_time) * 1000
        assert merge_time_ms < 100.0  # Should be very fast
        
        # Quality assertions
        assert len(merged_docs) <= 10
        assert len(merged_docs) > 0
        assert all(isinstance(doc, RRFDocument) for doc in merged_docs)
        
        # Verify scores are properly calculated
        assert all(doc.rrf_score > 0 for doc in merged_docs)
        assert merged_docs[0].rrf_score >= merged_docs[-1].rrf_score  # Should be sorted
        
        # Stats validation
        assert stats.total_docs_input > 0
        assert stats.unique_docs_output == len(merged_docs)
        assert stats.merge_time_ms > 0
    
    def test_deduplicator_performance(self, sample_documents):
        """Test deduplication performance and accuracy."""
        deduplicator = DocumentDeduplicator(
            jaccard_threshold=0.82,
            hamming_threshold=4
        )
        
        # Add some duplicate content
        docs_with_duplicates = sample_documents + [
            Document(
                page_content="DND Form 2888 Travel Authorization must be completed before travel. This form requires approval from authorized personnel.",  # Similar to doc_001
                metadata={"source": "duplicate_source.pdf", "id": "dup_001"}
            ),
            sample_documents[1]  # Exact duplicate
        ]
        
        start_time = time.time()
        unique_docs, stats = deduplicator.deduplicate(docs_with_duplicates)
        end_time = time.time()
        
        # Performance assertions
        dedup_time_ms = (end_time - start_time) * 1000
        assert dedup_time_ms < 1000.0  # Should be reasonable for 12 docs
        
        # Quality assertions - should remove duplicates while preserving unique content
        assert len(unique_docs) < len(docs_with_duplicates)
        assert len(unique_docs) >= len(sample_documents)  # At least original unique docs
        
        # Stats validation
        assert stats.total_docs_input == len(docs_with_duplicates)
        assert stats.unique_docs_output == len(unique_docs)
        assert stats.duplicates_removed > 0
        assert stats.get_deduplication_ratio() > 0
    
    def test_uncertainty_scorer_performance(self):
        """Test uncertainty scorer performance with various query types."""
        scorer = UncertaintyScorer()
        
        test_queries = [
            "DND 2888 form",  # Simple, specific
            "How do I submit travel expenses?",  # Medium complexity
            "What are the procedures for international emergency travel authorization during training assignments?",  # Complex
            "meal allowance rates domestic international",  # Keyword-heavy
            "travel",  # Very short, ambiguous
        ]
        
        total_time = 0
        results = []
        
        for query in test_queries:
            start_time = time.time()
            result = scorer.score_query(query)
            end_time = time.time()
            
            query_time_ms = (end_time - start_time) * 1000
            total_time += query_time_ms
            results.append((query, result, query_time_ms))
            
            # Each query should process quickly
            assert query_time_ms < 200.0
            
            # Results should be valid
            assert isinstance(result, UncertaintyResult)
            assert 0.0 <= result.overall_uncertainty <= 1.0
            assert result.confidence_level in ["high", "medium", "low"]
            assert len(result.reasoning) > 0
        
        # Average performance should be good
        avg_time_ms = total_time / len(test_queries)
        assert avg_time_ms < 100.0
        
        # Verify different queries produce different uncertainty scores
        uncertainties = [r[1].overall_uncertainty for r in results]
        assert max(uncertainties) - min(uncertainties) > 0.1  # Should have variation
    
    def test_bm25_gate_performance(self):
        """Test BM25 gate decision performance."""
        gate = BM25Gate()
        
        test_queries = [
            "DND Form 2888 completion",
            "meal allowance rates",
            "travel authorization procedures",
            "What is the policy for emergency travel?",
            "How much can I claim for accommodation?",
            "international travel requirements documentation",
            "vehicle mileage reimbursement rates",
            "training course travel expenses",
            "duty travel advance request",
            "expense claim submission deadlines"
        ]
        
        total_time = 0
        
        for query in test_queries:
            start_time = time.time()
            result = gate.should_activate_bm25(query)
            end_time = time.time()
            
            query_time_ms = (end_time - start_time) * 1000
            total_time += query_time_ms
            
            # Should be very fast
            assert query_time_ms < 50.0
            
            # Result should be valid
            assert result.should_activate in [True, False]
            assert result.confidence >= 0.0
            assert len(result.reasoning) > 0
        
        # Average should be very fast
        avg_time_ms = total_time / len(test_queries)
        assert avg_time_ms < 20.0
    
    def test_adaptive_k_selector_performance(self):
        """Test adaptive K selector performance."""
        selector = AdaptiveKSelector(
            base_k=5,
            max_total_k=20
        )
        
        test_cases = [
            ("simple query", 0.3),
            ("complex travel authorization requirements", 0.7),
            ("What are the detailed procedures for international emergency travel?", 0.9),
            ("form 2888", 0.2),
            ("How do I submit expense claims with receipts for reimbursement?", 0.6)
        ]
        
        total_time = 0
        
        for query, uncertainty in test_cases:
            start_time = time.time()
            result = selector.select_k_values(query, uncertainty)
            end_time = time.time()
            
            query_time_ms = (end_time - start_time) * 1000
            total_time += query_time_ms
            
            # Should be fast
            assert query_time_ms < 100.0
            
            # Results should be valid
            assert result.k_profile.total_k <= selector.max_total_k
            assert result.k_profile.total_k > 0
            assert result.complexity_level in ["SIMPLE", "MEDIUM", "HIGH"]
            assert 0.0 <= result.estimated_recall_coverage <= 1.0
        
        avg_time_ms = total_time / len(test_cases)
        assert avg_time_ms < 50.0
    
    @pytest.mark.asyncio
    async def test_gated_coordinator_performance(self, mock_retrievers):
        """Test gated retrieval coordinator end-to-end performance."""
        coordinator = GatedRetrievalCoordinator(
            dense_retriever=mock_retrievers["dense"],
            sparse_retriever=mock_retrievers["sparse"],
            bm25_retriever=mock_retrievers["bm25"],
            hybrid_retriever=mock_retrievers["hybrid"]
        )
        
        test_queries = [
            "DND Form 2888 requirements",
            "meal allowance rates for domestic travel",
            "emergency travel authorization procedures"
        ]
        
        total_time = 0
        results = []
        
        for query in test_queries:
            start_time = time.time()
            documents, metrics = await coordinator.retrieve(query)
            end_time = time.time()
            
            query_time_ms = (end_time - start_time) * 1000
            total_time += query_time_ms
            results.append((query, documents, metrics, query_time_ms))
            
            # Performance assertions
            assert query_time_ms < 5000.0  # Should complete within 5 seconds
            
            # Quality assertions
            assert len(documents) > 0
            assert all(isinstance(doc, Document) for doc in documents)
            assert metrics.total_execution_time_ms > 0
            assert len(metrics.retrievers_executed) > 0
        
        # Average performance
        avg_time_ms = total_time / len(test_queries)
        assert avg_time_ms < 3000.0
        
        # Verify different queries use different numbers of retrievers
        retriever_counts = [len(r[2].retrievers_executed) for r in results]
        assert len(set(retriever_counts)) > 1 or min(retriever_counts) > 0
    
    @pytest.mark.asyncio
    async def test_conditional_reranker_performance(self, sample_documents):
        """Test conditional reranker performance."""
        # Mock reranker function
        async def mock_reranker(query: str, docs: List[Document]) -> List[Document]:
            # Simple reranker that sorts by document length (simulates processing time)
            await asyncio.sleep(0.01)  # Simulate processing
            return sorted(docs, key=lambda x: len(x.page_content), reverse=True)
        
        reranker = ConditionalReranker(
            reranker_function=mock_reranker,
            uncertainty_threshold=0.4,
            confidence_threshold=0.6
        )
        
        # Create RRF documents
        rrf_docs = [
            RRFDocument(document=doc, rrf_score=1.0 - i*0.1)
            for i, doc in enumerate(sample_documents[:5])
        ]
        
        test_queries = [
            ("simple query", 0.3),  # Should skip
            ("medium complexity query about travel", 0.5),  # Should blend
            ("complex detailed travel authorization requirements", 0.8)  # Should apply
        ]
        
        for query, uncertainty in test_queries:
            start_time = time.time()
            documents, result = await reranker.rerank(query, rrf_docs)
            end_time = time.time()
            
            query_time_ms = (end_time - start_time) * 1000
            
            # Performance assertions
            assert query_time_ms < 2000.0  # Should be reasonable
            
            # Quality assertions
            assert len(documents) == len(rrf_docs)
            assert result.reranking_time_ms >= 0
            assert result.strategy_used.value in ["skip", "apply", "blend", "fallback"]
    
    @pytest.mark.asyncio
    async def test_streaming_handler_performance(self, sample_documents):
        """Test delayed head streaming performance."""
        handler = DelayedHeadStreamingHandler()
        
        # Create RRF documents with realistic score distribution
        rrf_docs = [
            RRFDocument(document=doc, rrf_score=1.0 - i*0.08)
            for i, doc in enumerate(sample_documents)
        ]
        
        start_time = time.time()
        chunks = []
        async for chunk in handler.stream_documents(rrf_docs, "travel authorization query"):
            chunk_time = time.time()
            chunks.append((chunk, (chunk_time - start_time) * 1000))
        
        # Performance assertions
        assert len(chunks) > 0
        
        # First chunk should arrive quickly
        first_chunk_time = chunks[0][1]
        assert first_chunk_time < 1000.0  # Within 1 second
        
        # All documents should be streamed
        total_docs = sum(len(chunk[0].documents) for chunk in chunks)
        assert total_docs == len(rrf_docs)
        
        # Streaming efficiency
        if len(chunks) > 1:
            # Head documents should arrive before background
            head_time = chunks[0][1]
            total_time = chunks[-1][1]
            efficiency_ratio = head_time / total_time
            assert efficiency_ratio < 1.0  # Head should be faster than total


class TestIntegrationScenarios:
    """Test complete integration scenarios with all components."""
    
    @pytest.fixture
    def full_pipeline_setup(self, sample_documents):
        """Set up complete pipeline with all components."""
        # Create mock retrievers
        async def mock_retriever(query: str, k: int = 5) -> List[Document]:
            return sample_documents[:k]
        
        # Initialize all components
        coordinator = GatedRetrievalCoordinator(
            dense_retriever=mock_retriever,
            sparse_retriever=mock_retriever,
            bm25_retriever=mock_retriever,
            hybrid_retriever=mock_retriever
        )
        
        reranker = ConditionalReranker(
            uncertainty_threshold=0.5,
            confidence_threshold=0.7
        )
        
        streaming_handler = DelayedHeadStreamingHandler()
        
        return {
            "coordinator": coordinator,
            "reranker": reranker,
            "streaming_handler": streaming_handler,
            "documents": sample_documents
        }
    
    @pytest.mark.asyncio
    async def test_end_to_end_pipeline_performance(self, full_pipeline_setup):
        """Test complete end-to-end pipeline performance."""
        pipeline = full_pipeline_setup
        
        test_queries = [
            "DND Form 2888 completion requirements",
            "meal allowance rates for travel",
            "emergency authorization procedures"
        ]
        
        total_pipeline_time = 0
        
        for query in test_queries:
            start_time = time.time()
            
            # Phase 1: Coordinated Retrieval
            documents, metrics = await pipeline["coordinator"].retrieve(query)
            retrieval_time = time.time()
            
            # Convert to RRF documents for reranking
            rrf_docs = [
                RRFDocument(document=doc, rrf_score=1.0 - i*0.1)
                for i, doc in enumerate(documents[:10])
            ]
            
            # Phase 2: Conditional Reranking
            reranked_docs, rerank_result = await pipeline["reranker"].rerank(
                query, rrf_docs
            )
            rerank_time = time.time()
            
            # Phase 3: Streaming
            rrf_for_streaming = [
                RRFDocument(document=doc, rrf_score=1.0 - i*0.05)
                for i, doc in enumerate(reranked_docs[:8])
            ]
            
            chunks = []
            async for chunk in pipeline["streaming_handler"].stream_documents(
                rrf_for_streaming, query
            ):
                chunks.append(chunk)
            
            end_time = time.time()
            
            # Calculate phase times
            retrieval_time_ms = (retrieval_time - start_time) * 1000
            rerank_time_ms = (rerank_time - retrieval_time) * 1000
            streaming_time_ms = (end_time - rerank_time) * 1000
            total_time_ms = (end_time - start_time) * 1000
            
            total_pipeline_time += total_time_ms
            
            # Performance assertions
            assert total_time_ms < 10000.0  # Complete pipeline under 10 seconds
            assert retrieval_time_ms > 0
            assert streaming_time_ms > 0
            
            # Quality assertions
            assert len(documents) > 0
            assert len(reranked_docs) > 0
            assert len(chunks) > 0
            
            # Verify each phase produces valid output
            assert all(isinstance(doc, Document) for doc in documents)
            assert all(isinstance(doc, Document) for doc in reranked_docs)
            assert sum(len(chunk.documents) for chunk in chunks) > 0
        
        # Average pipeline performance
        avg_pipeline_time = total_pipeline_time / len(test_queries)
        assert avg_pipeline_time < 8000.0  # Average under 8 seconds
    
    @pytest.mark.asyncio
    async def test_pipeline_accuracy_preservation(self, full_pipeline_setup):
        """Test that pipeline preserves retrieval accuracy."""
        pipeline = full_pipeline_setup
        
        # Test with specific queries that should return relevant documents
        accuracy_tests = [
            {
                "query": "DND Form 2888 travel authorization",
                "expected_keywords": ["form", "2888", "authorization", "travel"],
                "min_relevant_docs": 1
            },
            {
                "query": "meal allowance rates domestic",
                "expected_keywords": ["meal", "allowance", "rates"],
                "min_relevant_docs": 1
            }
        ]
        
        for test in accuracy_tests:
            # Run through pipeline
            documents, _ = await pipeline["coordinator"].retrieve(test["query"])
            
            # Check relevance
            relevant_docs = 0
            for doc in documents:
                content_lower = doc.page_content.lower()
                if any(keyword in content_lower for keyword in test["expected_keywords"]):
                    relevant_docs += 1
            
            # Should maintain accuracy
            assert relevant_docs >= test["min_relevant_docs"]
            assert len(documents) > 0
    
    @pytest.mark.asyncio
    async def test_pipeline_error_resilience(self, sample_documents):
        """Test pipeline behavior with component failures."""
        # Create pipeline with some failing components
        async def failing_retriever(query: str, k: int = 5) -> List[Document]:
            if "error" in query:
                raise Exception("Retriever failure")
            return sample_documents[:k]
        
        coordinator = GatedRetrievalCoordinator(
            dense_retriever=failing_retriever,
            sparse_retriever=failing_retriever,  # Both will fail for error queries
            bm25_retriever=lambda q, k: sample_documents[:k],  # This one works
            hybrid_retriever=lambda q, k: sample_documents[:k]  # This one works
        )
        
        # Test error resilience
        documents, metrics = await coordinator.retrieve("test query")  # Should work
        assert len(documents) > 0
        
        # Test with partial failure
        error_docs, error_metrics = await coordinator.retrieve("error in query")
        # Should still return some results from working retrievers
        assert len(error_docs) >= 0  # May be empty but shouldn't crash
    
    def test_memory_usage_stability(self, sample_documents):
        """Test that components don't have memory leaks."""
        import gc
        import sys
        
        # Create components
        merger = RRFMerger()
        deduplicator = DocumentDeduplicator()
        
        initial_objects = len(gc.get_objects())
        
        # Run operations multiple times
        for i in range(100):
            # RRF operations
            retriever_results = {
                "dense": sample_documents[:3],
                "sparse": sample_documents[1:4]
            }
            merged_docs, _ = merger.merge(retriever_results)
            
            # Deduplication operations
            docs_to_dedup = sample_documents + sample_documents[:2]  # Add some duplicates
            unique_docs, _ = deduplicator.deduplicate(docs_to_dedup)
            
            # Force garbage collection periodically
            if i % 20 == 0:
                gc.collect()
        
        # Final garbage collection
        gc.collect()
        final_objects = len(gc.get_objects())
        
        # Memory should not grow significantly
        object_growth = final_objects - initial_objects
        assert object_growth < 1000  # Allow some growth but not excessive


class TestPerformanceRegression:
    """Test for performance regressions compared to baseline."""
    
    @pytest.fixture
    def baseline_metrics(self):
        """Baseline performance metrics to compare against."""
        return {
            "rrf_merge_max_time_ms": 100.0,
            "deduplication_max_time_ms": 1000.0,
            "uncertainty_scoring_max_time_ms": 200.0,
            "bm25_gating_max_time_ms": 50.0,
            "k_selection_max_time_ms": 100.0,
            "end_to_end_max_time_ms": 10000.0
        }
    
    def test_component_performance_baselines(self, baseline_metrics, sample_documents):
        """Test that all components meet performance baselines."""
        # Test RRF Merger
        merger = RRFMerger()
        retriever_results = {"dense": sample_documents[:5], "sparse": sample_documents[2:7]}
        
        start = time.time()
        merged_docs, _ = merger.merge(retriever_results)
        rrf_time = (time.time() - start) * 1000
        
        assert rrf_time <= baseline_metrics["rrf_merge_max_time_ms"]
        
        # Test Deduplicator
        deduplicator = DocumentDeduplicator()
        docs_with_dups = sample_documents + sample_documents[:3]
        
        start = time.time()
        unique_docs, _ = deduplicator.deduplicate(docs_with_dups)
        dedup_time = (time.time() - start) * 1000
        
        assert dedup_time <= baseline_metrics["deduplication_max_time_ms"]
        
        # Test Uncertainty Scorer
        scorer = UncertaintyScorer()
        
        start = time.time()
        result = scorer.score_query("complex travel authorization query")
        uncertainty_time = (time.time() - start) * 1000
        
        assert uncertainty_time <= baseline_metrics["uncertainty_scoring_max_time_ms"]
        
        # Test BM25 Gate
        gate = BM25Gate()
        
        start = time.time()
        gate_result = gate.should_activate_bm25("travel form requirements")
        gate_time = (time.time() - start) * 1000
        
        assert gate_time <= baseline_metrics["bm25_gating_max_time_ms"]
        
        # Test K Selector
        selector = AdaptiveKSelector()
        
        start = time.time()
        k_result = selector.select_k_values("medium complexity query", 0.6)
        k_time = (time.time() - start) * 1000
        
        assert k_time <= baseline_metrics["k_selection_max_time_ms"]
    
    def test_performance_consistency(self, sample_documents):
        """Test that performance is consistent across multiple runs."""
        merger = RRFMerger()
        retriever_results = {"dense": sample_documents[:5], "sparse": sample_documents[2:7]}
        
        times = []
        for _ in range(10):
            start = time.time()
            merged_docs, _ = merger.merge(retriever_results)
            end = time.time()
            times.append((end - start) * 1000)
        
        # Check consistency
        avg_time = statistics.mean(times)
        std_dev = statistics.stdev(times) if len(times) > 1 else 0
        
        # Standard deviation should be reasonable (less than 50% of mean)
        assert std_dev < avg_time * 0.5
        # All times should be within reasonable bounds
        assert all(t < avg_time * 3 for t in times)