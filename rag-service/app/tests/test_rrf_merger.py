"""
Comprehensive tests for RRF (Reciprocal Rank Fusion) merger.

Tests cover:
- RRF scoring with single and multiple retrievers
- k parameter variations (60, 90, 120)
- Empty retriever handling
- Score normalization
- Performance benchmarks
- Document overlap analysis
"""

import pytest
import time
from typing import List, Dict
from unittest.mock import Mock, patch

from langchain_core.documents import Document

from app.components.rrf_merger import RRFMerger, RRFDocument, RRFMergerStats, create_rrf_merger


class TestRRFMerger:
    """Test suite for RRF merger component."""
    
    @pytest.fixture
    def sample_docs(self) -> List[Document]:
        """Create sample documents for testing."""
        return [
            Document(
                page_content="Travel allowances for meals in Toronto are $45 per day.",
                metadata={"id": "doc_1", "source": "cbi_chapter_5", "score": 0.9}
            ),
            Document(
                page_content="Kilometric rates for privately owned motor vehicles are $0.59 per km.",
                metadata={"id": "doc_2", "source": "cbi_chapter_7", "score": 0.8}
            ),
            Document(
                page_content="Hotel accommodation limits in major cities vary by location.",
                metadata={"id": "doc_3", "source": "cbi_chapter_6", "score": 0.7}
            ),
            Document(
                page_content="Incidental allowances are reduced to 75% after 30 days.",
                metadata={"id": "doc_4", "source": "cbi_chapter_5", "score": 0.6}
            ),
            Document(
                page_content="Travel advances must be reconciled within 30 days of return.",
                metadata={"id": "doc_5", "source": "cbi_chapter_8", "score": 0.5}
            )
        ]
    
    @pytest.fixture
    def rrf_merger(self) -> RRFMerger:
        """Create RRF merger instance."""
        return RRFMerger(k=60, normalize_scores=True)
    
    def test_single_retriever_scoring(self, rrf_merger, sample_docs):
        """Test RRF scoring with a single retriever."""
        retriever_results = {"vector": sample_docs[:3]}
        
        merged_docs, stats = rrf_merger.merge(retriever_results)
        
        # Verify basic properties
        assert len(merged_docs) == 3
        assert stats.retrievers_count == 1
        assert stats.total_docs_input == 3
        assert stats.unique_docs_output == 3
        
        # Verify RRF scores are in descending order
        scores = [doc.rrf_score for doc in merged_docs]
        assert scores == sorted(scores, reverse=True)
        
        # Verify RRF formula: score = 1/(k + rank) where rank is 1-indexed
        # For k=60: first doc should have score 1/(60+1) = 1/61 ≈ 0.0164 before normalization
        expected_raw_scores = [1/61, 1/62, 1/63]
        
        # Since scores are normalized, check relative ordering
        assert merged_docs[0].rrf_score > merged_docs[1].rrf_score
        assert merged_docs[1].rrf_score > merged_docs[2].rrf_score
        
        # Verify document IDs are preserved
        doc_ids = [doc.document.metadata["id"] for doc in merged_docs]
        assert doc_ids == ["doc_1", "doc_2", "doc_3"]
    
    def test_multiple_retrievers_merging(self, rrf_merger, sample_docs):
        """Test merging results from multiple retrievers."""
        retriever_results = {
            "vector": sample_docs[:3],  # doc_1, doc_2, doc_3
            "bm25": [sample_docs[2], sample_docs[0], sample_docs[4]],  # doc_3, doc_1, doc_5  
            "multi_query": [sample_docs[1], sample_docs[3]]  # doc_2, doc_4
        }
        
        merged_docs, stats = rrf_merger.merge(retriever_results)
        
        # Verify statistics
        assert stats.retrievers_count == 3
        assert stats.total_docs_input == 8  # 3 + 3 + 2
        assert stats.unique_docs_output == 5  # All unique docs
        assert stats.retriever_contributions == {"vector": 3, "bm25": 3, "multi_query": 2}
        
        # Verify all documents are present
        merged_ids = {doc.document.metadata["id"] for doc in merged_docs}
        expected_ids = {"doc_1", "doc_2", "doc_3", "doc_4", "doc_5"}
        assert merged_ids == expected_ids
        
        # doc_1 appears in vector (rank 0) and bm25 (rank 1)
        # RRF score = 1/(60+0) + 1/(60+1) = 1/60 + 1/61 ≈ 0.0330
        doc_1 = next(doc for doc in merged_docs if doc.document.metadata["id"] == "doc_1")
        assert "vector" in doc_1.retriever_ranks
        assert "bm25" in doc_1.retriever_ranks
        assert doc_1.retriever_ranks["vector"] == 0
        assert doc_1.retriever_ranks["bm25"] == 1
        
        # doc_5 only appears in bm25 (rank 2)
        doc_5 = next(doc for doc in merged_docs if doc.document.metadata["id"] == "doc_5")
        assert len(doc_5.retriever_ranks) == 1
        assert doc_5.retriever_ranks["bm25"] == 2
    
    @pytest.mark.parametrize("k_value", [60, 90, 120])
    def test_k_parameter_variations(self, sample_docs, k_value):
        """Test RRF with different k parameter values."""
        merger = RRFMerger(k=k_value, normalize_scores=False)
        retriever_results = {"vector": sample_docs[:2]}
        
        merged_docs, stats = merger.merge(retriever_results)
        
        assert stats.k_parameter == k_value
        
        # Verify RRF formula with different k values (ranks are 1-indexed in RRF)
        expected_score_1 = 1.0 / (k_value + 1)  # First document (rank 1)
        expected_score_2 = 1.0 / (k_value + 2)  # Second document (rank 2)
        
        assert abs(merged_docs[0].rrf_score - expected_score_1) < 1e-6
        assert abs(merged_docs[1].rrf_score - expected_score_2) < 1e-6
    
    def test_empty_retriever_handling(self, rrf_merger):
        """Test handling of empty retriever results."""
        # Test completely empty input
        empty_results = {}
        merged_docs, stats = rrf_merger.merge(empty_results)
        
        assert len(merged_docs) == 0
        assert stats.retrievers_count == 0
        assert stats.total_docs_input == 0
        
        # Test retriever with empty list
        empty_list_results = {"vector": [], "bm25": []}
        merged_docs, stats = rrf_merger.merge(empty_list_results)
        
        assert len(merged_docs) == 0
        assert stats.retrievers_count == 0
        
        # Test mixed empty and non-empty
        mixed_results = {
            "vector": [Document(page_content="test", metadata={"id": "doc_1"})],
            "bm25": [],
            "empty": None
        }
        # Should filter out empty/None results
        merged_docs, stats = rrf_merger.merge(mixed_results)
        
        assert len(merged_docs) == 1
        assert stats.retrievers_count == 1
    
    def test_score_normalization(self, sample_docs):
        """Test score normalization functionality."""
        # Test with normalization enabled
        merger_normalized = RRFMerger(k=60, normalize_scores=True)
        retriever_results = {"vector": sample_docs[:3]}
        
        merged_docs, _ = merger_normalized.merge(retriever_results)
        
        # Scores should be normalized to [0, 1]
        scores = [doc.rrf_score for doc in merged_docs]
        assert max(scores) <= 1.0
        assert min(scores) >= 0.0
        assert max(scores) == 1.0  # Highest score should be 1.0 after normalization
        
        # Test with normalization disabled
        merger_raw = RRFMerger(k=60, normalize_scores=False)
        merged_docs_raw, _ = merger_raw.merge(retriever_results)
        
        # Raw scores should be small fractions
        raw_scores = [doc.rrf_score for doc in merged_docs_raw]
        assert all(0 < score < 1 for score in raw_scores)
        assert max(raw_scores) < 0.02  # Should be around 1/61 ≈ 0.0164
    
    def test_max_docs_parameter(self, rrf_merger, sample_docs):
        """Test max_docs parameter limiting."""
        retriever_results = {"vector": sample_docs}
        
        # Test limiting to 3 documents
        merged_docs, stats = rrf_merger.merge(retriever_results, max_docs=3)
        
        assert len(merged_docs) == 3
        assert stats.unique_docs_output == 3
        
        # Should get top 3 documents by RRF score
        all_docs, _ = rrf_merger.merge(retriever_results)
        top_3_ids = [doc.document.metadata["id"] for doc in all_docs[:3]]
        limited_ids = [doc.document.metadata["id"] for doc in merged_docs]
        
        assert limited_ids == top_3_ids
    
    def test_document_id_extraction(self, rrf_merger):
        """Test document ID extraction from various metadata fields."""
        docs_with_different_ids = [
            Document(page_content="doc1", metadata={"id": "test_1"}),
            Document(page_content="doc2", metadata={"doc_id": "test_2"}),
            Document(page_content="doc3", metadata={"document_id": "test_3"}),
            Document(page_content="doc4", metadata={"source_id": "test_4"}),
            Document(page_content="doc5", metadata={"other_field": "test_5"}),  # No ID field
        ]
        
        retriever_results = {"test": docs_with_different_ids}
        merged_docs, _ = rrf_merger.merge(retriever_results)
        
        # Verify all documents are merged (no duplicates due to ID extraction)
        assert len(merged_docs) == 5
        
        # Verify ID extraction worked correctly
        doc_ids = [rrf_merger._get_document_id(doc.document) for doc in merged_docs]
        expected_ids = ["test_1", "test_2", "test_3", "test_4"]  # Last one will be hash-based
        
        assert "test_1" in doc_ids
        assert "test_2" in doc_ids  
        assert "test_3" in doc_ids
        assert "test_4" in doc_ids
        # Last doc should have a hash-based ID
        assert any(id.startswith("doc_") and id not in expected_ids for id in doc_ids)
    
    def test_retriever_overlap_analysis(self, rrf_merger, sample_docs):
        """Test retriever overlap analysis functionality."""
        retriever_results = {
            "vector": sample_docs[:3],  # doc_1, doc_2, doc_3
            "bm25": [sample_docs[1], sample_docs[2], sample_docs[4]],  # doc_2, doc_3, doc_5
        }
        
        overlap_analysis = rrf_merger.analyze_retriever_overlap(retriever_results)
        
        # Verify structure
        assert "pairwise_overlaps" in overlap_analysis
        assert "total_docs_before_merge" in overlap_analysis
        assert "unique_docs_after_merge" in overlap_analysis
        assert "deduplication_ratio_pct" in overlap_analysis
        
        # Verify calculations
        assert overlap_analysis["total_docs_before_merge"] == 6  # 3 + 3
        assert overlap_analysis["unique_docs_after_merge"] == 4  # doc_1, doc_2, doc_3, doc_5
        
        # Verify overlap between vector and bm25
        vector_vs_bm25 = overlap_analysis["pairwise_overlaps"]["vector_vs_bm25"]
        assert vector_vs_bm25["intersection_size"] == 2  # doc_2, doc_3
        assert vector_vs_bm25["union_size"] == 4  # doc_1, doc_2, doc_3, doc_5
        assert vector_vs_bm25["overlap_percentage"] == 50.0  # 2/4 = 50%
        
        # Test with insufficient retrievers
        single_retriever = {"vector": sample_docs[:2]}
        analysis = rrf_merger.analyze_retriever_overlap(single_retriever)
        assert "error" in analysis
    
    def test_simple_merge_interface(self, rrf_merger, sample_docs):
        """Test simplified merge interface for compatibility."""
        retriever_results = {"vector": sample_docs[:3]}
        
        # Test simple merge (returns just documents)
        merged_docs = rrf_merger.merge_simple(retriever_results, max_docs=2)
        
        assert len(merged_docs) == 2
        assert all(isinstance(doc, Document) for doc in merged_docs)
        
        # Should return top 2 documents by RRF score
        full_merge, _ = rrf_merger.merge(retriever_results)
        expected_ids = [doc.document.metadata["id"] for doc in full_merge[:2]]
        actual_ids = [doc.metadata["id"] for doc in merged_docs]
        
        assert actual_ids == expected_ids
    
    def test_performance_benchmark(self, sample_docs):
        """Test merge performance meets requirements (<10ms for 100 docs)."""
        # Create 100 documents by replicating sample docs
        large_doc_set = []
        for i in range(20):  # 20 * 5 = 100 docs
            for doc in sample_docs:
                new_doc = Document(
                    page_content=doc.page_content,
                    metadata={**doc.metadata, "id": f"{doc.metadata['id']}_{i}"}
                )
                large_doc_set.append(new_doc)
        
        # Create retriever results with overlapping documents
        retriever_results = {
            "vector": large_doc_set[:50],
            "bm25": large_doc_set[25:75],
            "multi_query": large_doc_set[50:100]
        }
        
        merger = RRFMerger(k=60, normalize_scores=True)
        
        # Benchmark merge time
        start_time = time.time()
        merged_docs, stats = merger.merge(retriever_results)
        end_time = time.time()
        
        merge_time_ms = (end_time - start_time) * 1000
        
        # Verify performance requirement
        assert merge_time_ms < 10.0, f"Merge took {merge_time_ms:.2f}ms, expected <10ms"
        
        # Verify correctness with large dataset
        assert len(merged_docs) == 100  # Should be all unique due to different IDs
        assert stats.total_docs_input == 150  # 50 + 50 + 50
        assert stats.merge_time_ms < 10.0
        
        print(f"✅ Performance test passed: {merge_time_ms:.2f}ms for 150 input docs → 100 unique docs")
    
    def test_stats_tracking(self, rrf_merger, sample_docs):
        """Test statistics tracking and retrieval."""
        retriever_results = {
            "vector": sample_docs[:3],
            "bm25": sample_docs[1:4]
        }
        
        # Initially no stats
        assert rrf_merger.get_last_merge_stats() is None
        
        merged_docs, stats = rrf_merger.merge(retriever_results)
        
        # Verify stats object
        assert isinstance(stats, RRFMergerStats)
        assert stats.total_docs_input == 6
        assert stats.unique_docs_output == 4
        assert stats.retrievers_count == 2
        assert stats.k_parameter == 60
        assert stats.merge_time_ms > 0
        
        # Verify stats are stored
        last_stats = rrf_merger.get_last_merge_stats()
        assert last_stats == stats
        assert last_stats.retriever_contributions["vector"] == 3
        assert last_stats.retriever_contributions["bm25"] == 3
    
    def test_factory_function(self):
        """Test factory function for creating RRF merger."""
        # Test default parameters
        merger1 = create_rrf_merger()
        assert merger1.k == 60
        assert merger1.normalize_scores == True
        
        # Test custom parameters
        merger2 = create_rrf_merger(k=90, normalize_scores=False)
        assert merger2.k == 90
        assert merger2.normalize_scores == False
    
    def test_edge_cases(self, rrf_merger):
        """Test various edge cases."""
        # Test single document
        single_doc = [Document(page_content="test", metadata={"id": "single"})]
        retriever_results = {"vector": single_doc}
        
        merged_docs, stats = rrf_merger.merge(retriever_results)
        assert len(merged_docs) == 1
        assert merged_docs[0].rrf_score == 1.0  # Normalized to 1.0
        
        # Test duplicate documents within same retriever (different content but same ID)
        duplicate_docs = [
            Document(page_content="content1", metadata={"id": "same_id"}),
            Document(page_content="content2", metadata={"id": "same_id"})
        ]
        retriever_results = {"vector": duplicate_docs}
        
        merged_docs, stats = rrf_merger.merge(retriever_results)
        # Should treat as same document since they have the same explicit ID
        assert len(merged_docs) == 1
        # The first document should be kept (first occurrence)
        assert merged_docs[0].document.page_content == "content1"
    
    def test_warning_for_extreme_k_values(self):
        """Test that extreme k values generate warnings."""
        with patch('app.components.rrf_merger.logger') as mock_logger:
            # Test k too small
            RRFMerger(k=5)
            mock_logger.warning.assert_called_once()
            mock_logger.reset_mock()
            
            # Test k too large
            RRFMerger(k=500)
            mock_logger.warning.assert_called_once()
    
    @pytest.mark.parametrize("normalize", [True, False])
    def test_normalization_consistency(self, sample_docs, normalize):
        """Test that normalization parameter works consistently."""
        merger = RRFMerger(k=60, normalize_scores=normalize)
        retriever_results = {"vector": sample_docs[:3]}
        
        merged_docs, _ = merger.merge(retriever_results)
        scores = [doc.rrf_score for doc in merged_docs]
        
        if normalize:
            assert max(scores) == 1.0
            assert min(scores) >= 0.0
        else:
            assert all(0 < score < 0.02 for score in scores)  # Raw RRF scores are small
    
    def test_real_world_scenario(self):
        """Test with realistic CF travel document scenario."""
        # Simulate realistic travel document retrieval results
        travel_docs = [
            Document(
                page_content="Meal allowances for Toronto are $54 for breakfast, $16 for lunch, $36 for dinner.",
                metadata={"id": "cbi_5_meal_toronto", "source": "CBI-5", "section": "5.3.2", "score": 0.92}
            ),
            Document(
                page_content="Kilometric rates for privately owned motor vehicles: $0.59 per kilometre.",
                metadata={"id": "cbi_7_pmv_rates", "source": "CBI-7", "section": "7.2.1", "score": 0.88}
            ),
            Document(
                page_content="Toronto meal allowances: breakfast $54, lunch $16, dinner $36, total $106 per day.",
                metadata={"id": "cbi_5_toronto_total", "source": "CBI-5", "section": "5.3.2", "score": 0.90}
            ),
            Document(
                page_content="PMV allowances include $0.59 per km plus parking and tolls as per receipt.",
                metadata={"id": "cbi_7_pmv_details", "source": "CBI-7", "section": "7.2.2", "score": 0.85}
            )
        ]
        
        # Simulate different retrievers finding different relevant documents
        retriever_results = {
            "vector_similarity": travel_docs[:3],  # Dense retrieval finds semantic matches
            "bm25_keywords": [travel_docs[1], travel_docs[3], travel_docs[0]],  # Sparse finds keyword matches
            "multi_query": [travel_docs[2], travel_docs[1]]  # Multi-query finds additional context
        }
        
        merger = RRFMerger(k=60, normalize_scores=True)
        merged_docs, stats = merger.merge(retriever_results, max_docs=5)
        
        # Verify realistic results
        assert len(merged_docs) == 4  # All unique documents
        assert stats.retrievers_count == 3
        assert stats.total_docs_input == 8  # 3 + 3 + 2
        
        # Documents mentioned in multiple retrievers should score higher
        # PMV doc (id: cbi_7_pmv_rates) appears in vector (rank 1) and bm25 (rank 0)
        pmv_doc = next(doc for doc in merged_docs if doc.document.metadata["id"] == "cbi_7_pmv_rates")
        meal_doc = next(doc for doc in merged_docs if doc.document.metadata["id"] == "cbi_5_meal_toronto")
        
        # PMV doc should have higher RRF score due to appearing in multiple retrievers
        assert pmv_doc.rrf_score >= meal_doc.rrf_score
        
        print(f"✅ Real-world scenario test passed: {len(merged_docs)} docs merged from {stats.retrievers_count} retrievers")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])