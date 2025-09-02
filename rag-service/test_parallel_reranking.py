#!/usr/bin/env python3
"""Test script for parallel retrieval with reranking."""

import asyncio
import sys
from pathlib import Path

# Add the app directory to the path
sys.path.insert(0, str(Path(__file__).parent))

from app.core.vectorstore import VectorStoreManager
from app.pipelines.parallel_retrieval import create_parallel_pipeline
from app.core.logging import get_logger

logger = get_logger(__name__)


async def test_queries():
    """Test various query types with the enhanced parallel pipeline."""
    
    # Initialize vector store
    logger.info("Initializing vector store...")
    vector_store = VectorStoreManager()
    await vector_store.initialize()
    
    # Create parallel pipeline with reranking
    logger.info("Creating parallel pipeline with reranking...")
    pipeline = create_parallel_pipeline(
        vector_store_manager=vector_store,
        llm=None  # We don't need LLM for basic testing
    )
    
    # Test queries
    test_cases = [
        {
            "query": "What is the meal allowance for Yukon?",
            "type": "table query",
            "expected": "Should find specific meal rates for Yukon"
        },
        {
            "query": "Ontario kilometric rate",
            "type": "table query", 
            "expected": "Should find Ontario PMV rates"
        },
        {
            "query": "What are the travel authorization requirements?",
            "type": "general query",
            "expected": "Should find authorization policies"
        },
        {
            "query": "incidental expense allowance 31st day",
            "type": "specific rule query",
            "expected": "Should find 75% reduction rule"
        }
    ]
    
    for test in test_cases:
        print(f"\n{'='*80}")
        print(f"Testing: {test['query']}")
        print(f"Type: {test['type']}")
        print(f"Expected: {test['expected']}")
        print(f"{'='*80}")
        
        try:
            # Retrieve documents
            results = await pipeline.retrieve(
                query=test['query'],
                k=5
            )
            
            print(f"\nFound {len(results)} results")
            
            # Display top results
            for i, (doc, score) in enumerate(results[:3]):
                print(f"\nResult {i+1} (score: {score:.3f}):")
                print(f"Source: {doc.metadata.get('source', 'Unknown')}")
                print(f"Content preview: {doc.page_content[:200]}...")
                
                # Check for specific content in table queries
                if test['type'] == 'table query' and '$' in doc.page_content:
                    print("✓ Contains dollar amounts")
                
        except Exception as e:
            logger.error(f"Error testing query '{test['query']}': {e}")
            print(f"❌ Error: {e}")
    
    print("\nTest completed!")


if __name__ == "__main__":
    asyncio.run(test_queries())