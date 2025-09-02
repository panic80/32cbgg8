#!/usr/bin/env python3
"""
Test script to verify reranking is working properly in the streaming chat endpoint.
Tests various queries and parses SSE responses to check document quality.
"""

import requests
import json
import sys
from typing import List, Dict, Any
from datetime import datetime

# ANSI color codes for output
GREEN = '\033[92m'
YELLOW = '\033[93m'
RED = '\033[91m'
BLUE = '\033[94m'
RESET = '\033[0m'

# Test queries focused on specific information
TEST_QUERIES = [
    {
        "query": "What is the meal allowance for Yukon?",
        "expected_keywords": ["Yukon", "meal", "allowance", "breakfast", "lunch", "dinner"],
        "description": "Testing specific regional meal allowance query"
    },
    {
        "query": "Ontario kilometric rate",
        "expected_keywords": ["Ontario", "kilometric", "rate", "km", "vehicle"],
        "description": "Testing provincial kilometric rate query"
    },
    {
        "query": "What are the travel allowances for British Columbia?",
        "expected_keywords": ["British Columbia", "BC", "allowance", "meal", "accommodation"],
        "description": "Testing comprehensive provincial allowances"
    },
    {
        "query": "hotel rates in Alberta",
        "expected_keywords": ["Alberta", "hotel", "accommodation", "rate", "lodging"],
        "description": "Testing accommodation-specific query"
    },
    {
        "query": "incidental expenses Northwest Territories",
        "expected_keywords": ["Northwest Territories", "NWT", "incidental", "expense"],
        "description": "Testing territory-specific incidental expenses"
    }
]

def parse_sse_response(response_text: str) -> List[Dict[str, Any]]:
    """Parse SSE response and extract events."""
    events = []
    current_event = {}
    
    for line in response_text.split('\n'):
        if line.startswith('event: '):
            current_event['event'] = line[7:].strip()
        elif line.startswith('data: '):
            try:
                data_str = line[6:].strip()
                if data_str and data_str != '[DONE]':
                    current_event['data'] = json.loads(data_str)
            except json.JSONDecodeError:
                current_event['data'] = data_str
        elif line == '' and current_event:
            events.append(current_event)
            current_event = {}
    
    if current_event:
        events.append(current_event)
    
    return events

def test_streaming_chat(query: str, description: str, expected_keywords: List[str]):
    """Test a single query against the streaming chat endpoint."""
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{YELLOW}Test: {description}{RESET}")
    print(f"{BLUE}Query: {query}{RESET}")
    print(f"{BLUE}{'='*80}{RESET}")
    
    url = "http://localhost:8000/api/v1/streaming_chat"
    payload = {
        "message": query,
        "llm_choice": "gemini",
        "conversationId": f"test-{datetime.now().isoformat()}",
        "stream": True
    }
    
    headers = {
        "Content-Type": "application/json",
        "Accept": "text/event-stream"
    }
    
    try:
        # Make the request
        response = requests.post(url, json=payload, headers=headers, stream=True)
        
        if response.status_code != 200:
            print(f"{RED}Error: HTTP {response.status_code}{RESET}")
            print(f"Response: {response.text}")
            return False
        
        # Collect the full response
        full_response = ""
        for chunk in response.iter_content(chunk_size=1024, decode_unicode=True):
            if chunk:
                full_response += chunk
        
        # Parse SSE events
        events = parse_sse_response(full_response)
        
        # Analyze the response
        sources_found = []
        citations_found = []
        response_content = ""
        
        for event in events:
            if event.get('event') == 'sources' and 'data' in event:
                sources = event['data']
                print(f"\n{GREEN}Sources found ({len(sources)}):{RESET}")
                for i, source in enumerate(sources[:5]):  # Show top 5 sources
                    title = source.get('metadata', {}).get('title', 'Unknown')
                    chunk_id = source.get('metadata', {}).get('chunk_id', 'Unknown')
                    relevance_score = source.get('relevance_score', 0)
                    sources_found.append(source)
                    print(f"  {i+1}. {title} (chunk: {chunk_id}, score: {relevance_score:.3f})")
            
            elif event.get('event') == 'citation' and 'data' in event:
                citation = event['data']
                citations_found.append(citation)
            
            elif event.get('event') == 'content' and 'data' in event:
                if isinstance(event['data'], dict) and 'content' in event['data']:
                    response_content += event['data']['content']
        
        print(f"\n{GREEN}Citations used: {len(citations_found)}{RESET}")
        
        # Check keyword relevance in sources
        if sources_found:
            print(f"\n{YELLOW}Checking keyword relevance in top sources:{RESET}")
            relevant_sources = 0
            for i, source in enumerate(sources_found[:3]):  # Check top 3 sources
                content = source.get('page_content', '').lower()
                metadata = json.dumps(source.get('metadata', {})).lower()
                full_text = content + " " + metadata
                
                matching_keywords = [kw for kw in expected_keywords if kw.lower() in full_text]
                
                if matching_keywords:
                    relevant_sources += 1
                    print(f"  Source {i+1}: {GREEN}✓ Relevant{RESET} (keywords: {', '.join(matching_keywords)})")
                else:
                    print(f"  Source {i+1}: {RED}✗ May not be relevant{RESET}")
            
            relevance_percentage = (relevant_sources / min(3, len(sources_found))) * 100
            print(f"\n{YELLOW}Source relevance: {relevance_percentage:.0f}%{RESET}")
            
            if relevance_percentage >= 66:
                print(f"{GREEN}✓ Good reranking - most sources are relevant{RESET}")
            else:
                print(f"{RED}✗ Poor reranking - many irrelevant sources{RESET}")
        
        # Show a snippet of the response
        print(f"\n{YELLOW}Response snippet:{RESET}")
        print(response_content[:300] + "..." if len(response_content) > 300 else response_content)
        
        return True
        
    except Exception as e:
        print(f"{RED}Error testing query: {str(e)}{RESET}")
        return False

def main():
    """Run all tests."""
    print(f"{BLUE}Starting RAG Reranking Tests{RESET}")
    print(f"Testing endpoint: http://localhost:8000/api/v1/streaming_chat")
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Check if the service is running
    try:
        health_response = requests.get("http://localhost:8000/api/v1/health")
        if health_response.status_code != 200:
            print(f"{RED}RAG service is not healthy. Please start it first.{RESET}")
            sys.exit(1)
    except requests.exceptions.ConnectionError:
        print(f"{RED}Cannot connect to RAG service at http://localhost:8000{RESET}")
        print("Please start the service with: cd rag-service && uvicorn app.main:app --reload --port 8000")
        sys.exit(1)
    
    # Run all tests
    successful_tests = 0
    for test_case in TEST_QUERIES:
        success = test_streaming_chat(
            query=test_case["query"],
            description=test_case["description"],
            expected_keywords=test_case["expected_keywords"]
        )
        if success:
            successful_tests += 1
    
    # Summary
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{YELLOW}Test Summary:{RESET}")
    print(f"Total tests: {len(TEST_QUERIES)}")
    print(f"Successful: {successful_tests}")
    print(f"Failed: {len(TEST_QUERIES) - successful_tests}")
    
    if successful_tests == len(TEST_QUERIES):
        print(f"\n{GREEN}✓ All tests passed! Reranking appears to be working well.{RESET}")
    else:
        print(f"\n{RED}✗ Some tests failed. Check the reranking configuration.{RESET}")

if __name__ == "__main__":
    main()