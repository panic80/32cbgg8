#!/usr/bin/env python3
"""
Reingest failed CBI chapters with retry logic
"""
import asyncio
import httpx
import json
from datetime import datetime
import time

# List of failed chapters from previous attempt
FAILED_CHAPTERS = [
    {
        "url": "https://www.canada.ca/en/department-national-defence/corporate/policies-standards/compensation-benefits-instructions/chapter-10-foreign-service.html",
        "chapter": "10",
        "name": "Foreign Service"
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
        "name": "Financial Benefits"
    },
    {
        "url": "https://www.canada.ca/en/department-national-defence/corporate/policies-standards/compensation-benefits-instructions/chapter-204-pay-policy-officers-ncms-2023.html",
        "chapter": "204",
        "name": "Pay Policy Officers NCMs 2023"
    },
    {
        "url": "https://www.canada.ca/en/department-national-defence/corporate/policies-standards/compensation-benefits-instructions/chapter-205-allowances-for-officers-and-non-commissioned-members-2025-1.html",
        "chapter": "205",
        "name": "Allowances For Officers And Non Commissioned Members 2025"
    },
    {
        "url": "https://www.canada.ca/en/department-national-defence/corporate/policies-standards/compensation-benefits-instructions/chapter-208-relocation-benefits.html",
        "chapter": "208",
        "name": "Relocation Benefits"
    },
    {
        "url": "https://www.canada.ca/en/department-national-defence/corporate/policies-standards/compensation-benefits-instructions/chapter-209-transportation-expenses.html",
        "chapter": "209",
        "name": "Transportation Expenses"
    },
    {
        "url": "https://www.canada.ca/en/department-national-defence/corporate/policies-standards/compensation-benefits-instructions/chapter-210-misc-entitlements-grants.html",
        "chapter": "210",
        "name": "Misc Entitlements Grants"
    },
    {
        "url": "https://www.canada.ca/en/department-national-defence/corporate/policies-standards/compensation-benefits-instructions/chapter-211-ill-injured-benefits.html",
        "chapter": "211",
        "name": "Ill Injured Benefits"
    }
]

async def ingest_chapter_with_retry(chapter_info, max_retries=3):
    """Ingest a single chapter with retry logic"""
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
    
    for attempt in range(max_retries):
        try:
            print(f"\nAttempt {attempt + 1}/{max_retries} for Chapter {chapter_info['chapter']} - {chapter_info['name']}")
            print(f"URL: {chapter_info['url']}")
            
            # Use longer timeout for ingestion
            async with httpx.AsyncClient(timeout=300.0) as client:
                response = await client.post(
                    rag_service_url,
                    json=payload,
                    headers={"Content-Type": "application/json"}
                )
                
                if response.status_code == 200:
                    result = response.json()
                    print(f"✓ Success! Document ID: {result.get('document_id', 'N/A')}")
                    return True
                else:
                    print(f"✗ HTTP {response.status_code}: {response.text}")
                    
        except httpx.TimeoutException:
            print(f"✗ Timeout error on attempt {attempt + 1}")
        except httpx.ConnectError as e:
            print(f"✗ Connection error on attempt {attempt + 1}: {str(e)}")
        except Exception as e:
            print(f"✗ Unexpected error on attempt {attempt + 1}: {str(e)}")
        
        if attempt < max_retries - 1:
            wait_time = 10 * (attempt + 1)  # Exponential backoff
            print(f"Waiting {wait_time} seconds before retry...")
            await asyncio.sleep(wait_time)
    
    return False

async def main():
    """Main ingestion process"""
    print("=" * 60)
    print("CBI Chapter Re-ingestion")
    print("=" * 60)
    print(f"Attempting to ingest {len(FAILED_CHAPTERS)} failed chapters")
    
    successful = 0
    failed = []
    
    for i, chapter in enumerate(FAILED_CHAPTERS, 1):
        print(f"\n[{i}/{len(FAILED_CHAPTERS)}] Processing Chapter {chapter['chapter']}")
        
        success = await ingest_chapter_with_retry(chapter)
        if success:
            successful += 1
        else:
            failed.append(chapter)
        
        # Small delay between chapters
        if i < len(FAILED_CHAPTERS):
            await asyncio.sleep(5)
    
    print("\n" + "=" * 60)
    print("Re-ingestion Summary:")
    print(f"Successful: {successful}/{len(FAILED_CHAPTERS)}")
    print(f"Failed: {len(failed)}/{len(FAILED_CHAPTERS)}")
    
    if failed:
        print("\nFailed chapters:")
        for chapter in failed:
            print(f"  - Chapter {chapter['chapter']}: {chapter['name']}")
    
    return len(failed) == 0

if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1)