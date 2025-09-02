#!/usr/bin/env python3
"""
Ingest Chapter 211 - Service Benefits for Ill and Injured Members
"""
import asyncio
import httpx
import time
from datetime import datetime

async def test_url_accessibility(url):
    """Test if the URL is accessible"""
    print(f"Testing URL accessibility: {url}")
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.head(url, follow_redirects=True)
            print(f"  Status: {response.status_code}")
            if response.status_code == 200:
                print("  ✓ URL is accessible")
                return True
            else:
                print(f"  ✗ URL returned status {response.status_code}")
                return False
    except Exception as e:
        print(f"  ✗ Error accessing URL: {type(e).__name__}: {str(e)}")
        return False

async def ingest_chapter_211(attempt_num=1):
    """Ingest Chapter 211 with retry logic"""
    chapter_info = {
        "url": "https://www.canada.ca/en/department-national-defence/corporate/policies-standards/compensation-benefits-instructions/chapter-211-ill-injured-benefits.html",
        "chapter": "211", 
        "name": "Service Benefits for Ill and Injured Members"
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
            "ill_injured_benefits",
            "medical_benefits",
            "service_benefits"
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
    
    print(f"\n[Attempt {attempt_num}] Ingesting Chapter {chapter_info['chapter']} - {chapter_info['name']}")
    print(f"URL: {chapter_info['url']}")
    
    try:
        async with httpx.AsyncClient(timeout=600.0) as client:
            print("Sending ingestion request (timeout: 10 minutes)...")
            start_time = time.time()
            
            response = await client.post(
                rag_service_url,
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            elapsed = time.time() - start_time
            
            if response.status_code == 200:
                result = response.json()
                print(f"✓ SUCCESS! Ingestion completed in {elapsed:.1f} seconds")
                print(f"  Document ID: {result.get('document_id', 'N/A')}")
                return True
            else:
                print(f"✗ HTTP {response.status_code}: {response.text[:200]}...")
                return False
                
    except httpx.ConnectError as e:
        print(f"✗ Connection error: {str(e)}")
        return False
    except httpx.TimeoutException:
        print(f"✗ Timeout after 600 seconds")
        return False
    except Exception as e:
        print(f"✗ Unexpected error: {type(e).__name__}: {str(e)}")
        return False

async def get_document_count():
    """Get current document count"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get("http://localhost:8000/api/v1/health")
            if response.status_code == 200:
                data = response.json()
                return data.get("components", {}).get("vector_store", {}).get("document_count", 0)
    except:
        return None

async def main():
    """Main process with retries"""
    print("=" * 60)
    print("Chapter 211 Ingestion")
    print("=" * 60)
    
    # Get initial count
    initial_count = await get_document_count()
    if initial_count:
        print(f"Initial document count: {initial_count}")
    
    # First, test URL accessibility
    url_accessible = await test_url_accessibility(
        "https://www.canada.ca/en/department-national-defence/corporate/policies-standards/compensation-benefits-instructions/chapter-211-ill-injured-benefits.html"
    )
    
    if not url_accessible:
        print("\n⚠️  Warning: URL may not be accessible. Trying ingestion anyway...")
    
    # Try up to 3 attempts
    max_attempts = 3
    success = False
    
    for attempt in range(1, max_attempts + 1):
        if attempt > 1:
            print(f"\nWaiting 30 seconds before retry...")
            await asyncio.sleep(30)
        
        success = await ingest_chapter_211(attempt)
        
        if success:
            break
    
    # Get final count
    if success:
        print("\nWaiting 20 seconds for indexing...")
        await asyncio.sleep(20)
        
        final_count = await get_document_count()
        if final_count and initial_count:
            print(f"\nFinal document count: {final_count}")
            print(f"Documents added: {final_count - initial_count}")
    
    print("\n" + "=" * 60)
    if success:
        print("✓ Chapter 211 ingestion completed successfully!")
    else:
        print("✗ Chapter 211 ingestion failed after all attempts")
        print("\nPossible issues:")
        print("1. The URL might be incorrect or the page structure has changed")
        print("2. Network connectivity issues")
        print("3. The chapter might be temporarily unavailable")
        print("\nSuggested actions:")
        print("1. Verify the URL in a web browser")
        print("2. Check if there's an alternative URL for this chapter")
        print("3. Try again later if it's a temporary issue")
    
    return success

if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1)