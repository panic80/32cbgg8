"""Test script to demonstrate strategy usage."""

import asyncio
from typing import List

from app.unified_retrieval.strategies import (
    RetrievalContext,
    StrategyPipeline,
    MultiQueryStrategy,
    VectorRetrievalStrategy,
    RestrictionAwareFilterStrategy,
    ContentBoostStrategy,
    HybridScoreStrategy
)
from app.core.logging import get_logger

logger = get_logger(__name__)


async def test_basic_pipeline():
    """Test a basic retrieval pipeline."""
    
    # Create a retrieval context
    context = RetrievalContext(
        original_query="What is the meal allowance for Class A reservists?",
        top_k=10
    )
    
    # Create strategies
    strategies = [
        # 1. Generate multiple query variations
        MultiQueryStrategy(
            num_queries=3,
            include_original=True
        ),
        
        # 2. Perform vector retrieval
        VectorRetrievalStrategy(
            search_type="similarity"
        ),
        
        # 3. Filter for restrictions
        RestrictionAwareFilterStrategy(
            boost_factor=2.0
        ),
        
        # 4. Boost based on content patterns
        ContentBoostStrategy(),
        
        # 5. Combine scores
        HybridScoreStrategy(
            normalization="minmax"
        )
    ]
    
    # Create pipeline
    pipeline = StrategyPipeline(
        strategies=strategies,
        name="test_pipeline"
    )
    
    # Execute pipeline
    try:
        result = await pipeline.execute(context)
        
        # Print results
        print(f"Query: {result.original_query}")
        print(f"Documents retrieved: {len(result.documents)}")
        print(f"Errors: {len(result.errors)}")
        
        # Show top 3 documents
        print("\nTop 3 Results:")
        for i, doc in enumerate(result.documents[:3], 1):
            print(f"\n{i}. Score: {result.scores.get(id(doc), 0):.3f}")
            print(f"   Content: {doc.page_content[:200]}...")
            print(f"   Metadata: {doc.metadata}")
        
        # Show strategy outputs
        print("\nStrategy Outputs:")
        for strategy_name, output in result.strategy_outputs.items():
            print(f"\n{strategy_name}:")
            print(f"  {output}")
            
    except Exception as e:
        logger.error(f"Pipeline execution failed: {e}")
        raise


async def test_parallel_strategies():
    """Test parallel strategy execution."""
    
    context = RetrievalContext(
        original_query="How many kilometers can I claim for PMV travel?",
        top_k=15
    )
    
    # Create pipeline with parallel scoring
    pipeline = StrategyPipeline(
        name="parallel_test",
        strategies=[
            # Sequential: Query enhancement
            MultiQueryStrategy(num_queries=2)
        ],
        parallel_groups={
            "retrieval": [
                VectorRetrievalStrategy(search_type="similarity"),
                # Could add BM25 here for true parallel retrieval
            ],
            "scoring": [
                ContentBoostStrategy(),
                AuthorityBoostStrategy(),
                CooccurrenceScoreStrategy()
            ]
        }
    )
    
    # Add final scoring strategy
    pipeline.add_strategy(HybridScoreStrategy())
    
    # Execute
    result = await pipeline.execute(context)
    
    print(f"Parallel pipeline completed with {len(result.documents)} documents")
    print(f"Parallel groups executed: {list(pipeline.parallel_groups.keys())}")


async def test_config_based_pipeline():
    """Test loading pipeline from configuration."""
    from app.unified_retrieval.strategies.base import PipelineConfig
    import yaml
    
    # Load example configuration
    with open("/var/www/cbthis/rag-service/app/unified_retrieval/config/example_pipelines.yaml", "r") as f:
        config_data = yaml.safe_load(f)
    
    # Use the multi-query enhanced pipeline
    pipeline_data = next(
        p for p in config_data["pipelines"]
        if p["name"] == "Multi-Query Enhanced Search"
    )
    
    # Create pipeline config
    pipeline_config = PipelineConfig(**pipeline_data)
    
    # Build pipeline
    pipeline = pipeline_config.build_pipeline()
    
    # Test with a query
    context = RetrievalContext(
        original_query="What are the restrictions on international travel?",
        top_k=10
    )
    
    result = await pipeline.execute(context)
    
    print(f"Config-based pipeline '{pipeline_config.name}' completed")
    print(f"Strategies used: {len(pipeline.strategies)}")
    print(f"Documents retrieved: {len(result.documents)}")


async def main():
    """Run all tests."""
    print("=== Testing Basic Pipeline ===")
    await test_basic_pipeline()
    
    print("\n\n=== Testing Parallel Strategies ===")
    await test_parallel_strategies()
    
    print("\n\n=== Testing Config-Based Pipeline ===")
    await test_config_based_pipeline()


if __name__ == "__main__":
    asyncio.run(main())