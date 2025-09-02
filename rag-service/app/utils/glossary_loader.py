"""Utility to load and manage the centralized acronym/glossary database."""

import json
import os
from typing import Dict, List, Optional, Set
from pathlib import Path

from app.core.logging import get_logger

logger = get_logger(__name__)


class GlossaryLoader:
    """Load and manage acronyms and glossary terms from centralized JSON."""
    
    def __init__(self, glossary_path: Optional[str] = None):
        """
        Initialize the glossary loader.
        
        Args:
            glossary_path: Path to the glossary JSON file
        """
        if glossary_path is None:
            # Default path relative to the app directory
            base_dir = Path(__file__).parent.parent
            glossary_path = base_dir / "config" / "acronyms_glossary.json"
        
        self.glossary_path = Path(glossary_path)
        self._glossary_data = None
        self._abbreviations = None
        self._variations_map = None
        self._load_glossary()
    
    def _load_glossary(self):
        """Load the glossary from JSON file."""
        try:
            if not self.glossary_path.exists():
                logger.warning(f"Glossary file not found at {self.glossary_path}")
                self._glossary_data = {"categories": {}}
                return
            
            with open(self.glossary_path, 'r') as f:
                self._glossary_data = json.load(f)
            
            # Build abbreviations dictionary and variations map
            self._build_abbreviations()
            logger.info(f"Loaded glossary with {len(self._abbreviations)} terms")
            
        except Exception as e:
            logger.error(f"Error loading glossary: {e}")
            self._glossary_data = {"categories": {}}
            self._abbreviations = {}
            self._variations_map = {}
    
    def _build_abbreviations(self):
        """Build flat abbreviation dictionary and variations map from glossary."""
        self._abbreviations = {}
        self._variations_map = {}
        
        for category_key, category_data in self._glossary_data.get("categories", {}).items():
            for term_key, term_data in category_data.get("terms", {}).items():
                # Add main term (keep expansion capitalization)
                self._abbreviations[term_key.lower()] = term_data["expansion"]
                
                # Add variations
                for variation in term_data.get("variations", []):
                    variation_lower = variation.lower()
                    self._abbreviations[variation_lower] = term_data["expansion"]
                    # Map variations back to main term
                    self._variations_map[variation_lower] = term_key.lower()
    
    def get_abbreviations(self) -> Dict[str, str]:
        """Get all abbreviations and their expansions."""
        return self._abbreviations.copy()
    
    def get_expansion(self, term: str) -> Optional[str]:
        """Get expansion for a specific term."""
        return self._abbreviations.get(term.lower())
    
    def expand_text(self, text: str, include_both: bool = True) -> str:
        """
        Expand abbreviations in text.
        
        Args:
            text: Text containing abbreviations
            include_both: If True, include both abbreviation and expansion
        
        Returns:
            Text with expanded abbreviations
        """
        words = text.split()
        expanded_words = []
        
        for word in words:
            # Clean word of punctuation for lookup
            cleaned_word = word.lower().strip(".,!?;:()[]{}\"'")
            
            if cleaned_word in self._abbreviations:
                expansion = self._abbreviations[cleaned_word]
                
                if include_both:
                    # Keep both abbreviation and expansion for better search
                    expanded_words.append(f"({word} OR {expansion})")
                else:
                    # Replace with expansion only
                    expanded_words.append(expansion)
            else:
                expanded_words.append(word)
        
        return " ".join(expanded_words)
    
    def get_all_variations(self, term: str) -> List[str]:
        """Get all variations of a term including the term itself."""
        term_lower = term.lower()
        variations = set([term_lower])
        
        # Find the main term if this is a variation
        main_term = self._variations_map.get(term_lower, term_lower)
        
        # Find all variations of the main term
        for category_data in self._glossary_data.get("categories", {}).values():
            terms = category_data.get("terms", {})
            if main_term.upper() in terms or main_term in terms:
                term_data = terms.get(main_term.upper()) or terms.get(main_term)
                if term_data:
                    variations.add(main_term)
                    variations.update([v.lower() for v in term_data.get("variations", [])])
                    variations.add(term_data["expansion"].lower())
        
        return list(variations)
    
    def search_glossary(self, query: str) -> List[Dict[str, any]]:
        """
        Search glossary for terms matching the query.
        
        Args:
            query: Search query
        
        Returns:
            List of matching glossary entries
        """
        query_lower = query.lower()
        results = []
        
        for category_key, category_data in self._glossary_data.get("categories", {}).items():
            for term_key, term_data in category_data.get("terms", {}).items():
                # Check if query matches term, expansion, or description
                if (query_lower in term_key.lower() or
                    query_lower in term_data["expansion"].lower() or
                    query_lower in term_data.get("description", "").lower()):
                    
                    results.append({
                        "term": term_key,
                        "expansion": term_data["expansion"],
                        "description": term_data.get("description", ""),
                        "category": category_data["name"],
                        "variations": term_data.get("variations", [])
                    })
        
        return results
    
    def get_categories(self) -> List[str]:
        """Get list of all categories."""
        return list(self._glossary_data.get("categories", {}).keys())
    
    def get_terms_by_category(self, category: str) -> List[Dict[str, any]]:
        """Get all terms in a specific category."""
        category_data = self._glossary_data.get("categories", {}).get(category, {})
        terms = []
        
        for term_key, term_data in category_data.get("terms", {}).items():
            terms.append({
                "term": term_key,
                "expansion": term_data["expansion"],
                "description": term_data.get("description", ""),
                "variations": term_data.get("variations", [])
            })
        
        return terms


# Global instance for easy access
_glossary_loader = None


def get_glossary_loader() -> GlossaryLoader:
    """Get the global glossary loader instance."""
    global _glossary_loader
    if _glossary_loader is None:
        _glossary_loader = GlossaryLoader()
    return _glossary_loader