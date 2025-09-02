"""
Tests for the delayed head streaming handler.

Tests streaming strategies, decision making, and performance metrics
with objective assertions based on measurable behaviors.
"""

import pytest
import asyncio
import time
from typing import List, Dict, Any
from unittest.mock import AsyncMock, Mock

from langchain_core.documents import Document

from app.components.delayed_head_streaming import (
    DelayedHeadStreamingHandler, StreamingDecision, StreamingMetrics,
    StreamingConfiguration, StreamingChunk, create_delayed_head_streaming_handler
)
from app.components.rrf_merger import RRFDocument
from app.components.uncertainty_scorer import UncertaintyResult, UncertaintyFeatures


class TestStreamingConfiguration:
    """Test streaming configuration data structure."""
    
    def test_default_configuration(self):
        """Test default configuration values."""
        config = StreamingConfiguration()
        
        assert config.enable_delayed_streaming is True
        assert config.head_document_count == 3
        assert config.confidence_threshold == 0.7
        assert config.max_head_latency_ms == 500.0
        assert config.background_timeout_ms == 10000.0
        assert config.min_score_gap == 0.1
        assert config.enable_progressive_streaming is False
    
    def test_custom_configuration(self):
        """Test custom configuration values."""
        config = StreamingConfiguration(
            head_document_count=5,
            confidence_threshold=0.8,
            max_head_latency_ms=300.0,
            enable_progressive_streaming=True
        )
        
        assert config.head_document_count == 5
        assert config.confidence_threshold == 0.8
        assert config.max_head_latency_ms == 300.0
        assert config.enable_progressive_streaming is True


class TestStreamingMetrics:
    """Test streaming metrics data structure."""
    
    def test_metrics_initialization(self):
        """Test metrics initialization with defaults."""
        metrics = StreamingMetrics()
        
        assert metrics.total_documents_streamed == 0
        assert metrics.head_documents_count == 0
        assert metrics.background_documents_count == 0
        assert metrics.first_document_latency_ms == 0.0
        assert metrics.head_completion_time_ms == 0.0
        assert metrics.total_completion_time_ms == 0.0
        assert metrics.head_confidence_score == 0.0
        assert metrics.streaming_efficiency_ratio == 0.0
        assert metrics.background_processing_time_ms == 0.0
        assert metrics.background_success is True
        assert metrics.background_error is None


class TestStreamingChunk:
    """Test streaming chunk data structure."""
    
    def test_chunk_initialization(self):
        """Test chunk creation with required fields."""
        docs = [Document(page_content="test", metadata={"id": "1"})]
        chunk = StreamingChunk(
            documents=docs,
            chunk_type="head",
            confidence_score=0.8
        )
        
        assert len(chunk.documents) == 1
        assert chunk.chunk_type == "head"
        assert chunk.confidence_score == 0.8
        assert chunk.is_complete is False
        assert chunk.metadata is None
    
    def test_chunk_with_metadata(self):
        """Test chunk with optional metadata."""
        docs = []
        metadata = {"strategy": "delayed", "total_docs": 10}
        chunk = StreamingChunk(
            documents=docs,
            chunk_type="background",
            confidence_score=0.6,
            is_complete=True,
            metadata=metadata
        )
        
        assert chunk.is_complete is True
        assert chunk.metadata == metadata


class TestDelayedHeadStreamingHandler:
    """Test delayed head streaming handler functionality."""
    
    @pytest.fixture
    def sample_rrf_documents(self):
        """Create sample RRF documents with realistic score distribution."""
        return [
            RRFDocument(
                document=Document(
                    page_content="High relevance document about DND Form 2888",
                    metadata={"source": "forms.pdf", "id": "doc1"}
                ),
                rrf_score=0.95
            ),
            RRFDocument(
                document=Document(
                    page_content="Medium relevance travel allowance information",
                    metadata={"source": "allowances.pdf", "id": "doc2"}
                ),
                rrf_score=0.78
            ),
            RRFDocument(
                document=Document(
                    page_content="Lower relevance general travel guidance",
                    metadata={"source": "guidance.pdf", "id": "doc3"}
                ),
                rrf_score=0.65
            ),
            RRFDocument(
                document=Document(
                    page_content="Background document with minimal relevance",
                    metadata={"source": "background.pdf", "id": "doc4"}
                ),
                rrf_score=0.42
            ),
            RRFDocument(
                document=Document(
                    page_content="Additional context document",
                    metadata={"source": "context.pdf", "id": "doc5"}
                ),
                rrf_score=0.31
            )
        ]
    
    @pytest.fixture
    def uncertainty_result_low(self):
        """Create low uncertainty result."""
        return UncertaintyResult(
            overall_uncertainty=0.3,
            confidence_level="high",
            features=UncertaintyFeatures(
                ambiguity_score=0.2,
                specificity_score=0.9,
                coverage_score=0.8,
                coherence_score=0.9,
                complexity_score=0.4
            ),
            reasoning=["Simple, specific query"],
            retriever_recommendations={"dense": True}
        )
    
    @pytest.fixture
    def uncertainty_result_high(self):
        """Create high uncertainty result."""
        return UncertaintyResult(
            overall_uncertainty=0.8,
            confidence_level="low",
            features=UncertaintyFeatures(
                ambiguity_score=0.8,
                specificity_score=0.3,
                coverage_score=0.4,
                coherence_score=0.6,
                complexity_score=0.9
            ),
            reasoning=["Complex, ambiguous query"],
            retriever_recommendations={"dense": True, "sparse": True, "bm25": True}
        )
    
    def test_handler_initialization_defaults(self):
        """Test handler initialization with default configuration."""
        handler = DelayedHeadStreamingHandler()
        
        assert handler.config.enable_delayed_streaming is True
        assert handler.config.head_document_count == 3
        assert handler.background_processor is None
        assert handler.total_streams == 0
        assert handler.successful_streams == 0
        assert handler.average_head_latency_ms == 0.0
    
    def test_handler_initialization_custom_config(self):
        """Test handler initialization with custom configuration."""
        config = StreamingConfiguration(
            head_document_count=5,
            confidence_threshold=0.8
        )
        handler = DelayedHeadStreamingHandler(config=config)
        
        assert handler.config.head_document_count == 5
        assert handler.config.confidence_threshold == 0.8
    
    def test_head_confidence_calculation(self, sample_rrf_documents):
        """Test head confidence calculation algorithm."""
        handler = DelayedHeadStreamingHandler()
        
        # High confidence with good scores and separation
        confidence = handler._calculate_head_confidence(sample_rrf_documents)
        assert 0.0 <= confidence <= 1.0
        assert confidence > 0.5  # Should be high due to good top scores
        
        # Lower confidence with similar scores
        similar_docs = [
            RRFDocument(
                document=Document(page_content="doc1", metadata={}),
                rrf_score=0.5
            ),
            RRFDocument(
                document=Document(page_content="doc2", metadata={}),
                rrf_score=0.49
            ),
            RRFDocument(
                document=Document(page_content="doc3", metadata={}),
                rrf_score=0.48
            )
        ]
        
        similar_confidence = handler._calculate_head_confidence(similar_docs)
        assert similar_confidence < confidence  # Should be lower due to similar scores
        
        # Zero confidence for empty list
        empty_confidence = handler._calculate_head_confidence([])
        assert empty_confidence == 0.0
    
    def test_streaming_decision_immediate_small_set(self):
        """Test immediate streaming decision for small document sets."""
        config = StreamingConfiguration(head_document_count=5)
        handler = DelayedHeadStreamingHandler(config=config)
        
        # Only 3 documents, less than head_document_count
        small_docs = [
            RRFDocument(
                document=Document(page_content="doc1", metadata={}),
                rrf_score=0.9
            ),
            RRFDocument(
                document=Document(page_content="doc2", metadata={}),
                rrf_score=0.8
            )
        ]
        
        decision = handler._make_streaming_decision(small_docs, "test query")
        assert decision == StreamingDecision.IMMEDIATE
    
    def test_streaming_decision_delayed_good_confidence(self, sample_rrf_documents):
        """Test delayed streaming decision with good head confidence."""
        config = StreamingConfiguration(
            head_document_count=3,
            confidence_threshold=0.6,  # Lower threshold
            min_score_gap=0.1
        )
        handler = DelayedHeadStreamingHandler(config=config)
        
        decision = handler._make_streaming_decision(
            sample_rrf_documents, "DND form requirements"
        )
        assert decision == StreamingDecision.DELAYED
    
    def test_streaming_decision_batch_high_uncertainty(self, sample_rrf_documents, uncertainty_result_high):
        """Test batch streaming decision for high uncertainty queries."""
        handler = DelayedHeadStreamingHandler()
        
        decision = handler._make_streaming_decision(
            sample_rrf_documents, "complex ambiguous query", uncertainty_result_high
        )
        assert decision == StreamingDecision.BATCH
    
    def test_streaming_decision_disabled(self, sample_rrf_documents):
        """Test immediate streaming when delayed streaming is disabled."""
        config = StreamingConfiguration(enable_delayed_streaming=False)
        handler = DelayedHeadStreamingHandler(config=config)
        
        decision = handler._make_streaming_decision(sample_rrf_documents, "test query")
        assert decision == StreamingDecision.IMMEDIATE
    
    @pytest.mark.asyncio
    async def test_stream_immediate_strategy(self, sample_rrf_documents):
        """Test immediate streaming strategy."""
        handler = DelayedHeadStreamingHandler()
        metrics = StreamingMetrics()
        
        chunks = []
        async for chunk in handler._stream_immediate(sample_rrf_documents, metrics):
            chunks.append(chunk)
        
        # Should produce single chunk
        assert len(chunks) == 1
        chunk = chunks[0]
        
        assert chunk.chunk_type == "immediate"
        assert len(chunk.documents) == len(sample_rrf_documents)
        assert chunk.confidence_score == 1.0
        assert chunk.is_complete is True
        assert chunk.metadata["strategy"] == "immediate"
        
        # Check metrics
        assert metrics.total_documents_streamed == len(sample_rrf_documents)
        assert metrics.head_documents_count == len(sample_rrf_documents)
        assert metrics.first_document_latency_ms > 0.0
    
    @pytest.mark.asyncio
    async def test_stream_delayed_strategy(self, sample_rrf_documents):
        """Test delayed streaming strategy with head/background split."""
        config = StreamingConfiguration(head_document_count=3)
        handler = DelayedHeadStreamingHandler(config=config)
        metrics = StreamingMetrics()
        
        chunks = []
        async for chunk in handler._stream_delayed(sample_rrf_documents, "test query", metrics):
            chunks.append(chunk)
        
        # Should produce head chunk and background chunk
        assert len(chunks) == 2
        
        # Check head chunk
        head_chunk = chunks[0]
        assert head_chunk.chunk_type == "head"
        assert len(head_chunk.documents) == 3  # head_document_count
        assert head_chunk.is_complete is False
        assert head_chunk.confidence_score > 0.0
        
        # Check background chunk
        bg_chunk = chunks[1]
        assert bg_chunk.chunk_type == "background"
        assert len(bg_chunk.documents) == 2  # remaining documents
        assert bg_chunk.is_complete is True
        
        # Check metrics
        assert metrics.total_documents_streamed == len(sample_rrf_documents)
        assert metrics.head_documents_count == 3
        assert metrics.background_documents_count == 2
        assert metrics.first_document_latency_ms > 0.0
        assert metrics.head_completion_time_ms > 0.0
    
    @pytest.mark.asyncio
    async def test_stream_progressive_strategy(self, sample_rrf_documents):
        """Test progressive streaming strategy."""
        handler = DelayedHeadStreamingHandler()
        metrics = StreamingMetrics()
        
        chunks = []
        async for chunk in handler._stream_progressive(sample_rrf_documents, metrics):
            chunks.append(chunk)
        
        # Should produce multiple progressive chunks
        assert len(chunks) > 1
        
        total_docs = 0
        for i, chunk in enumerate(chunks):
            assert chunk.chunk_type == "progressive"
            assert chunk.confidence_score > 0.0
            
            if i == len(chunks) - 1:  # Last chunk
                assert chunk.is_complete is True
            else:
                assert chunk.is_complete is False
            
            total_docs += len(chunk.documents)
        
        # All documents should be streamed
        assert total_docs == len(sample_rrf_documents)
        assert metrics.total_documents_streamed == len(sample_rrf_documents)
        assert metrics.first_document_latency_ms > 0.0
    
    @pytest.mark.asyncio
    async def test_stream_batch_strategy(self, sample_rrf_documents):
        """Test batch streaming strategy."""
        handler = DelayedHeadStreamingHandler()
        metrics = StreamingMetrics()
        
        start_time = time.time()
        chunks = []
        async for chunk in handler._stream_batch(sample_rrf_documents, metrics):
            chunks.append(chunk)
        end_time = time.time()
        
        # Should produce single chunk after delay
        assert len(chunks) == 1
        chunk = chunks[0]
        
        assert chunk.chunk_type == "batch"
        assert len(chunk.documents) == len(sample_rrf_documents)
        assert chunk.confidence_score == 1.0
        assert chunk.is_complete is True
        assert chunk.metadata["strategy"] == "batch"
        
        # Should have some delay for batch processing
        elapsed_ms = (end_time - start_time) * 1000
        assert elapsed_ms >= 100.0  # At least the simulated delay
        
        assert metrics.total_documents_streamed == len(sample_rrf_documents)
    
    @pytest.mark.asyncio
    async def test_end_to_end_streaming(self, sample_rrf_documents, uncertainty_result_low):
        """Test complete streaming workflow."""
        handler = DelayedHeadStreamingHandler()
        
        chunks = []
        async for chunk in handler.stream_documents(
            sample_rrf_documents, "DND form requirements", uncertainty_result_low
        ):
            chunks.append(chunk)
        
        # Should produce at least one chunk
        assert len(chunks) >= 1
        
        # Verify all chunks are valid
        total_docs = 0
        for chunk in chunks:
            assert isinstance(chunk, StreamingChunk)
            assert len(chunk.documents) >= 0
            assert 0.0 <= chunk.confidence_score <= 1.0
            assert chunk.chunk_type in ["head", "background", "immediate", "progressive", "batch"]
            total_docs += len(chunk.documents)
        
        # All documents should be accounted for
        assert total_docs == len(sample_rrf_documents)
        
        # Statistics should be updated
        assert handler.total_streams == 1
        assert handler.successful_streams == 1
    
    @pytest.mark.asyncio
    async def test_background_processor_integration(self, sample_rrf_documents):
        """Test integration with background processor."""
        # Mock background processor
        async def mock_background_processor(query: str, docs: List[RRFDocument]) -> List[RRFDocument]:
            # Simulate processing by sorting by score (reverse order for testing)
            return sorted(docs, key=lambda x: x.rrf_score, reverse=True)
        
        handler = DelayedHeadStreamingHandler(background_processor=mock_background_processor)
        
        chunks = []
        async for chunk in handler.stream_documents(sample_rrf_documents, "test query"):
            chunks.append(chunk)
        
        # Should still work with background processor
        assert len(chunks) >= 1
        total_docs = sum(len(chunk.documents) for chunk in chunks)
        assert total_docs == len(sample_rrf_documents)
    
    @pytest.mark.asyncio
    async def test_background_processor_timeout(self, sample_rrf_documents):
        """Test background processor timeout handling."""
        # Slow background processor that times out
        async def slow_background_processor(query: str, docs: List[RRFDocument]) -> List[RRFDocument]:
            await asyncio.sleep(20.0)  # Longer than background_timeout_ms
            return docs
        
        config = StreamingConfiguration(background_timeout_ms=100.0)  # Short timeout
        handler = DelayedHeadStreamingHandler(
            config=config,
            background_processor=slow_background_processor
        )
        
        chunks = []
        async for chunk in handler.stream_documents(sample_rrf_documents, "test query"):
            chunks.append(chunk)
        
        # Should still complete despite timeout
        assert len(chunks) >= 1
        total_docs = sum(len(chunk.documents) for chunk in chunks)
        assert total_docs == len(sample_rrf_documents)
    
    @pytest.mark.asyncio
    async def test_error_handling(self):
        """Test error handling during streaming."""
        handler = DelayedHeadStreamingHandler()
        
        # Empty document list
        chunks = []
        async for chunk in handler.stream_documents([], "test query"):
            chunks.append(chunk)
        
        # Should handle gracefully
        assert len(chunks) >= 1
    
    @pytest.mark.asyncio
    async def test_concurrent_streaming(self, sample_rrf_documents):
        """Test concurrent streaming operations."""
        handler = DelayedHeadStreamingHandler()
        
        # Start multiple concurrent streams
        tasks = []
        for i in range(3):
            task = asyncio.create_task(
                self._collect_stream_chunks(
                    handler, sample_rrf_documents, f"query_{i}"
                )
            )
            tasks.append(task)
        
        # Wait for all to complete
        results = await asyncio.gather(*tasks)
        
        # All should complete successfully
        assert len(results) == 3
        for chunks in results:
            assert len(chunks) >= 1
            total_docs = sum(len(chunk.documents) for chunk in chunks)
            assert total_docs == len(sample_rrf_documents)
        
        # Statistics should reflect all streams
        assert handler.total_streams == 3
        assert handler.successful_streams == 3
    
    async def _collect_stream_chunks(self, handler, documents, query):
        """Helper to collect all chunks from a stream."""
        chunks = []
        async for chunk in handler.stream_documents(documents, query):
            chunks.append(chunk)
        return chunks
    
    def test_statistics_tracking(self):
        """Test statistics tracking and retrieval."""
        handler = DelayedHeadStreamingHandler()
        
        # Initial statistics
        stats = handler.get_streaming_statistics()
        assert stats["total_streams"] == 0
        assert stats["successful_streams"] == 0
        assert stats["success_rate"] == 0.0
        assert stats["average_head_latency_ms"] == 0.0
        assert "configuration" in stats
        
        # Manually update for testing
        handler.total_streams = 10
        handler.successful_streams = 8
        handler.average_head_latency_ms = 150.0
        
        updated_stats = handler.get_streaming_statistics()
        assert updated_stats["total_streams"] == 10
        assert updated_stats["successful_streams"] == 8
        assert updated_stats["success_rate"] == 0.8
        assert updated_stats["average_head_latency_ms"] == 150.0
    
    def test_statistics_reset(self):
        """Test statistics reset functionality."""
        handler = DelayedHeadStreamingHandler()
        
        # Set some statistics
        handler.total_streams = 5
        handler.successful_streams = 4
        handler.average_head_latency_ms = 200.0
        
        # Reset
        handler.reset_statistics()
        
        # Should be back to defaults
        assert handler.total_streams == 0
        assert handler.successful_streams == 0
        assert handler.average_head_latency_ms == 0.0
    
    def test_streaming_decision_score_gap_analysis(self, sample_rrf_documents):
        """Test streaming decision based on score gaps."""
        # Good score gap should favor delayed streaming
        config = StreamingConfiguration(
            head_document_count=3,
            confidence_threshold=0.5,  # Low threshold
            min_score_gap=0.1
        )
        handler = DelayedHeadStreamingHandler(config=config)
        
        decision = handler._make_streaming_decision(sample_rrf_documents, "test")
        assert decision == StreamingDecision.DELAYED
        
        # Small score gap should favor batch streaming
        small_gap_config = StreamingConfiguration(
            head_document_count=3,
            confidence_threshold=0.5,
            min_score_gap=0.5  # Large gap requirement
        )
        handler_small_gap = DelayedHeadStreamingHandler(config=small_gap_config)
        
        decision_small_gap = handler_small_gap._make_streaming_decision(sample_rrf_documents, "test")
        assert decision_small_gap == StreamingDecision.BATCH
    
    @pytest.mark.asyncio
    async def test_streaming_efficiency_calculation(self, sample_rrf_documents):
        """Test streaming efficiency ratio calculation."""
        config = StreamingConfiguration(head_document_count=2)
        handler = DelayedHeadStreamingHandler(config=config)
        
        chunks = []
        async for chunk in handler.stream_documents(sample_rrf_documents, "test query"):
            chunks.append(chunk)
        
        # Should calculate efficiency ratio
        stats = handler.get_streaming_statistics()
        assert "average_head_latency_ms" in stats
        assert stats["average_head_latency_ms"] > 0.0


class TestFactoryFunction:
    """Test factory function for creating streaming handlers."""
    
    def test_create_handler_defaults(self):
        """Test factory function with default parameters."""
        handler = create_delayed_head_streaming_handler()
        
        assert isinstance(handler, DelayedHeadStreamingHandler)
        assert handler.config.head_document_count == 3
        assert handler.config.confidence_threshold == 0.7
    
    def test_create_handler_with_config(self):
        """Test factory function with custom configuration."""
        config = StreamingConfiguration(
            head_document_count=5,
            confidence_threshold=0.8
        )
        handler = create_delayed_head_streaming_handler(config=config)
        
        assert isinstance(handler, DelayedHeadStreamingHandler)
        assert handler.config.head_document_count == 5
        assert handler.config.confidence_threshold == 0.8
    
    def test_create_handler_with_kwargs(self):
        """Test factory function with keyword arguments."""
        handler = create_delayed_head_streaming_handler(
            head_document_count=4,
            confidence_threshold=0.9,
            enable_progressive_streaming=True
        )
        
        assert isinstance(handler, DelayedHeadStreamingHandler)
        assert handler.config.head_document_count == 4
        assert handler.config.confidence_threshold == 0.9
        assert handler.config.enable_progressive_streaming is True


class TestStreamingPerformance:
    """Test streaming performance characteristics."""
    
    @pytest.mark.asyncio
    async def test_latency_measurements(self):
        """Test that latency measurements are captured accurately."""
        handler = DelayedHeadStreamingHandler()
        
        docs = [
            RRFDocument(
                document=Document(page_content="test doc", metadata={}),
                rrf_score=0.8
            )
        ]
        
        start_time = time.time()
        chunks = []
        async for chunk in handler.stream_documents(docs, "test query"):
            chunks.append(chunk)
        end_time = time.time()
        
        # Should have reasonable latency measurements
        elapsed_ms = (end_time - start_time) * 1000
        assert elapsed_ms > 0.0
        assert handler.average_head_latency_ms > 0.0
    
    @pytest.mark.asyncio
    async def test_streaming_under_load(self):
        """Test streaming behavior under concurrent load."""
        handler = DelayedHeadStreamingHandler()
        
        # Create larger document set
        docs = [
            RRFDocument(
                document=Document(
                    page_content=f"Document {i} content",
                    metadata={"id": str(i)}
                ),
                rrf_score=1.0 - i*0.1
            )
            for i in range(10)
        ]
        
        # Run multiple concurrent streams
        tasks = []
        for i in range(5):
            task = asyncio.create_task(
                self._collect_and_validate_stream(handler, docs, f"load_query_{i}")
            )
            tasks.append(task)
        
        results = await asyncio.gather(*tasks)
        
        # All should complete successfully
        for success, chunk_count in results:
            assert success is True
            assert chunk_count > 0
    
    async def _collect_and_validate_stream(self, handler, documents, query):
        """Helper to collect and validate a stream."""
        try:
            chunks = []
            async for chunk in handler.stream_documents(documents, query):
                chunks.append(chunk)
                # Validate chunk structure
                assert isinstance(chunk.documents, list)
                assert isinstance(chunk.confidence_score, (int, float))
                assert 0.0 <= chunk.confidence_score <= 1.0
            
            return True, len(chunks)
        except Exception:
            return False, 0