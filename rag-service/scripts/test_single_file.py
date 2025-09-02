#!/usr/bin/env python3
"""
Test ingestion of a single source file to validate the process.
"""
import asyncio
import sys
import os
sys.path.append('/var/www/cbthis/rag-service')

from ingest_source_files import ingest_file, check_service_health, get_document_count, create_metadata

async def test_single_file():
    """Test ingesting a single file."""
    # Pick a small file for testing
    test_files = [
        "/var/www/cbthis/source/1014-1-1.doc",
        "/var/www/cbthis/source/glossary.page",
        "/var/www/cbthis/source/1014-3.pdf"
    ]
    
    # Find the first existing file
    test_file = None
    for file_path in test_files:
        if os.path.exists(file_path):
            test_file = file_path
            break
    
    if not test_file:
        print("No test files found!")
        return False
    
    filename = os.path.basename(test_file)
    print(f"Testing with file: {filename}")
    
    # Check service health
    print("Checking service health...")
    if not await check_service_health():
        print("Service is not healthy!")
        return False
    
    # Get initial count
    initial_count = await get_document_count()
    print(f"Initial document count: {initial_count}")
    
    # Test metadata creation
    print("\nTesting metadata creation...")
    metadata = create_metadata(filename, test_file)
    print(f"Metadata: {metadata}")
    
    # Test ingestion
    print(f"\nTesting ingestion of {filename}...")
    result = await ingest_file(test_file, filename)
    
    # Get final count
    final_count = await get_document_count()
    print(f"Final document count: {final_count}")
    
    print(f"\nResult: {result}")
    
    return result['status'] == 'success'

if __name__ == "__main__":
    success = asyncio.run(test_single_file())
    print(f"\nTest {'PASSED' if success else 'FAILED'}")
    exit(0 if success else 1)