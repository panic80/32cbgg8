"""
Tests for Gated Retrieval Coordinator.

Tests focus on realistic coordination scenarios and edge cases that could
break the orchestration logic. Tests should reveal actual integration issues
rather than catering to expected results.
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock
from typing import List, Dict

from langchain_core.documents import Document

from app.components.gated_retrieval_coordinator import (
    GatedRetrievalCoordinator,
    CoordinatorConfiguration,
    RetrieverExecutionResult,
    RetrievalCoordinationMetrics,
    create_gated_retrieval_coordinator
)
from app.components.uncertainty_scorer import UncertaintyScorer
from app.components.bm25_gating import BM25Gate
from app.components.adaptive_k_selector import AdaptiveKSelector
from app.components.rrf_merger import RRFMerger
from app.components.deduplicator import DocumentDeduplicator
from app.services.retrieval_cache import RetrievalL2Cache


class TestCoordinatorConfiguration:
    """Test coordinator configuration dataclass."""
    
    def test_default_configuration(self):
        """Test default configuration values."""
        config = CoordinatorConfiguration()
        
        assert config.enable_l2_cache is True
        assert config.enable_parallel_execution is True
        assert config.max_parallel_workers == 4
        assert config.retrieval_timeout_ms == 5000.0
        assert config.enable_detailed_metrics is True
        assert config.cache_threshold_docs == 5
        assert config.fallback_on_errors is True
        assert config.conservative_deduplication is True
    
    def test_custom_configuration(self):
        """Test custom configuration values."""
        config = CoordinatorConfiguration(
            enable_l2_cache=False,
            enable_parallel_execution=False,
            max_parallel_workers=2,
            retrieval_timeout_ms=1000.0
        )
        
        assert config.enable_l2_cache is False
        assert config.enable_parallel_execution is False
        assert config.max_parallel_workers == 2
        assert config.retrieval_timeout_ms == 1000.0


class TestRetrieverExecutionResult:
    """Test retriever execution result functionality."""
    
    def test_result_initialization(self):
        """Test result creation and basic properties."""
        result = RetrieverExecutionResult(
            retriever_name="dense",
            documents=[Document(page_content="test")],
            execution_time_ms=100.0,
            documents_requested=10,
            documents_returned=1,
            success=True
        )
        
        assert result.retriever_name == "dense"
        assert len(result.documents) == 1
        assert result.execution_time_ms == 100.0
        assert result.documents_requested == 10
        assert result.documents_returned == 1
        assert result.success is True
        assert result.error_message is None
    
    def test_retrieval_rate_calculation(self):
        """Test retrieval rate calculation."""
        # Normal case
        result = RetrieverExecutionResult(
            retriever_name="test",
            documents=[],
            execution_time_ms=100.0,  # 100ms
            documents_requested=10,
            documents_returned=5,
            success=True
        )
        
        # 5 docs in 100ms = 50 docs/second
        assert result.retrieval_rate == 50.0
        
        # Zero time case
        zero_time_result = RetrieverExecutionResult(
            retriever_name="test",
            documents=[],
            execution_time_ms=0.0,
            documents_requested=10,
            documents_returned=5,
            success=True
        )
        
        assert zero_time_result.retrieval_rate == 0.0
    
    def test_error_result(self):
        """Test error result creation."""
        error_result = RetrieverExecutionResult(
            retriever_name="failing",
            documents=[],
            execution_time_ms=50.0,
            documents_requested=10,
            documents_returned=0,
            success=False,
            error_message="Connection timeout"
        )
        
        assert error_result.success is False
        assert error_result.error_message == "Connection timeout"
        assert error_result.documents_returned == 0


class TestRetrievalCoordinationMetrics:
    """Test coordination metrics functionality."""
    
    def test_metrics_initialization(self):
        """Test metrics creation with all fields."""
        metrics = RetrievalCoordinationMetrics(
            query="test query",
            total_execution_time_ms=250.0,
            uncertainty_analysis_time_ms=10.0,
            bm25_gating_time_ms=5.0,
            k_selection_time_ms=8.0,
            cache_lookup_time_ms=15.0,
            retrieval_execution_time_ms=150.0,
            rrf_merge_time_ms=20.0,
            deduplication_time_ms=12.0,
            cache_store_time_ms=30.0,
            retrievers_executed=["dense", "sparse"],
            total_documents_retrieved=25,
            unique_documents_after_dedup=20,
            final_documents_returned=15,
            cache_hit=False,
            deduplication_ratio=0.2,
            average_retrieval_latency_ms=75.0,
            uncertainty_score=0.4,
            estimated_recall_coverage=0.8
        )
        
        assert metrics.query == "test query"
        assert metrics.total_execution_time_ms == 250.0
        assert metrics.cache_hit is False
        assert len(metrics.retrievers_executed) == 2
        assert metrics.deduplication_ratio == 0.2
    
    def test_total_speedup_ratio_calculation(self):
        """Test speedup ratio calculation for parallel execution."""
        # Parallel execution case
        parallel_metrics = RetrievalCoordinationMetrics(
            query="test",
            total_execution_time_ms=200.0,
            uncertainty_analysis_time_ms=0.0,
            bm25_gating_time_ms=0.0,
            k_selection_time_ms=0.0,
            cache_lookup_time_ms=0.0,
            retrieval_execution_time_ms=100.0,  # Parallel time
            rrf_merge_time_ms=0.0,
            deduplication_time_ms=0.0,
            cache_store_time_ms=0.0,
            retrievers_executed=["dense", "sparse"],
            total_documents_retrieved=20,
            unique_documents_after_dedup=15,
            final_documents_returned=10,
            cache_hit=False,
            deduplication_ratio=0.25,
            average_retrieval_latency_ms=80.0,  # Average per retriever
            uncertainty_score=0.5,
            estimated_recall_coverage=0.7
        )
        
        # Sequential would be: 2 retrievers * 80ms = 160ms
        # Parallel was: 100ms
        # Speedup ratio: 160/100 = 1.6
        expected_speedup = 160.0 / 100.0
        assert abs(parallel_metrics.total_speedup_ratio - expected_speedup) < 0.01


# Mock retriever functions for testing
async def mock_dense_retriever(query: str, k: int) -> List[Document]:
    """Mock dense retriever."""
    await asyncio.sleep(0.01)  # Simulate some latency
    return [
        Document(
            page_content=f"Dense result {i} for: {query}",
            metadata={"retriever": "dense", "rank": i, "score": 0.9 - (i * 0.1)}
        )
        for i in range(min(k, 5))  # Return up to 5 docs
    ]


async def mock_sparse_retriever(query: str, k: int) -> List[Document]:
    """Mock sparse retriever."""
    await asyncio.sleep(0.008)  # Slightly different latency
    return [
        Document(
            page_content=f"Sparse result {i} for query: {query}",
            metadata={"retriever": "sparse", "rank": i, "score": 0.85 - (i * 0.1)}
        )
        for i in range(min(k, 3))  # Return up to 3 docs
    ]


async def mock_bm25_retriever(query: str, k: int) -> List[Document]:
    """Mock BM25 retriever."""
    await asyncio.sleep(0.005)
    return [
        Document(
            page_content=f"BM25 keyword match {i}: {query}",
            metadata={"retriever": "bm25", "rank": i, "score": 0.8 - (i * 0.15)}
        )
        for i in range(min(k, 2))  # Return up to 2 docs
    ]


async def mock_failing_retriever(query: str, k: int) -> List[Document]:
    """Mock retriever that always fails."""
    raise Exception("Mock retriever failure")


def sync_mock_retriever(query: str, k: int) -> List[Document]:
    """Mock synchronous retriever."""
    return [
        Document(
            page_content=f"Sync result for: {query}",
            metadata={"retriever": "sync", "rank": 0}
        )
    ]


class TestGatedRetrievalCoordinator:
    """Test the main coordinator functionality."""
    
    def test_coordinator_initialization_defaults(self):
        """Test coordinator initialization with default components."""
        coordinator = GatedRetrievalCoordinator()
        
        # Should create default components
        assert coordinator.uncertainty_scorer is not None
        assert coordinator.bm25_gate is not None
        assert coordinator.adaptive_k_selector is not None
        assert coordinator.rrf_merger is not None
        assert coordinator.deduplicator is not None
        
        # No retrievers by default
        assert all(func is None for func in coordinator.retrievers.values())
        
        # Default configuration
        assert coordinator.config.enable_l2_cache is True
        assert coordinator.config.enable_parallel_execution is True
    
    def test_coordinator_initialization_custom_components(self):
        """Test coordinator initialization with custom components."""
        mock_scorer = MagicMock(spec=UncertaintyScorer)
        mock_gate = MagicMock(spec=BM25Gate)
        mock_selector = MagicMock(spec=AdaptiveKSelector)
        mock_cache = MagicMock(spec=RetrievalL2Cache)
        
        coordinator = GatedRetrievalCoordinator(
            uncertainty_scorer=mock_scorer,
            bm25_gate=mock_gate,
            adaptive_k_selector=mock_selector,
            l2_cache=mock_cache,
            dense_retriever=mock_dense_retriever,
            sparse_retriever=mock_sparse_retriever
        )
        
        assert coordinator.uncertainty_scorer == mock_scorer
        assert coordinator.bm25_gate == mock_gate
        assert coordinator.adaptive_k_selector == mock_selector
        assert coordinator.l2_cache == mock_cache
        assert coordinator.retrievers["dense"] == mock_dense_retriever
        assert coordinator.retrievers["sparse"] == mock_sparse_retriever
    
    @pytest.mark.asyncio
    async def test_basic_retrieval_flow(self):
        """Test basic end-to-end retrieval flow."""
        coordinator = GatedRetrievalCoordinator(
            dense_retriever=mock_dense_retriever,
            sparse_retriever=mock_sparse_retriever,
            l2_cache=None  # Disable cache for this test
        )
        
        query = "CF travel accommodation expenses"
        documents, metrics = await coordinator.retrieve(query)
        
        # Should return some documents
        assert isinstance(documents, list)
        assert len(documents) > 0
        
        # All items should be Documents
        assert all(isinstance(doc, Document) for doc in documents)
        
        # Should have comprehensive metrics
        assert isinstance(metrics, RetrievalCoordinationMetrics)
        assert metrics.query == query
        assert metrics.total_execution_time_ms > 0
        assert len(metrics.retrievers_executed) > 0
        assert metrics.total_documents_retrieved > 0
        assert metrics.cache_hit is False  # No cache
    
    @pytest.mark.asyncio
    async def test_empty_query_handling(self):
        """Test handling of empty queries."""
        coordinator = GatedRetrievalCoordinator(
            dense_retriever=mock_dense_retriever
        )
        
        # Empty string
        documents, metrics = await coordinator.retrieve("")
        
        # Should handle gracefully (might return empty or minimal results)
        assert isinstance(documents, list)
        assert isinstance(metrics, RetrievalCoordinationMetrics)
        assert metrics.total_execution_time_ms >= 0
        
        # Whitespace only
        documents2, metrics2 = await coordinator.retrieve("   ")
        assert isinstance(documents2, list)
        assert isinstance(metrics2, RetrievalCoordinationMetrics)
    
    @pytest.mark.asyncio
    async def test_single_retriever_execution(self):
        """Test execution with only one retriever."""
        coordinator = GatedRetrievalCoordinator(
            dense_retriever=mock_dense_retriever,
            # No other retrievers
        )
        
        documents, metrics = await coordinator.retrieve("test query")
        
        # Should still work with one retriever
        assert len(documents) > 0
        assert len(metrics.retrievers_executed) == 1
        assert "dense" in metrics.retrievers_executed
    
    @pytest.mark.asyncio
    async def test_multiple_retrievers_execution(self):
        """Test execution with multiple retrievers."""
        coordinator = GatedRetrievalCoordinator(
            dense_retriever=mock_dense_retriever,
            sparse_retriever=mock_sparse_retriever,
            bm25_retriever=mock_bm25_retriever
        )
        
        # Query likely to activate BM25
        query = '"Form DND 2888" completion requirements'
        documents, metrics = await coordinator.retrieve(query)
        
        # Should execute multiple retrievers
        assert len(documents) > 0
        assert len(metrics.retrievers_executed) >= 2  # At least dense + sparse
        assert metrics.total_documents_retrieved > 0
        
        # Should have reasonable deduplication
        assert 0.0 <= metrics.deduplication_ratio <= 1.0
    
    @pytest.mark.asyncio
    async def test_retriever_failure_handling(self):
        """Test handling of retriever failures."""
        coordinator = GatedRetrievalCoordinator(
            dense_retriever=mock_dense_retriever,  # Working retriever
            sparse_retriever=mock_failing_retriever,  # Failing retriever
            config=CoordinatorConfiguration(fallback_on_errors=True)
        )
        
        documents, metrics = await coordinator.retrieve("test query")
        
        # Should still return results from working retriever
        assert len(documents) > 0  # Dense retriever should work
        
        # Metrics should reflect the failure
        assert len(metrics.retrievers_executed) >= 1
        # Should have tried both retrievers (success + failure)
    
    @pytest.mark.asyncio
    async def test_no_retrievers_available(self):
        """Test behavior when no retrievers are configured."""
        coordinator = GatedRetrievalCoordinator()  # No retrievers
        
        documents, metrics = await coordinator.retrieve("test query")
        
        # Should return empty results gracefully
        assert isinstance(documents, list)
        assert len(documents) == 0
        assert len(metrics.retrievers_executed) == 0
        assert metrics.total_documents_retrieved == 0
    
    @pytest.mark.asyncio
    async def test_synchronous_retriever_support(self):
        """Test support for synchronous retriever functions."""
        coordinator = GatedRetrievalCoordinator(
            dense_retriever=sync_mock_retriever,  # Synchronous function
            sparse_retriever=mock_sparse_retriever  # Async function
        )
        
        documents, metrics = await coordinator.retrieve("test query")
        
        # Should work with mixed sync/async retrievers
        assert len(documents) > 0
        assert len(metrics.retrievers_executed) >= 1
    
    @pytest.mark.asyncio
    async def test_max_final_docs_limiting(self):
        """Test limiting final document count."""
        coordinator = GatedRetrievalCoordinator(
            dense_retriever=mock_dense_retriever,
            sparse_retriever=mock_sparse_retriever
        )
        
        # Request many docs but limit final output
        documents, metrics = await coordinator.retrieve(
            "comprehensive travel policy documentation",
            max_final_docs=3
        )
        
        # Should respect the limit
        assert len(documents) <= 3
        assert metrics.final_documents_returned <= 3
        # But might have retrieved more initially
        assert metrics.total_documents_retrieved >= metrics.final_documents_returned
    
    @pytest.mark.asyncio
    async def test_cache_integration(self):
        """Test L2 cache integration."""
        mock_cache = AsyncMock(spec=RetrievalL2Cache)
        mock_cache.get.return_value = None  # Cache miss first time
        mock_cache.set.return_value = True   # Successful cache store
        
        coordinator = GatedRetrievalCoordinator(
            dense_retriever=mock_dense_retriever,
            sparse_retriever=mock_sparse_retriever,
            l2_cache=mock_cache
        )
        
        query = "cache test query"
        
        # First call - should be cache miss
        documents1, metrics1 = await coordinator.retrieve(query)
        
        assert metrics1.cache_hit is False
        assert len(documents1) > 0
        
        # Cache should have been called
        mock_cache.get.assert_called_once()
        mock_cache.set.assert_called_once()
        
        # Second call - simulate cache hit
        mock_cache.get.return_value = (
            [MagicMock() for _ in range(3)],  # Mock RRF documents
            {"retrieval_stats": "test"}
        )
        
        documents2, metrics2 = await coordinator.retrieve(query)
        
        assert metrics2.cache_hit is True
        # Should have called cache.get again
        assert mock_cache.get.call_count == 2
    
    @pytest.mark.asyncio
    async def test_force_cache_refresh(self):
        """Test forcing cache refresh."""
        mock_cache = AsyncMock(spec=RetrievalL2Cache)
        mock_cache.get.return_value = (
            [MagicMock() for _ in range(2)], 
            {"cached": True}
        )
        
        coordinator = GatedRetrievalCoordinator(
            dense_retriever=mock_dense_retriever,
            l2_cache=mock_cache
        )
        
        # Call with force_cache_refresh=True
        documents, metrics = await coordinator.retrieve(
            "test query",
            force_cache_refresh=True
        )
        
        # Should not have called cache.get due to force refresh
        mock_cache.get.assert_not_called()
        assert metrics.cache_hit is False
        assert len(documents) > 0
    
    @pytest.mark.asyncio
    async def test_parallel_vs_sequential_execution(self):
        """Test difference between parallel and sequential execution."""
        # Parallel execution
        parallel_coordinator = GatedRetrievalCoordinator(
            dense_retriever=mock_dense_retriever,
            sparse_retriever=mock_sparse_retriever,
            config=CoordinatorConfiguration(enable_parallel_execution=True)
        )
        
        # Sequential execution
        sequential_coordinator = GatedRetrievalCoordinator(
            dense_retriever=mock_dense_retriever,
            sparse_retriever=mock_sparse_retriever,
            config=CoordinatorConfiguration(enable_parallel_execution=False)
        )
        
        query = "performance test query"
        
        # Execute both
        docs_parallel, metrics_parallel = await parallel_coordinator.retrieve(query)
        docs_sequential, metrics_sequential = await sequential_coordinator.retrieve(query)
        
        # Both should return documents
        assert len(docs_parallel) > 0
        assert len(docs_sequential) > 0
        
        # Parallel should generally be faster (but not guaranteed in mock scenario)
        # Just verify both work
        assert metrics_parallel.total_execution_time_ms > 0
        assert metrics_sequential.total_execution_time_ms > 0
    
    @pytest.mark.asyncio
    async def test_retrieval_timeout(self):
        """Test retrieval timeout handling."""
        async def slow_retriever(query: str, k: int) -> List[Document]:
            await asyncio.sleep(2.0)  # 2 second delay
            return [Document(page_content="slow result")]
        
        coordinator = GatedRetrievalCoordinator(
            dense_retriever=slow_retriever,
            config=CoordinatorConfiguration(retrieval_timeout_ms=100.0)  # 100ms timeout
        )
        
        documents, metrics = await coordinator.retrieve("timeout test")
        
        # Should handle timeout gracefully
        assert isinstance(documents, list)
        assert isinstance(metrics, RetrievalCoordinationMetrics)
        # May or may not have documents depending on timeout behavior
    
    def test_coordinator_stats(self):
        """Test coordinator statistics tracking."""
        coordinator = GatedRetrievalCoordinator(
            dense_retriever=mock_dense_retriever,
            sparse_retriever=mock_sparse_retriever
        )
        
        stats = coordinator.get_coordinator_stats()
        
        # Should have all expected fields
        assert "total_queries" in stats
        assert "cache_hits" in stats
        assert "cache_hit_rate" in stats
        assert "average_execution_time_ms" in stats
        assert "configuration" in stats
        assert "active_retrievers" in stats
        assert "component_status" in stats
        
        # Initial state
        assert stats["total_queries"] == 0
        assert stats["cache_hits"] == 0
        assert stats["cache_hit_rate"] == 0.0
        
        # Active retrievers should be listed
        assert "dense" in stats["active_retrievers"]
        assert "sparse" in stats["active_retrievers"]
        assert "bm25" not in stats["active_retrievers"]  # Not configured
    
    def test_coordinator_cleanup(self):
        """Test coordinator resource cleanup."""
        coordinator = GatedRetrievalCoordinator(
            dense_retriever=mock_dense_retriever,
            config=CoordinatorConfiguration(enable_parallel_execution=True)
        )
        
        # Should not raise exceptions
        coordinator.close()
        
        # Multiple calls should be safe
        coordinator.close()


class TestFactoryFunction:
    """Test factory function for creating coordinators."""
    
    def test_create_gated_retrieval_coordinator_defaults(self):
        """Test factory function with default parameters."""
        coordinator = create_gated_retrieval_coordinator(
            dense_retriever=mock_dense_retriever
        )
        
        assert isinstance(coordinator, GatedRetrievalCoordinator)
        assert coordinator.retrievers["dense"] == mock_dense_retriever
        assert coordinator.retrievers["sparse"] is None
        
        # Should have default components
        assert coordinator.uncertainty_scorer is not None
        assert coordinator.bm25_gate is not None
    
    def test_create_gated_retrieval_coordinator_full_config(self):
        """Test factory function with full configuration."""
        mock_scorer = MagicMock(spec=UncertaintyScorer)
        mock_gate = MagicMock(spec=BM25Gate)
        mock_cache = MagicMock(spec=RetrievalL2Cache)
        config = CoordinatorConfiguration(enable_parallel_execution=False)
        
        coordinator = create_gated_retrieval_coordinator(
            dense_retriever=mock_dense_retriever,
            sparse_retriever=mock_sparse_retriever,
            bm25_retriever=mock_bm25_retriever,
            uncertainty_scorer=mock_scorer,
            bm25_gate=mock_gate,
            l2_cache=mock_cache,
            config=config
        )
        
        # Should use provided components
        assert coordinator.uncertainty_scorer == mock_scorer
        assert coordinator.bm25_gate == mock_gate
        assert coordinator.l2_cache == mock_cache
        assert coordinator.config == config
        
        # Should have all retrievers
        assert coordinator.retrievers["dense"] == mock_dense_retriever
        assert coordinator.retrievers["sparse"] == mock_sparse_retriever
        assert coordinator.retrievers["bm25"] == mock_bm25_retriever


class TestIntegrationScenarios:
    """Test realistic integration scenarios."""
    
    @pytest.mark.asyncio
    async def test_typical_cf_query_flow(self):
        """Test with typical CF travel queries."""
        coordinator = GatedRetrievalCoordinator(
            dense_retriever=mock_dense_retriever,
            sparse_retriever=mock_sparse_retriever,
            bm25_retriever=mock_bm25_retriever
        )
        
        cf_queries = [
            "meal allowance rates domestic travel",
            "DND 2888 form completion requirements",
            "accommodation expense receipt documentation",
            "temporary duty travel authorization policy"
        ]
        
        for query in cf_queries:
            documents, metrics = await coordinator.retrieve(query)
            
            # Each query should return reasonable results
            assert isinstance(documents, list)
            assert isinstance(metrics, RetrievalCoordinationMetrics)
            assert metrics.total_execution_time_ms > 0
            
            # Should have used appropriate retrievers based on query
            assert len(metrics.retrievers_executed) >= 1
    
    @pytest.mark.asyncio
    async def test_error_recovery_scenarios(self):
        """Test various error recovery scenarios."""
        # Mixed working and failing retrievers
        coordinator = GatedRetrievalCoordinator(
            dense_retriever=mock_dense_retriever,       # Working
            sparse_retriever=mock_failing_retriever,    # Failing
            bm25_retriever=mock_bm25_retriever,         # Working
            config=CoordinatorConfiguration(fallback_on_errors=True)
        )
        
        documents, metrics = await coordinator.retrieve("error recovery test")
        
        # Should have some results from working retrievers
        # (Exact expectations depend on error handling implementation)
        assert isinstance(documents, list)
        assert isinstance(metrics, RetrievalCoordinationMetrics)
        assert metrics.total_execution_time_ms > 0
    
    @pytest.mark.asyncio  
    async def test_performance_under_load(self):
        """Test coordinator performance with multiple concurrent queries."""
        coordinator = GatedRetrievalCoordinator(
            dense_retriever=mock_dense_retriever,
            sparse_retriever=mock_sparse_retriever,
            config=CoordinatorConfiguration(
                enable_parallel_execution=True,
                max_parallel_workers=2
            )
        )
        
        # Execute multiple queries concurrently
        queries = [
            "query 1",
            "query 2", 
            "query 3",
            "query 4"
        ]
        
        # Run concurrently
        tasks = [coordinator.retrieve(query) for query in queries]
        results = await asyncio.gather(*tasks)
        
        # All should complete successfully
        assert len(results) == len(queries)
        
        for documents, metrics in results:
            assert isinstance(documents, list)
            assert isinstance(metrics, RetrievalCoordinationMetrics)
            assert metrics.total_execution_time_ms > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])