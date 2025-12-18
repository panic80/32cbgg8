#!/usr/bin/env python3
"""Monitor ingestion progress by checking document count."""
import asyncio
import httpx
from datetime import datetime
import time

async def get_doc_count():
    """Get current document count."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get("http://localhost:8000/api/v1/health")
            if response.status_code == 200:
                data = response.json()
                return data.get('components', {}).get('vector_store', {}).get('document_count', 0)
    except:
        pass
    return None

async def monitor_progress():
    """Monitor document count changes."""
    print("Monitoring ingestion progress...")
    print("Press Ctrl+C to stop\n")
    
    last_count = await get_doc_count()
    if last_count is None:
        print("Cannot connect to RAG service")
        return
        
    print(f"Initial count: {last_count}")
    stable_iterations = 0
    
    while True:
        await asyncio.sleep(5)  # Check every 5 seconds
        
        current_count = await get_doc_count()
        if current_count is None:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Cannot connect to service")
            continue
            
        if current_count != last_count:
            delta = current_count - last_count
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Documents: {current_count} (+{delta})")
            last_count = current_count
            stable_iterations = 0
        else:
            stable_iterations += 1
            if stable_iterations == 1:
                print(f"[{datetime.now().strftime('%H:%M:%S')}] Count stable at {current_count} documents")
            elif stable_iterations == 12:  # 1 minute of no changes
                print(f"\nIngestion appears complete. Final count: {current_count}")
                break

if __name__ == "__main__":
    try:
        asyncio.run(monitor_progress())
    except KeyboardInterrupt:
        print("\nMonitoring stopped by user")