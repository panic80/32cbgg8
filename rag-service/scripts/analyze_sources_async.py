#!/usr/bin/env python3
"""
Analyze all sources in the ChromaDB database
"""
import asyncio
import os
import sys
from collections import defaultdict, Counter

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import chromadb
from app.core.config import settings

async def analyze_sources():
    """Analyze all sources in the database"""
    print("=" * 80)
    print("ChromaDB Source Analysis")
    print("=" * 80)
    
    try:
        # Connect directly to ChromaDB
        client = chromadb.PersistentClient(path="./chroma_db")
        collection = client.get_collection(name="travel_instructions")
        
        # Get all documents
        print("Fetching all documents from database...")
        results = collection.get(include=['metadatas'])
        
        metadatas = results['metadatas']
        total_docs = len(metadatas)
        
        print(f"\nTotal documents in database: {total_docs:,}")
        print("=" * 80)
        
        # Analyze sources
        sources = defaultdict(list)
        chapters = defaultdict(int)
        document_types = Counter()
        categories = Counter()
        source_types = Counter()
        titles_by_source = {}
        
        for metadata in metadatas:
            if metadata:
                # Track by source URL
                source = metadata.get('source', 'Unknown')
                sources[source].append(metadata)
                
                # Store title for each source
                if source not in titles_by_source and metadata.get('title'):
                    titles_by_source[source] = metadata.get('title')
                
                # Track document types
                doc_type = metadata.get('document_type', 'Unknown')
                document_types[doc_type] += 1
                
                # Track categories
                category = metadata.get('category', 'Unknown')
                categories[category] += 1
                
                # Track source types
                source_type = metadata.get('source_type', 'Unknown')
                source_types[source_type] += 1
                
                # Track CBI chapters
                chapter = metadata.get('chapter')
                if chapter:
                    chapters[chapter] += 1
        
        # Print source analysis
        print("\n📁 SOURCES BY URL:")
        print("-" * 80)
        
        # Sort sources by document count
        sorted_sources = sorted(sources.items(), key=lambda x: len(x[1]), reverse=True)
        
        for i, (source_url, docs) in enumerate(sorted_sources, 1):
            doc_count = len(docs)
            title = titles_by_source.get(source_url, 'No title')
            
            print(f"\n{i}. {title}")
            if len(source_url) > 100:
                print(f"   URL: {source_url[:97]}...")
            else:
                print(f"   URL: {source_url}")
            print(f"   Documents: {doc_count:,}")
        
        # Print document type breakdown
        print("\n\n📊 DOCUMENT TYPES:")
        print("-" * 80)
        for doc_type, count in document_types.most_common():
            percentage = (count / total_docs) * 100
            print(f"{doc_type:<30} {count:>6,} ({percentage:>5.1f}%)")
        
        # Print category breakdown
        print("\n\n🏷️  CATEGORIES:")
        print("-" * 80)
        for category, count in categories.most_common():
            percentage = (count / total_docs) * 100
            print(f"{category:<30} {count:>6,} ({percentage:>5.1f}%)")
        
        # Print CBI chapters if any
        if chapters:
            print("\n\n📚 CBI CHAPTERS IN DATABASE:")
            print("-" * 80)
            sorted_chapters = sorted(chapters.items(), key=lambda x: int(x[0]) if x[0].isdigit() else 999)
            total_chapter_docs = sum(chapters.values())
            
            for chapter, count in sorted_chapters:
                percentage = (count / total_chapter_docs) * 100
                print(f"Chapter {chapter:<5} {count:>6,} documents ({percentage:>5.1f}% of CBI content)")
            
            print(f"\nTotal CBI chapter documents: {total_chapter_docs:,}")
        
        # Summary statistics
        print("\n\n📈 SUMMARY:")
        print("-" * 80)
        print(f"Total unique sources: {len(sources)}")
        print(f"Total documents: {total_docs:,}")
        print(f"Average documents per source: {total_docs / len(sources) if sources else 0:.1f}")
        
        # Top sources
        print(f"\n🔝 TOP 5 SOURCES BY DOCUMENT COUNT:")
        print("-" * 80)
        for i, (source_url, docs) in enumerate(sorted_sources[:5], 1):
            title = titles_by_source.get(source_url, 'No title')
            print(f"{i}. {title}")
            print(f"   {len(docs):,} documents")
        
    except Exception as e:
        print(f"\nError analyzing sources: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()

async def main():
    await analyze_sources()

if __name__ == "__main__":
    asyncio.run(main())