#!/usr/bin/env python3
"""Final CBI ingestion script using the sophisticated pipeline."""
import json
import requests
import time
from datetime import datetime

def get_doc_count():
    """Get current document count."""
    try:
        response = requests.get("http://localhost:8000/api/v1/health", timeout=5)
        if response.status_code == 200:
            data = response.json()
            return data.get('components', {}).get('vector_store', {}).get('document_count', 0)
    except:
        pass
    return 0

def ingest_chapter(chapter_data):
    """Ingest a single chapter."""
    try:
        response = requests.post(
            "http://localhost:8000/api/v1/ingest",
            json=chapter_data,
            timeout=300  # 5 min timeout
        )
        
        if response.status_code == 200:
            result = response.json()
            return True, result
        else:
            return False, f"HTTP {response.status_code}: {response.text[:200]}"
    except requests.Timeout:
        return False, "Timeout after 5 minutes"
    except Exception as e:
        return False, str(e)

def main():
    """Main ingestion process."""
    # Read batch request
    with open('cbi_batch_request.json', 'r') as f:
        chapters = json.load(f)
    
    print(f"=== CBI Chapter Ingestion ===")
    print(f"Total chapters: {len(chapters)}")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    
    successful = 0
    failed = []
    
    # Get initial count
    initial_total = get_doc_count()
    print(f"Initial document count: {initial_total}\n")
    
    for i, chapter in enumerate(chapters, 1):
        metadata = chapter.get('metadata', {})
        chapter_num = metadata.get('chapter', 'Unknown')
        chapter_title = metadata.get('title', 'Unknown')
        
        print(f"[{i}/{len(chapters)}] Chapter {chapter_num}: {chapter_title}")
        
        # Get count before
        count_before = get_doc_count()
        
        # Ingest chapter
        start_time = time.time()
        success, result = ingest_chapter(chapter)
        elapsed = time.time() - start_time
        
        if success:
            successful += 1
            chunks = result.get('chunks_created', 0)
            doc_id = result.get('document_id', 'N/A')
            print(f"  ✓ Success in {elapsed:.1f}s")
            print(f"    Document ID: {doc_id}")
            print(f"    Chunks created: {chunks}")
            
            # Wait for indexing
            time.sleep(3)
            
            # Get count after
            count_after = get_doc_count()
            print(f"    Total documents: {count_after} (+{count_after - count_before})")
        else:
            failed.append((chapter_num, chapter_title, result))
            print(f"  ✗ Failed: {result}")
        
        print()  # Blank line
        
        # Delay between chapters
        if i < len(chapters):
            time.sleep(2)
    
    # Final summary
    print("=" * 50)
    print("Summary:")
    print(f"Successful: {successful}/{len(chapters)}")
    print(f"Failed: {len(failed)}/{len(chapters)}")
    
    final_total = get_doc_count()
    print(f"\nDocument count: {initial_total} → {final_total} (+{final_total - initial_total})")
    
    if failed:
        print("\nFailed chapters:")
        for chapter_num, title, error in failed:
            print(f"  - Chapter {chapter_num}: {title}")
            print(f"    {error}")
    
    print(f"\nCompleted: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

if __name__ == "__main__":
    main()