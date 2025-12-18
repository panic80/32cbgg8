#!/usr/bin/env python3
"""Submit batch ingestion request with proper timeout handling."""
import asyncio
import httpx
import json
import sys
from datetime import datetime

async def submit_batch_ingestion():
    """Submit batch ingestion and monitor progress."""
    # Read the batch request
    with open('cbi_batch_request.json', 'r') as f:
        batch_data = json.load(f)
    
    print(f"Submitting batch ingestion for {len(batch_data)} documents...")
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Create client with long timeout
    async with httpx.AsyncClient(timeout=httpx.Timeout(1800.0)) as client:  # 30 min timeout
        try:
            response = await client.post(
                "http://localhost:8000/api/v1/ingest/batch",
                json=batch_data,
                params={"max_concurrent": 3}  # Process 3 documents at a time
            )
            
            if response.status_code == 200:
                results = response.json()
                print(f"\nCompleted at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
                print(f"Total documents processed: {len(results)}")
                
                # Count successes and failures
                successful = sum(1 for r in results if r.get('status') == 'success')
                failed = sum(1 for r in results if r.get('status') == 'error')
                
                print(f"Successful: {successful}")
                print(f"Failed: {failed}")
                
                # Show failed documents
                if failed > 0:
                    print("\nFailed documents:")
                    for i, result in enumerate(results):
                        if result.get('status') == 'error':
                            metadata = batch_data[i].get('metadata', {})
                            print(f"  - Chapter {metadata.get('chapter')}: {metadata.get('title')}")
                            print(f"    Error: {result.get('message', 'Unknown error')}")
                
                return successful, failed
            else:
                print(f"Error: HTTP {response.status_code}")
                print(response.text)
                return 0, len(batch_data)
                
        except httpx.TimeoutException:
            print("Request timed out after 30 minutes")
            return None, None
        except Exception as e:
            print(f"Error: {str(e)}")
            return None, None

async def check_document_count():
    """Check current document count."""
    async with httpx.AsyncClient() as client:
        response = await client.get("http://localhost:8000/api/v1/health")
        if response.status_code == 200:
            data = response.json()
            return data.get('components', {}).get('vector_store', {}).get('document_count', 0)
    return 0

async def main():
    """Main function."""
    # Check initial count
    initial_count = await check_document_count()
    print(f"Initial document count: {initial_count}")
    
    # Submit batch ingestion
    successful, failed = await submit_batch_ingestion()
    
    if successful is not None:
        # Wait a bit for indexing
        print("\nWaiting 10 seconds for indexing to complete...")
        await asyncio.sleep(10)
        
        # Check final count
        final_count = await check_document_count()
        print(f"\nFinal document count: {final_count} (+{final_count - initial_count})")
        
        return failed == 0
    else:
        print("\nIngestion did not complete successfully")
        return False

if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)