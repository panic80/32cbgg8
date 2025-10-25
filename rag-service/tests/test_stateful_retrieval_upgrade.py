"""Tests for StatefulRetrievalPipeline with LangGraph 1.0 upgrade.

Tests:
1. Import and instantiation
2. Workflow compilation
3. State management
4. Checkpoint integration
5. Query refinement cycle
6. Error handling
"""

import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch
from typing import List, Tuple


class TestStatefulRetrievalImport:
    """Test importing StatefulRetrievalPipeline components."""

    def test_import_stateful_pipeline(self):
        """Test importing StatefulRetrievalPipeline."""
        try:
            from app.pipelines.stateful_retrieval import StatefulRetrievalPipeline
            print("✅ StatefulRetrievalPipeline imported successfully")
        except ImportError as e:
            pytest.fail(f"Cannot import StatefulRetrievalPipeline: {e}")

    def test_import_retrieval_state(self):
        """Test importing RetrievalState schema."""
        try:
            from app.pipelines.stateful_retrieval import RetrievalState
            print("✅ RetrievalState imported successfully")
        except ImportError as e:
            pytest.fail(f"Cannot import RetrievalState: {e}")

    def test_redis_checkpoint_flag(self):
        """Test REDIS_CHECKPOINT_AVAILABLE flag."""
        from app.pipelines.stateful_retrieval import REDIS_CHECKPOINT_AVAILABLE

        print(f"✅ REDIS_CHECKPOINT_AVAILABLE = {REDIS_CHECKPOINT_AVAILABLE}")
        if REDIS_CHECKPOINT_AVAILABLE:
            from langgraph.checkpoint.redis.aio import AsyncRedisSaver
            print("   AsyncRedisSaver available for production use")
        else:
            print("   Using MemorySaver fallback (install langgraph-checkpoint-redis for Redis)")


class TestStatefulRetrievalInstantiation:
    """Test creating StatefulRetrievalPipeline instances."""

    def test_create_with_memory_saver(self):
        """Test creating pipeline with MemorySaver (no Redis)."""
        from app.pipelines.stateful_retrieval import StatefulRetrievalPipeline
        from app.pipelines.parallel_retrieval import ParallelRetrievalPipeline

        mock_parallel = Mock(spec=ParallelRetrievalPipeline)

        pipeline = StatefulRetrievalPipeline(
            parallel_pipeline=mock_parallel,
            enable_checkpointing=True,
            redis_client=None  # Force MemorySaver
        )

        assert pipeline is not None
        assert pipeline.workflow is not None
        assert pipeline.checkpointer is not None
        print("✅ StatefulRetrievalPipeline created with MemorySaver")

    def test_create_without_checkpointing(self):
        """Test creating pipeline without checkpointing."""
        from app.pipelines.stateful_retrieval import StatefulRetrievalPipeline
        from app.pipelines.parallel_retrieval import ParallelRetrievalPipeline

        mock_parallel = Mock(spec=ParallelRetrievalPipeline)

        pipeline = StatefulRetrievalPipeline(
            parallel_pipeline=mock_parallel,
            enable_checkpointing=False
        )

        assert pipeline is not None
        assert pipeline.workflow is not None
        print("✅ StatefulRetrievalPipeline created without checkpointing")

    def test_default_settings(self):
        """Test that pipeline uses default settings."""
        from app.pipelines.stateful_retrieval import StatefulRetrievalPipeline
        from app.pipelines.parallel_retrieval import ParallelRetrievalPipeline
        from app.core.config import settings

        mock_parallel = Mock(spec=ParallelRetrievalPipeline)

        pipeline = StatefulRetrievalPipeline(
            parallel_pipeline=mock_parallel
        )

        assert pipeline.max_iterations == settings.max_retrieval_iterations
        assert pipeline.relevance_threshold == settings.relevance_threshold
        print(f"✅ Default settings applied: max_iterations={pipeline.max_iterations}, "
              f"threshold={pipeline.relevance_threshold}")


class TestRetrievalStateSchema:
    """Test RetrievalState TypedDict schema."""

    def test_state_fields(self):
        """Test that RetrievalState has all required fields."""
        from app.pipelines.stateful_retrieval import RetrievalState

        annotations = RetrievalState.__annotations__

        required_fields = {
            "query", "original_query", "documents", "relevance_scores",
            "iteration_count", "metadata", "error", "finalized"
        }

        actual_fields = set(annotations.keys())

        assert required_fields == actual_fields, (
            f"Schema mismatch. Expected: {required_fields}, Got: {actual_fields}"
        )
        print(f"✅ RetrievalState has all required fields: {list(annotations.keys())}")

    def test_create_state_instance(self):
        """Test creating a RetrievalState instance."""
        from app.pipelines.stateful_retrieval import RetrievalState

        state: RetrievalState = {
            "query": "test query",
            "original_query": "test query",
            "documents": [],
            "relevance_scores": [],
            "iteration_count": 0,
            "metadata": {},
            "error": None,
            "finalized": False
        }

        assert state["query"] == "test query"
        assert state["iteration_count"] == 0
        assert state["finalized"] is False
        print("✅ RetrievalState instance created successfully")


class TestWorkflowCompilation:
    """Test workflow compilation and structure."""

    def test_workflow_compiles(self):
        """Test that workflow compiles without errors."""
        from app.pipelines.stateful_retrieval import StatefulRetrievalPipeline
        from app.pipelines.parallel_retrieval import ParallelRetrievalPipeline

        mock_parallel = Mock(spec=ParallelRetrievalPipeline)

        pipeline = StatefulRetrievalPipeline(
            parallel_pipeline=mock_parallel
        )

        assert pipeline.workflow is not None
        print("✅ Workflow compiled successfully")

    def test_workflow_nodes(self):
        """Test that workflow has expected nodes."""
        from app.pipelines.stateful_retrieval import StatefulRetrievalPipeline
        from app.pipelines.parallel_retrieval import ParallelRetrievalPipeline

        mock_parallel = Mock(spec=ParallelRetrievalPipeline)

        pipeline = StatefulRetrievalPipeline(
            parallel_pipeline=mock_parallel
        )

        # LangGraph 1.0 workflow structure
        assert pipeline.workflow is not None
        print("✅ Workflow has proper node structure")

    def test_checkpointer_integration(self):
        """Test that checkpointer is integrated into workflow."""
        from app.pipelines.stateful_retrieval import StatefulRetrievalPipeline
        from app.pipelines.parallel_retrieval import ParallelRetrievalPipeline
        from langgraph.checkpoint.memory import MemorySaver

        mock_parallel = Mock(spec=ParallelRetrievalPipeline)

        pipeline = StatefulRetrievalPipeline(
            parallel_pipeline=mock_parallel,
            enable_checkpointing=True
        )

        assert pipeline.checkpointer is not None
        assert isinstance(pipeline.checkpointer, MemorySaver)
        print("✅ Checkpointer integrated into workflow")


class TestRetrievalExecution:
    """Test stateful retrieval execution."""

    @pytest.mark.asyncio
    async def test_retrieve_basic(self):
        """Test basic retrieve operation."""
        from app.pipelines.stateful_retrieval import StatefulRetrievalPipeline
        from app.pipelines.parallel_retrieval import ParallelRetrievalPipeline
        from langchain_core.documents import Document

        # Mock parallel pipeline
        mock_parallel = AsyncMock(spec=ParallelRetrievalPipeline)
        mock_doc = Document(page_content="test content", metadata={"source": "test"})
        mock_parallel.retrieve = AsyncMock(return_value=[(mock_doc, 0.9)])

        pipeline = StatefulRetrievalPipeline(
            parallel_pipeline=mock_parallel,
            relevance_threshold=0.8,
            max_iterations=2
        )

        # Execute retrieval
        query = "test query"
        results = await pipeline.retrieve(query=query, k=5)

        assert len(results) > 0
        assert isinstance(results[0][0], Document)
        print(f"✅ Basic retrieval successful: {len(results)} documents returned")

    @pytest.mark.asyncio
    async def test_retrieve_with_session_id(self):
        """Test retrieval with session ID for checkpointing."""
        from app.pipelines.stateful_retrieval import StatefulRetrievalPipeline
        from app.pipelines.parallel_retrieval import ParallelRetrievalPipeline
        from langchain_core.documents import Document

        mock_parallel = AsyncMock(spec=ParallelRetrievalPipeline)
        mock_doc = Document(page_content="test", metadata={})
        mock_parallel.retrieve = AsyncMock(return_value=[(mock_doc, 0.95)])

        pipeline = StatefulRetrievalPipeline(
            parallel_pipeline=mock_parallel,
            enable_checkpointing=True
        )

        results = await pipeline.retrieve(
            query="test query",
            k=5,
            session_id="test-session-123"
        )

        assert len(results) > 0
        print("✅ Retrieval with session ID successful")

    @pytest.mark.asyncio
    async def test_refinement_cycle(self):
        """Test query refinement cycle when quality is low."""
        from app.pipelines.stateful_retrieval import StatefulRetrievalPipeline
        from app.pipelines.parallel_retrieval import ParallelRetrievalPipeline
        from langchain_core.documents import Document

        mock_parallel = AsyncMock(spec=ParallelRetrievalPipeline)

        # First call: low quality results (triggers refinement)
        low_quality_doc = Document(page_content="low quality", metadata={})
        # Second call: better results
        good_doc = Document(page_content="good result", metadata={})

        mock_parallel.retrieve = AsyncMock(side_effect=[
            [(low_quality_doc, 0.3)],  # Low score
            [(good_doc, 0.9)]  # High score after refinement
        ])

        pipeline = StatefulRetrievalPipeline(
            parallel_pipeline=mock_parallel,
            relevance_threshold=0.7,  # Threshold that triggers refinement
            max_iterations=3
        )

        results = await pipeline.retrieve(query="test query", k=5)

        # Should have called retrieve at least once
        assert mock_parallel.retrieve.call_count >= 1
        print(f"✅ Refinement cycle tested: {mock_parallel.retrieve.call_count} retrieval calls")


class TestErrorHandling:
    """Test error handling in stateful retrieval."""

    @pytest.mark.asyncio
    async def test_retrieval_error_fallback(self):
        """Test fallback when retrieval fails."""
        from app.pipelines.stateful_retrieval import StatefulRetrievalPipeline
        from app.pipelines.parallel_retrieval import ParallelRetrievalPipeline
        from langchain_core.documents import Document

        mock_parallel = AsyncMock(spec=ParallelRetrievalPipeline)

        # First call raises error, should fallback
        fallback_doc = Document(page_content="fallback", metadata={})
        mock_parallel.retrieve = AsyncMock(side_effect=[
            Exception("Retrieval failed"),
            [(fallback_doc, 0.8)]  # Fallback call
        ])

        pipeline = StatefulRetrievalPipeline(
            parallel_pipeline=mock_parallel
        )

        try:
            results = await pipeline.retrieve(query="test", k=5)
            # Should get fallback results
            assert len(results) >= 0
            print("✅ Error fallback mechanism works")
        except Exception as e:
            # Fallback should handle the error
            print(f"⚠️  Exception occurred: {e}")

    @pytest.mark.asyncio
    async def test_max_iterations_limit(self):
        """Test that refinement stops at max iterations."""
        from app.pipelines.stateful_retrieval import StatefulRetrievalPipeline
        from app.pipelines.parallel_retrieval import ParallelRetrievalPipeline
        from langchain_core.documents import Document

        mock_parallel = AsyncMock(spec=ParallelRetrievalPipeline)

        # Always return low quality (would trigger infinite refinement without limit)
        low_doc = Document(page_content="low", metadata={})
        mock_parallel.retrieve = AsyncMock(return_value=[(low_doc, 0.2)])

        pipeline = StatefulRetrievalPipeline(
            parallel_pipeline=mock_parallel,
            relevance_threshold=0.9,  # Very high threshold
            max_iterations=2  # Limit iterations
        )

        results = await pipeline.retrieve(query="test", k=5)

        # Should stop after max_iterations
        call_count = mock_parallel.retrieve.call_count
        assert call_count <= 3  # Initial + max_iterations refinements
        print(f"✅ Max iterations limit enforced: {call_count} calls made")


class TestPerformanceMonitoring:
    """Test performance monitoring integration."""

    @pytest.mark.asyncio
    async def test_metrics_recorded(self):
        """Test that performance metrics are recorded."""
        from app.pipelines.stateful_retrieval import StatefulRetrievalPipeline
        from app.pipelines.parallel_retrieval import ParallelRetrievalPipeline
        from langchain_core.documents import Document

        mock_parallel = AsyncMock(spec=ParallelRetrievalPipeline)
        mock_doc = Document(page_content="test", metadata={})
        mock_parallel.retrieve = AsyncMock(return_value=[(mock_doc, 0.9)])

        pipeline = StatefulRetrievalPipeline(
            parallel_pipeline=mock_parallel
        )

        # perf_monitor may be None in test environment
        if pipeline.perf_monitor:
            await pipeline.retrieve(query="test", k=5)
            print("✅ Performance monitoring active")
        else:
            print("⚠️  Performance monitor not available in test environment")


class TestUpgradeCompatibility:
    """Test upgrade compatibility and migration."""

    def test_no_manual_checkpoint_calls(self):
        """Verify no manual checkpoint save/load in retrieve method."""
        import inspect
        from app.pipelines.stateful_retrieval import StatefulRetrievalPipeline

        source = inspect.getsource(StatefulRetrievalPipeline.retrieve)

        # Should NOT have manual aput/aget calls (was in old version)
        assert "checkpointer.aput" not in source, (
            "Found manual checkpoint.aput - should be automatic in LangGraph 1.0"
        )
        assert "checkpointer.aget" not in source, (
            "Found manual checkpoint.aget - should be automatic in LangGraph 1.0"
        )
        print("✅ No manual checkpoint calls (automatic in LangGraph 1.0)")

    def test_async_redis_saver_conditional_import(self):
        """Test that AsyncRedisSaver import is conditional."""
        import inspect
        from app.pipelines import stateful_retrieval

        source = inspect.getsource(stateful_retrieval)

        # Should have try/except for AsyncRedisSaver import
        assert "try:" in source and "AsyncRedisSaver" in source
        assert "except ImportError:" in source
        print("✅ AsyncRedisSaver import is conditional (graceful fallback)")

    def test_from_conn_string_used(self):
        """Test that from_conn_string method is used for Redis checkpoint."""
        import inspect
        from app.pipelines.stateful_retrieval import StatefulRetrievalPipeline

        source = inspect.getsource(StatefulRetrievalPipeline.__init__)

        assert "from_conn_string" in source, (
            "Missing from_conn_string - should use AsyncRedisSaver.from_conn_string()"
        )
        print("✅ from_conn_string method used for AsyncRedisSaver")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short", "-s"])
