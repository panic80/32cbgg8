#!/usr/bin/env python3
"""Test query logging directly"""
import asyncio
import uuid
from datetime import datetime

async def test_logging():
    from app.services.query_logger import get_query_logger
    from app.models.query_history import QueryStatus
    
    query_logger = get_query_logger()
    print(f"Query logger enabled: {query_logger.enabled}")
    print(f"Database path: {query_logger.db_path}")
    print(f"Encrypt queries: {query_logger.encrypt_queries}")
    
    # Initialize
    await query_logger.initialize()
    print("Query logger initialized")
    
    # Test logging
    query_id = str(uuid.uuid4())
    test_query = "Test query: What is the meal allowance for testing?"
    test_response = "Test response: The meal allowance is $100 per day."
    
    await query_logger.log_query(
        query_id=query_id,
        user_query=test_query,
        provider="openai",
        model="gpt-4",
        use_rag=True,
        response=test_response,
        sources_count=3,
        processing_time=1.5,
        tokens_used=100,
        conversation_id="test-conv-123",
        status=QueryStatus.SUCCESS,
        metadata={"test": True}
    )
    
    print(f"Successfully logged query: {query_id}")
    
    # Check if it was stored
    from app.models.query_history import QueryHistoryFilter
    filters = QueryHistoryFilter(limit=10)
    entries = await query_logger.get_query_history(filters)
    
    print(f"\nFound {len(entries)} queries in history")
    for entry in entries[:3]:
        print(f"- {entry.id}: {entry.user_query[:50]}...")
        print(f"  Encrypted: {entry.user_query.startswith('[ENCRYPTED-')}")

if __name__ == "__main__":
    asyncio.run(test_logging())