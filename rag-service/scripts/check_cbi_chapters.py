#!/usr/bin/env python3
"""
Check which CBI chapters have been ingested
"""
import httpx
import asyncio

CHAPTERS = [
    {"num": "10", "name": "Foreign Service"},
    {"num": "11", "name": "Isolated Posts"},
    {"num": "12", "name": "Education Of Children"},
    {"num": "203", "name": "Financial Benefits"},
    {"num": "204", "name": "Pay Policy Officers NCMs 2023"},
    {"num": "205", "name": "Allowances For Officers And Non Commissioned Members 2025"},
    {"num": "208", "name": "Relocation Benefits"},
    {"num": "209", "name": "Transportation Expenses"},
    {"num": "210", "name": "Misc Entitlements Grants"},
    {"num": "211", "name": "Ill Injured Benefits"}
]

async def test_search(chapter_num, chapter_name):
    """Test if a chapter can be found through search"""
    search_url = "http://localhost:8000/api/v1/search"
    
    # Try searching for the chapter
    query = f"CBI Chapter {chapter_num} {chapter_name}"
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                search_url,
                json={
                    "query": query,
                    "k": 5,
                    "search_type": "similarity"
                }
            )
            
            if response.status_code == 200:
                results = response.json()
                sources = results.get("sources", [])
                
                # Check if any source mentions this chapter
                for source in sources:
                    metadata = source.get("metadata", {})
                    if f"chapter_{chapter_num}" in str(metadata).lower() or \
                       f"chapter {chapter_num}" in str(metadata).lower():
                        return True
                        
                return False
            else:
                return None
                
    except Exception as e:
        print(f"Error searching for chapter {chapter_num}: {e}")
        return None

async def main():
    print("Checking which CBI chapters have been ingested...")
    print("=" * 60)
    
    results = []
    for chapter in CHAPTERS:
        found = await test_search(chapter["num"], chapter["name"])
        status = "✓ Found" if found else "✗ Not found" if found is False else "? Error"
        results.append((chapter["num"], chapter["name"], status))
        print(f"Chapter {chapter['num']:>3} - {chapter['name']:<45} {status}")
    
    print("=" * 60)
    found_count = sum(1 for _, _, status in results if "✓" in status)
    print(f"Summary: {found_count}/{len(CHAPTERS)} chapters found in database")

if __name__ == "__main__":
    asyncio.run(main())