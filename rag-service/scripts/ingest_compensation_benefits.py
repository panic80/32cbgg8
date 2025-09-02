#!/usr/bin/env python3
"""
Ingest Compensation and Benefits Instructions with multi-page crawling
"""
import asyncio
import httpx
import json
import re
from urllib.parse import urljoin
from datetime import datetime
from typing import List, Dict, Set
from bs4 import BeautifulSoup

class CompensationBenefitsIngester:
    def __init__(self):
        self.base_url = "https://www.canada.ca/en/department-national-defence/corporate/policies-standards/compensation-benefits-instructions.html"
        self.rag_service_url = "http://localhost:8000/api/v1/ingest"
        self.visited_urls: Set[str] = set()
        self.failed_urls: List[str] = []
        
    async def discover_chapters(self, url: str) -> List[Dict[str, str]]:
        """Discover all chapter links from the main page"""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url)
                if response.status_code != 200:
                    return []
                
                soup = BeautifulSoup(response.text, 'html.parser')
                chapters = []
                seen = set()
                
                # Find all links that look like CBI chapters
                for link in soup.find_all('a', href=True):
                    href = link['href']
                    if 'compensation-benefits-instructions/chapter-' in href:
                        full_url = urljoin(url, href)
                        if full_url not in seen:
                            seen.add(full_url)
                            # Extract chapter info from URL
                            chapter_match = re.search(r'chapter-(\d+)-(.+?)\.html', href)
                            if chapter_match:
                                chapter_num = chapter_match.group(1)
                                chapter_name = chapter_match.group(2).replace('-', ' ').title()
                                chapters.append({
                                    'url': full_url,
                                    'chapter': chapter_num,
                                    'name': chapter_name
                                })
                
                return sorted(chapters, key=lambda x: x['chapter'])
                
        except Exception as e:
            print(f"Failed to discover chapters: {e}")
            return []
    
    async def ingest_page(self, url: str, metadata: Dict) -> bool:
        """Ingest a single page via the API"""
        try:
            if url in self.visited_urls:
                print(f"Already visited: {url}")
                return True
            
            print(f"Ingesting: {url}")
            
            payload = {
                "url": url,
                "type": "web",
                "metadata": metadata,
                "force_refresh": True
            }
            
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    self.rag_service_url,
                    json=payload,
                    headers={"Content-Type": "application/json"}
                )
                
                if response.status_code == 200:
                    self.visited_urls.add(url)
                    result = response.json()
                    print(f"  ✓ Document ID: {result.get('document_id', 'N/A')}")
                    return True
                else:
                    print(f"  ✗ Failed: {response.text}")
                    self.failed_urls.append(url)
                    return False
                    
        except Exception as e:
            print(f"  ✗ Error: {str(e)}")
            self.failed_urls.append(url)
            return False
    
    async def ingest_compensation_benefits(self):
        """Main ingestion process"""
        try:
            print("=" * 60)
            print("Compensation Benefits Instructions Ingestion")
            print("=" * 60)
            
            # First, ingest the main page
            main_metadata = {
                "source": "DND Canada",
                "source_type": "official_government",
                "category": "compensation_benefits",
                "document_type": "cbi_main",
                "title": "Compensation and Benefits Instructions - Main Page",
                "tags": [
                    "compensation_benefits",
                    "cbi",
                    "military_benefits",
                    "dnd",
                    "canadian_forces",
                    "travel_rates",
                    "allowances",
                    "benefits_policy"
                ],
                "ingested_at": datetime.utcnow().isoformat(),
                "description": "Main index page for Canadian Forces Compensation and Benefits Instructions"
            }
            
            print("\n1. Ingesting main page...")
            await self.ingest_page(self.base_url, main_metadata)
            
            # Discover all chapters
            print("\n2. Discovering chapters...")
            chapters = await self.discover_chapters(self.base_url)
            print(f"   Found {len(chapters)} chapters")
            
            # Ingest each chapter
            if chapters:
                print("\n3. Ingesting chapters...")
                for i, chapter in enumerate(chapters, 1):
                    print(f"\n   Chapter {i}/{len(chapters)}: {chapter['chapter']} - {chapter['name']}")
                    
                    chapter_metadata = {
                        "source": "DND Canada",
                        "source_type": "official_government",
                        "category": "compensation_benefits",
                        "document_type": "cbi_chapter",
                        "title": f"CBI Chapter {chapter['chapter']} - {chapter['name']}",
                        "chapter": chapter['chapter'],
                        "chapter_name": chapter['name'],
                        "tags": [
                            "compensation_benefits",
                            "cbi",
                            f"chapter_{chapter['chapter']}",
                            "military_benefits",
                            "dnd",
                            "canadian_forces"
                        ],
                        "ingested_at": datetime.utcnow().isoformat(),
                        "description": f"Compensation and Benefits Instructions - Chapter {chapter['chapter']}: {chapter['name']}"
                    }
                    
                    await self.ingest_page(chapter['url'], chapter_metadata)
                    
                    # Small delay to avoid overwhelming the server
                    await asyncio.sleep(1)
            
            # Report results
            print("\n" + "=" * 60)
            print("Ingestion Summary:")
            print(f"Total pages processed: {len(self.visited_urls)}")
            print(f"Failed pages: {len(self.failed_urls)}")
            
            if self.failed_urls:
                print("\nFailed URLs:")
                for url in self.failed_urls:
                    print(f"  - {url}")
            
            return len(self.failed_urls) == 0
            
        except Exception as e:
            print(f"\n✗ Failed to complete ingestion: {e}")
            return False

async def main():
    """Main entry point"""
    ingester = CompensationBenefitsIngester()
    success = await ingester.ingest_compensation_benefits()
    
    if success:
        print("\n✓ Ingestion completed successfully")
    else:
        print("\n✗ Ingestion completed with errors")
        exit(1)

if __name__ == "__main__":
    asyncio.run(main())