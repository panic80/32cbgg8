#!/usr/bin/env python3
"""Check if logging is happening in live system"""
import asyncio
import aiohttp
import json

async def test_live_query():
    # Test through the RAG service directly
    url = "http://localhost:8000/api/v1/streaming_chat"
    
    data = {
        "message": "What is the meal allowance for Ottawa?",
        "provider": "openai",
        "model": "gpt-4o-mini",
        "use_rag": True,
        "temperature": 0.1,
        "max_tokens": 300,
        "conversation_id": "test-logging-123"
    }
    
    print(f"Sending query to: {url}")
    print(f"Query: {data['message']}")
    
    async with aiohttp.ClientSession() as session:
        async with session.post(url, json=data) as response:
            print(f"Response status: {response.status}")
            
            # Read streaming response
            response_text = ""
            async for line in response.content:
                line_text = line.decode('utf-8').strip()
                if line_text.startswith('data: '):
                    try:
                        event_data = json.loads(line_text[6:])
                        if event_data.get('type') == 'token':
                            response_text += event_data.get('content', '')
                    except:
                        pass
                        
            print(f"Response preview: {response_text[:200]}...")
    
    # Wait a bit for logging to complete
    await asyncio.sleep(2)
    
    # Check if it was logged
    print("\nChecking query logs...")
    from app.services.query_logger import get_query_logger
    from app.models.query_history import QueryHistoryFilter
    
    query_logger = get_query_logger()
    filters = QueryHistoryFilter(
        limit=5,
        conversation_id="test-logging-123"
    )
    
    entries = await query_logger.get_query_history(filters)
    print(f"Found {len(entries)} matching queries")
    
    for entry in entries:
        print(f"\nLogged query:")
        print(f"  ID: {entry.id}")
        print(f"  Query: {entry.user_query}")
        print(f"  Response preview: {entry.response_preview[:100] if entry.response_preview else 'None'}...")
        print(f"  Status: {entry.status}")

if __name__ == "__main__":
    asyncio.run(test_live_query())