#!/usr/bin/env python3
"""Ingest CBI chapters using the sophisticated pipeline."""
import asyncio
import httpx
import json
from datetime import datetime

async def ingest_single_chapter(chapter_data, client):
    """Ingest a single chapter."""
    try:
        response = await client.post(
            "http://localhost:8000/api/v1/ingest",
            json=chapter_data,
            timeout=300.0  # 5 min timeout per chapter
        )
        
        if response.status_code == 200:
            result = response.json()
            return True, result.get('document_id', 'N/A')
        else:
            return False, f"HTTP {response.status_code}: {response.text[:200]}"
    except httpx.TimeoutException:
        return False, "Timeout after 5 minutes"
    except Exception as e:
        return False, str(e)

async def get_doc_count(client):
    """Get current document count."""
    try:
        response = await client.get("http://localhost:8000/api/v1/health")
        if response.status_code == 200:
            data = response.json()
            return data.get('components', {}).get('vector_store', {}).get('document_count', 0)
    except:
        pass
    return 0

async def main():
    """Main ingestion process."""
    # Read batch request
    with open('cbi_batch_request.json', 'r') as f:
        chapters = json.load(f)
    
    print(f"=== CBI Chapter Ingestion (Sophisticated Pipeline) ===")
    print(f"Total chapters to ingest: {len(chapters)}")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    
    successful = 0
    failed = []
    
    async with httpx.AsyncClient() as client:
        # Get initial count
        initial_total = await get_doc_count(client)
        print(f"Initial document count: {initial_total}\n")
        
        for i, chapter in enumerate(chapters, 1):
            metadata = chapter.get('metadata', {})
            chapter_num = metadata.get('chapter', 'Unknown')
            chapter_title = metadata.get('title', 'Unknown')
            
            print(f"[{i}/{len(chapters)}] Chapter {chapter_num}: {chapter_title}")
            print(f"  URL: {chapter['url']}")
            
            # Get count before
            count_before = await get_doc_count(client)
            
            # Ingest chapter
            start_time = datetime.now()
            success, result = await ingest_single_chapter(chapter, client)
            elapsed = (datetime.now() - start_time).total_seconds()
            
            if success:
                successful += 1
                print(f"  ✓ Success in {elapsed:.1f}s - Document ID: {result}")
                
                # Wait for indexing
                await asyncio.sleep(5)
                
                # Get count after
                count_after = await get_doc_count(client)
                docs_added = count_after - count_before
                print(f"  Documents added: {docs_added} (Total: {count_after})")
            else:
                failed.append((chapter_num, chapter_title, result))
                print(f"  ✗ Failed after {elapsed:.1f}s: {result}")
            
            print()  # Blank line between chapters
            
            # Small delay between chapters
            if i < len(chapters):
                await asyncio.sleep(2)
    
    # Final summary
    print("=" * 60)
    print("Ingestion Summary:")
    print(f"Successful: {successful}/{len(chapters)}")
    print(f"Failed: {len(failed)}/{len(chapters)}")
    
    final_total = await get_doc_count(client)
    print(f"\nFinal document count: {final_total} (+{final_total - initial_total})")
    
    if failed:
        print("\nFailed chapters:")
        for chapter_num, title, error in failed:
            print(f"  - Chapter {chapter_num}: {title}")
            print(f"    Error: {error}")
    
    print(f"\nCompleted: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    return len(failed) == 0

if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1)