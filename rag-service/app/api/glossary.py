"""API endpoints for glossary and acronym management."""

from typing import Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.utils.glossary_loader import get_glossary_loader
from app.core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/api/glossary", tags=["glossary"])


class GlossaryTerm(BaseModel):
    """Model for a glossary term."""
    term: str
    expansion: str
    description: str
    category: str
    variations: List[str]


class GlossarySearchResponse(BaseModel):
    """Response model for glossary search."""
    results: List[GlossaryTerm]
    total: int


class GlossaryExpansionRequest(BaseModel):
    """Request model for text expansion."""
    text: str
    include_both: bool = True


class GlossaryExpansionResponse(BaseModel):
    """Response model for text expansion."""
    original_text: str
    expanded_text: str
    expansions_made: int


@router.get("/", response_model=Dict[str, List[GlossaryTerm]])
async def get_all_glossary_terms():
    """Get all glossary terms organized by category."""
    try:
        loader = get_glossary_loader()
        categories = loader.get_categories()
        
        result = {}
        for category in categories:
            terms = loader.get_terms_by_category(category)
            result[category] = [
                GlossaryTerm(
                    term=term["term"],
                    expansion=term["expansion"],
                    description=term["description"],
                    category=category,
                    variations=term["variations"]
                )
                for term in terms
            ]
        
        return result
        
    except Exception as e:
        logger.error(f"Error fetching glossary terms: {e}")
        raise HTTPException(status_code=500, detail="Error fetching glossary terms")


@router.get("/search", response_model=GlossarySearchResponse)
async def search_glossary(
    q: str = Query(..., description="Search query", min_length=1)
):
    """Search glossary for terms matching the query."""
    try:
        loader = get_glossary_loader()
        results = loader.search_glossary(q)
        
        glossary_terms = [
            GlossaryTerm(
                term=result["term"],
                expansion=result["expansion"],
                description=result["description"],
                category=result["category"],
                variations=result["variations"]
            )
            for result in results
        ]
        
        return GlossarySearchResponse(
            results=glossary_terms,
            total=len(glossary_terms)
        )
        
    except Exception as e:
        logger.error(f"Error searching glossary: {e}")
        raise HTTPException(status_code=500, detail="Error searching glossary")


@router.get("/term/{term}", response_model=Optional[GlossaryTerm])
async def get_glossary_term(term: str):
    """Get a specific glossary term by its abbreviation."""
    try:
        loader = get_glossary_loader()
        expansion = loader.get_expansion(term)
        
        if not expansion:
            raise HTTPException(status_code=404, detail=f"Term '{term}' not found in glossary")
        
        # Find the full term details
        results = loader.search_glossary(term)
        for result in results:
            if result["term"].upper() == term.upper():
                return GlossaryTerm(
                    term=result["term"],
                    expansion=result["expansion"],
                    description=result["description"],
                    category=result["category"],
                    variations=result["variations"]
                )
        
        # If exact match not found, return basic info
        return GlossaryTerm(
            term=term,
            expansion=expansion,
            description="",
            category="",
            variations=loader.get_all_variations(term)
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions (like 404)
        raise
    except Exception as e:
        logger.error(f"Error fetching glossary term: {e}")
        raise HTTPException(status_code=500, detail="Error fetching glossary term")


@router.post("/expand", response_model=GlossaryExpansionResponse)
async def expand_text(request: GlossaryExpansionRequest):
    """Expand acronyms and abbreviations in the provided text."""
    try:
        loader = get_glossary_loader()
        
        # Count words for expansion tracking
        original_words = request.text.split()
        
        # Expand the text
        expanded_text = loader.expand_text(
            request.text, 
            include_both=request.include_both
        )
        
        # Count expansions made
        expanded_words = expanded_text.split()
        expansions_made = len(expanded_words) - len(original_words)
        
        return GlossaryExpansionResponse(
            original_text=request.text,
            expanded_text=expanded_text,
            expansions_made=max(0, expansions_made)
        )
        
    except Exception as e:
        logger.error(f"Error expanding text: {e}")
        raise HTTPException(status_code=500, detail="Error expanding text")


@router.get("/categories", response_model=List[str])
async def get_glossary_categories():
    """Get all available glossary categories."""
    try:
        loader = get_glossary_loader()
        return loader.get_categories()
        
    except Exception as e:
        logger.error(f"Error fetching categories: {e}")
        raise HTTPException(status_code=500, detail="Error fetching categories")


@router.get("/abbreviations", response_model=Dict[str, str])
async def get_all_abbreviations():
    """Get all abbreviations and their expansions as a simple dictionary."""
    try:
        loader = get_glossary_loader()
        return loader.get_abbreviations()
        
    except Exception as e:
        logger.error(f"Error fetching abbreviations: {e}")
        raise HTTPException(status_code=500, detail="Error fetching abbreviations")


class GlossaryUpdateRequest(BaseModel):
    """Request model for updating glossary data."""
    glossary: Dict[str, List[GlossaryTerm]]


@router.post("/update")
async def update_glossary(request: GlossaryUpdateRequest):
    """Update the glossary data file."""
    try:
        import json
        from pathlib import Path
        
        # Get the glossary file path
        loader = get_glossary_loader()
        glossary_path = loader.glossary_path
        
        # Read existing data to preserve metadata
        existing_data = {}
        if glossary_path.exists():
            with open(glossary_path, 'r') as f:
                existing_data = json.load(f)
        
        # Transform the flat structure back to nested structure
        categories = {}
        for category_key, terms_list in request.glossary.items():
            categories[category_key] = {
                "name": category_key.replace('_', ' ').title(),
                "terms": {}
            }
            
            for term in terms_list:
                categories[category_key]["terms"][term.term] = {
                    "expansion": term.expansion,
                    "description": term.description,
                    "variations": term.variations
                }
        
        # Prepare the data in the correct format, preserving metadata
        data = {
            "metadata": existing_data.get("metadata", {
                "version": "1.0",
                "last_updated": "2025-01-08",
                "description": "Canadian Forces Travel Instructions Acronyms and Glossary"
            }),
            "categories": categories
        }
        
        # Backup the existing file
        backup_path = glossary_path.with_suffix('.json.backup')
        if glossary_path.exists():
            import shutil
            shutil.copy2(glossary_path, backup_path)
            logger.info(f"Created backup at {backup_path}")
        
        # Write the new data
        with open(glossary_path, 'w') as f:
            json.dump(data, f, indent=2)
        
        # Reload the glossary loader to use new data
        loader._load_glossary()
        
        logger.info("Glossary updated successfully")
        return {"status": "success", "message": "Glossary updated successfully"}
        
    except Exception as e:
        logger.error(f"Error updating glossary: {e}")
        raise HTTPException(status_code=500, detail=str(e))