#!/usr/bin/env python3
"""Diagnose Chapter 10 ingestion issues."""
import asyncio
import httpx
import time
from bs4 import BeautifulSoup
import sys
sys.path.append('/var/www/cbthis/rag-service')

from app.pipelines.table_aware_loader import TableAwareWebLoader
from app.pipelines.sentence_aware_splitter import SentenceAwareTextSplitter

async def diagnose():
    url = "https://www.canada.ca/en/department-national-defence/corporate/policies-standards/compensation-benefits-instructions/chapter-10-foreign-service.html"
    
    print("=== Chapter 10 Diagnosis ===\n")
    
    # 1. Test basic fetch
    print("1. Testing basic HTTP fetch...")
    start = time.time()
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.get(url)
            fetch_time = time.time() - start
            print(f"   ✓ Fetched in {fetch_time:.1f}s")
            print(f"   Size: {len(response.content) / 1024:.1f} KB")
    except Exception as e:
        print(f"   ✗ Failed: {e}")
        return
    
    # 2. Test table parsing
    print("\n2. Testing HTML parsing...")
    start = time.time()
    try:
        soup = BeautifulSoup(response.text, "html.parser")
        parse_time = time.time() - start
        print(f"   ✓ Parsed in {parse_time:.1f}s")
        
        tables = soup.find_all("table")
        print(f"   Found {len(tables)} tables")
        
        # Check table sizes
        for i, table in enumerate(tables[:3]):
            rows = table.find_all("tr")
            print(f"   Table {i+1}: {len(rows)} rows")
    except Exception as e:
        print(f"   ✗ Failed: {e}")
    
    # 3. Test loader
    print("\n3. Testing TableAwareWebLoader...")
    start = time.time()
    try:
        loader = TableAwareWebLoader(url, timeout=120)
        documents = await loader.load()
        load_time = time.time() - start
        print(f"   ✓ Loaded in {load_time:.1f}s")
        print(f"   Created {len(documents)} documents")
        
        # Check document sizes
        total_chars = sum(len(doc.page_content) for doc in documents)
        print(f"   Total content: {total_chars} characters")
        
        # Check for table documents
        table_docs = [doc for doc in documents if doc.metadata.get('content_type') == 'table']
        print(f"   Table documents: {len(table_docs)}")
        
    except Exception as e:
        print(f"   ✗ Failed: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return
    
    # 4. Test text splitting
    print("\n4. Testing text splitting...")
    start = time.time()
    try:
        splitter = SentenceAwareTextSplitter(
            chunk_size=1024,
            chunk_overlap=250
        )
        
        all_chunks = []
        for doc in documents[:5]:  # Test first 5 docs
            chunks = splitter.split_documents([doc])
            all_chunks.extend(chunks)
        
        split_time = time.time() - start
        print(f"   ✓ Split in {split_time:.1f}s")
        print(f"   Created {len(all_chunks)} chunks from first 5 documents")
        
    except Exception as e:
        print(f"   ✗ Failed: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
    
    # 5. Check content characteristics
    print("\n5. Content analysis...")
    # Check for problematic content
    content = response.text
    print(f"   JavaScript blocks: {content.count('<script')}")
    print(f"   Style blocks: {content.count('<style')}")
    print(f"   Iframe elements: {content.count('<iframe')}")
    print(f"   Comments: {content.count('<!--')}")
    
    # Check for very long lines
    lines = content.split('\n')
    long_lines = [l for l in lines if len(l) > 5000]
    print(f"   Very long lines (>5000 chars): {len(long_lines)}")
    
    print("\n=== Diagnosis Complete ===")

if __name__ == "__main__":
    asyncio.run(diagnose())