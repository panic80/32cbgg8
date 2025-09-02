"""
Tests for L2 Retrieval Cache.

Tests cache functionality with realistic CF travel document scenarios,
focusing on cache correctness, performance, and proper serialization.
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock
from typing import List, Dict, Any

from langchain_core.documents import Document

from app.services.retrieval_cache import (
    RetrievalL2Cache,
    RetrievalCacheKey,
    CachedRetrievalResult,
    RetrievalCacheStats,
    create_retrieval_l2_cache
)
from app.services.cache import CacheService
from app.components.rrf_merger import RRFDocument


class TestRetrievalCacheKey:
    """Test cache key generation and consistency."""
    
    def test_cache_key_generation(self):
        """Test cache key components are properly formatted."""
        key = RetrievalCacheKey(
            query_hash="abc123def456",
            index_version="v1.2.3",
            retriever_bitmask="dense|sparse",
            rrf_k=60,
            dedup_params="dedup_hash_123",
            max_docs=50
        )
        
        cache_key = key.to_cache_key()
        expected = "retrieval_l2:v1.2.3:dense|sparse:k60:dedup_hash_123:abc123def456:max50"
        assert cache_key == expected
    
    def test_cache_key_without_max_docs(self):
        """Test cache key generation without max_docs limit."""
        key = RetrievalCacheKey(
            query_hash="xyz789",
            index_version="v2.0.0",
            retriever_bitmask="bm25|dense",
            rrf_k=120,
            dedup_params="dedup_xyz"
        )
        
        cache_key = key.to_cache_key()
        expected = "retrieval_l2:v2.0.0:bm25|dense:k120:dedup_xyz:xyz789"
        assert cache_key == expected
    
    def test_cache_key_consistency(self):
        """Test that identical parameters produce identical keys."""
        key1 = RetrievalCacheKey(
            query_hash="same_hash",
            index_version="v1.0.0",
            retriever_bitmask="dense|sparse",
            rrf_k=60,
            dedup_params="same_dedup"
        )
        
        key2 = RetrievalCacheKey(
            query_hash="same_hash",
            index_version="v1.0.0", 
            retriever_bitmask="dense|sparse",
            rrf_k=60,
            dedup_params="same_dedup"
        )
        
        assert key1.to_cache_key() == key2.to_cache_key()


class TestCachedRetrievalResult:
    """Test serialization and deserialization of cached results."""
    
    def test_rrf_document_serialization_roundtrip(self):
        """Test that RRFDocument objects survive serialization."""
        # Create realistic CF travel documents
        doc1 = Document(
            page_content="Meals and incidental expenses rates for domestic travel within Canada.",
            metadata={
                "id": "cf_travel_001",
                "source": "travel_directive_2024.pdf",
                "page": 15,
                "section": "meal_allowances"
            }
        )
        
        doc2 = Document(
            page_content="Accommodation expenses for government employees on official travel.",
            metadata={
                "id": "cf_travel_002", 
                "source": "accommodation_policy.pdf",
                "page": 8,
                "classification": "For Official Use Only"
            }
        )
        
        rrf_docs = [
            RRFDocument(
                document=doc1,
                rrf_score=0.95,
                retriever_ranks={"dense": 0, "sparse": 2},
                retriever_scores={"dense": 0.87, "sparse": 0.92}
            ),
            RRFDocument(
                document=doc2, 
                rrf_score=0.78,
                retriever_ranks={"dense": 1, "sparse": 0},
                retriever_scores={"dense": 0.81, "sparse": 0.94}
            )
        ]
        
        # Create cached result
        cached_result = CachedRetrievalResult(
            documents=[
                {
                    'page_content': rrf_doc.document.page_content,
                    'metadata': rrf_doc.document.metadata,
                    'rrf_score': rrf_doc.rrf_score,
                    'retriever_ranks': rrf_doc.retriever_ranks,
                    'retriever_scores': rrf_doc.retriever_scores
                }
                for rrf_doc in rrf_docs
            ],
            query="meal allowance domestic travel",
            cached_at="2024-03-15T10:30:00",
            ttl_seconds=86400,
            retriever_stats={"total_retrieved": 2, "merge_time_ms": 15.7}
        )
        
        # Convert back to RRFDocument objects
        restored_docs = cached_result.to_rrf_documents()
        
        # Verify restoration
        assert len(restored_docs) == 2
        
        # Check first document
        assert restored_docs[0].document.page_content == doc1.page_content
        assert restored_docs[0].document.metadata == doc1.metadata
        assert restored_docs[0].rrf_score == 0.95
        assert restored_docs[0].retriever_ranks == {"dense": 0, "sparse": 2}
        assert restored_docs[0].retriever_scores == {"dense": 0.87, "sparse": 0.92}
        
        # Check second document
        assert restored_docs[1].document.page_content == doc2.page_content
        assert restored_docs[1].document.metadata == doc2.metadata
        assert restored_docs[1].rrf_score == 0.78
        assert restored_docs[1].retriever_ranks == {"dense": 1, "sparse": 0}
        assert restored_docs[1].retriever_scores == {"dense": 0.81, "sparse": 0.94}


@pytest.fixture
def mock_cache_service():
    """Create mock cache service for testing."""
    mock_service = AsyncMock(spec=CacheService)
    mock_service.enabled = True
    return mock_service


@pytest.fixture
def sample_rrf_documents():
    """Create sample RRF documents for testing."""
    docs = [
        RRFDocument(
            document=Document(
                page_content="Transportation expenses for official government travel must include receipts for amounts over $25.",
                metadata={"id": "trans_001", "source": "transport_policy.pdf", "page": 3}
            ),
            rrf_score=0.92,
            retriever_ranks={"dense": 0, "bm25": 1},
            retriever_scores={"dense": 0.89, "bm25": 0.76}
        ),
        RRFDocument(
            document=Document(
                page_content="Per diem rates are updated annually and vary by location and season.",
                metadata={"id": "perdiem_001", "source": "rates_2024.pdf", "page": 12}
            ),
            rrf_score=0.84,
            retriever_ranks={"dense": 1, "bm25": 0},
            retriever_scores={"dense": 0.82, "bm25": 0.88}
        )
    ]
    return docs


class TestRetrievalL2Cache:
    """Test L2 retrieval cache functionality."""
    
    @pytest.mark.asyncio
    async def test_cache_miss_returns_none(self, mock_cache_service):
        """Test that cache miss returns None."""
        mock_cache_service.get.return_value = None
        
        cache = RetrievalL2Cache(mock_cache_service, default_ttl=3600)
        
        result = await cache.get(
            query="test query",
            retriever_names=["dense", "sparse"],
            rrf_k=60,
            dedup_params={"jaccard_threshold": 0.82},
            max_docs=10
        )
        
        assert result is None
        assert cache._stats.cache_misses == 1
        assert cache._stats.cache_hits == 0
    
    @pytest.mark.asyncio
    async def test_cache_hit_returns_documents(self, mock_cache_service, sample_rrf_documents):
        """Test successful cache hit with document restoration."""
        # Prepare cached data
        cached_data = {
            'documents': [
                {
                    'page_content': doc.document.page_content,
                    'metadata': doc.document.metadata,
                    'rrf_score': doc.rrf_score,
                    'retriever_ranks': doc.retriever_ranks,
                    'retriever_scores': doc.retriever_scores
                }
                for doc in sample_rrf_documents
            ],
            'query': 'transportation receipts',
            'cached_at': '2024-03-15T10:00:00',
            'ttl_seconds': 3600,
            'retriever_stats': {'total_docs': 2, 'merge_time_ms': 12.5}
        }
        
        mock_cache_service.get.return_value = cached_data
        
        cache = RetrievalL2Cache(mock_cache_service, enable_stats=True)
        
        result = await cache.get(
            query="transportation receipts",
            retriever_names=["dense", "bm25"],
            rrf_k=60,
            dedup_params={"jaccard_threshold": 0.82},
            max_docs=10
        )
        
        assert result is not None
        rrf_docs, retriever_stats = result
        
        # Verify documents are correctly restored
        assert len(rrf_docs) == 2
        assert rrf_docs[0].rrf_score == 0.92
        assert rrf_docs[0].document.metadata["id"] == "trans_001"
        assert rrf_docs[1].rrf_score == 0.84
        assert rrf_docs[1].document.metadata["id"] == "perdiem_001"
        
        # Verify stats
        assert retriever_stats == {'total_docs': 2, 'merge_time_ms': 12.5}
        assert cache._stats.cache_hits == 1
        assert cache._stats.cache_misses == 0
    
    @pytest.mark.asyncio
    async def test_cache_set_stores_documents(self, mock_cache_service, sample_rrf_documents):
        """Test that documents are properly stored in cache."""
        mock_cache_service.set.return_value = True
        
        cache = RetrievalL2Cache(mock_cache_service, default_ttl=86400)
        
        success = await cache.set(
            query="CF travel policy updates",
            retriever_names=["dense", "bm25"],
            rrf_k=60,
            dedup_params={"jaccard_threshold": 0.82, "hamming_threshold": 4},
            rrf_documents=sample_rrf_documents,
            retriever_stats={"total_retrieved": 2, "merge_time_ms": 18.3},
            max_docs=20
        )
        
        assert success is True
        
        # Verify cache.set was called with correct parameters
        mock_cache_service.set.assert_called_once()
        call_args = mock_cache_service.set.call_args
        
        # Check cache key format
        cache_key = call_args[0][0]
        assert cache_key.startswith("retrieval_l2:")
        assert "bm25|dense" in cache_key  # Retrievers are sorted alphabetically
        assert "k60" in cache_key
        assert "max20" in cache_key
        
        # Check cached data structure
        cached_data = call_args[0][1]
        assert 'documents' in cached_data
        assert 'query' in cached_data
        assert 'retriever_stats' in cached_data
        assert len(cached_data['documents']) == 2
        
        # Verify TTL
        ttl = call_args[0][2]
        assert ttl == 86400
    
    @pytest.mark.asyncio
    async def test_cache_key_consistency_with_sorted_retrievers(self, mock_cache_service):
        """Test that retriever order doesn't affect cache keys."""
        cache = RetrievalL2Cache(mock_cache_service)
        
        # Different retriever orders should produce same cache key
        key1 = cache._build_cache_key(
            query="same query",
            retriever_names=["dense", "sparse", "bm25"],
            rrf_k=60,
            dedup_params={"threshold": 0.8},
            max_docs=10
        )
        
        key2 = cache._build_cache_key(
            query="same query",
            retriever_names=["bm25", "dense", "sparse"],  # Different order
            rrf_k=60,
            dedup_params={"threshold": 0.8},
            max_docs=10
        )
        
        assert key1.to_cache_key() == key2.to_cache_key()
    
    @pytest.mark.asyncio
    async def test_cache_key_sensitivity_to_parameters(self, mock_cache_service):
        """Test that cache keys change when parameters change."""
        cache = RetrievalL2Cache(mock_cache_service)
        
        base_key = cache._build_cache_key(
            query="base query",
            retriever_names=["dense"],
            rrf_k=60,
            dedup_params={"threshold": 0.8},
            max_docs=10
        )
        
        # Different query
        diff_query_key = cache._build_cache_key(
            query="different query",
            retriever_names=["dense"],
            rrf_k=60,
            dedup_params={"threshold": 0.8},
            max_docs=10
        )
        assert base_key.to_cache_key() != diff_query_key.to_cache_key()
        
        # Different RRF k
        diff_k_key = cache._build_cache_key(
            query="base query",
            retriever_names=["dense"],
            rrf_k=120,  # Different k
            dedup_params={"threshold": 0.8},
            max_docs=10
        )
        assert base_key.to_cache_key() != diff_k_key.to_cache_key()
        
        # Different dedup params
        diff_dedup_key = cache._build_cache_key(
            query="base query",
            retriever_names=["dense"],
            rrf_k=60,
            dedup_params={"threshold": 0.9},  # Different threshold
            max_docs=10
        )
        assert base_key.to_cache_key() != diff_dedup_key.to_cache_key()
    
    @pytest.mark.asyncio
    async def test_cache_statistics_tracking(self, mock_cache_service):
        """Test that cache statistics are properly tracked."""
        cache = RetrievalL2Cache(mock_cache_service, enable_stats=True)
        
        # Initial stats
        stats = cache.get_stats()
        assert stats.total_requests == 0
        assert stats.hit_rate == 0.0
        
        # Simulate cache miss
        mock_cache_service.get.return_value = None
        await cache.get("query1", ["dense"], 60, {}, 10)
        
        stats = cache.get_stats()
        assert stats.total_requests == 1
        assert stats.cache_misses == 1
        assert stats.hit_rate == 0.0
        
        # Simulate cache hit
        mock_cache_service.get.return_value = {
            'documents': [],
            'query': 'query2',
            'cached_at': '2024-03-15T10:00:00',
            'ttl_seconds': 3600,
            'retriever_stats': {}
        }
        await cache.get("query2", ["dense"], 60, {}, 10)
        
        stats = cache.get_stats()
        assert stats.total_requests == 2
        assert stats.cache_hits == 1
        assert stats.cache_misses == 1
        assert stats.hit_rate == 0.5
    
    @pytest.mark.asyncio
    async def test_error_handling_on_cache_get(self, mock_cache_service):
        """Test error handling during cache get operations."""
        mock_cache_service.get.side_effect = Exception("Redis connection failed")
        
        cache = RetrievalL2Cache(mock_cache_service)
        
        result = await cache.get("query", ["dense"], 60, {})
        
        assert result is None
        assert cache._stats.cache_misses == 1
    
    @pytest.mark.asyncio
    async def test_error_handling_on_cache_set(self, mock_cache_service, sample_rrf_documents):
        """Test error handling during cache set operations."""
        mock_cache_service.set.side_effect = Exception("Redis write failed")
        
        cache = RetrievalL2Cache(mock_cache_service)
        
        success = await cache.set(
            query="test",
            retriever_names=["dense"],
            rrf_k=60,
            dedup_params={},
            rrf_documents=sample_rrf_documents,
            retriever_stats={}
        )
        
        assert success is False
    
    @pytest.mark.asyncio
    async def test_cache_invalidation_tracking(self, mock_cache_service):
        """Test cache invalidation operations."""
        cache = RetrievalL2Cache(mock_cache_service, enable_stats=True)
        
        initial_invalidations = cache._stats.cache_invalidations
        
        result = await cache.invalidate_by_index_version("v1.0.0")
        
        assert result >= 0  # Should return count (placeholder implementation)
        assert cache._stats.cache_invalidations == initial_invalidations + 1
    
    @pytest.mark.asyncio
    async def test_disabled_cache_behavior(self, sample_rrf_documents):
        """Test behavior when cache service is disabled."""
        mock_service = AsyncMock(spec=CacheService)
        mock_service.enabled = False
        
        cache = RetrievalL2Cache(mock_service)
        
        # Cache get should return None
        result = await cache.get("query", ["dense"], 60, {})
        assert result is None
        
        # Cache set should return False
        success = await cache.set(
            query="test",
            retriever_names=["dense"],
            rrf_k=60,
            dedup_params={},
            rrf_documents=sample_rrf_documents,
            retriever_stats={}
        )
        assert success is False


class TestFactoryFunction:
    """Test factory function for creating cache instances."""
    
    def test_create_retrieval_l2_cache(self):
        """Test factory function creates properly configured cache."""
        mock_service = MagicMock(spec=CacheService)
        
        cache = create_retrieval_l2_cache(
            cache_service=mock_service,
            ttl=7200,
            enable_stats=False
        )
        
        assert isinstance(cache, RetrievalL2Cache)
        assert cache.cache == mock_service
        assert cache.default_ttl == 7200
        assert cache.enable_stats is False


class TestCachePerformance:
    """Test cache performance characteristics."""
    
    @pytest.mark.asyncio
    async def test_cache_performance_with_large_documents(self, mock_cache_service):
        """Test cache performance with large CF travel documents."""
        # Create large realistic documents
        large_docs = []
        
        for i in range(50):
            content = f"""
            Section {i+1}: Official Travel Policy for Canadian Forces Personnel
            
            This section outlines the comprehensive travel allowances, accommodation standards,
            and expense reporting requirements for CF personnel on official duty travel.
            
            Meal Allowances: Personnel are entitled to meal allowances based on the duration
            of travel and destination. Domestic travel within Canada follows standard rates
            published in the Travel Directive, while international travel requires additional
            approval and follows Treasury Board guidelines.
            
            Accommodation Standards: Government personnel must use approved accommodations
            when available. Commercial accommodations should not exceed the established
            maximum rates unless exceptional circumstances warrant approval.
            
            Transportation: The most economical and practical means of transportation should
            be used. Air travel requires advance booking when possible to obtain government
            rates. Ground transportation via personal vehicle is reimbursed at the established
            per-kilometer rate including parking and toll expenses.
            
            Expense Documentation: All expenses over $25 require receipts. Claims must be
            submitted within 60 days of travel completion with proper authorization and
            supporting documentation as specified in Financial Administration Act requirements.
            """
            
            large_docs.append(RRFDocument(
                document=Document(
                    page_content=content.strip(),
                    metadata={
                        "id": f"cf_travel_section_{i+1:03d}",
                        "source": f"travel_directive_section_{i+1}.pdf",
                        "page": i + 1,
                        "section": f"section_{i+1}",
                        "classification": "For Official Use Only",
                        "effective_date": "2024-01-01",
                        "review_date": "2024-12-31"
                    }
                ),
                rrf_score=0.95 - (i * 0.01),  # Decreasing scores
                retriever_ranks={"dense": i, "sparse": (i + 10) % 50, "bm25": (i + 20) % 50},
                retriever_scores={"dense": 0.9 - (i * 0.01), "sparse": 0.85, "bm25": 0.88}
            ))
        
        mock_cache_service.set.return_value = True
        cache = RetrievalL2Cache(mock_cache_service, enable_stats=True)
        
        # Measure cache set performance
        import time
        start_time = time.time()
        
        success = await cache.set(
            query="comprehensive CF travel policy documentation review",
            retriever_names=["dense", "sparse", "bm25"],
            rrf_k=60,
            dedup_params={"jaccard_threshold": 0.82, "hamming_threshold": 4},
            rrf_documents=large_docs,
            retriever_stats={"total_retrieved": 50, "merge_time_ms": 45.2}
        )
        
        cache_time = (time.time() - start_time) * 1000  # Convert to ms
        
        assert success is True
        assert cache_time < 100  # Should cache 50 documents in under 100ms
        
        print(f"\nL2 Cache Performance: Cached {len(large_docs)} documents in {cache_time:.2f}ms")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])