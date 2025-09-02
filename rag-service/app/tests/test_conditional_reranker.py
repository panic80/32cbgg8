"""
Tests for the conditional reranker component.

Tests the intelligent reranking decision-making and fallback mechanisms
that optimize precision while controlling latency costs.
"""

import pytest
import asyncio
import time
from unittest.mock import AsyncMock, Mock
from typing import List

from langchain_core.documents import Document

from app.components.conditional_reranker import (
    ConditionalReranker, RerankingStrategy, RerankingDecision,
    RerankingResult, ConditionalRerankerStats, create_conditional_reranker
)
from app.components.rrf_merger import RRFDocument
from app.components.uncertainty_scorer import UncertaintyResult, UncertaintyFeatures


class TestRerankingDecision:
    """Test reranking decision data structure."""
    
    def test_decision_initialization(self):
        """Test reranking decision creation."""
        decision = RerankingDecision(
            strategy=RerankingStrategy.APPLY,
            confidence=0.8,
            reasoning="High complexity query",
            query_complexity=0.7,
            result_quality_score=0.5,
            uncertainty_threshold_met=True,
            diversity_score=0.3,
            estimated_latency_ms=150.0
        )
        
        assert decision.strategy == RerankingStrategy.APPLY
        assert decision.confidence == 0.8
        assert decision.reasoning == "High complexity query"
        assert decision.query_complexity == 0.7
        assert decision.uncertainty_threshold_met is True
        assert not decision.skip_due_to_timeout


class TestRerankingResult:
    """Test reranking result data structure."""
    
    def test_result_initialization(self):
        """Test reranking result creation."""
        docs = [Document(page_content="test doc", metadata={"id": "1"})]
        result = RerankingResult(
            documents=docs,
            strategy_used=RerankingStrategy.BLEND,
            reranker_confidence=0.6,
            reranking_time_ms=200.0,
            blend_ratio=0.4,
            ranking_changes=2
        )
        
        assert len(result.documents) == 1
        assert result.strategy_used == RerankingStrategy.BLEND
        assert result.reranker_confidence == 0.6
        assert result.blend_ratio == 0.4
        assert result.ranking_changes == 2
        assert not result.fallback_triggered


class TestConditionalRerankerStats:
    """Test statistics tracking."""
    
    def test_stats_initialization(self):
        """Test stats initialization."""
        stats = ConditionalRerankerStats()
        
        assert stats.total_requests == 0
        assert len(stats.strategy_counts) == 0
        assert stats.average_reranking_time_ms == 0.0
        assert stats.fallback_rate == 0.0
    
    def test_strategy_count_updates(self):
        """Test strategy count tracking."""
        stats = ConditionalRerankerStats()
        
        stats.update_strategy_count(RerankingStrategy.APPLY)
        stats.update_strategy_count(RerankingStrategy.SKIP)
        stats.update_strategy_count(RerankingStrategy.APPLY)
        
        assert stats.total_requests == 3
        assert stats.strategy_counts["apply"] == 2
        assert stats.strategy_counts["skip"] == 1


class TestConditionalReranker:
    """Test conditional reranker functionality."""
    
    @pytest.fixture
    def sample_rrf_documents(self):
        """Create sample RRF documents for testing."""
        return [
            RRFDocument(
                document=Document(
                    page_content="DND Form 2888 completion requires proper authorization",
                    metadata={"source": "form_guide.pdf", "id": "doc1"}
                ),
                rrf_score=0.95,
                retriever_scores={"dense": 0.8, "sparse": 0.7}
            ),
            RRFDocument(
                document=Document(
                    page_content="Travel accommodation allowances depend on location and rank",
                    metadata={"source": "allowances.pdf", "id": "doc2"}
                ),
                rrf_score=0.78,
                retriever_scores={"dense": 0.6, "hybrid": 0.9}
            ),
            RRFDocument(
                document=Document(
                    page_content="Meal rates vary by province and meal type",
                    metadata={"source": "meal_rates.pdf", "id": "doc3"}
                ),
                rrf_score=0.65,
                retriever_scores={"sparse": 0.8}
            ),
            RRFDocument(
                document=Document(
                    page_content="Receipt requirements for expense reimbursement",
                    metadata={"source": "receipts.pdf", "id": "doc4"}
                ),
                rrf_score=0.42,
                retriever_scores={"bm25": 0.6}
            ),
            RRFDocument(
                document=Document(
                    page_content="Travel authorization must be obtained prior to travel",
                    metadata={"source": "authorization.pdf", "id": "doc5"}
                ),
                rrf_score=0.31,
                retriever_scores={"dense": 0.4}
            )
        ]
    
    @pytest.fixture
    def mock_reranker(self):
        """Create mock reranker function."""
        async def reranker(query: str, documents: List[Document]) -> List[Document]:
            # Simulate reranking by reversing order
            return list(reversed(documents))
        return reranker
    
    @pytest.fixture
    def slow_reranker(self):
        """Create slow reranker that times out."""
        async def reranker(query: str, documents: List[Document]) -> List[Document]:
            await asyncio.sleep(5.0)  # Simulate slow reranker
            return documents
        return reranker
    
    @pytest.fixture
    def failing_reranker(self):
        """Create reranker that fails."""
        async def reranker(query: str, documents: List[Document]) -> List[Document]:
            raise Exception("Reranker service unavailable")
        return reranker
    
    def test_reranker_initialization_defaults(self):
        """Test reranker initialization with defaults."""
        reranker = ConditionalReranker()
        
        assert reranker.reranker_function is None
        assert reranker.uncertainty_threshold == 0.6
        assert reranker.min_documents_for_reranking == 5
        assert reranker.max_reranking_latency_ms == 2000.0
        assert reranker.enable_fallback is True
        assert isinstance(reranker.stats, ConditionalRerankerStats)
    
    def test_reranker_initialization_custom(self, mock_reranker):
        """Test reranker initialization with custom parameters."""
        reranker = ConditionalReranker(
            reranker_function=mock_reranker,
            uncertainty_threshold=0.8,
            min_documents_for_reranking=3,
            max_reranking_latency_ms=1000.0,
            confidence_threshold=0.8,
            enable_fallback=False
        )
        
        assert reranker.reranker_function == mock_reranker
        assert reranker.uncertainty_threshold == 0.8
        assert reranker.min_documents_for_reranking == 3
        assert reranker.max_reranking_latency_ms == 1000.0
        assert reranker.confidence_threshold == 0.8
        assert reranker.enable_fallback is False
    
    @pytest.mark.asyncio
    async def test_skip_strategy_no_reranker(self, sample_rrf_documents):
        """Test skip strategy when no reranker is available."""
        reranker = ConditionalReranker()  # No reranker function
        
        query = "DND form completion requirements"
        documents, result = await reranker.rerank(query, sample_rrf_documents)
        
        # Should skip reranking
        assert len(documents) == len(sample_rrf_documents)
        assert result.strategy_used == RerankingStrategy.SKIP
        assert result.reranker_confidence == 0.0
        assert result.reranking_time_ms >= 0.0
        
        # Documents should be in original RRF order
        assert documents[0].page_content == sample_rrf_documents[0].document.page_content
    
    @pytest.mark.asyncio
    async def test_skip_strategy_too_few_documents(self, mock_reranker):
        """Test skip strategy with too few documents."""
        reranker = ConditionalReranker(
            reranker_function=mock_reranker,
            min_documents_for_reranking=10
        )
        
        # Only provide 5 documents, but require 10
        short_docs = [
            RRFDocument(
                document=Document(
                    page_content="Test doc",
                    metadata={"id": "1"}
                ),
                rrf_score=0.8,
                retriever_scores={"dense": 0.8}
            )
        ]
        
        query = "test query"
        documents, result = await reranker.rerank(query, short_docs)
        
        assert result.strategy_used == RerankingStrategy.SKIP
        assert result.reranking_time_ms >= 0.0
    
    @pytest.mark.asyncio
    async def test_apply_strategy_high_confidence(self, mock_reranker, sample_rrf_documents):
        """Test apply strategy with high confidence query."""
        reranker = ConditionalReranker(
            reranker_function=mock_reranker,
            uncertainty_threshold=0.3,  # Lower threshold
            confidence_threshold=0.5    # Lower confidence threshold
        )
        
        # High uncertainty query
        uncertainty_result = UncertaintyResult(
            overall_uncertainty=0.8,
            confidence_level="low",
            features=UncertaintyFeatures(
                ambiguity_score=0.7,
                specificity_score=0.3,
                coverage_score=0.4,
                coherence_score=0.8,
                complexity_score=0.8
            ),
            reasoning=["Complex technical query with multiple concepts"],
            retriever_recommendations={"dense": True, "sparse": True, "bm25": True}
        )
        
        query = '"DND Form 2888" completion requirements and authorization process'
        documents, result = await reranker.rerank(
            query, sample_rrf_documents, uncertainty_result
        )
        
        # Should apply reranking (mock reranker reverses order)
        assert len(documents) == len(sample_rrf_documents)
        assert result.strategy_used == RerankingStrategy.APPLY
        assert result.reranker_confidence > 0.0
        assert result.ranking_changes > 0
        
        # Should be in reversed order due to mock reranker
        assert documents[0].page_content == sample_rrf_documents[-1].document.page_content
    
    @pytest.mark.asyncio
    async def test_blend_strategy_moderate_confidence(self, mock_reranker, sample_rrf_documents):
        """Test blend strategy with moderate confidence."""
        reranker = ConditionalReranker(
            reranker_function=mock_reranker,
            uncertainty_threshold=0.4,
            confidence_threshold=0.9,  # High threshold for pure apply
            blend_threshold=0.3         # Lower threshold for blending
        )
        
        # Moderate uncertainty query
        uncertainty_result = UncertaintyResult(
            overall_uncertainty=0.5,
            ambiguity_score=0.4,
            specificity_score=0.6,
            coverage_confidence=0.7,
            coherence_score=0.8,
            complexity_level="MEDIUM",
            reasoning="Moderately complex query"
        )
        
        query = "travel allowance rates"
        documents, result = await reranker.rerank(
            query, sample_rrf_documents, uncertainty_result
        )
        
        # Should use blending strategy
        assert len(documents) == len(sample_rrf_documents)
        assert result.strategy_used == RerankingStrategy.BLEND
        assert result.blend_ratio is not None
        assert 0.0 <= result.blend_ratio <= 1.0
    
    @pytest.mark.asyncio
    async def test_skip_strategy_low_uncertainty_high_quality(self, mock_reranker, sample_rrf_documents):
        """Test skip strategy for low uncertainty with high quality results."""
        reranker = ConditionalReranker(
            reranker_function=mock_reranker,
            uncertainty_threshold=0.6
        )
        
        # Low uncertainty query
        uncertainty_result = UncertaintyResult(
            overall_uncertainty=0.3,  # Below threshold
            ambiguity_score=0.2,
            specificity_score=0.9,
            coverage_confidence=0.9,
            coherence_score=0.9,
            complexity_level="LOW",
            reasoning="Simple, specific query"
        )
        
        query = "meal rates"
        documents, result = await reranker.rerank(
            query, sample_rrf_documents, uncertainty_result
        )
        
        # Should skip due to low uncertainty and high result quality
        assert result.strategy_used == RerankingStrategy.SKIP
        assert result.reranking_time_ms >= 0.0
    
    @pytest.mark.asyncio
    async def test_timeout_handling(self, slow_reranker, sample_rrf_documents):
        """Test timeout handling with slow reranker."""
        reranker = ConditionalReranker(
            reranker_function=slow_reranker,
            max_reranking_latency_ms=100.0,  # Very short timeout
            uncertainty_threshold=0.3,
            confidence_threshold=0.3
        )
        
        # High uncertainty query that would normally trigger reranking
        uncertainty_result = UncertaintyResult(
            overall_uncertainty=0.9,
            ambiguity_score=0.8,
            specificity_score=0.2,
            coverage_confidence=0.3,
            coherence_score=0.6,
            complexity_level="HIGH",
            reasoning="Very complex query"
        )
        
        query = "complex technical query about multiple CF regulations"
        documents, result = await reranker.rerank(
            query, sample_rrf_documents, uncertainty_result
        )
        
        # Should skip due to estimated timeout
        assert result.strategy_used == RerankingStrategy.SKIP
        assert result.reranking_time_ms >= 0.0
    
    @pytest.mark.asyncio
    async def test_reranker_failure_fallback(self, failing_reranker, sample_rrf_documents):
        """Test fallback when reranker fails."""
        reranker = ConditionalReranker(
            reranker_function=failing_reranker,
            uncertainty_threshold=0.3,
            confidence_threshold=0.3,
            enable_fallback=True
        )
        
        # High confidence query that should trigger reranking
        uncertainty_result = UncertaintyResult(
            overall_uncertainty=0.8,
            ambiguity_score=0.7,
            specificity_score=0.3,
            coverage_confidence=0.4,
            coherence_score=0.8,
            complexity_level="HIGH",
            reasoning="Complex query that should trigger reranking"
        )
        
        query = "detailed DND regulation interpretation"
        documents, result = await reranker.rerank(
            query, sample_rrf_documents, uncertainty_result
        )
        
        # Should fallback to RRF scores due to reranker failure
        assert result.strategy_used == RerankingStrategy.FALLBACK
        assert result.fallback_triggered is True
        assert result.fallback_reason is not None
        
        # Should return documents in original RRF order
        assert documents[0].page_content == sample_rrf_documents[0].document.page_content
    
    @pytest.mark.asyncio
    async def test_max_results_limiting(self, mock_reranker, sample_rrf_documents):
        """Test max results limiting."""
        reranker = ConditionalReranker(
            reranker_function=mock_reranker,
            uncertainty_threshold=0.3,
            confidence_threshold=0.3
        )
        
        uncertainty_result = UncertaintyResult(
            overall_uncertainty=0.7,
            ambiguity_score=0.6,
            specificity_score=0.4,
            coverage_confidence=0.5,
            coherence_score=0.7,
            complexity_level="HIGH",
            reasoning="High complexity query"
        )
        
        query = "complex query"
        documents, result = await reranker.rerank(
            query, sample_rrf_documents, uncertainty_result, max_results=3
        )
        
        # Should limit to 3 documents regardless of strategy
        assert len(documents) == 3
    
    def test_query_complexity_calculation(self):
        """Test query complexity scoring."""
        reranker = ConditionalReranker()
        
        # Simple query
        simple_complexity = reranker._calculate_query_complexity("meal rates")
        assert 0.0 <= simple_complexity <= 1.0
        
        # Complex query
        complex_complexity = reranker._calculate_query_complexity(
            "What are the specific requirements for completing DND Form 2888 "
            "regarding temporary duty travel authorization and allowance calculations?"
        )
        assert complex_complexity > simple_complexity
        
        # Technical query with form numbers
        technical_complexity = reranker._calculate_query_complexity(
            "DND 2888 form completion policy regulation procedure"
        )
        assert technical_complexity > simple_complexity
    
    def test_result_quality_analysis(self, sample_rrf_documents):
        """Test result quality analysis."""
        reranker = ConditionalReranker()
        
        # Good quality results (clear score separation)
        quality_score = reranker._analyze_result_quality(sample_rrf_documents)
        assert 0.0 <= quality_score <= 1.0
        assert quality_score > 0.0  # Should detect good separation
        
        # Poor quality results (similar scores)
        similar_docs = [
            RRFDocument(
                document=Document(page_content="doc1", metadata={}),
                rrf_score=0.50,
                retriever_scores={"dense": 0.5}
            ),
            RRFDocument(
                document=Document(page_content="doc2", metadata={}),
                rrf_score=0.49,
                retriever_scores={"dense": 0.49}
            )
        ]
        poor_quality = reranker._analyze_result_quality(similar_docs)
        assert poor_quality < quality_score  # Should be lower quality
    
    def test_diversity_score_calculation(self, sample_rrf_documents):
        """Test diversity score calculation."""
        reranker = ConditionalReranker()
        
        diversity_score = reranker._calculate_diversity_score(sample_rrf_documents)
        assert 0.0 <= diversity_score <= 1.0
        
        # Test with no documents
        no_diversity = reranker._calculate_diversity_score([])
        assert no_diversity == 0.0
        
        # Test with single document
        single_diversity = reranker._calculate_diversity_score(sample_rrf_documents[:1])
        assert single_diversity == 0.0
    
    def test_latency_estimation(self):
        """Test reranking latency estimation."""
        reranker = ConditionalReranker()
        
        # Should increase with document count
        latency_5 = reranker._estimate_reranking_latency(5)
        latency_10 = reranker._estimate_reranking_latency(10)
        
        assert latency_10 > latency_5
        assert latency_5 > 0.0
    
    def test_confidence_calculation(self):
        """Test reranking confidence calculation."""
        reranker = ConditionalReranker()
        
        # High complexity, high uncertainty should increase confidence
        high_confidence = reranker._calculate_reranking_confidence(
            query_complexity=0.8,
            uncertainty_score=0.9,
            result_quality=0.3,  # Low quality results
            diversity_score=0.5
        )
        
        # Low complexity, low uncertainty should decrease confidence
        low_confidence = reranker._calculate_reranking_confidence(
            query_complexity=0.2,
            uncertainty_score=0.3,
            result_quality=0.9,  # High quality results
            diversity_score=0.1
        )
        
        assert high_confidence > low_confidence
        assert 0.0 <= high_confidence <= 1.0
        assert 0.0 <= low_confidence <= 1.0
    
    def test_ranking_changes_calculation(self, sample_rrf_documents):
        """Test ranking changes calculation."""
        reranker = ConditionalReranker()
        
        # Original order
        original_docs = [Document(page_content=doc.page_content, metadata=doc.metadata)
                        for doc in sample_rrf_documents]
        
        # Reversed order
        reversed_docs = list(reversed(original_docs))
        
        changes = reranker._calculate_ranking_changes(sample_rrf_documents, reversed_docs)
        
        # Should detect significant changes (all positions changed except middle if odd length)
        assert changes > 0
        assert changes <= len(sample_rrf_documents)
        
        # No changes (same order)
        no_changes = reranker._calculate_ranking_changes(sample_rrf_documents, original_docs)
        assert no_changes == 0
    
    @pytest.mark.asyncio
    async def test_statistics_tracking(self, mock_reranker, sample_rrf_documents):
        """Test statistics tracking across multiple calls."""
        reranker = ConditionalReranker(
            reranker_function=mock_reranker,
            uncertainty_threshold=0.3,
            confidence_threshold=0.3
        )
        
        # Make multiple reranking calls with different strategies
        queries_and_uncertainties = [
            ("simple query", 0.2),     # Should skip
            ("complex query", 0.8),    # Should apply
            ("medium query", 0.5),     # Might blend
        ]
        
        for query, uncertainty_score in queries_and_uncertainties:
            uncertainty_result = UncertaintyResult(
                overall_uncertainty=uncertainty_score,
                ambiguity_score=uncertainty_score,
                specificity_score=1.0 - uncertainty_score,
                coverage_confidence=0.7,
                coherence_score=0.8,
                complexity_level="MEDIUM",
                reasoning="Test query"
            )
            
            await reranker.rerank(query, sample_rrf_documents, uncertainty_result)
        
        stats = reranker.get_stats()
        assert stats.total_requests == 3
        assert len(stats.strategy_counts) > 0
        assert stats.average_reranking_time_ms >= 0.0
    
    def test_stats_reset(self, mock_reranker):
        """Test statistics reset functionality."""
        reranker = ConditionalReranker(reranker_function=mock_reranker)
        
        # Manually update stats
        reranker.stats.total_requests = 10
        reranker.stats.strategy_counts["apply"] = 5
        
        # Reset stats
        reranker.reset_stats()
        
        assert reranker.stats.total_requests == 0
        assert len(reranker.stats.strategy_counts) == 0


class TestFactoryFunction:
    """Test factory function for creating conditional rerankers."""
    
    def test_create_conditional_reranker_defaults(self):
        """Test factory function with defaults."""
        reranker = create_conditional_reranker()
        
        assert isinstance(reranker, ConditionalReranker)
        assert reranker.reranker_function is None
        assert reranker.uncertainty_threshold == 0.6
    
    def test_create_conditional_reranker_custom(self):
        """Test factory function with custom parameters."""
        mock_reranker = AsyncMock()
        
        reranker = create_conditional_reranker(
            reranker_function=mock_reranker,
            uncertainty_threshold=0.8,
            min_documents_for_reranking=3
        )
        
        assert isinstance(reranker, ConditionalReranker)
        assert reranker.reranker_function == mock_reranker
        assert reranker.uncertainty_threshold == 0.8
        assert reranker.min_documents_for_reranking == 3


class TestIntegrationScenarios:
    """Test realistic integration scenarios."""
    
    @pytest.mark.asyncio
    async def test_typical_cf_travel_queries(self):
        """Test with typical CF travel-related queries."""
        # Mock reranker that slightly reorders based on query keywords
        async def smart_reranker(query: str, documents: List[Document]) -> List[Document]:
            # Prioritize documents containing query keywords
            query_lower = query.lower()
            scored_docs = []
            
            for doc in documents:
                score = 0
                content_lower = doc.page_content.lower()
                for word in query_lower.split():
                    if word in content_lower:
                        score += 1
                scored_docs.append((doc, score))
            
            # Sort by keyword relevance
            scored_docs.sort(key=lambda x: x[1], reverse=True)
            return [doc for doc, score in scored_docs]
        
        reranker = ConditionalReranker(
            reranker_function=smart_reranker,
            uncertainty_threshold=0.4,
            confidence_threshold=0.6
        )
        
        # Test queries
        test_cases = [
            {
                "query": "DND Form 2888 completion requirements",
                "uncertainty": 0.7,
                "expected_strategy": [RerankingStrategy.APPLY, RerankingStrategy.BLEND]
            },
            {
                "query": "meal allowance rates",
                "uncertainty": 0.3,
                "expected_strategy": [RerankingStrategy.SKIP]
            },
            {
                "query": "complex travel authorization policy interpretation",
                "uncertainty": 0.8,
                "expected_strategy": [RerankingStrategy.APPLY, RerankingStrategy.BLEND]
            }
        ]
        
        rrf_docs = [
            RRFDocument(
                document=Document(
                    page_content="DND Form 2888 completion requires proper authorization and signatures",
                    metadata={"source": "forms.pdf"}
                ),
                rrf_score=0.9,
                retriever_scores={"dense": 0.9}
            ),
            RRFDocument(
                document=Document(
                    page_content="Meal allowance rates vary by location and duty type",
                    metadata={"source": "allowances.pdf"}
                ),
                rrf_score=0.7,
                retriever_scores={"sparse": 0.7}
            ),
            RRFDocument(
                document=Document(
                    page_content="Travel authorization policy requires advance approval",
                    metadata={"source": "policy.pdf"}
                ),
                rrf_score=0.6,
                retriever_scores={"hybrid": 0.6}
            ),
            RRFDocument(
                document=Document(
                    page_content="Complex regulations require careful interpretation by authorized personnel",
                    metadata={"source": "regulations.pdf"}
                ),
                rrf_score=0.5,
                retriever_scores={"bm25": 0.5}
            ),
            RRFDocument(
                document=Document(
                    page_content="General travel guidance for Canadian Forces members",
                    metadata={"source": "guidance.pdf"}
                ),
                rrf_score=0.4,
                retriever_scores={"dense": 0.4}
            )
        ]
        
        for case in test_cases:
            uncertainty_result = UncertaintyResult(
                overall_uncertainty=case["uncertainty"],
                ambiguity_score=case["uncertainty"],
                specificity_score=1.0 - case["uncertainty"],
                coverage_confidence=0.7,
                coherence_score=0.8,
                complexity_level="MEDIUM",
                reasoning="Test case"
            )
            
            documents, result = await reranker.rerank(
                case["query"], rrf_docs, uncertainty_result
            )
            
            # Check that strategy is as expected
            assert result.strategy_used in case["expected_strategy"]
            assert len(documents) == len(rrf_docs)
            assert result.reranking_time_ms >= 0.0
    
    @pytest.mark.asyncio
    async def test_error_recovery_scenarios(self):
        """Test error recovery and fallback scenarios."""
        # Reranker that fails intermittently
        call_count = 0
        async def unreliable_reranker(query: str, documents: List[Document]) -> List[Document]:
            nonlocal call_count
            call_count += 1
            if call_count % 2 == 0:  # Fail on even calls
                raise Exception("Service temporarily unavailable")
            return documents[::-1]  # Reverse order on successful calls
        
        reranker = ConditionalReranker(
            reranker_function=unreliable_reranker,
            uncertainty_threshold=0.3,
            confidence_threshold=0.3,
            enable_fallback=True
        )
        
        rrf_docs = [
            RRFDocument(
                document=Document(
                    page_content=f"Document {i}",
                    metadata={"id": str(i)}
                ),
                rrf_score=1.0 - i*0.1,
                retriever_scores={"dense": 1.0 - i*0.1}
            )
            for i in range(5)
        ]
        
        uncertainty_result = UncertaintyResult(
            overall_uncertainty=0.8,
            ambiguity_score=0.7,
            specificity_score=0.3,
            coverage_confidence=0.5,
            coherence_score=0.7,
            complexity_level="HIGH",
            reasoning="Complex query requiring reranking"
        )
        
        # First call should succeed
        documents1, result1 = await reranker.rerank("test query", rrf_docs, uncertainty_result)
        assert result1.strategy_used == RerankingStrategy.APPLY
        assert not result1.fallback_triggered
        
        # Second call should fail and fallback
        documents2, result2 = await reranker.rerank("test query", rrf_docs, uncertainty_result)
        assert result2.strategy_used == RerankingStrategy.FALLBACK
        assert result2.fallback_triggered
        assert result2.fallback_reason is not None
        
        # Both should return valid documents
        assert len(documents1) == len(rrf_docs)
        assert len(documents2) == len(rrf_docs)
    
    @pytest.mark.asyncio
    async def test_performance_under_load(self):
        """Test performance characteristics under load."""
        # Fast reranker
        async def fast_reranker(query: str, documents: List[Document]) -> List[Document]:
            await asyncio.sleep(0.01)  # 10ms processing time
            return documents
        
        reranker = ConditionalReranker(
            reranker_function=fast_reranker,
            uncertainty_threshold=0.2,  # More aggressive reranking
            confidence_threshold=0.3,
            max_reranking_latency_ms=1000.0
        )
        
        # Create realistic document set
        rrf_docs = [
            RRFDocument(
                document=Document(
                    page_content=f"CF travel document {i} with various regulations and policies",
                    metadata={"source": f"doc_{i}.pdf", "id": str(i)}
                ),
                rrf_score=1.0 - i*0.05,
                retriever_scores={"dense": 1.0 - i*0.05}
            )
            for i in range(10)
        ]
        
        # Run multiple concurrent reranking operations
        tasks = []
        for i in range(5):
            uncertainty_result = UncertaintyResult(
                overall_uncertainty=0.5 + i*0.1,
                ambiguity_score=0.4 + i*0.1,
                specificity_score=0.6 - i*0.05,
                coverage_confidence=0.7,
                coherence_score=0.8,
                complexity_level="MEDIUM",
                reasoning=f"Query {i}"
            )
            
            task = reranker.rerank(f"query {i}", rrf_docs, uncertainty_result)
            tasks.append(task)
        
        # Wait for all tasks to complete
        results = await asyncio.gather(*tasks)
        
        # Verify all completed successfully
        assert len(results) == 5
        for documents, result in results:
            assert len(documents) > 0
            assert result.reranking_time_ms >= 0.0
            assert isinstance(result.strategy_used, RerankingStrategy)
        
        # Check statistics
        stats = reranker.get_stats()
        assert stats.total_requests == 5
        assert stats.average_reranking_time_ms >= 0.0