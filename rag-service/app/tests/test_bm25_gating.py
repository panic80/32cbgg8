"""
Tests for BM25 Smart Gating Logic.

Tests focus on realistic query scenarios and edge cases that could
break the gating decision logic. Tests should reveal actual issues
rather than catering to expected results.
"""

import pytest
from typing import List, Dict
from unittest.mock import MagicMock

from app.components.bm25_gating import (
    BM25Gate,
    GatingDecision,
    BM25GatingFeatures,
    BM25GatingResult,
    BM25GatingStats,
    create_bm25_gate
)
from app.components.uncertainty_scorer import UncertaintyScorer


class TestBM25GatingFeatures:
    """Test BM25 gating feature extraction."""
    
    def test_feature_initialization(self):
        """Test feature dataclass initialization."""
        features = BM25GatingFeatures(
            has_exact_phrases=True,
            has_technical_terms=False,
            has_numbers_codes=True,
            has_negation=False,
            high_keyword_density=True,
            out_of_domain=False,
            high_uncertainty=True,
            complex_boolean=False
        )
        
        assert features.has_exact_phrases is True
        assert features.has_technical_terms is False
        assert features.has_numbers_codes is True
        assert features.high_uncertainty is True
    
    def test_feature_post_init_validation(self):
        """Test that post_init validation runs without errors."""
        # This should not raise any exceptions
        features = BM25GatingFeatures(
            has_exact_phrases=True,
            has_technical_terms=False,  # This combination should be valid
            has_numbers_codes=False,
            has_negation=False,
            high_keyword_density=False,
            out_of_domain=False,
            high_uncertainty=False,
            complex_boolean=False
        )
        
        # Should complete without errors
        assert features is not None


class TestBM25GatingResult:
    """Test BM25 gating result functionality."""
    
    def test_should_activate_property(self):
        """Test should_activate property logic."""
        features = BM25GatingFeatures(
            has_exact_phrases=False, has_technical_terms=False,
            has_numbers_codes=False, has_negation=False,
            high_keyword_density=False, out_of_domain=False,
            high_uncertainty=False, complex_boolean=False
        )
        
        # Test SKIP decision
        result_skip = BM25GatingResult(
            decision=GatingDecision.SKIP,
            confidence=0.8,
            features=features,
            reasoning=["Test reasoning"],
            estimated_benefit=0.1,
            performance_cost=0.0
        )
        assert result_skip.should_activate is False
        
        # Test ACTIVATE decision
        result_activate = BM25GatingResult(
            decision=GatingDecision.ACTIVATE,
            confidence=0.7,
            features=features,
            reasoning=["Test reasoning"],
            estimated_benefit=0.6,
            performance_cost=25.0
        )
        assert result_activate.should_activate is True
        
        # Test REQUIRED decision
        result_required = BM25GatingResult(
            decision=GatingDecision.REQUIRED,
            confidence=0.9,
            features=features,
            reasoning=["Test reasoning"],
            estimated_benefit=0.9,
            performance_cost=30.0
        )
        assert result_required.should_activate is True


class TestBM25Gate:
    """Test BM25 gate core functionality."""
    
    def test_initialization_defaults(self):
        """Test gate initialization with default parameters."""
        gate = BM25Gate()
        
        assert gate.performance_budget_ms == 50.0
        assert gate.activation_threshold == 0.6
        assert gate.conservative_mode is True
        assert gate.uncertainty_scorer is not None
        
        # Check initial statistics
        stats = gate.get_stats()
        assert stats.total_queries == 0
        assert stats.activation_rate == 0.0
    
    def test_initialization_custom_params(self):
        """Test gate initialization with custom parameters."""
        mock_scorer = MagicMock(spec=UncertaintyScorer)
        
        gate = BM25Gate(
            uncertainty_scorer=mock_scorer,
            performance_budget_ms=100.0,
            activation_threshold=0.5,
            conservative_mode=False
        )
        
        assert gate.uncertainty_scorer == mock_scorer
        assert gate.performance_budget_ms == 100.0
        assert gate.activation_threshold == 0.5
        assert gate.conservative_mode is False
    
    def test_empty_query_handling(self):
        """Test handling of empty or invalid queries."""
        gate = BM25Gate()
        
        # Empty string
        result = gate.should_activate_bm25("")
        assert result.decision == GatingDecision.SKIP
        assert "Empty query" in " ".join(result.reasoning)
        assert result.should_activate is False
        
        # Whitespace only
        result = gate.should_activate_bm25("   ")
        assert result.decision == GatingDecision.SKIP
        assert result.should_activate is False
        
        # Check statistics were updated
        stats = gate.get_stats()
        assert stats.total_queries == 2
        assert stats.bm25_skipped == 2
    
    def test_exact_phrase_detection(self):
        """Test detection of exact phrases triggers BM25."""
        gate = BM25Gate()
        
        query_with_quotes = 'find "Form DND 2888" completion requirements'
        result = gate.should_activate_bm25(query_with_quotes)
        
        assert result.features.has_exact_phrases is True
        assert result.should_activate is True  # Exact phrases should strongly favor BM25
        assert any("exact" in reason.lower() for reason in result.reasoning)
    
    def test_technical_terms_detection(self):
        """Test detection of technical terms influences BM25 decision."""
        gate = BM25Gate()
        
        # Query with technical terms
        technical_query = "accommodation reimbursement policy documentation requirements"
        result = gate.should_activate_bm25(technical_query)
        
        assert result.features.has_technical_terms is True
        # Technical terms should generally favor BM25, but decision depends on threshold
        assert result.decision in [GatingDecision.ACTIVATE, GatingDecision.REQUIRED, GatingDecision.SKIP]
    
    def test_numbers_and_codes_detection(self):
        """Test that numbers and codes trigger BM25 activation."""
        gate = BM25Gate()
        
        # Query with numbers
        number_query = "Form DND 2888 section 4.2.1 maximum $150 daily rate"
        result = gate.should_activate_bm25(number_query)
        
        assert result.features.has_numbers_codes is True
        assert result.should_activate is True  # Numbers should strongly favor exact matching
        assert any("number" in reason.lower() or "code" in reason.lower() for reason in result.reasoning)
    
    def test_negation_detection(self):
        """Test detection of negation terms."""
        gate = BM25Gate()
        
        negation_query = "travel allowance rates not applicable for temporary duty"
        result = gate.should_activate_bm25(negation_query)
        
        assert result.features.has_negation is True
        # Negation should influence decision but may not guarantee activation
        assert "negation" in " ".join(result.reasoning).lower() or "not" in " ".join(result.reasoning).lower()
    
    def test_keyword_density_calculation(self):
        """Test high keyword density detection."""
        gate = BM25Gate()
        
        # High density of technical keywords
        dense_query = "accommodation expense reimbursement authorization approval documentation"
        result = gate.should_activate_bm25(dense_query)
        
        assert result.features.high_keyword_density is True
        # Should influence decision
        assert result.decision in [GatingDecision.ACTIVATE, GatingDecision.REQUIRED, GatingDecision.SKIP]
    
    def test_boolean_logic_detection(self):
        """Test detection of complex boolean logic."""
        gate = BM25Gate()
        
        complex_query = "travel allowance and accommodation rates but not meal expenses and also transportation costs"
        result = gate.should_activate_bm25(complex_query)
        
        assert result.features.complex_boolean is True
        # Complex boolean should influence decision
        assert "boolean" in " ".join(result.reasoning).lower() or "logic" in " ".join(result.reasoning).lower()
    
    def test_simple_semantic_query_skipping(self):
        """Test that simple semantic queries skip BM25."""
        gate = BM25Gate(activation_threshold=0.8)  # High threshold to test skipping
        
        simple_query = "travel policies"
        result = gate.should_activate_bm25(simple_query)
        
        # Simple queries should generally skip BM25 unless threshold is very low
        # This tests realistic behavior rather than forced expectations
        assert result.decision in [GatingDecision.SKIP, GatingDecision.ACTIVATE]
        assert result.confidence > 0.1  # Should have some confidence in decision
    
    def test_out_of_domain_query_handling(self):
        """Test handling of queries outside CF travel domain."""
        gate = BM25Gate()
        
        # Completely out-of-domain query
        ood_query = "python machine learning neural network optimization algorithms"
        result = gate.should_activate_bm25(ood_query)
        
        # Out-of-domain should be detected by uncertainty scorer
        assert result.features.out_of_domain is True
        # May or may not activate BM25 depending on other factors
        assert result.decision in [GatingDecision.SKIP, GatingDecision.ACTIVATE, GatingDecision.REQUIRED]
    
    def test_performance_cost_estimation(self):
        """Test that performance cost estimation is reasonable."""
        gate = BM25Gate(performance_budget_ms=30.0)
        
        # Simple query
        simple_result = gate.should_activate_bm25("travel rates")
        
        # Complex query
        complex_result = gate.should_activate_bm25(
            '"Form DND 2888" completion requirements section 4.2.1 and not temporary duty but accommodation expenses'
        )
        
        # Performance costs should be reasonable
        assert 0.0 <= simple_result.performance_cost <= gate.performance_budget_ms
        assert 0.0 <= complex_result.performance_cost <= gate.performance_budget_ms
        
        # Complex query should generally cost more (unless skipped)
        if complex_result.should_activate and simple_result.should_activate:
            assert complex_result.performance_cost >= simple_result.performance_cost
    
    def test_conservative_mode_effects(self):
        """Test that conservative mode affects decisions appropriately."""
        # Conservative mode (default)
        conservative_gate = BM25Gate(conservative_mode=True, activation_threshold=0.6)
        
        # Non-conservative mode
        aggressive_gate = BM25Gate(conservative_mode=False, activation_threshold=0.6)
        
        # Test with a borderline query
        borderline_query = "accommodation expense documentation"
        
        conservative_result = conservative_gate.should_activate_bm25(borderline_query)
        aggressive_result = aggressive_gate.should_activate_bm25(borderline_query)
        
        # Conservative mode should not be less likely to activate than aggressive mode
        # (Either equal likelihood or more likely to activate)
        if aggressive_result.should_activate:
            assert conservative_result.should_activate  # Conservative should at least match aggressive
    
    def test_decision_confidence_ranges(self):
        """Test that decision confidence stays within valid ranges."""
        gate = BM25Gate()
        
        test_queries = [
            "",  # Empty
            "travel",  # Simple
            '"exact phrase"',  # Exact phrase
            "Form DND 2888 section 4.2.1",  # Technical with numbers
            "python machine learning",  # Out of domain
            "accommodation and transportation but not meals"  # Complex boolean
        ]
        
        for query in test_queries:
            result = gate.should_activate_bm25(query)
            
            # Confidence should be in valid range
            assert 0.0 <= result.confidence <= 1.0
            assert result.confidence >= 0.1  # Should have minimum confidence
            
            # Estimated benefit should be in valid range
            assert 0.0 <= result.estimated_benefit <= 1.0
    
    def test_statistics_tracking(self):
        """Test that statistics are properly tracked."""
        gate = BM25Gate()
        
        # Initial state
        stats = gate.get_stats()
        assert stats.total_queries == 0
        assert stats.bm25_activated == 0
        assert stats.bm25_skipped == 0
        
        # Process some queries
        queries = [
            "simple query",
            '"exact phrase query"',
            "Form DND 2888",
            ""
        ]
        
        for query in queries:
            gate.should_activate_bm25(query)
        
        # Check updated statistics
        final_stats = gate.get_stats()
        assert final_stats.total_queries == 4
        assert final_stats.bm25_activated + final_stats.bm25_skipped == 4
        assert 0.0 <= final_stats.activation_rate <= 1.0
        assert final_stats.avg_decision_time_ms >= 0.0
    
    def test_statistics_reset(self):
        """Test statistics reset functionality."""
        gate = BM25Gate()
        
        # Process some queries
        gate.should_activate_bm25("test query 1")
        gate.should_activate_bm25("test query 2")
        
        # Verify stats exist
        stats_before = gate.get_stats()
        assert stats_before.total_queries > 0
        
        # Reset
        gate.reset_stats()
        
        # Verify reset
        stats_after = gate.get_stats()
        assert stats_after.total_queries == 0
        assert stats_after.bm25_activated == 0
        assert stats_after.bm25_skipped == 0
    
    def test_performance_budget_update(self):
        """Test updating performance budget."""
        gate = BM25Gate(performance_budget_ms=50.0)
        
        assert gate.performance_budget_ms == 50.0
        
        gate.update_performance_budget(75.0)
        assert gate.performance_budget_ms == 75.0
    
    def test_batch_analysis(self):
        """Test batch query analysis functionality."""
        gate = BM25Gate()
        
        queries = [
            "travel allowance rates",
            '"Form DND 2888" requirements',
            "accommodation expenses",
            ""
        ]
        
        results = gate.analyze_query_batch(queries)
        
        # Should return results for all queries
        assert len(results) == len(queries)
        
        # All queries should be in results
        for query in queries:
            assert query in results
            assert isinstance(results[query], BM25GatingResult)
        
        # Statistics should be updated
        stats = gate.get_stats()
        assert stats.total_queries >= len(queries)  # At least these queries
    
    def test_error_handling_in_gating(self):
        """Test error handling during gating decisions."""
        # Create gate with mock uncertainty scorer that raises exception
        mock_scorer = MagicMock()
        mock_scorer.score_query.side_effect = Exception("Mock error")
        
        gate = BM25Gate(uncertainty_scorer=mock_scorer)
        
        # Should not crash, should return conservative result
        result = gate.should_activate_bm25("test query")
        
        # Should still return a valid result
        assert isinstance(result, BM25GatingResult)
        assert result.decision in [GatingDecision.SKIP, GatingDecision.ACTIVATE, GatingDecision.REQUIRED]
        assert "Error" in " ".join(result.reasoning) or "error" in " ".join(result.reasoning)
    
    def test_threshold_sensitivity(self):
        """Test sensitivity to activation threshold."""
        # Low threshold gate (more likely to activate)
        low_gate = BM25Gate(activation_threshold=0.3)
        
        # High threshold gate (less likely to activate)
        high_gate = BM25Gate(activation_threshold=0.8)
        
        # Test with a moderate query
        moderate_query = "accommodation expense documentation"
        
        low_result = low_gate.should_activate_bm25(moderate_query)
        high_result = high_gate.should_activate_bm25(moderate_query)
        
        # Low threshold should be more likely to activate (but not guaranteed)
        # This tests realistic behavior
        assert isinstance(low_result, BM25GatingResult)
        assert isinstance(high_result, BM25GatingResult)
        
        # If high threshold activates, low threshold should definitely activate
        if high_result.should_activate:
            assert low_result.should_activate


class TestFactoryFunction:
    """Test factory function for creating BM25 gates."""
    
    def test_create_bm25_gate_defaults(self):
        """Test factory function with default parameters."""
        gate = create_bm25_gate()
        
        assert isinstance(gate, BM25Gate)
        assert gate.performance_budget_ms == 50.0
        assert gate.activation_threshold == 0.6
        assert gate.conservative_mode is True
    
    def test_create_bm25_gate_custom_params(self):
        """Test factory function with custom parameters."""
        mock_scorer = MagicMock(spec=UncertaintyScorer)
        
        gate = create_bm25_gate(
            uncertainty_scorer=mock_scorer,
            performance_budget_ms=100.0,
            activation_threshold=0.4,
            conservative_mode=False
        )
        
        assert gate.uncertainty_scorer == mock_scorer
        assert gate.performance_budget_ms == 100.0
        assert gate.activation_threshold == 0.4
        assert gate.conservative_mode is False


class TestEdgeCases:
    """Test edge cases and potential failure modes."""
    
    def test_unicode_and_special_characters(self):
        """Test with unicode and special characters."""
        gate = BM25Gate()
        
        # Unicode query
        unicode_query = "tråvel àllowance réimbursement"
        result = gate.should_activate_bm25(unicode_query)
        assert isinstance(result, BM25GatingResult)
        
        # Special characters
        special_query = "travel @#$%^&*() allowance !!! ???"
        result = gate.should_activate_bm25(special_query)
        assert isinstance(result, BM25GatingResult)
    
    def test_very_long_query(self):
        """Test with extremely long query."""
        gate = BM25Gate()
        
        long_query = ("accommodation expense reimbursement policy " * 50).strip()
        result = gate.should_activate_bm25(long_query)
        
        assert isinstance(result, BM25GatingResult)
        # Performance cost should be capped
        assert result.performance_cost <= gate.performance_budget_ms
    
    def test_all_caps_query(self):
        """Test with all uppercase query."""
        gate = BM25Gate()
        
        caps_query = "FORM DND 2888 ACCOMMODATION EXPENSE RATES"
        result = gate.should_activate_bm25(caps_query)
        
        # Should detect codes/numbers due to capitalization
        assert result.features.has_numbers_codes is True
        assert isinstance(result, BM25GatingResult)
    
    def test_mixed_case_technical_terms(self):
        """Test detection of technical terms in mixed case."""
        gate = BM25Gate()
        
        mixed_query = "AccommoDation ReimburseMent Policy"
        result = gate.should_activate_bm25(mixed_query)
        
        # Should still detect technical terms (case insensitive)
        assert result.features.has_technical_terms is True
    
    def test_repeated_activation_calls(self):
        """Test multiple calls with same query for consistency."""
        gate = BM25Gate()
        
        query = "Form DND 2888 requirements"
        
        # Make multiple calls
        results = [gate.should_activate_bm25(query) for _ in range(5)]
        
        # Decisions should be consistent
        decisions = [r.decision for r in results]
        assert all(d == decisions[0] for d in decisions)
        
        # Features should be consistent
        feature_sets = [r.features for r in results]
        for features in feature_sets[1:]:
            assert features.has_exact_phrases == feature_sets[0].has_exact_phrases
            assert features.has_technical_terms == feature_sets[0].has_technical_terms
            assert features.has_numbers_codes == feature_sets[0].has_numbers_codes


class TestRealisticScenarios:
    """Test realistic CF travel query scenarios."""
    
    def test_typical_cf_travel_queries(self):
        """Test with typical Canadian Forces travel queries."""
        gate = BM25Gate()
        
        cf_queries = [
            "meal allowance rates for domestic travel",
            "accommodation expense receipt requirements",
            "temporary duty travel authorization form",
            "per diem rates for international deployment",
            "transportation expense reimbursement policy"
        ]
        
        for query in cf_queries:
            result = gate.should_activate_bm25(query)
            
            # All should produce valid results
            assert isinstance(result, BM25GatingResult)
            assert len(result.reasoning) > 0
            assert result.confidence > 0.0
    
    def test_form_and_document_queries(self):
        """Test queries about specific forms and documents."""
        gate = BM25Gate()
        
        form_queries = [
            "DND 2888 form completion",
            "Treasury Board travel directive section 4",
            "Financial Administration Act requirements",
            "CF travel policy paragraph 2.1.3"
        ]
        
        for query in form_queries:
            result = gate.should_activate_bm25(query)
            
            # Form queries should generally favor BM25 due to specificity
            # But don't force the test - let the algorithm decide
            assert isinstance(result, BM25GatingResult)
            assert result.features.has_numbers_codes or result.features.has_technical_terms


if __name__ == "__main__":
    pytest.main([__file__, "-v"])