#!/usr/bin/env python3
"""
Ingest Canadian Forces Temporary Duty Travel Instructions
"""
import asyncio
import httpx
import json
from datetime import datetime

async def ingest_cf_travel_instructions():
    """Ingest CF Temporary Duty Travel Instructions from canada.ca"""
    
    url = "https://www.canada.ca/en/department-national-defence/services/benefits-military/pay-pension-benefits/benefits/canadian-forces-temporary-duty-travel-instructions.html"
    rag_service_url = "http://localhost:8000/api/v1/ingest"
    
    # Prepare ingestion request with detailed metadata
    payload = {
        "url": url,
        "type": "web",
        "metadata": {
            "source": "DND Canada",
            "source_type": "official_government",
            "category": "travel_policy",
            "document_type": "cf_travel_instructions",
            "title": "Canadian Forces Temporary Duty Travel Instructions",
            "tags": [
                "cf_travel",
                "temporary_duty",
                "travel_instructions",
                "military_travel",
                "dnd",
                "canadian_forces",
                "travel_policy",
                "td_travel"
            ],
            "ingested_at": datetime.utcnow().isoformat(),
            "description": "Official Canadian Forces Temporary Duty Travel Instructions covering policies and procedures for military travel"
        },
        "force_refresh": True
    }
    
    print("=" * 60)
    print("CF Travel Instructions Ingestion")
    print("=" * 60)
    print(f"URL: {url}")
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            print("\nSending ingestion request...")
            response = await client.post(
                rag_service_url,
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            print(f"Response status: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                print(f"\n✓ Successfully ingested CF Travel Instructions")
                print(f"  Document ID: {result.get('document_id', 'N/A')}")
                print(f"  Status: {result.get('status', 'N/A')}")
                return True
            else:
                print(f"\n✗ Failed to ingest: {response.text}")
                return False
                
        except Exception as e:
            print(f"\n✗ Error during ingestion: {str(e)}")
            return False

def main():
    """Main entry point"""
    success = asyncio.run(ingest_cf_travel_instructions())
    
    if success:
        print("\n✓ Ingestion completed successfully")
    else:
        print("\n✗ Ingestion failed")
        exit(1)

if __name__ == "__main__":
    main()