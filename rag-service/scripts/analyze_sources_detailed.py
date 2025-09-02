#!/usr/bin/env python3
"""
Detailed analysis of sources in the ChromaDB database
"""
import asyncio
import os
import sys
from collections import defaultdict, Counter
import json

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import chromadb

async def analyze_sources_detailed():
    """Analyze all sources in the database with detailed metadata"""
    print("=" * 80)
    print("ChromaDB Detailed Source Analysis")
    print("=" * 80)
    
    try:
        # Connect directly to ChromaDB
        client = chromadb.PersistentClient(path="./chroma_db")
        collection = client.get_collection(name="travel_instructions")
        
        # Get a sample of documents with all metadata
        print("Fetching document metadata...")
        
        # Get first 100 documents to examine metadata structure
        sample_results = collection.get(limit=100, include=['metadatas', 'documents'])
        
        # Print sample metadata to understand structure
        print("\n📋 SAMPLE METADATA STRUCTURE:")
        print("-" * 80)
        if sample_results['metadatas'] and sample_results['metadatas'][0]:
            sample_metadata = sample_results['metadatas'][0]
            print("Keys found in metadata:")
            for key in sorted(sample_metadata.keys()):
                print(f"  - {key}: {type(sample_metadata[key]).__name__}")
        
        # Now get all documents
        print("\nFetching all documents...")
        all_results = collection.get(include=['metadatas'])
        metadatas = all_results['metadatas']
        total_docs = len(metadatas)
        
        print(f"\nTotal documents: {total_docs:,}")
        
        # Analyze by unique sources
        source_analysis = defaultdict(lambda: {
            'count': 0,
            'title': None,
            'type': None,
            'category': None,
            'chapter': None,
            'metadata_sample': None
        })
        
        # Process all metadata
        for metadata in metadatas:
            if metadata and isinstance(metadata, dict):
                source = metadata.get('source', 'Unknown')
                
                analysis = source_analysis[source]
                analysis['count'] += 1
                
                # Capture first instance of each field
                if not analysis['title'] and 'title' in metadata:
                    analysis['title'] = metadata['title']
                if not analysis['type'] and 'document_type' in metadata:
                    analysis['type'] = metadata['document_type']
                if not analysis['category'] and 'category' in metadata:
                    analysis['category'] = metadata['category']
                if not analysis['chapter'] and 'chapter' in metadata:
                    analysis['chapter'] = metadata['chapter']
                if not analysis['metadata_sample']:
                    analysis['metadata_sample'] = metadata
        
        # Print detailed source information
        print("\n\n📁 DETAILED SOURCE BREAKDOWN:")
        print("=" * 80)
        
        # Sort by document count
        sorted_sources = sorted(source_analysis.items(), key=lambda x: x[1]['count'], reverse=True)
        
        for i, (source_url, info) in enumerate(sorted_sources, 1):
            print(f"\n{i}. Source #{i}")
            print("-" * 60)
            
            # Clean URL display
            if source_url.startswith('http'):
                # Extract meaningful part of URL
                if 'chapter-' in source_url:
                    chapter_part = source_url.split('chapter-')[1].split('.html')[0]
                    print(f"📄 CBI Chapter URL: ...chapter-{chapter_part}.html")
                elif 'njc-cnm' in source_url:
                    print(f"📄 NJC Travel Directive URL")
                elif 'canadian-forces-temporary-duty' in source_url:
                    print(f"📄 CF Temporary Duty Travel Instructions URL")
                else:
                    print(f"📄 URL: {source_url[:80]}...")
            else:
                print(f"📄 Source: {source_url}")
            
            print(f"📊 Documents: {info['count']:,}")
            
            if info['title']:
                print(f"📑 Title: {info['title']}")
            if info['type']:
                print(f"🏷️  Type: {info['type']}")
            if info['category']:
                print(f"📂 Category: {info['category']}")
            if info['chapter']:
                print(f"📚 Chapter: {info['chapter']}")
        
        # Summary of all sources
        print("\n\n📈 SUMMARY BY TYPE:")
        print("=" * 80)
        
        # Group by URL patterns
        cbi_chapters = []
        njc_docs = []
        cf_travel_docs = []
        other_docs = []
        
        for source, info in sorted_sources:
            if 'chapter-' in source and 'compensation-benefits' in source:
                cbi_chapters.append((source, info))
            elif 'njc-cnm' in source:
                njc_docs.append((source, info))
            elif 'canadian-forces-temporary-duty' in source:
                cf_travel_docs.append((source, info))
            else:
                other_docs.append((source, info))
        
        print(f"\n📚 CBI Chapters: {len(cbi_chapters)} sources")
        cbi_total = sum(info['count'] for _, info in cbi_chapters)
        print(f"   Total documents: {cbi_total:,}")
        for source, info in cbi_chapters:
            if 'chapter-' in source:
                chapter_num = source.split('chapter-')[1].split('-')[0]
                print(f"   - Chapter {chapter_num}: {info['count']:,} documents")
        
        print(f"\n📋 NJC Documents: {len(njc_docs)} sources")
        njc_total = sum(info['count'] for _, info in njc_docs)
        print(f"   Total documents: {njc_total:,}")
        
        print(f"\n✈️  CF Travel Instructions: {len(cf_travel_docs)} sources")
        cf_total = sum(info['count'] for _, info in cf_travel_docs)
        print(f"   Total documents: {cf_total:,}")
        
        if other_docs:
            print(f"\n📄 Other Sources: {len(other_docs)} sources")
            other_total = sum(info['count'] for _, info in other_docs)
            print(f"   Total documents: {other_total:,}")
        
        print(f"\n🎯 GRAND TOTAL: {total_docs:,} documents from {len(sorted_sources)} sources")
        
    except Exception as e:
        print(f"\nError: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(analyze_sources_detailed())