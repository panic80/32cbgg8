#!/usr/bin/env python3
"""Test Chapter 10 ingestion with monitoring."""
import asyncio
import httpx
import time
import psutil
import os
import sys
sys.path.append('/var/www/cbthis/rag-service')

from app.pipelines.ingestion import IngestionPipeline
from app.services.cache import CacheService
from app.core.vectorstore import VectorStoreManager
from app.models.documents import DocumentIngestionRequest, DocumentType
from app.core.config import settings

async def monitor_ingestion():
    """Monitor system resources during ingestion."""
    process = psutil.Process(os.getpid())
    
    print("\n=== Testing Chapter 10 Ingestion ===\n")
    
    # Initialize services
    print("Initializing services...")
    cache_service = CacheService()
    vector_store = VectorStoreManager()
    
    # Create ingestion pipeline
    pipeline = IngestionPipeline(vector_store, cache_service)
    
    # Create request for Chapter 10
    request = DocumentIngestionRequest(
        url="https://www.canada.ca/en/department-national-defence/corporate/policies-standards/compensation-benefits-instructions/chapter-10-foreign-service.html",
        type=DocumentType.WEB,
        metadata={
            "chapter": "10",
            "title": "Military Foreign Service Instructions",
            "source_type": "CBI",
            "document_category": "policy"
        }
    )
    
    # Progress callback
    progress_events = []
    async def progress_callback(event_type: str, data: dict):
        progress_events.append((event_type, data, time.time()))
        print(f"[{event_type}] {data.get('message', '')}")
    
    # Monitor resources
    print("\nStarting ingestion...")
    start_time = time.time()
    start_memory = process.memory_info().rss / 1024 / 1024
    
    try:
        # Run ingestion with timeout
        response = await asyncio.wait_for(
            pipeline.ingest_document(request, progress_callback=progress_callback),
            timeout=300  # 5 minute timeout
        )
        
        elapsed = time.time() - start_time
        end_memory = process.memory_info().rss / 1024 / 1024
        
        print(f"\n✓ Ingestion completed in {elapsed:.1f}s")
        print(f"  Document ID: {response.document_id}")
        print(f"  Chunks created: {response.chunks_created}")
        print(f"  Memory used: {end_memory - start_memory:.1f} MB")
        
        # Show progress timeline
        if progress_events:
            print("\nProgress timeline:")
            base_time = progress_events[0][2]
            for event_type, data, timestamp in progress_events[-10:]:
                rel_time = timestamp - base_time
                print(f"  +{rel_time:.1f}s: {event_type}")
        
    except asyncio.TimeoutError:
        print(f"\n✗ Timeout after 5 minutes")
        
        # Check where it got stuck
        if progress_events:
            last_event = progress_events[-1]
            print(f"  Last event: {last_event[0]} at +{last_event[2] - start_time:.1f}s")
        
        # Check memory
        end_memory = process.memory_info().rss / 1024 / 1024
        print(f"  Memory at timeout: {end_memory:.1f} MB (delta: {end_memory - start_memory:.1f} MB)")
        
    except Exception as e:
        print(f"\n✗ Error: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        # Cleanup
        await pipeline.cleanup()
        print("\nCleaned up resources")

if __name__ == "__main__":
    asyncio.run(monitor_ingestion())