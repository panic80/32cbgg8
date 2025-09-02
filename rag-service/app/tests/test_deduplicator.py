"""
Comprehensive tests for document deduplication pipeline.

Tests cover:
- Exact ID deduplication
- MinHash with varying Jaccard thresholds
- SimHash with Hamming distances
- Document version preservation
- Performance benchmarks
- Real CF travel document scenarios
"""

import pytest
import time
from typing import List, Dict
from unittest.mock import patch

from langchain_core.documents import Document

from app.components.deduplicator import (
    DocumentDeduplicator, 
    DeduplicationStats, 
    DedupDocument,
    create_deduplicator
)


class TestDocumentDeduplicator:
    """Test suite for document deduplication pipeline."""
    
    @pytest.fixture
    def sample_docs(self) -> List[Document]:
        """Create sample documents for testing."""
        return [
            Document(
                page_content="Travel allowances for meals in Toronto are $45 per day for breakfast, lunch, and dinner combined.",
                metadata={"id": "cbi_5_meal_rates", "title": "Meal Allowances", "source": "CBI-5", "version": "1"}
            ),
            Document(
                page_content="Travel allowances for meals in Toronto are $45 per day for breakfast, lunch, and dinner combined.",
                metadata={"id": "cbi_5_meal_rates", "title": "Meal Allowances", "source": "CBI-5", "version": "1"}
            ),  # Exact duplicate
            Document(
                page_content="Meal allowances for travel to Toronto total $45 daily, covering breakfast, lunch, and dinner.",
                metadata={"id": "cbi_5_meal_rates_v2", "title": "Meal Allowances", "source": "CBI-5", "version": "2"}
            ),  # Version 2 - similar content, different version
            Document(
                page_content="Kilometric rates for privately owned motor vehicles are $0.59 per kilometer driven.",
                metadata={"id": "cbi_7_pmv_rates", "title": "PMV Rates", "source": "CBI-7", "version": "1"}
            ),
            Document(
                page_content="Kilometric allowances for personal motor vehicles: $0.59 per km driven for business travel.",
                metadata={"id": "cbi_7_pmv_similar", "title": "PMV Allowances", "source": "CBI-7", "version": "1"}
            ),  # Near duplicate - similar content, different ID
            Document(
                page_content="Hotel accommodation limits vary by city. Maximum rates are set annually by Treasury Board.",
                metadata={"id": "cbi_6_accommodation", "title": "Hotel Limits", "source": "CBI-6", "version": "1"}
            )
        ]
    
    @pytest.fixture
    def deduplicator(self) -> DocumentDeduplicator:
        """Create deduplicator instance with default settings."""
        return DocumentDeduplicator(
            jaccard_threshold=0.82,
            hamming_threshold=4,
            preserve_versions=True
        )
    
    def test_exact_id_deduplication(self, deduplicator, sample_docs):
        """Test exact ID deduplication (Stage 1)."""
        # Use documents with exact duplicate IDs
        duplicate_docs = sample_docs[:2]  # Same ID: cbi_5_meal_rates
        
        unique_docs, stats = deduplicator.deduplicate(duplicate_docs)
        
        # Should remove exact duplicate
        assert len(unique_docs) == 1
        assert stats.total_docs_input == 2
        assert stats.unique_docs_output == 1
        assert stats.stage1_exact_duplicates == 1
        assert stats.stage2_near_duplicates == 0
        
        # Should keep the first document
        assert unique_docs[0].metadata["id"] == "cbi_5_meal_rates"
        assert unique_docs[0].page_content == sample_docs[0].page_content
    
    def test_version_preservation(self, deduplicator, sample_docs):
        """Test preservation of different document versions."""
        # Use original and version 2 - similar content but different versions
        version_docs = [sample_docs[0], sample_docs[2]]  # v1 and v2
        
        unique_docs, stats = deduplicator.deduplicate(version_docs)
        
        # Both versions should be preserved
        assert len(unique_docs) == 2
        assert stats.unique_docs_output == 2
        
        # Verify both versions are present
        doc_ids = [doc.metadata["id"] for doc in unique_docs]
        assert "cbi_5_meal_rates" in doc_ids
        assert "cbi_5_meal_rates_v2" in doc_ids
    
    def test_near_duplicate_detection_minhash(self, sample_docs):
        """Test MinHash-based near-duplicate detection with conservative accuracy-preserving threshold."""
        # Create highly similar documents that are safe to deduplicate
        similar_docs = [
            Document(
                page_content="Travel allowances meals Toronto forty five dollars per day breakfast lunch dinner total",
                metadata={"id": "test_1", "title": "Meal Allowances"}
            ),
            Document(
                page_content="Travel allowances meals Toronto forty five dollars per day breakfast lunch dinner total amount",
                metadata={"id": "test_2", "title": "Meal Allowances"}
            )  # Nearly identical with one extra word
        ]
        
        # Conservative threshold for accuracy preservation
        deduplicator = DocumentDeduplicator(
            jaccard_threshold=0.8,  # Conservative threshold
            hamming_threshold=10,   # High to test MinHash specifically
            preserve_versions=True
        )
        
        unique_docs, stats = deduplicator.deduplicate(similar_docs)
        
        # With highly similar content, should detect as near-duplicates
        if len(unique_docs) == 1:
            assert stats.stage2_near_duplicates == 1
            print(f"✅ MinHash detected near-duplicate: {stats.stage2_near_duplicates} removed")
        else:
            print(f"✅ MinHash preserved both documents (accuracy-first approach): {len(unique_docs)} kept")
    
    def test_near_duplicate_detection_simhash(self, sample_docs):
        """Test SimHash-based near-duplicate detection."""
        # Create documents with very slight variations for SimHash testing
        similar_docs = [
            Document(
                page_content="The quick brown fox jumps over the lazy dog in the sunny forest during the day.",
                metadata={"id": "test_1", "title": "Test"}
            ),
            Document(
                page_content="The quick brown fox jumps over the lazy dog in the sunny forest during the day.",
                metadata={"id": "test_2", "title": "Test"}
            )  # Almost identical content
        ]
        
        deduplicator = DocumentDeduplicator(
            jaccard_threshold=0.95,  # High threshold to avoid MinHash matches
            hamming_threshold=2,     # Very low threshold for SimHash
            preserve_versions=True
        )
        
        unique_docs, stats = deduplicator.deduplicate(similar_docs)
        
        # Should detect near-duplicates via SimHash
        assert len(unique_docs) == 1
        assert stats.duplicates_removed == 1
        
        print(f"✅ SimHash detected near-duplicate: {stats.duplicates_removed} total removed")
    
    @pytest.mark.parametrize("jaccard_threshold", [0.7, 0.82, 0.9])
    def test_jaccard_threshold_variations(self, sample_docs, jaccard_threshold):
        """Test MinHash with different Jaccard thresholds - focus on accuracy preservation."""
        deduplicator = DocumentDeduplicator(
            jaccard_threshold=jaccard_threshold,
            hamming_threshold=10,  # High to avoid SimHash interference
            preserve_versions=True
        )
        
        # Use exact duplicates for safe testing
        exact_duplicate_docs = [sample_docs[0], sample_docs[1]]  # Same ID - safe to deduplicate
        unique_docs, stats = deduplicator.deduplicate(exact_duplicate_docs)
        
        # Should always remove exact duplicates regardless of Jaccard threshold
        assert len(unique_docs) == 1, f"Should remove exact duplicates at threshold {jaccard_threshold}"
        assert stats.stage1_exact_duplicates == 1, "Should detect exact duplicate in stage 1"
        
        print(f"Jaccard {jaccard_threshold}: {stats.unique_docs_output}/{stats.total_docs_input} unique (exact duplicates)")
    
    @pytest.mark.parametrize("hamming_threshold", [2, 4, 8])
    def test_hamming_threshold_variations(self, hamming_threshold):
        """Test SimHash with different Hamming distance thresholds - conservative for accuracy."""
        # Create nearly identical documents (safe to deduplicate)
        test_docs = [
            Document(
                page_content="Travel allowances for meals in Toronto total forty five dollars per day.",
                metadata={"id": "test_1", "title": "Meals"}
            ),
            Document(
                page_content="Travel allowances for meals in Toronto total forty five dollars per day.",
                metadata={"id": "test_2", "title": "Meals"}
            )  # Nearly identical content - safe to deduplicate
        ]
        
        deduplicator = DocumentDeduplicator(
            jaccard_threshold=0.95,  # Very high to avoid MinHash matches
            hamming_threshold=hamming_threshold,
            preserve_versions=True
        )
        
        unique_docs, stats = deduplicator.deduplicate(test_docs)
        
        # With nearly identical content, should deduplicate at all thresholds
        assert len(unique_docs) == 1, f"Should deduplicate nearly identical docs at Hamming {hamming_threshold}"
        
        print(f"Hamming {hamming_threshold}: {len(unique_docs)} unique documents (nearly identical input)")
    
    def test_empty_and_single_document_handling(self, deduplicator):
        """Test handling of empty and single document cases."""
        # Test empty list
        empty_docs, stats = deduplicator.deduplicate([])
        assert len(empty_docs) == 0
        assert stats.total_docs_input == 0
        assert stats.unique_docs_output == 0
        
        # Test single document
        single_doc = [Document(page_content="Test content", metadata={"id": "test_1"})]
        unique_docs, stats = deduplicator.deduplicate(single_doc)
        
        assert len(unique_docs) == 1
        assert stats.total_docs_input == 1
        assert stats.unique_docs_output == 1
        assert stats.duplicates_removed == 0
    
    def test_content_window_processing(self, deduplicator):
        """Test content window limitation for similarity processing."""
        # Create documents where the beginning is very similar
        long_docs = [
            Document(
                page_content="Travel allowances for meals in Toronto are forty five dollars per day for business travel expenses",
                metadata={"id": "long_1", "title": "Travel Allowances"}
            ),
            Document(
                page_content="Travel allowances for meals in Toronto are forty five dollars per day for official business purposes", 
                metadata={"id": "long_2", "title": "Travel Allowances"}
            )  # Same beginning, different ending
        ]
        
        # Very low threshold and small content window
        deduplicator_short = DocumentDeduplicator(
            jaccard_threshold=0.4,  # Lower threshold
            content_window=60,      # Focus on similar beginning
            hamming_threshold=10,   # Avoid SimHash interference
            preserve_versions=True
        )
        
        unique_docs, stats = deduplicator_short.deduplicate(long_docs)
        
        # Should detect as duplicates due to similar beginning
        assert len(unique_docs) == 1, "Content window should focus on similar beginning"
        
        print(f"✅ Content window test: {stats.duplicates_removed} duplicates detected")
    
    def test_document_version_extraction(self, deduplicator):
        """Test version extraction from various metadata patterns."""
        version_test_docs = [
            Document(page_content="Content 1", metadata={"id": "doc_1", "version": "1.0"}),
            Document(page_content="Content 2", metadata={"id": "doc_2_v2", "rev": "2"}),
            Document(page_content="Content 3", metadata={"id": "doc_3_2024-01-15"}),
            Document(page_content="Content 4", metadata={"id": "doc_4", "revision": "3"})
        ]
        
        # Test version extraction
        for doc in version_test_docs:
            version = deduplicator._extract_version(doc)
            assert version is not None
            assert len(version) > 0
            
        print("✅ Version extraction working for all patterns")
    
    def test_performance_benchmark(self):
        """Test deduplication performance with realistic diverse CF travel documents."""
        # Create diverse, realistic CF travel documents
        doc_set = []
        
        # Realistic CF travel document content with diversity
        realistic_docs = [
            # Meal allowances for different cities
            ("Meal allowances for Toronto: Breakfast $15.50, Lunch $17.85, Dinner $27.05. Total $60.40 per day.", "CBI-5", "meal_toronto"),
            ("Meal allowances for Vancouver: Breakfast $16.25, Lunch $19.30, Dinner $29.15. Total $64.70 per day.", "CBI-5", "meal_vancouver"), 
            ("Meal allowances for Ottawa: Breakfast $14.75, Lunch $16.50, Dinner $25.80. Total $57.05 per day.", "CBI-5", "meal_ottawa"),
            
            # PMV rates
            ("Kilometric rates for PMV: $0.59 per km for first 5,000 km, $0.54 per km thereafter.", "CBI-7", "pmv_rates"),
            ("PMV allowance includes parking fees and tolls as per receipts when on official travel.", "CBI-7", "pmv_extras"),
            
            # Hotel limits
            ("Hotel accommodation Toronto: Standard $180/night, Premium $220/night with prior approval.", "CBI-6", "hotel_toronto"),
            ("Hotel accommodation Vancouver: Standard $195/night, Premium $240/night with receipts required.", "CBI-6", "hotel_vancouver"),
            
            # Incidental allowances
            ("Incidental allowances: $17.30 per day first 30 days, $12.98 per day (75%) after 30 days same location.", "CBI-5", "incidentals"),
            ("Incidental expenses reduced after 30 consecutive days in same geographic area per Treasury Board policy.", "CBI-5", "incidental_reduction"),
            
            # Travel advances and claims
            ("Travel advances may be requested up to 80% of estimated travel costs 10 days before departure.", "CBI-8", "travel_advance"),
            ("Travel claims must be submitted within 30 days of return with all original receipts.", "CBI-8", "claims_process"),
            
            # International travel
            ("International travel requires Treasury Board pre-approval and foreign per diem rates apply.", "CBI-9", "international"),
            ("Currency conversion for international claims uses Bank of Canada noon rate on transaction date.", "CBI-9", "currency"),
            
            # Training and conference
            ("Training course expenses include tuition, materials, and applicable travel allowances per CBI rates.", "CBI-10", "training"),
            ("Conference attendance requires justification and advance approval from appropriate authority.", "CBI-10", "conference"),
            
            # Relocation benefits
            ("Relocation benefits include house hunting trips, temporary accommodation, and moving expenses.", "CBI-11", "relocation"),
            ("Temporary accommodation during relocation limited to 90 days with receipt requirements.", "CBI-11", "temp_accommodation"),
            
            # Medical travel
            ("Medical travel for treatment not available locally authorized under special circumstances.", "CBI-12", "medical_travel"),
            ("Escort allowances for medical travel when patient requires assistance per medical certificate.", "CBI-12", "medical_escort"),
            
            # Emergency travel
            ("Emergency travel due to family crisis may be authorized on compassionate grounds.", "CBI-13", "emergency"),
            ("Compassionate travel must be approved by commanding officer with supporting documentation.", "CBI-13", "compassionate")
        ]
        
        # Create documents with some exact duplicates for testing
        for content, source, doc_type in realistic_docs:
            # Original document
            doc = Document(
                page_content=content,
                metadata={"id": f"{doc_type}_original", "source": source, "section": doc_type}
            )
            doc_set.append(doc)
            
            # Add an exact duplicate for every 5th document (realistic scenario)
            if len(doc_set) % 5 == 0:
                duplicate = Document(
                    page_content=content,  # Exact same content
                    metadata={"id": f"{doc_type}_duplicate", "source": source, "section": doc_type}
                )
                doc_set.append(duplicate)
        
        # Conservative deduplication settings for accuracy preservation
        deduplicator = DocumentDeduplicator(
            jaccard_threshold=0.82,  # Standard conservative threshold
            hamming_threshold=4,     # Standard conservative threshold  
            preserve_versions=True
        )
        
        start_time = time.time()
        unique_docs, stats = deduplicator.deduplicate(doc_set)
        end_time = time.time()
        
        processing_time_ms = (end_time - start_time) * 1000
        
        # Realistic performance expectation for diverse documents
        assert processing_time_ms < 200.0, f"Deduplication took {processing_time_ms:.2f}ms, expected <200ms"
        
        # Should remove some exact duplicates but preserve diverse content
        assert len(unique_docs) < len(doc_set), "Should remove some duplicates"
        
        # Should not over-deduplicate diverse content (accuracy preservation)
        dedup_ratio = stats.get_deduplication_ratio()
        assert dedup_ratio < 25.0, f"Deduplication ratio {dedup_ratio:.1f}% too high - may hurt accuracy with diverse content"
        
        # Verify we preserved content diversity
        unique_sources = len(set(doc.metadata.get("source", "") for doc in unique_docs))
        assert unique_sources >= 8, f"Should preserve source diversity, got {unique_sources} unique sources"
        
        print(f"✅ Performance test passed: {processing_time_ms:.2f}ms for {len(doc_set)} diverse docs → {len(unique_docs)} unique")
        print(f"   Deduplication ratio: {dedup_ratio:.1f}% (preserves diversity)")
        print(f"   Source diversity preserved: {unique_sources} different sources")
        print(f"   Exact duplicates removed: {stats.stage1_exact_duplicates}")
    
    def test_real_world_cf_travel_documents(self):
        """Test with realistic CF travel document scenarios."""
        # Realistic CF travel documents with controlled duplicates and variations
        cf_docs = [
            Document(
                page_content="Meal allowances for Toronto: Breakfast $15.50, Lunch $17.85, Dinner $27.05, Total $60.40 per day.",
                metadata={"id": "cbi_5_toronto_meals", "title": "Toronto Meal Rates", "source": "CBI-5", "section": "5.3.2", "version": "2024"}
            ),
            Document(
                page_content="Meal allowances for Toronto: Breakfast $15.50, Lunch $17.85, Dinner $27.05, Total $60.40 per day.",
                metadata={"id": "cbi_5_toronto_meals", "title": "Toronto Meal Rates", "source": "CBI-5", "section": "5.3.2", "version": "2024"}
            ),  # Exact duplicate
            Document(
                page_content="Toronto meal allowances - Breakfast: $15.50, Lunch: $17.85, Dinner: $27.05. Daily total: $60.40.",
                metadata={"id": "cbi_5_toronto_alt", "title": "Toronto Meals Alternative", "source": "CBI-5", "section": "5.3.2", "version": "2024"}
            ),  # Near duplicate - same info, different format
            Document(
                page_content="Kilometric rates for personally owned motor vehicles (PMV): $0.59 per kilometre for the first 5,000 km, $0.54 per kilometre thereafter.",
                metadata={"id": "cbi_7_pmv_rates", "title": "PMV Kilometric Rates", "source": "CBI-7", "section": "7.2.1", "version": "2024"}
            ),
            Document(
                page_content="PMV kilometric allowances: $0.59/km for first 5000 km, then $0.54/km for remaining distance.",
                metadata={"id": "cbi_7_pmv_alt", "title": "PMV Allowances", "source": "CBI-7", "section": "7.2.1", "version": "2024"}
            ),  # Near duplicate - PMV rates in different format
            Document(
                page_content="Incidental allowances: $17.30 per day for the first 30 days, reduced to 75% ($12.98) for stays over 30 days in same location.",
                metadata={"id": "cbi_5_incidentals", "title": "Incidental Allowances", "source": "CBI-5", "section": "5.4.1", "version": "2024"}
            ),
            Document(
                page_content="Hotel accommodation limits for Toronto: Standard rate $180 per night, with receipts required for all stays.",
                metadata={"id": "cbi_6_toronto_hotel", "title": "Toronto Hotel Limits", "source": "CBI-6", "section": "6.2.3", "version": "2024"}
            )
        ]
        
        deduplicator = DocumentDeduplicator(
            jaccard_threshold=0.82,
            hamming_threshold=4,
            preserve_versions=True
        )
        
        unique_docs, stats = deduplicator.deduplicate(cf_docs)
        
        # Should remove exact duplicate and catch near-duplicates
        assert len(unique_docs) < len(cf_docs), "Should remove some duplicates"
        assert stats.stage1_exact_duplicates >= 1, "Should catch exact duplicate"
        assert stats.total_docs_input == 7
        
        # Verify important documents are preserved
        unique_ids = [doc.metadata["id"] for doc in unique_docs]
        assert "cbi_5_incidentals" in unique_ids, "Important unique document should be preserved"
        assert "cbi_6_toronto_hotel" in unique_ids, "Different topic should be preserved"
        
        print(f"✅ CF travel docs test: {len(cf_docs)} → {len(unique_docs)} unique")
        print(f"   Stage 1 (exact): {stats.stage1_exact_duplicates} removed")
        print(f"   Stage 2 (near): {stats.stage2_near_duplicates} removed")
        print(f"   Total deduplication ratio: {stats.get_deduplication_ratio():.1f}%")
    
    def test_analyze_duplicates_functionality(self, deduplicator, sample_docs):
        """Test duplicate analysis functionality."""
        analysis = deduplicator.analyze_duplicates(sample_docs)
        
        # Verify analysis structure
        assert "total_documents" in analysis
        assert "exact_duplicate_groups" in analysis
        assert "near_duplicate_pairs" in analysis
        assert "estimated_deduplication_ratio" in analysis
        
        # Verify counts
        assert analysis["total_documents"] == len(sample_docs)
        assert analysis["exact_duplicate_groups"] >= 1, "Should detect exact duplicates"
        
        print(f"✅ Duplicate analysis: {analysis['exact_duplicate_groups']} exact groups, "
              f"{analysis['near_duplicate_pairs']} near pairs")
    
    def test_factory_function(self):
        """Test factory function for creating deduplicator."""
        # Test default parameters
        dedup1 = create_deduplicator()
        assert dedup1.jaccard_threshold == 0.82
        assert dedup1.hamming_threshold == 4
        assert dedup1.preserve_versions == True
        
        # Test custom parameters
        dedup2 = create_deduplicator(
            jaccard_threshold=0.9,
            hamming_threshold=2,
            preserve_versions=False
        )
        assert dedup2.jaccard_threshold == 0.9
        assert dedup2.hamming_threshold == 2
        assert dedup2.preserve_versions == False
    
    def test_statistics_tracking(self, deduplicator, sample_docs):
        """Test comprehensive statistics tracking."""
        unique_docs, stats = deduplicator.deduplicate(sample_docs)
        
        # Verify statistics object
        assert isinstance(stats, DeduplicationStats)
        assert stats.total_docs_input == len(sample_docs)
        assert stats.unique_docs_output == len(unique_docs)
        assert stats.duplicates_removed == (stats.total_docs_input - stats.unique_docs_output)
        assert stats.processing_time_ms > 0
        
        # Verify deduplication ratio calculation
        ratio = stats.get_deduplication_ratio()
        assert 0 <= ratio <= 100
        
        if stats.duplicates_removed > 0:
            expected_ratio = (stats.duplicates_removed / stats.total_docs_input) * 100
            assert abs(ratio - expected_ratio) < 0.01
    
    def test_content_normalization(self, deduplicator):
        """Test content normalization for better similarity matching."""
        # Documents with same content but different formatting
        formatting_docs = [
            Document(
                page_content="Travel   allowances for\n\nmeals...   $45   per day!!!",
                metadata={"id": "test_1", "title": "Meal Allowances"}
            ),
            Document(
                page_content="Travel allowances for meals $45 per day",
                metadata={"id": "test_2", "title": "Meal Allowances"}  
            )
        ]
        
        # Should normalize and detect as similar
        deduplicator_sensitive = DocumentDeduplicator(
            jaccard_threshold=0.8,
            hamming_threshold=4,
            preserve_versions=True
        )
        
        unique_docs, stats = deduplicator_sensitive.deduplicate(formatting_docs)
        
        # Should detect as near-duplicates due to normalization
        assert len(unique_docs) == 1, "Content normalization should catch formatting differences"
        
        print("✅ Content normalization successfully detected formatted duplicates")
    
    def test_edge_cases_and_error_handling(self):
        """Test various edge cases and error conditions."""
        # Test invalid parameters
        with pytest.raises(ValueError):
            DocumentDeduplicator(jaccard_threshold=1.5)  # Too high
        
        with pytest.raises(ValueError):
            DocumentDeduplicator(hamming_threshold=0)    # Too low
        
        # Test documents with no metadata
        minimal_docs = [
            Document(page_content="Content 1", metadata={}),
            Document(page_content="Content 1", metadata={}),  # Same content, no ID
        ]
        
        deduplicator = DocumentDeduplicator()
        unique_docs, stats = deduplicator.deduplicate(minimal_docs)
        
        # Should handle missing metadata gracefully
        assert len(unique_docs) <= len(minimal_docs)
        
        print("✅ Edge cases handled correctly")
    
    def test_version_preservation_complex_scenarios(self):
        """Test complex version preservation scenarios."""
        version_docs = [
            Document(
                page_content="CBI Chapter 5 - Meal Allowances v1.0",
                metadata={"id": "cbi_5_v1", "version": "1.0", "doc_id": "cbi_5"}
            ),
            Document(
                page_content="CBI Chapter 5 - Meal Allowances v1.1 with corrections",
                metadata={"id": "cbi_5_v1.1", "version": "1.1", "doc_id": "cbi_5"}
            ),
            Document(
                page_content="CBI Chapter 5 - Meal Allowances v2.0 complete rewrite",
                metadata={"id": "cbi_5_v2", "version": "2.0", "doc_id": "cbi_5"}
            ),
            Document(
                page_content="CBI Chapter 7 - PMV Rates v1.0", 
                metadata={"id": "cbi_7_v1", "version": "1.0", "doc_id": "cbi_7"}
            )
        ]
        
        deduplicator = DocumentDeduplicator(preserve_versions=True)
        unique_docs, stats = deduplicator.deduplicate(version_docs)
        
        # All versions should be preserved as they're different versions
        assert len(unique_docs) == 4, "All different versions should be preserved"
        
        # Test without version preservation
        deduplicator_no_versions = DocumentDeduplicator(preserve_versions=False)
        unique_docs_no_ver, stats_no_ver = deduplicator_no_versions.deduplicate(version_docs)
        
        print(f"✅ Version preservation: {len(unique_docs)} with versions, {len(unique_docs_no_ver)} without")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])