#!/usr/bin/env python3
"""
Analyze all sources in the ChromaDB database
"""
import os
import sys
from collections import defaultdict, Counter
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.vectorstore import VectorStoreManager
from app.core.config import settings

def analyze_sources():
    """Analyze all sources in the database"""
    print("=" * 80)
    print("ChromaDB Source Analysis")
    print("=" * 80)
    
    try:
        # Initialize vector store
        vector_store_manager = VectorStoreManager()
        vector_store_manager.initialize()
        
        # Get the collection
        collection = vector_store_manager.vector_store._collection
        
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
        
        for metadata in metadatas:
            if metadata:
                # Track by source URL
                source = metadata.get('source', 'Unknown')
                sources[source].append(metadata)
                
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
            # Get first document's metadata for details
            first_doc = docs[0]
            title = first_doc.get('title', 'No title')
            
            print(f"\n{i}. {title}")
            print(f"   URL: {source_url}")
            print(f"   Documents: {doc_count:,}")
            
            # Show ingestion date if available
            ingestion_date = first_doc.get('ingested_at', first_doc.get('ingestion_date'))
            if ingestion_date:
                print(f"   Ingested: {ingestion_date}")
        
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
        
        # Print source type breakdown
        print("\n\n🌐 SOURCE TYPES:")
        print("-" * 80)
        for source_type, count in source_types.most_common():
            percentage = (count / total_docs) * 100
            print(f"{source_type:<30} {count:>6,} ({percentage:>5.1f}%)")
        
        # Print CBI chapters if any
        if chapters:
            print("\n\n📚 CBI CHAPTERS:")
            print("-" * 80)
            sorted_chapters = sorted(chapters.items(), key=lambda x: int(x[0]) if x[0].isdigit() else 999)
            for chapter, count in sorted_chapters:
                print(f"Chapter {chapter:<5} {count:>6,} documents")
        
        # Summary statistics
        print("\n\n📈 SUMMARY STATISTICS:")
        print("-" * 80)
        print(f"Total unique sources: {len(sources)}")
        print(f"Total documents: {total_docs:,}")
        print(f"Average documents per source: {total_docs / len(sources):.1f}")
        
        # Find sources with most documents
        print(f"\nLargest sources:")
        for source_url, docs in sorted_sources[:5]:
            title = docs[0].get('title', 'No title')
            print(f"  - {title}: {len(docs):,} documents")
        
    except Exception as e:
        print(f"\nError analyzing sources: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    analyze_sources()