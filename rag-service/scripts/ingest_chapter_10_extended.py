#!/usr/bin/env python3
"""
Ingest Chapter 10 with extended timeout and monitoring
"""
import asyncio
import httpx
import time
from datetime import datetime
import threading

class ProgressMonitor:
    def __init__(self):
        self.start_time = time.time()
        self.last_update = time.time()
        self.running = True
        
    def start(self):
        """Start progress monitoring in a separate thread"""
        def monitor():
            while self.running:
                elapsed = time.time() - self.start_time
                print(f"\r⏱️  Processing... {elapsed:.0f}s elapsed", end="", flush=True)
                time.sleep(5)
        
        thread = threading.Thread(target=monitor)
        thread.daemon = True
        thread.start()
    
    def stop(self):
        self.running = False
        print()  # New line after progress

async def ingest_chapter_10():
    """Ingest Chapter 10 with extended timeout"""
    chapter_info = {
        "url": "https://www.canada.ca/en/department-national-defence/corporate/policies-standards/compensation-benefits-instructions/chapter-10-foreign-service.html",
        "chapter": "10",
        "name": "Military Foreign Service Instructions"
    }
    
    rag_service_url = "http://localhost:8000/api/v1/ingest"
    
    metadata = {
        "source": "DND Canada",
        "source_type": "official_government",
        "category": "compensation_benefits",
        "document_type": "cbi_chapter",
        "title": f"CBI Chapter {chapter_info['chapter']} - {chapter_info['name']}",
        "chapter": chapter_info['chapter'],
        "chapter_name": chapter_info['name'],
        "tags": [
            "compensation_benefits",
            "cbi",
            f"chapter_{chapter_info['chapter']}",
            "military_benefits",
            "dnd",
            "canadian_forces",
            "foreign_service",
            "travel_policy"
        ],
        "ingested_at": datetime.utcnow().isoformat(),
        "description": f"Compensation and Benefits Instructions - Chapter {chapter_info['chapter']}: {chapter_info['name']}"
    }
    
    payload = {
        "url": chapter_info['url'],
        "type": "web",
        "metadata": metadata,
        "force_refresh": True
    }
    
    print("=" * 60)
    print("Chapter 10 Extended Ingestion")
    print("=" * 60)
    print(f"Chapter: {chapter_info['chapter']} - {chapter_info['name']}")
    print(f"URL: {chapter_info['url']}")
    print(f"Timeout: 20 minutes (1200 seconds)")
    print("=" * 60)
    
    # Get initial document count
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get("http://localhost:8000/api/v1/health")
            if response.status_code == 200:
                data = response.json()
                initial_count = data.get("components", {}).get("vector_store", {}).get("document_count", 0)
                print(f"Initial document count: {initial_count}")
    except:
        initial_count = "Unknown"
        print("Could not get initial document count")
    
    # Start progress monitoring
    monitor = ProgressMonitor()
    monitor.start()
    
    try:
        # Use 20 minute timeout
        async with httpx.AsyncClient(timeout=1200.0) as client:
            print("\nSending ingestion request...")
            start_time = time.time()
            
            response = await client.post(
                rag_service_url,
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            monitor.stop()
            elapsed = time.time() - start_time
            
            if response.status_code == 200:
                result = response.json()
                print(f"\n✓ SUCCESS! Ingestion completed in {elapsed:.1f} seconds ({elapsed/60:.1f} minutes)")
                print(f"  Document ID: {result.get('document_id', 'N/A')}")
                
                # Wait for indexing
                print("\nWaiting 30 seconds for indexing to complete...")
                await asyncio.sleep(30)
                
                # Get final document count
                try:
                    async with httpx.AsyncClient(timeout=10.0) as client:
                        response = await client.get("http://localhost:8000/api/v1/health")
                        if response.status_code == 200:
                            data = response.json()
                            final_count = data.get("components", {}).get("vector_store", {}).get("document_count", 0)
                            print(f"\nFinal document count: {final_count}")
                            if isinstance(initial_count, int):
                                print(f"Documents added: {final_count - initial_count}")
                except:
                    print("Could not get final document count")
                
                return True
            else:
                print(f"\n✗ FAILED! HTTP {response.status_code}")
                print(f"Response: {response.text[:500]}...")
                return False
                
    except httpx.TimeoutException:
        monitor.stop()
        print(f"\n✗ TIMEOUT after 1200 seconds (20 minutes)")
        print("This chapter might be too large to process in a single request")
        return False
    except httpx.ConnectError as e:
        monitor.stop()
        print(f"\n✗ CONNECTION ERROR: {str(e)}")
        return False
    except Exception as e:
        monitor.stop()
        print(f"\n✗ UNEXPECTED ERROR: {type(e).__name__}: {str(e)}")
        return False

async def check_service_health():
    """Check if the RAG service is healthy"""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get("http://localhost:8000/api/v1/health")
            if response.status_code == 200:
                print("✓ RAG service is healthy")
                return True
    except:
        pass
    print("✗ RAG service is not responding")
    return False

async def main():
    """Main entry point"""
    print("Checking RAG service health...")
    if not await check_service_health():
        print("Please ensure the RAG service is running before attempting ingestion")
        return False
    
    print()
    success = await ingest_chapter_10()
    
    print("\n" + "=" * 60)
    if success:
        print("✓ Chapter 10 ingestion completed successfully!")
    else:
        print("✗ Chapter 10 ingestion failed")
        print("\nPossible solutions:")
        print("1. The chapter might be too large - consider splitting it")
        print("2. Check the URL is correct and accessible")
        print("3. Increase server resources (RAM/CPU)")
        print("4. Check server logs for detailed error messages")
    
    return success

if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1)