#!/usr/bin/env python3
"""
Simple test script to verify reranking with better SSE parsing.
"""

import requests
import json
import time

# Test queries
queries = [
    "What is the meal allowance for Yukon?",
    "Ontario kilometric rate",
    "What are the travel allowances for British Columbia?",
]

def test_query(query):
    print(f"\n{'='*60}")
    print(f"Testing: {query}")
    print('='*60)
    
    url = "http://localhost:8000/api/v1/streaming_chat"
    payload = {
        "message": query,
        "llm_choice": "gemini",
        "conversationId": f"test-{time.time()}",
        "stream": True
    }
    
    try:
        response = requests.post(
            url, 
            json=payload, 
            headers={"Accept": "text/event-stream"},
            stream=True
        )
        
        if response.status_code != 200:
            print(f"Error: HTTP {response.status_code}")
            return
        
        sources = []
        content = ""
        citations = 0
        
        # Process SSE stream
        for line in response.iter_lines():
            if line:
                line_str = line.decode('utf-8')
                
                if line_str.startswith('event: '):
                    event_type = line_str[7:]
                elif line_str.startswith('data: '):
                    data_str = line_str[6:]
                    if data_str and data_str != '[DONE]':
                        try:
                            data = json.loads(data_str)
                            
                            if event_type == 'sources':
                                sources = data
                                print(f"\nFound {len(sources)} sources:")
                                for i, source in enumerate(sources[:3]):
                                    metadata = source.get('metadata', {})
                                    title = metadata.get('title', 'Unknown')
                                    score = source.get('relevance_score', 0)
                                    print(f"  {i+1}. {title} (score: {score:.3f})")
                                    
                                    # Show a snippet of content
                                    content_preview = source.get('page_content', '')[:100]
                                    if content_preview:
                                        print(f"     Preview: {content_preview}...")
                            
                            elif event_type == 'citation':
                                citations += 1
                            
                            elif event_type == 'content':
                                if isinstance(data, dict) and 'content' in data:
                                    content += data['content']
                        except json.JSONDecodeError:
                            pass
        
        print(f"\nTotal citations: {citations}")
        print(f"\nResponse preview:")
        print(content[:200] + "..." if len(content) > 200 else content)
        
    except Exception as e:
        print(f"Error: {str(e)}")

# Run tests
print("Testing RAG Service Reranking")
print(f"Endpoint: http://localhost:8000/api/v1/streaming_chat")

for query in queries:
    test_query(query)
    time.sleep(1)  # Small delay between queries

print("\nTests completed!")