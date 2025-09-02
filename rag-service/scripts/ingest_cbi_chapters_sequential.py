#!/usr/bin/env python3
"""
Ingest CBI chapters one at a time with service restarts
"""
import asyncio
import httpx
import subprocess
import time
import os
import signal
from datetime import datetime

CHAPTERS = [
    {
        "url": "https://www.canada.ca/en/department-national-defence/corporate/policies-standards/compensation-benefits-instructions/ch-01-introduction-effective-01-sept-2017.html",
        "chapter": "1",
        "name": "Introduction"
    },
    {
        "url": "https://www.canada.ca/en/department-national-defence/corporate/policies-standards/compensation-benefits-instructions/chapter-10-foreign-service.html",
        "chapter": "10",
        "name": "Military Foreign Service Instructions"
    },
    {
        "url": "https://www.canada.ca/en/department-national-defence/corporate/policies-standards/compensation-benefits-instructions/chapter-11-isolated-posts.html",
        "chapter": "11",
        "name": "Isolated Posts"
    },
    {
        "url": "https://www.canada.ca/en/department-national-defence/corporate/policies-standards/compensation-benefits-instructions/chapter-12-education-of-children.html",
        "chapter": "12",
        "name": "Education Of Children"
    },
    {
        "url": "https://www.canada.ca/en/department-national-defence/corporate/policies-standards/compensation-benefits-instructions/chapter-203-financial-benefits.html",
        "chapter": "203",
        "name": "Financial Benefits Overview"
    },
    {
        "url": "https://www.canada.ca/en/department-national-defence/corporate/policies-standards/compensation-benefits-instructions/chapter-204-pay-policy-officers-ncms-2023.html",
        "chapter": "204",
        "name": "Pay of Officers and Non-Commissioned Members"
    },
    {
        "url": "https://www.canada.ca/en/department-national-defence/corporate/policies-standards/compensation-benefits-instructions/chapter-205-allowances-for-officers-and-non-commissioned-members-2025-1.html",
        "chapter": "205",
        "name": "Allowances for Officers and Non-Commissioned Members"
    },
    {
        "url": "https://www.canada.ca/en/department-national-defence/corporate/policies-standards/compensation-benefits-instructions/chapter-208-relocation-benefits.html",
        "chapter": "208",
        "name": "Relocation Benefits"
    },
    {
        "url": "https://www.canada.ca/en/department-national-defence/corporate/policies-standards/compensation-benefits-instructions/chapter-209-transportation-expenses.html",
        "chapter": "209",
        "name": "Transportation and Travelling Expenses"
    },
    {
        "url": "https://www.canada.ca/en/department-national-defence/corporate/policies-standards/compensation-benefits-instructions/chapter-210-misc-entitlements-grants.html",
        "chapter": "210",
        "name": "Entitlements and Grants"
    }
]

def kill_uvicorn():
    """Kill all uvicorn processes"""
    print("Stopping RAG service...")
    try:
        # Kill all uvicorn processes
        subprocess.run(["pkill", "-f", "uvicorn"], capture_output=True)
        time.sleep(2)
        # Force kill if still running
        subprocess.run(["pkill", "-9", "-f", "uvicorn"], capture_output=True)
        time.sleep(1)
    except Exception as e:
        print(f"Error killing uvicorn: {e}")

def start_rag_service():
    """Start the RAG service"""
    print("Starting RAG service...")
    try:
        # Change to rag-service directory
        os.chdir("/var/www/cbthis/rag-service")
        
        # Start uvicorn in background
        process = subprocess.Popen(
            ["venv/bin/uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"],
            stdout=open("rag-service-sequential.log", "a"),
            stderr=subprocess.STDOUT,
            preexec_fn=os.setsid
        )
        
        # Wait for service to be ready
        print("Waiting for service to start...")
        for i in range(30):
            try:
                response = httpx.get("http://localhost:8000/api/v1/health", timeout=5.0)
                if response.status_code == 200:
                    print("✓ RAG service is ready")
                    return True
            except:
                pass
            time.sleep(2)
        
        print("✗ RAG service failed to start")
        return False
        
    except Exception as e:
        print(f"Error starting RAG service: {e}")
        return False

async def get_document_count():
    """Get current document count from the service"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get("http://localhost:8000/api/v1/health")
            if response.status_code == 200:
                data = response.json()
                return data.get("components", {}).get("vector_store", {}).get("document_count", 0)
    except:
        pass
    return 0

async def ingest_chapter(chapter_info):
    """Ingest a single chapter"""
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
            "canadian_forces"
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
    
    print(f"\nIngesting Chapter {chapter_info['chapter']} - {chapter_info['name']}")
    print(f"URL: {chapter_info['url']}")
    
    try:
        # Get initial document count
        initial_count = await get_document_count()
        print(f"Initial document count: {initial_count}")
        
        # Send ingestion request
        async with httpx.AsyncClient(timeout=600.0) as client:
            start_time = time.time()
            response = await client.post(
                rag_service_url,
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            elapsed = time.time() - start_time
            
            if response.status_code == 200:
                result = response.json()
                print(f"✓ Ingestion completed in {elapsed:.1f}s")
                print(f"  Document ID: {result.get('document_id', 'N/A')}")
                
                # Wait a bit for indexing to complete
                await asyncio.sleep(10)
                
                # Get final document count
                final_count = await get_document_count()
                print(f"Final document count: {final_count} (+{final_count - initial_count})")
                
                return True
            else:
                print(f"✗ HTTP {response.status_code}: {response.text}")
                return False
                
    except httpx.TimeoutException:
        print(f"✗ Timeout error after 600 seconds")
        return False
    except Exception as e:
        print(f"✗ Error: {str(e)}")
        return False

async def main():
    """Main process"""
    print("=" * 60)
    print("CBI Chapter Sequential Ingestion")
    print("=" * 60)
    print(f"Processing {len(CHAPTERS)} chapters with service restarts")
    
    successful = 0
    failed = []
    
    for i, chapter in enumerate(CHAPTERS, 1):
        print(f"\n{'='*60}")
        print(f"[{i}/{len(CHAPTERS)}] Chapter {chapter['chapter']}")
        print(f"{'='*60}")
        
        # Restart service before each chapter
        kill_uvicorn()
        
        if not start_rag_service():
            print("Failed to start RAG service, skipping chapter")
            failed.append(chapter)
            continue
        
        # Ingest the chapter
        success = await ingest_chapter(chapter)
        
        if success:
            successful += 1
            print(f"✓ Chapter {chapter['chapter']} completed successfully")
        else:
            failed.append(chapter)
            print(f"✗ Chapter {chapter['chapter']} failed")
        
        # Give the system a breather
        print("\nWaiting 5 seconds before next chapter...")
        await asyncio.sleep(5)
    
    # Final cleanup
    kill_uvicorn()
    
    print("\n" + "=" * 60)
    print("Sequential Ingestion Summary:")
    print(f"Successful: {successful}/{len(CHAPTERS)}")
    print(f"Failed: {len(failed)}/{len(CHAPTERS)}")
    
    if failed:
        print("\nFailed chapters:")
        for chapter in failed:
            print(f"  - Chapter {chapter['chapter']}: {chapter['name']}")
    
    # Restart service one final time
    print("\nRestarting RAG service...")
    start_rag_service()
    
    return len(failed) == 0

if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1)