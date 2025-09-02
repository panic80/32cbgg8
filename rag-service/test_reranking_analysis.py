#!/usr/bin/env python3
"""
Comprehensive test to analyze the effectiveness of reranking in the RAG service.
"""

import requests
import json
import time
from typing import List, Dict, Any
from collections import defaultdict

# ANSI color codes
GREEN = '\033[92m'
YELLOW = '\033[93m'
RED = '\033[91m'
BLUE = '\033[94m'
CYAN = '\033[96m'
RESET = '\033[0m'

# Test cases with expected relevant content
TEST_CASES = [
    {
        "query": "What is the meal allowance for Yukon?",
        "expected_terms": ["Yukon", "meal", "breakfast", "lunch", "dinner", "27.95", "25.65", "73.95"],
        "category": "Specific Regional Rates"
    },
    {
        "query": "Ontario kilometric rate",
        "expected_terms": ["Ontario", "kilometric", "rate", "km", "vehicle", "0.65", "0.66"],
        "category": "Provincial Transportation"
    },
    {
        "query": "What are the travel allowances for British Columbia?",
        "expected_terms": ["British Columbia", "BC", "allowance", "meal", "accommodation", "hotel"],
        "category": "Comprehensive Provincial Info"
    },
    {
        "query": "hotel rates in Alberta",
        "expected_terms": ["Alberta", "hotel", "accommodation", "rate", "Calgary", "Edmonton"],
        "category": "Accommodation Specific"
    },
    {
        "query": "incidental expenses Northwest Territories",
        "expected_terms": ["Northwest Territories", "NWT", "incidental", "expense", "17.30"],
        "category": "Territory Incidentals"
    }
]

def parse_sse_stream(response):
    """Parse SSE stream and extract all events."""
    events = defaultdict(list)
    current_event = None
    
    for line in response.iter_lines():
        if not line:
            continue
            
        line_str = line.decode('utf-8')
        
        if line_str.startswith('event: '):
            current_event = line_str[7:].strip()
        elif line_str.startswith('data: ') and current_event:
            data_str = line_str[6:].strip()
            if data_str and data_str != '[DONE]':
                try:
                    data = json.loads(data_str)
                    events[current_event].append(data)
                except json.JSONDecodeError:
                    pass
    
    return dict(events)

def analyze_source_relevance(source: Dict[str, Any], expected_terms: List[str]) -> Dict[str, Any]:
    """Analyze how relevant a source is based on expected terms."""
    content = source.get('page_content', '').lower()
    metadata = source.get('metadata', {})
    title = metadata.get('title', '').lower()
    section = metadata.get('section', '').lower()
    
    # Combine all text for analysis
    full_text = f"{content} {title} {section}"
    
    # Check for expected terms
    found_terms = [term for term in expected_terms if term.lower() in full_text]
    relevance_score = len(found_terms) / len(expected_terms) if expected_terms else 0
    
    return {
        'found_terms': found_terms,
        'relevance_score': relevance_score,
        'has_content': len(content) > 50,
        'title': metadata.get('title', 'Unknown'),
        'section': metadata.get('section', 'Unknown'),
        'chunk_id': metadata.get('chunk_id', 'Unknown')
    }

def test_query(query: str, expected_terms: List[str], category: str) -> Dict[str, Any]:
    """Test a single query and analyze results."""
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{YELLOW}Category: {category}{RESET}")
    print(f"{CYAN}Query: {query}{RESET}")
    print(f"{BLUE}{'='*80}{RESET}")
    
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
            headers={"Content-Type": "application/json", "Accept": "text/event-stream"},
            stream=True
        )
        
        if response.status_code != 200:
            print(f"{RED}Error: HTTP {response.status_code}{RESET}")
            return {"success": False, "error": f"HTTP {response.status_code}"}
        
        # Parse all events
        events = parse_sse_stream(response)
        
        # Analyze sources
        sources = []
        if 'sources' in events:
            sources_data = events['sources'][0] if events['sources'] else []
            sources = sources_data if isinstance(sources_data, list) else []
        
        print(f"\n{GREEN}Retrieved {len(sources)} sources{RESET}")
        
        # Analyze top sources for relevance
        if sources:
            print(f"\n{YELLOW}Top 5 Sources Analysis:{RESET}")
            relevant_count = 0
            
            for i, source in enumerate(sources[:5]):
                analysis = analyze_source_relevance(source, expected_terms)
                relevance_pct = analysis['relevance_score'] * 100
                
                if relevance_pct >= 50:
                    relevant_count += 1
                    color = GREEN
                elif relevance_pct >= 25:
                    color = YELLOW
                else:
                    color = RED
                
                print(f"\n  {i+1}. {analysis['title']}")
                print(f"     Section: {analysis['section']}")
                print(f"     {color}Relevance: {relevance_pct:.0f}%{RESET}")
                if analysis['found_terms']:
                    print(f"     Found terms: {', '.join(analysis['found_terms'])}")
                print(f"     Content length: {'Yes' if analysis['has_content'] else 'No'}")
            
            overall_relevance = (relevant_count / min(5, len(sources))) * 100
            print(f"\n{YELLOW}Overall Relevance Score: {overall_relevance:.0f}%{RESET}")
            
            if overall_relevance >= 60:
                print(f"{GREEN}✓ Good reranking - Most top sources are relevant{RESET}")
            elif overall_relevance >= 40:
                print(f"{YELLOW}⚠ Moderate reranking - Some relevant sources{RESET}")
            else:
                print(f"{RED}✗ Poor reranking - Few relevant sources in top results{RESET}")
        
        # Count citations
        citations = events.get('citation', [])
        print(f"\n{GREEN}Citations generated: {len(citations)}{RESET}")
        
        # Get response content
        content_tokens = events.get('content', [])
        response_text = ''.join([token.get('content', '') for token in content_tokens if isinstance(token, dict)])
        
        if response_text:
            print(f"\n{YELLOW}Response Preview:{RESET}")
            preview = response_text[:300] + "..." if len(response_text) > 300 else response_text
            print(preview)
        
        return {
            "success": True,
            "sources_count": len(sources),
            "relevant_sources": relevant_count if sources else 0,
            "citations_count": len(citations),
            "overall_relevance": overall_relevance if sources else 0,
            "response_length": len(response_text)
        }
        
    except Exception as e:
        print(f"{RED}Error: {str(e)}{RESET}")
        return {"success": False, "error": str(e)}

def main():
    """Run comprehensive reranking tests."""
    print(f"{BLUE}RAG Service Reranking Analysis{RESET}")
    print(f"Testing endpoint: http://localhost:8000/api/v1/streaming_chat")
    print(f"Time: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Check service health
    try:
        health = requests.get("http://localhost:8000/api/v1/health")
        if health.status_code == 200:
            health_data = health.json()
            doc_count = health_data.get('components', {}).get('vector_store', {}).get('document_count', 0)
            print(f"{GREEN}✓ Service healthy - {doc_count} documents indexed{RESET}")
        else:
            print(f"{RED}✗ Service unhealthy{RESET}")
            return
    except Exception as e:
        print(f"{RED}✗ Cannot connect to service: {e}{RESET}")
        return
    
    # Run tests
    results = []
    for test_case in TEST_CASES:
        result = test_query(
            query=test_case["query"],
            expected_terms=test_case["expected_terms"],
            category=test_case["category"]
        )
        results.append({
            "category": test_case["category"],
            "query": test_case["query"],
            **result
        })
        time.sleep(2)  # Pause between queries
    
    # Summary
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{YELLOW}SUMMARY REPORT{RESET}")
    print(f"{BLUE}{'='*80}{RESET}")
    
    successful_tests = [r for r in results if r.get('success', False)]
    failed_tests = [r for r in results if not r.get('success', False)]
    
    print(f"\nTotal tests: {len(results)}")
    print(f"{GREEN}Successful: {len(successful_tests)}{RESET}")
    print(f"{RED}Failed: {len(failed_tests)}{RESET}")
    
    if successful_tests:
        avg_relevance = sum(r.get('overall_relevance', 0) for r in successful_tests) / len(successful_tests)
        avg_sources = sum(r.get('sources_count', 0) for r in successful_tests) / len(successful_tests)
        avg_citations = sum(r.get('citations_count', 0) for r in successful_tests) / len(successful_tests)
        
        print(f"\n{YELLOW}Average Metrics:{RESET}")
        print(f"  - Average relevance score: {avg_relevance:.1f}%")
        print(f"  - Average sources retrieved: {avg_sources:.1f}")
        print(f"  - Average citations generated: {avg_citations:.1f}")
        
        print(f"\n{YELLOW}Per-Category Results:{RESET}")
        for result in results:
            if result.get('success'):
                status = f"{GREEN}✓{RESET}" if result.get('overall_relevance', 0) >= 60 else f"{YELLOW}⚠{RESET}"
                print(f"  {status} {result['category']}: {result.get('overall_relevance', 0):.0f}% relevance")
    
    # Overall assessment
    print(f"\n{BLUE}{'='*80}{RESET}")
    if successful_tests and avg_relevance >= 60:
        print(f"{GREEN}✓ RERANKING IS WORKING WELL{RESET}")
        print("The system is successfully prioritizing relevant documents for most queries.")
    elif successful_tests and avg_relevance >= 40:
        print(f"{YELLOW}⚠ RERANKING NEEDS IMPROVEMENT{RESET}")
        print("The system is finding some relevant documents but could be better optimized.")
    else:
        print(f"{RED}✗ RERANKING IS NOT EFFECTIVE{RESET}")
        print("The system is not effectively prioritizing relevant documents.")

if __name__ == "__main__":
    main()