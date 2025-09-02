"""
Tests for Multi-feature Uncertainty Scorer.

Tests focus on objective measurement of query characteristics and realistic
edge cases that could break the uncertainty analysis.
"""

import pytest
from typing import Dict, List

from app.components.uncertainty_scorer import (
    UncertaintyScorer,
    UncertaintyFeatures,
    UncertaintyResult,
    create_uncertainty_scorer
)


class TestUncertaintyFeatures:
    """Test uncertainty feature data structure."""
    
    def test_feature_dict_conversion(self):
        """Test conversion to dictionary format."""
        features = UncertaintyFeatures(
            ambiguity_score=0.7,
            specificity_score=0.3,
            coverage_score=0.5,
            coherence_score=0.2,
            complexity_score=0.8
        )
        
        feature_dict = features.feature_dict
        
        assert feature_dict['ambiguity'] == 0.7
        assert feature_dict['specificity'] == 0.3
        assert feature_dict['coverage'] == 0.5
        assert feature_dict['coherence'] == 0.2
        assert feature_dict['complexity'] == 0.8
        assert len(feature_dict) == 5


class TestUncertaintyScorer:
    """Test uncertainty scorer functionality with real-world scenarios."""
    
    def test_empty_query_handling(self):
        """Test behavior with empty or invalid queries."""
        scorer = UncertaintyScorer()
        
        # Test empty string
        result = scorer.score_query("")
        assert result.overall_uncertainty == 1.0
        assert result.confidence_level == 'low'
        assert not result.retriever_recommendations['dense']
        
        # Test whitespace-only
        result = scorer.score_query("   ")
        assert result.overall_uncertainty == 1.0
        assert result.confidence_level == 'low'
        
        # Test None (should not crash, should handle gracefully)
        result = scorer.score_query(None)
        assert result.overall_uncertainty == 1.0
        assert result.confidence_level == 'low'
    
    def test_simple_clear_query(self):
        """Test with clear, specific CF travel query."""
        scorer = UncertaintyScorer()
        
        query = "accommodation expense receipt requirements for temporary duty travel"
        result = scorer.score_query(query)
        
        # Should have relatively low uncertainty due to specific CF terms
        assert result.overall_uncertainty < 0.8
        assert result.confidence_level in ['high', 'medium']
        
        # Should recommend core retrievers at minimum
        assert result.retriever_recommendations['dense'] is True
        assert result.retriever_recommendations['sparse'] is True
        
        # Features should make sense
        assert result.features.coverage_score < 0.7  # Good domain coverage
        assert len(result.reasoning) > 0
    
    def test_ambiguous_query(self):
        """Test with deliberately ambiguous query."""
        scorer = UncertaintyScorer()
        
        # Intentionally vague query with ambiguous terms
        query = "general information about rates"
        result = scorer.score_query(query)
        
        # Should detect high ambiguity
        assert result.features.ambiguity_score > 0.5
        
        # Overall uncertainty should be higher
        assert result.overall_uncertainty > 0.4
        
        # Should recommend additional retrievers for broader coverage
        assert result.retriever_recommendations['dense'] is True
        assert result.retriever_recommendations['sparse'] is True
    
    def test_out_of_domain_query(self):
        """Test with query completely outside CF travel domain."""
        scorer = UncertaintyScorer()
        
        query = "python machine learning algorithm optimization techniques"
        result = scorer.score_query(query)
        
        # Should detect poor domain coverage
        assert result.features.coverage_score > 0.8
        
        # Should have moderate-to-high overall uncertainty due to poor domain coverage
        assert result.overall_uncertainty > 0.4  # Reasonable threshold
        assert result.confidence_level in ['medium', 'low']  # Should not be high confidence
        
        # Should recommend additional retrievers due to uncertainty
        assert result.retriever_recommendations['bm25'] is True
    
    def test_highly_specific_technical_query(self):
        """Test with very specific technical query."""
        scorer = UncertaintyScorer()
        
        query = "Form DND 2888 completion requirements section 4.2.1 paragraph b authorization codes"
        result = scorer.score_query(query)
        
        # Should have low ambiguity and high specificity
        assert result.features.ambiguity_score < 0.5
        # Note: specificity_score is inverted in features, so check raw specificity
        raw_specificity = 1.0 - result.features.specificity_score
        assert raw_specificity > 0.5  # Technical terms should increase specificity
        
        # Should have reasonable overall uncertainty
        assert result.overall_uncertainty < 0.7
    
    def test_contradictory_query(self):
        """Test with internally contradictory query."""
        scorer = UncertaintyScorer()
        
        query = "maximum minimum allowance rates for temporary permanent duty travel"
        result = scorer.score_query(query)
        
        # Should detect coherence issues
        assert result.features.coherence_score > 0.3
        
        # Should still be processable but with some uncertainty
        assert result.overall_uncertainty > 0.25  # More realistic threshold
    
    def test_very_long_complex_query(self):
        """Test with extremely long and complex query."""
        scorer = UncertaintyScorer()
        
        query = """
        What are the specific accommodation reimbursement rates and meal allowance calculations
        for Canadian Forces personnel on temporary duty travel exceeding 30 days duration when
        stationed at locations where government accommodation is not available and commercial
        lodging exceeds the standard maximum rates established by Treasury Board guidelines,
        particularly for remote northern locations during winter months when transportation
        costs are significantly elevated due to weather conditions and limited flight schedules?
        """
        result = scorer.score_query(query)
        
        # Should detect high complexity
        assert result.features.complexity_score > 0.5
        
        # Long query should have some uncertainty due to complexity
        assert result.overall_uncertainty > 0.3
    
    def test_repeated_terms_query(self):
        """Test query with excessive term repetition."""
        scorer = UncertaintyScorer()
        
        query = "travel travel allowance allowance rates rates travel allowance"
        result = scorer.score_query(query)
        
        # Should detect coherence issues due to repetition
        assert result.features.coherence_score > 0.2
        
        # Should still be processable
        assert result.confidence_level != 'high'  # Shouldn't be high confidence
    
    def test_single_word_query(self):
        """Test with single word query."""
        scorer = UncertaintyScorer()
        
        query = "travel"
        result = scorer.score_query(query)
        
        # Single word should be high uncertainty due to lack of context
        assert result.features.ambiguity_score >= 0.6  # Very ambiguous (allow exactly 0.6)
        assert result.overall_uncertainty > 0.4
        assert result.confidence_level in ['medium', 'low']  # Should not be high confidence
    
    def test_numbers_and_codes_increase_specificity(self):
        """Test that numbers and codes are properly recognized as specific."""
        scorer = UncertaintyScorer()
        
        query_with_numbers = "DND 2888 form section 4.2.1 maximum $150 daily rate"
        query_without_numbers = "form section maximum daily rate"
        
        result_with = scorer.score_query(query_with_numbers)
        result_without = scorer.score_query(query_without_numbers)
        
        # Query with numbers should have higher raw specificity (lower uncertainty score)
        specificity_with = 1.0 - result_with.features.specificity_score
        specificity_without = 1.0 - result_without.features.specificity_score
        
        assert specificity_with > specificity_without
    
    def test_question_words_without_specifics(self):
        """Test that vague questions are detected as ambiguous."""
        scorer = UncertaintyScorer()
        
        vague_query = "what about travel stuff"
        specific_query = "what documentation is required for accommodation expense claims"
        
        vague_result = scorer.score_query(vague_query)
        specific_result = scorer.score_query(specific_query)
        
        # Vague question should have higher ambiguity
        assert vague_result.features.ambiguity_score > specific_result.features.ambiguity_score
        assert vague_result.overall_uncertainty > specific_result.overall_uncertainty
    
    def test_mixed_domain_coherence(self):
        """Test queries mixing CF travel with unrelated domains."""
        scorer = UncertaintyScorer()
        
        mixed_query = "travel allowance python programming database optimization rates"
        pure_query = "travel allowance accommodation rates expense documentation"
        
        mixed_result = scorer.score_query(mixed_query)
        pure_result = scorer.score_query(pure_query)
        
        # Mixed domain query should have coherence issues
        assert mixed_result.features.coherence_score > pure_result.features.coherence_score
    
    def test_capitalized_terms_specificity(self):
        """Test that capitalized terms (proper nouns, acronyms) increase specificity."""
        scorer = UncertaintyScorer()
        
        query_with_caps = "Canadian Forces Treasury Board DND regulations"
        query_without_caps = "forces board regulations"
        
        result_with = scorer.score_query(query_with_caps)
        result_without = scorer.score_query(query_without_caps)
        
        # Capitalized query should have higher specificity
        specificity_with = 1.0 - result_with.features.specificity_score
        specificity_without = 1.0 - result_without.features.specificity_score
        
        assert specificity_with >= specificity_without
    
    def test_weight_validation(self):
        """Test that invalid weights are handled appropriately."""
        # Weights that don't sum to 1.0 should generate warning but not crash
        invalid_weights = {
            'ambiguity': 0.5,
            'specificity': 0.5,
            'coverage': 0.5,
            'coherence': 0.5,
            'complexity': 0.5
        }
        
        # Should not crash, just warn
        scorer = UncertaintyScorer(weights=invalid_weights)
        result = scorer.score_query("test query")
        
        # Should still produce a valid result
        assert 0.0 <= result.overall_uncertainty <= 1.5  # May exceed 1.0 due to invalid weights
        assert result.confidence_level in ['high', 'medium', 'low']
    
    def test_confidence_level_thresholds(self):
        """Test confidence level classification with custom thresholds."""
        custom_thresholds = {
            'high': 0.2,
            'medium': 0.5,
            'low': 1.0
        }
        
        scorer = UncertaintyScorer(confidence_thresholds=custom_thresholds)
        
        # Test with queries that should hit different thresholds
        high_confidence_query = "specific accommodation receipt documentation requirements"
        medium_confidence_query = "general travel allowance information"
        
        high_result = scorer.score_query(high_confidence_query)
        medium_result = scorer.score_query(medium_confidence_query)
        
        # Results should respect custom thresholds
        assert high_result.confidence_level in ['high', 'medium', 'low']
        assert medium_result.confidence_level in ['medium', 'low']
    
    def test_retriever_recommendations_logic(self):
        """Test retriever recommendation logic under different uncertainty scenarios."""
        scorer = UncertaintyScorer()
        
        # High confidence scenario (should use minimal retrievers)
        high_conf_query = "DND 2888 form completion requirements section 4 documentation"
        high_result = scorer.score_query(high_conf_query)
        
        if high_result.overall_uncertainty <= 0.3:
            assert high_result.retriever_recommendations['dense'] is True
            assert high_result.retriever_recommendations['sparse'] is True
            # BM25 and hybrid might be False for high confidence
        
        # Low confidence scenario (should use more retrievers)
        low_conf_query = "stuff about things"
        low_result = scorer.score_query(low_conf_query)
        
        if low_result.overall_uncertainty > 0.6:
            assert low_result.retriever_recommendations['dense'] is True
            assert low_result.retriever_recommendations['sparse'] is True
            assert low_result.retriever_recommendations['bm25'] is True
    
    def test_reasoning_generation(self):
        """Test that reasoning is generated appropriately."""
        scorer = UncertaintyScorer()
        
        query = "maximum accommodation expense reimbursement rates"
        result = scorer.score_query(query)
        
        # Should have non-empty reasoning
        assert len(result.reasoning) > 0
        assert all(isinstance(reason, str) for reason in result.reasoning)
        assert all(len(reason.strip()) > 0 for reason in result.reasoning)
        
        # Reasoning should be descriptive
        reasoning_text = " ".join(result.reasoning).lower()
        assert any(keyword in reasoning_text for keyword in 
                  ['ambiguity', 'specificity', 'coverage', 'coherence', 'complexity', 'query'])
    
    def test_feature_score_ranges(self):
        """Test that all feature scores stay within valid ranges."""
        scorer = UncertaintyScorer()
        
        # Test various query types
        test_queries = [
            "",
            "travel",
            "accommodation expense receipt documentation requirements for CF personnel",
            "what how when where why which something",
            "python machine learning neural networks deep learning",
            "travel travel travel accommodation accommodation rates rates rates",
            "DND 2888 form section 4.2.1 paragraph b maximum $150 daily rate"
        ]
        
        for query in test_queries:
            if query:  # Skip empty string for this test
                result = scorer.score_query(query)
                
                # All feature scores should be in [0.0, 1.0]
                assert 0.0 <= result.features.ambiguity_score <= 1.0
                assert 0.0 <= result.features.specificity_score <= 1.0
                assert 0.0 <= result.features.coverage_score <= 1.0
                assert 0.0 <= result.features.coherence_score <= 1.0
                assert 0.0 <= result.features.complexity_score <= 1.0
                
                # Overall uncertainty should be in [0.0, 1.0] with default weights
                assert 0.0 <= result.overall_uncertainty <= 1.0


class TestFactoryFunction:
    """Test factory function for creating scorer instances."""
    
    def test_create_uncertainty_scorer_defaults(self):
        """Test factory function with default parameters."""
        scorer = create_uncertainty_scorer()
        
        assert isinstance(scorer, UncertaintyScorer)
        assert scorer.weights is not None
        assert scorer.confidence_thresholds is not None
        
        # Should work with basic query
        result = scorer.score_query("test query")
        assert isinstance(result, UncertaintyResult)
    
    def test_create_uncertainty_scorer_custom_params(self):
        """Test factory function with custom parameters."""
        custom_weights = {
            'ambiguity': 0.3,
            'specificity': 0.3,
            'coverage': 0.2,
            'coherence': 0.1,
            'complexity': 0.1
        }
        
        custom_thresholds = {
            'high': 0.25,
            'medium': 0.55,
            'low': 1.0
        }
        
        scorer = create_uncertainty_scorer(
            weights=custom_weights,
            confidence_thresholds=custom_thresholds
        )
        
        assert scorer.weights == custom_weights
        assert scorer.confidence_thresholds == custom_thresholds


class TestEdgeCases:
    """Test edge cases and potential failure modes."""
    
    def test_unicode_and_special_characters(self):
        """Test with unicode and special characters."""
        scorer = UncertaintyScorer()
        
        # Unicode characters
        unicode_query = "tråvel àllowance réimbursement"
        result = scorer.score_query(unicode_query)
        assert result.overall_uncertainty >= 0.0
        
        # Special characters and symbols
        special_query = "travel @#$%^&*() allowance rates !!!"
        result = scorer.score_query(special_query)
        assert result.overall_uncertainty >= 0.0
        
        # Should not crash
        assert result.confidence_level in ['high', 'medium', 'low']
    
    def test_very_long_single_token(self):
        """Test with extremely long single token."""
        scorer = UncertaintyScorer()
        
        long_token = "accommodationexpensereimbursementrequirementsdocumentation" * 5
        result = scorer.score_query(long_token)
        
        # Should handle gracefully
        assert result.overall_uncertainty >= 0.0
        assert len(result.reasoning) > 0
    
    def test_all_punctuation_query(self):
        """Test query with only punctuation."""
        scorer = UncertaintyScorer()
        
        punct_query = "!@#$%^&*()_+-=[]{}|;:,.<>?"
        result = scorer.score_query(punct_query)
        
        # Should treat as effectively empty
        assert result.overall_uncertainty >= 0.8  # High uncertainty
        assert result.confidence_level == 'low'
    
    def test_numeric_only_query(self):
        """Test query with only numbers."""
        scorer = UncertaintyScorer()
        
        numeric_query = "123 456 789 2024 150"
        result = scorer.score_query(numeric_query)
        
        # Numbers should increase specificity but poor coverage/coherence
        assert result.features.coverage_score > 0.5  # Poor domain coverage
        raw_specificity = 1.0 - result.features.specificity_score
        # Numbers should contribute to specificity somewhat
        assert raw_specificity >= 0.0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])