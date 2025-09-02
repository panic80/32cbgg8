#!/usr/bin/env python3
"""
Ingest missing CBI chapters
"""
import asyncio
import httpx
import subprocess
import time
import os
from datetime import datetime

# Complete list of chapters to check and ingest if missing
ALL_CHAPTERS = [
    {
        "url": "https://www.canada.ca/en/department-national-defence/corporate/policies-standards/compensation-benefits-instructions/chapter-1-introduction.html",
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
        "name": "Isolated Post Instructions"
    },
    {
        "url": "https://www.canada.ca/en/department-national-defence/corporate/policies-standards/compensation-benefits-instructions/chapter-12-education-of-children.html",
        "chapter": "12",
        "name": "Education of Children"
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
        "url": "https://www.canada.ca/en/department-national-defence/corporate/policies-standards/compensation-benefits-instructions/chapter-206-gratuities.html",
        "chapter": "206",
        "name": "Gratuities - Officers Serving for Fixed Period (Repealed)"
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
    },
    {
        "url": "https://www.canada.ca/en/department-national-defence/corporate/policies-standards/compensation-benefits-instructions/chapter-211-ill-injured-benefits.html",
        "chapter": "211",
        "name": "Service Benefits for Ill and Injured Members"
    }
]

# Chapters we believe are already ingested (based on logs)
LIKELY_INGESTED = ["11", "12", "203", "204", "205", "208", "209", "210"]

async def check_chapter_exists(chapter_num):
    """Quick check if chapter might exist in database"""
    # This is a simple heuristic - we'll try to ingest anyway if unsure
    return chapter_num in LIKELY_INGESTED

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
            "canadian_forces",
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
    
    print(f"\nIngesting Chapter {chapter_info['chapter']} - {chapter_info['name']}")
    print(f"URL: {chapter_info['url']}")
    
    try:
        async with httpx.AsyncClient(timeout=300.0) as client:
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
                return True
            else:
                print(f"✗ HTTP {response.status_code}: {response.text}")
                return False
                
    except httpx.TimeoutException:
        print(f"✗ Timeout error after 300 seconds")
        return False
    except Exception as e:
        print(f"✗ Error: {str(e)}")
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
        pass
    return 0

async def main():
    """Main ingestion process"""
    print("=" * 60)
    print("Missing CBI Chapters Ingestion")
    print("=" * 60)
    
    # Get initial count
    initial_count = await get_document_count()
    print(f"Initial document count: {initial_count}")
    
    # Identify potentially missing chapters
    missing_chapters = []
    for chapter in ALL_CHAPTERS:
        if not await check_chapter_exists(chapter['chapter']):
            missing_chapters.append(chapter)
        else:
            print(f"Chapter {chapter['chapter']} - {chapter['name']} (likely already ingested)")
    
    # Focus on definitely missing chapters
    definite_missing = [
        ch for ch in ALL_CHAPTERS 
        if ch['chapter'] in ['1', '10', '206', '211']
    ]
    
    print(f"\nFocusing on {len(definite_missing)} likely missing chapters:")
    for ch in definite_missing:
        print(f"  - Chapter {ch['chapter']}: {ch['name']}")
    
    successful = 0
    failed = []
    
    for i, chapter in enumerate(definite_missing, 1):
        print(f"\n{'='*60}")
        print(f"[{i}/{len(definite_missing)}] Processing Chapter {chapter['chapter']}")
        print(f"{'='*60}")
        
        success = await ingest_chapter(chapter)
        
        if success:
            successful += 1
            await asyncio.sleep(5)  # Brief pause between chapters
        else:
            failed.append(chapter)
            await asyncio.sleep(2)
    
    # Get final count
    final_count = await get_document_count()
    
    print("\n" + "=" * 60)
    print("Ingestion Summary:")
    print(f"Initial documents: {initial_count}")
    print(f"Final documents: {final_count}")
    print(f"Added: {final_count - initial_count}")
    print(f"Successful: {successful}/{len(definite_missing)}")
    print(f"Failed: {len(failed)}/{len(definite_missing)}")
    
    if failed:
        print("\nFailed chapters:")
        for chapter in failed:
            print(f"  - Chapter {chapter['chapter']}: {chapter['name']}")

if __name__ == "__main__":
    asyncio.run(main())