#!/usr/bin/env python3
"""
Ingest NJC Travel Directive
"""
import asyncio
import httpx
import json
from datetime import datetime

async def ingest_njc_travel_directive():
    """Ingest NJC Travel Directive Module 10"""
    
    url = "https://www.njc-cnm.gc.ca/directive/d10/v238/en?print"
    rag_service_url = "http://localhost:8000/api/v1/ingest"
    
    # Prepare ingestion request with detailed metadata
    payload = {
        "url": url,
        "type": "web",
        "metadata": {
            "source": "NJC",
            "source_type": "official_government",
            "category": "travel_directive",
            "document_type": "njc_travel_module",
            "title": "NJC Travel Directive - Module 10",
            "version": "238",
            "tags": [
                "njc_travel",
                "travel_directive",
                "module_10",
                "government_travel",
                "travel_policy",
                "njc",
                "travel_rates",
                "allowances"
            ],
            "ingested_at": datetime.utcnow().isoformat(),
            "description": "Official NJC Travel Directive Module 10 covering government travel policies, rates, and allowances"
        },
        "force_refresh": True
    }
    
    print("=" * 60)
    print("NJC Travel Directive Ingestion")
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
                print(f"\n✓ Successfully ingested NJC Travel Directive")
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
    success = asyncio.run(ingest_njc_travel_directive())
    
    if success:
        print("\n✓ Ingestion completed successfully")
    else:
        print("\n✗ Ingestion failed")
        exit(1)

if __name__ == "__main__":
    main()