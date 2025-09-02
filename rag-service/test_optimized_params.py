#!/usr/bin/env python3
"""Test script to verify optimized retrieval parameters."""

import asyncio
import httpx
import json
from datetime import datetime

# Test queries of different types
TEST_QUERIES = [
    # Simple query
    {
        "query": "What is the meal allowance for breakfast?",
        "type": "simple",
        "expected_docs": 5
    },
    # Table query
    {
        "query": "What are the kilometric rates for Ontario?",
        "type": "table",
        "expected_docs": 8
    },
    # Complex query
    {
        "query": "How do I claim both meal allowances and accommodation for a multi-day trip to Vancouver?",
        "type": "complex",
        "expected_docs": 10
    },
    # Multi-hop query
    {
        "query": "If I'm a Class A reservist traveling from Toronto to Ottawa for training, what meal allowances am I entitled to and how do they differ from regular force members?",
        "type": "multi_hop",
        "expected_docs": 12
    },
    # Comparison query
    {
        "query": "What's the difference between TD and LTA travel benefits?",
        "type": "comparison",
        "expected_docs": 10
    }
]

async def test_query(client: httpx.AsyncClient, query_info: dict):
    """Test a single query and analyze results."""
    print(f"\n{'='*60}")
    print(f"Testing {query_info['type']} query:")
    print(f"Query: {query_info['query']}")
    print(f"Expected docs: {query_info['expected_docs']}")
    print(f"{'='*60}")
    
    # Prepare request
    request_data = {
        "message": query_info["query"],
        "use_rag": True,
        "provider": "openai",
        "model": "gpt-4o-mini",
        "include_sources": True
    }
    
    try:
        # Send request
        start_time = datetime.now()
        response = await client.post(
            "http://localhost:8000/api/v1/chat",
            json=request_data,
            timeout=30.0
        )
        elapsed = (datetime.now() - start_time).total_seconds()
        
        if response.status_code == 200:
            result = response.json()
            
            # Analyze results
            num_sources = len(result.get("sources", []))
            print(f"\n✓ Success!")
            print(f"  - Response time: {elapsed:.2f}s")
            print(f"  - Sources returned: {num_sources}")
            print(f"  - Processing time: {result.get('processing_time', 'N/A')}s")
            
            # Check if we got expected number of docs
            if num_sources > 0:
                print(f"  - Document count vs expected: {num_sources}/{query_info['expected_docs']}")
                
                # Analyze source types
                source_types = {}
                for source in result["sources"]:
                    src_type = source.get("metadata", {}).get("source_type", "unknown")
                    source_types[src_type] = source_types.get(src_type, 0) + 1
                
                print(f"  - Source types: {source_types}")
                
                # Check for table content in table queries
                if query_info["type"] == "table":
                    has_tables = any("|" in source.get("text", "") for source in result["sources"])
                    print(f"  - Contains table formatting: {has_tables}")
                
                # Show top source
                if result["sources"]:
                    top_source = result["sources"][0]
                    print(f"\n  Top source:")
                    print(f"    - Title: {top_source.get('title', 'N/A')}")
                    print(f"    - Score: {top_source.get('score', 'N/A')}")
                    print(f"    - Preview (50 chars): {top_source.get('text', '')[:50]}...")
            
            return True, num_sources
            
        else:
            print(f"\n✗ Request failed with status {response.status_code}")
            print(f"  Error: {response.text}")
            return False, 0
            
    except Exception as e:
        print(f"\n✗ Exception occurred: {str(e)}")
        return False, 0

async def main():
    """Run all tests."""
    print("Testing Optimized Retrieval Parameters")
    print("=====================================")
    
    # Create HTTP client
    async with httpx.AsyncClient() as client:
        # Run tests
        results = []
        for query_info in TEST_QUERIES:
            success, num_docs = await test_query(client, query_info)
            results.append({
                "type": query_info["type"],
                "success": success,
                "num_docs": num_docs,
                "expected": query_info["expected_docs"]
            })
            
            # Small delay between requests
            await asyncio.sleep(1)
        
        # Summary
        print(f"\n{'='*60}")
        print("SUMMARY")
        print(f"{'='*60}")
        
        successful = sum(1 for r in results if r["success"])
        print(f"Successful queries: {successful}/{len(results)}")
        
        print("\nDocument retrieval analysis:")
        for result in results:
            if result["success"]:
                efficiency = (result["num_docs"] / result["expected"]) * 100
                print(f"  - {result['type']:12s}: {result['num_docs']:2d}/{result['expected']:2d} docs ({efficiency:.0f}%)")
        
        # Check if parameter optimization is working
        print("\nParameter optimization checks:")
        
        # Check if we're getting more documents for complex queries
        simple_docs = next((r["num_docs"] for r in results if r["type"] == "simple" and r["success"]), 0)
        complex_docs = next((r["num_docs"] for r in results if r["type"] == "complex" and r["success"]), 0)
        
        if complex_docs > simple_docs:
            print("  ✓ Complex queries return more documents than simple queries")
        else:
            print("  ✗ Complex queries should return more documents than simple queries")
        
        # Check if table queries are working
        table_result = next((r for r in results if r["type"] == "table"), None)
        if table_result and table_result["success"] and table_result["num_docs"] > 0:
            print("  ✓ Table queries are returning documents")
        else:
            print("  ✗ Table queries need improvement")

if __name__ == "__main__":
    asyncio.run(main())