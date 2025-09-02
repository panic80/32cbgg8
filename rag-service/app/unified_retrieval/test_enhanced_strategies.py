"""Test script for enhanced retrieval strategies"""

import asyncio
import logging
from typing import List
import redis
from langchain.embeddings import OpenAIEmbeddings
from langchain.schema import Document, HumanMessage, AIMessage

from app.unified_retrieval.strategies.enhanced_strategies import (
    SemanticCacheStrategy,
    EnhancedQueryStrategy, 
    ContextualBoostStrategy,
    RRFHybridStrategy,
    AdaptiveHybridStrategy,
    ComprehensiveEnhancementStrategy
)
from app.unified_retrieval.strategies.base import StrategyContext

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def create_sample_documents() -> List[Document]:
    """Create sample documents for testing"""
    return [
        Document(
            page_content="Travel claims must be submitted within 30 days of return from duty travel.",
            metadata={"source": "Travel Policy", "section": "Claims", "id": "doc1"}
        ),
        Document(
            page_content="Per diem rates for international travel vary by country and are updated annually.",
            metadata={"source": "Per Diem Guide", "section": "International", "id": "doc2"}
        ),
        Document(
            page_content="Canadian Armed Forces members are entitled to travel advance for authorized duty travel.",
            metadata={"source": "CAF Travel Directive", "section": "Advances", "id": "doc3"}
        ),
        Document(
            page_content="Leave Travel Assistance (LTA) provides financial support for annual leave travel.",
            metadata={"source": "LTA Policy", "section": "Benefits", "id": "doc4"}
        ),
        Document(
            page_content="Temporary duty (TD) assignments require prior authorization from commanding officer.",
            metadata={"source": "TD Procedures", "section": "Authorization", "id": "doc5"}
        )
    ]


async def test_semantic_cache():
    """Test semantic cache strategy"""
    logger.info("\n=== Testing Semantic Cache Strategy ===")
    
    # Initialize components
    embeddings = OpenAIEmbeddings()
    redis_client = redis.Redis(host='localhost', port=6379, decode_responses=True)
    
    strategy = SemanticCacheStrategy(
        embeddings=embeddings,
        redis_client=redis_client,
        similarity_threshold=0.9
    )
    
    # Test queries
    queries = [
        "How do I submit a travel claim?",
        "What is the process for submitting travel claims?",  # Similar to first
        "What are the per diem rates?"
    ]
    
    for query in queries:
        context = StrategyContext()
        context.query = query
        
        # Execute strategy
        result = await strategy.execute(context)
        
        if result.metadata.get("cache_hit"):
            logger.info(f"Cache HIT for: {query}")
            logger.info(f"  Similarity: {result.metadata.get('similarity_score'):.3f}")
            logger.info(f"  Cached query: {result.metadata.get('cached_query')}")
        else:
            logger.info(f"Cache MISS for: {query}")
            # Simulate retrieval
            result.documents = create_sample_documents()[:2]
            await strategy.post_process(result)


async def test_query_expansion():
    """Test advanced query expansion"""
    logger.info("\n=== Testing Enhanced Query Strategy ===")
    
    strategy = EnhancedQueryStrategy()
    
    # Test queries with abbreviations and domain terms
    queries = [
        "TD procedures for CAF members",
        "recent travel policy updates",
        "how to claim per diem"
    ]
    
    # Simulate conversation history
    conversation_history = [
        HumanMessage(content="I'm posted to Ottawa next month"),
        AIMessage(content="Here's information about relocations to Ottawa...")
    ]
    
    for query in queries:
        context = StrategyContext()
        context.query = query
        
        result = await strategy.execute(
            context,
            conversation_history=conversation_history
        )
        
        logger.info(f"\nOriginal: {query}")
        logger.info(f"Expanded: {result.enhanced_query}")
        logger.info(f"Terms added: {result.metadata['query_expansion']['terms_added']}")
        logger.info(f"Query type: {result.metadata['query_type']}")


async def test_contextual_boost():
    """Test contextual retrieval strategy"""
    logger.info("\n=== Testing Contextual Boost Strategy ===")
    
    embeddings = OpenAIEmbeddings()
    strategy = ContextualBoostStrategy(embeddings=embeddings)
    
    # Simulate conversation with context
    turns = [
        ("I need to travel to Halifax", "Here's information about travel to Halifax..."),
        ("What about per diem rates?", "Per diem rates for Halifax are...")
    ]
    
    # Build conversation context
    for query, response in turns:
        strategy.contextual_retriever.update_context(
            query, 
            response,
            create_sample_documents()[:2]
        )
    
    # Test contextual scoring
    context = StrategyContext()
    context.query = "How do I claim expenses for my Halifax trip?"
    context.documents = create_sample_documents()
    
    result = await strategy.execute(context)
    
    logger.info(f"\nQuery: {context.query}")
    logger.info("Document scores after contextual boost:")
    for doc, score in zip(result.documents, result.metadata["scores"]):
        logger.info(f"  {doc.metadata['id']}: {score:.3f} - {doc.page_content[:50]}...")


async def test_adaptive_hybrid():
    """Test adaptive hybrid strategy"""
    logger.info("\n=== Testing Adaptive Hybrid Strategy ===")
    
    strategy = AdaptiveHybridStrategy()
    
    # Test different query types
    test_cases = [
        {
            "query": "CF 100",  # Exact/keyword query
            "dense_results": [(create_sample_documents()[0], 0.7)],
            "sparse_results": [(create_sample_documents()[0], 0.9), 
                             (create_sample_documents()[1], 0.8)]
        },
        {
            "query": "What is the concept behind travel advances?",  # Conceptual
            "dense_results": [(create_sample_documents()[2], 0.9),
                            (create_sample_documents()[3], 0.8)],
            "sparse_results": [(create_sample_documents()[2], 0.6)]
        }
    ]
    
    for test in test_cases:
        context = StrategyContext()
        context.query = test["query"]
        context.metadata["dense_results"] = test["dense_results"]
        context.metadata["sparse_results"] = test["sparse_results"]
        
        result = await strategy.execute(context)
        
        logger.info(f"\nQuery: {test['query']}")
        logger.info(f"Detected type: {result.metadata['detected_query_type']}")
        logger.info(f"Fusion config: {result.metadata['fusion_config']}")
        logger.info(f"Final documents: {len(result.documents)}")


async def test_comprehensive_enhancement():
    """Test comprehensive enhancement strategy"""
    logger.info("\n=== Testing Comprehensive Enhancement Strategy ===")
    
    embeddings = OpenAIEmbeddings()
    redis_client = redis.Redis(host='localhost', port=6379, decode_responses=True)
    
    strategy = ComprehensiveEnhancementStrategy(
        embeddings=embeddings,
        redis_client=redis_client,
        enable_cache=True,
        enable_expansion=True,
        enable_contextual=True,
        enable_hybrid=True
    )
    
    # Test query
    context = StrategyContext()
    context.query = "How do CAF members claim TD expenses?"
    
    # Simulate hybrid retrieval results
    docs = create_sample_documents()
    context.metadata["dense_results"] = [(docs[0], 0.8), (docs[2], 0.7)]
    context.metadata["sparse_results"] = [(docs[4], 0.9), (docs[0], 0.7)]
    
    result = await strategy.execute(context)
    
    logger.info(f"\nOriginal query: {context.query}")
    if result.enhanced_query:
        logger.info(f"Enhanced query: {result.enhanced_query}")
    logger.info(f"Cache status: {result.metadata.get('cache_strategy', 'N/A')}")
    logger.info(f"Documents retrieved: {len(result.documents)}")
    
    # Show top results
    logger.info("\nTop results:")
    for i, (doc, score) in enumerate(zip(result.documents[:3], 
                                         result.metadata.get('scores', [])[:3])):
        logger.info(f"{i+1}. Score: {score:.3f} - {doc.page_content[:60]}...")


async def main():
    """Run all tests"""
    try:
        await test_semantic_cache()
        await test_query_expansion()
        await test_contextual_boost()
        await test_adaptive_hybrid()
        await test_comprehensive_enhancement()
        
        logger.info("\n=== All tests completed successfully ===")
        
    except Exception as e:
        logger.error(f"Test failed: {e}", exc_info=True)


if __name__ == "__main__":
    asyncio.run(main())