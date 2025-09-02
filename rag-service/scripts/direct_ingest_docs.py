#!/usr/bin/env python3
"""
Direct ingestion of .doc files using the ingestion pipeline directly.
Bypasses the API to avoid temporary file issues.
"""
import asyncio
import sys
import os
from pathlib import Path
from datetime import datetime
import re
import json

# Add the project root to the path
sys.path.insert(0, '/var/www/cbthis/rag-service')

from app.pipelines.ingestion import IngestionPipeline
from app.core.vectorstore import VectorStoreManager
from app.services.cache import CacheService
from app.models.documents import DocumentIngestionRequest, DocumentType
from app.core.config import settings

def extract_chapter_info(filename: str):
    """Extract chapter information from filename."""
    # Remove extension
    base_name = Path(filename).stem
    
    # Common patterns for FAM chapters
    patterns = [
        r'^(\d{4})-(\d+)-?(\d*)',  # 1014-1-1, 1014-2, etc.
        r'^fam[_-]?(\d{4})[_-]?(\d+)',  # fam-1020-5, fam_chapter_1016
    ]
    
    for pattern in patterns:
        match = re.search(pattern, base_name, re.IGNORECASE)
        if match:
            chapter = match.group(1)
            section = match.group(2) if len(match.groups()) > 1 else ""
            subsection = match.group(3) if len(match.groups()) > 2 and match.group(3) else ""
            
            # Create chapter identifier
            chapter_id = f"{chapter}"
            if section:
                chapter_id += f"-{section}"
            if subsection:
                chapter_id += f"-{subsection}"
                
            return {
                "chapter": chapter,
                "section": section,
                "subsection": subsection,
                "chapter_id": chapter_id,
                "series": f"{chapter[0:2]}xx"  # 10xx, 11xx, etc.
            }
    
    return {
        "chapter": "unknown",
        "section": "",
        "subsection": "",
        "chapter_id": "unknown",
        "series": "unknown"
    }

def create_metadata(filename: str, file_path: str):
    """Create metadata for a document."""
    chapter_info = extract_chapter_info(filename)
    
    # Determine document type and title
    doc_type = 'fam_chapter'
    category = 'financial_administration'
    title_prefix = 'FAM Chapter'
    
    # Create descriptive title
    if chapter_info['chapter'] != 'unknown':
        title = f"{title_prefix} {chapter_info['chapter_id']}"
        
        # Add specific descriptions based on chapter
        chapter_descriptions = {
            '1014': 'General',
            '1015': 'Financial Planning and Management',
            '1016': 'Financial Operations',
            '1017': 'Revenue',
            '1018': 'Expenditure Management',
            '1019': 'Assets',
            '1020': 'Liabilities',
            '1021': 'Financial Reporting',
            '1022': 'Internal Control',
            '1023': 'Risk Management',
            '1024': 'Taxation'
        }
        
        desc = chapter_descriptions.get(chapter_info['chapter'][:4])
        if desc:
            title += f" - {desc}"
    else:
        # Clean up filename for title
        clean_name = filename.replace('-', ' ').replace('_', ' ')
        clean_name = re.sub(r'\.[^.]*$', '', clean_name)  # Remove extension
        title = clean_name.title()
    
    # Create tags
    tags = [
        'fam',
        'financial_administration',
        'dnd',
        'canadian_forces',
        'policy',
        category
    ]
    
    if chapter_info['chapter'] != 'unknown':
        tags.extend([
            f"chapter_{chapter_info['chapter']}",
            f"series_{chapter_info['series']}"
        ])
    
    # Get file stats
    file_stats = os.stat(file_path)
    
    return {
        "source": "DND Canada",
        "source_type": "official_government",
        "category": category,
        "document_type": doc_type,
        "title": title,
        "chapter": chapter_info['chapter'],
        "chapter_id": chapter_info['chapter_id'],
        "section": chapter_info['section'],
        "subsection": chapter_info['subsection'],
        "series": chapter_info['series'],
        "original_filename": filename,
        "file_size": file_stats.st_size,
        "tags": tags,
        "ingested_at": datetime.utcnow().isoformat(),
        "description": f"Financial Administration Manual document: {title}"
    }

async def get_document_count(vector_store_manager):
    """Get current document count."""
    try:
        if hasattr(vector_store_manager.vector_store, '_collection'):
            collection = vector_store_manager.vector_store._collection
            return collection.count() if collection else 0
    except:
        pass
    return 0

async def ingest_doc_file(file_path: str, pipeline: IngestionPipeline):
    """Ingest a single .doc file directly."""
    filename = os.path.basename(file_path)
    print(f"\nProcessing: {filename}")
    
    try:
        # Create metadata
        metadata = create_metadata(filename, file_path)
        print(f"  Chapter: {metadata['chapter_id']}")
        print(f"  Title: {metadata['title']}")
        print(f"  Size: {metadata['file_size']:,} bytes")
        
        # Create ingestion request
        request = DocumentIngestionRequest(
            file_path=file_path,
            type=DocumentType.DOCX,  # Use DOCX type for .doc files
            metadata=metadata,
            force_refresh=True
        )
        
        # Ingest document
        start_time = asyncio.get_event_loop().time()
        response = await pipeline.ingest_document(request)
        elapsed = asyncio.get_event_loop().time() - start_time
        
        print(f"  ✓ Status: {response.status}")
        print(f"  ✓ Document ID: {response.document_id}")
        print(f"  ✓ Chunks created: {response.chunks_created}")
        print(f"  ✓ Processing time: {elapsed:.2f}s")
        
        return {
            'filename': filename,
            'status': response.status,
            'document_id': response.document_id,
            'chunks_created': response.chunks_created,
            'elapsed': elapsed
        }
        
    except Exception as e:
        print(f"  ✗ Error: {str(e)}")
        return {
            'filename': filename,
            'status': 'error',
            'error': str(e)
        }

async def main():
    """Main ingestion process."""
    print("=" * 60)
    print("Direct .doc Files Ingestion")
    print("=" * 60)
    
    # Initialize services
    print("Initializing services...")
    vector_store_manager = VectorStoreManager()
    await vector_store_manager.initialize()
    
    cache_service = CacheService()
    await cache_service.connect()
    
    # Create pipeline
    pipeline = IngestionPipeline(vector_store_manager, cache_service)
    
    # Get initial document count
    initial_count = await get_document_count(vector_store_manager)
    print(f"Initial document count: {initial_count:,}")
    
    # Find .doc files
    source_dir = "/var/www/cbthis/source"
    doc_files = list(Path(source_dir).glob("*.doc"))
    print(f"Found {len(doc_files)} .doc files")
    
    if not doc_files:
        print("No .doc files found!")
        return
    
    # Process files
    successful = 0
    failed = []
    total_chunks = 0
    
    for doc_file in doc_files:
        result = await ingest_doc_file(str(doc_file), pipeline)
        
        if result['status'] in ['success', 'exists']:
            successful += 1
            total_chunks += result.get('chunks_created', 0)
        else:
            failed.append(result)
        
        # Brief pause between files
        await asyncio.sleep(1)
    
    # Get final document count
    final_count = await get_document_count(vector_store_manager)
    
    # Print summary
    print("\n" + "=" * 60)
    print("DIRECT INGESTION SUMMARY")
    print("=" * 60)
    print(f"Total .doc files processed: {len(doc_files)}")
    print(f"Successful: {successful}")
    print(f"Failed: {len(failed)}")
    print(f"Total chunks created: {total_chunks:,}")
    print(f"Document count: {initial_count:,} → {final_count:,} (+{final_count - initial_count:,})")
    
    if failed:
        print(f"\nFailed files ({len(failed)}):")
        for result in failed:
            print(f"  ✗ {result['filename']}: {result.get('error', 'Unknown error')}")
    
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())