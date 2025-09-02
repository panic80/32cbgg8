#!/usr/bin/env python3
"""Patient CBI ingestion - one chapter at a time with long timeouts."""
import json
import requests
import time
from datetime import datetime

def ingest_chapter_patiently(chapter_data):
    """Ingest a single chapter with very long timeout."""
    try:
        # Use a session for connection pooling
        session = requests.Session()
        
        # Very long timeout: 30 minutes
        response = session.post(
            "http://localhost:8000/api/v1/ingest",
            json=chapter_data,
            timeout=(60, 1800)  # 60s connect, 30min read
        )
        
        if response.status_code == 200:
            return True, response.json()
        else:
            return False, f"HTTP {response.status_code}"
    except requests.Timeout:
        return False, "Timeout after 30 minutes"
    except Exception as e:
        return False, str(e)

def main():
    """Main ingestion with patience."""
    # Read remaining chapters
    with open('cbi_batch_request.json', 'r') as f:
        all_chapters = json.load(f)
    
    # Skip Chapter 1 (already done)
    remaining_chapters = [ch for ch in all_chapters if ch['metadata']['chapter'] != '1']
    
    print(f"=== Patient CBI Ingestion ===")
    print(f"Chapters to ingest: {len(remaining_chapters)}")
    print(f"Note: Each chapter may take 5-30 minutes\n")
    
    successful = 0
    
    for i, chapter in enumerate(remaining_chapters, 1):
        metadata = chapter.get('metadata', {})
        chapter_num = metadata.get('chapter')
        chapter_title = metadata.get('title')
        
        print(f"\n[{i}/{len(remaining_chapters)}] Chapter {chapter_num}: {chapter_title}")
        print(f"Starting at {datetime.now().strftime('%H:%M:%S')}")
        print("Please be patient, this may take a while...")
        
        start_time = time.time()
        success, result = ingest_chapter_patiently(chapter)
        elapsed = time.time() - start_time
        
        if success:
            successful += 1
            print(f"✓ Success after {elapsed/60:.1f} minutes")
            print(f"  Chunks: {result.get('chunks_created', 'N/A')}")
        else:
            print(f"✗ Failed after {elapsed/60:.1f} minutes: {result}")
        
        # Rest between chapters
        if i < len(remaining_chapters):
            print("\nResting for 30 seconds before next chapter...")
            time.sleep(30)
    
    print(f"\n=== Summary ===")
    print(f"Successful: {successful}/{len(remaining_chapters)}")
    print(f"Completed at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

if __name__ == "__main__":
    main()