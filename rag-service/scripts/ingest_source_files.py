#!/usr/bin/env python3
"""
Ingest all source files from /var/www/cbthis/source/ into the RAG vector database.
This script processes FAM (Financial Administration Manual) chapters and other policy documents.
"""
import asyncio
import httpx
import os
import mimetypes
from pathlib import Path
from datetime import datetime
import time
import json
from typing import List, Dict, Optional
import re

# Configuration
SOURCE_DIR = "/var/www/cbthis/source"
RAG_SERVICE_URL = "http://localhost:8000/api/v1/ingest/file"
HEALTH_URL = "http://localhost:8000/api/v1/health"
MAX_CONCURRENT = 3
TIMEOUT_SECONDS = 600

# Supported file extensions
SUPPORTED_EXTENSIONS = {'.doc', '.docx', '.pdf'}


def extract_chapter_info(filename: str) -> Dict[str, str]:
    """Extract chapter information from filename."""
    # Remove extension
    base_name = Path(filename).stem
    
    # Common patterns for FAM chapters
    patterns = [
        r'^(\d{4})-(\d+)-?(\d*)',  # 1014-1-1, 1014-2, etc.
        r'^fam[_-]?(\d{4})[_-]?(\d+)',  # fam-1020-5, fam_chapter_1016
        r'^en[_-]fam[_-]chapter[_-](\d{4})[_-](\d+)',  # en-fam-chapter-1024-2
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
    
    # Fallback - extract any 4-digit number
    match = re.search(r'(\d{4})', base_name)
    if match:
        return {
            "chapter": match.group(1),
            "section": "",
            "subsection": "",
            "chapter_id": match.group(1),
            "series": f"{match.group(1)[0:2]}xx"
        }
    
    return {
        "chapter": "unknown",
        "section": "",
        "subsection": "",
        "chapter_id": "unknown",
        "series": "unknown"
    }


def create_metadata(filename: str, file_path: str) -> Dict:
    """Create metadata for a document."""
    chapter_info = extract_chapter_info(filename)
    
    # Determine document type and title
    if 'fam' in filename.lower():
        doc_type = 'fam_chapter'
        category = 'financial_administration'
        title_prefix = 'FAM Chapter'
    elif any(x in filename.lower() for x in ['1014', '1015', '1016', '1017', '1018', '1019', '1020', '1021', '1022', '1023', '1024']):
        doc_type = 'fam_chapter'
        category = 'financial_administration'
        title_prefix = 'FAM Chapter'
    else:
        doc_type = 'policy_document'
        category = 'administrative'
        title_prefix = 'Document'
    
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


async def check_service_health() -> bool:
    """Check if the RAG service is healthy."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(HEALTH_URL)
            return response.status_code == 200
    except Exception as e:
        print(f"Health check failed: {e}")
        return False


async def get_document_count() -> int:
    """Get current document count from the service."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(HEALTH_URL)
            if response.status_code == 200:
                data = response.json()
                return data.get("components", {}).get("vector_store", {}).get("document_count", 0)
    except Exception as e:
        print(f"Error getting document count: {e}")
    return 0


async def ingest_file(file_path: str, filename: str) -> Dict:
    """Ingest a single file."""
    try:
        # Create metadata
        metadata = create_metadata(filename, file_path)
        
        # Determine MIME type
        mime_type, _ = mimetypes.guess_type(file_path)
        if not mime_type:
            if file_path.endswith('.page'):
                mime_type = 'text/plain'  # Treat .page files as text
            else:
                mime_type = 'application/octet-stream'
        
        print(f"\nProcessing: {filename}")
        print(f"  Chapter: {metadata['chapter_id']}")
        print(f"  Title: {metadata['title']}")
        print(f"  Size: {metadata['file_size']:,} bytes")
        
        # Prepare multipart form data
        with open(file_path, 'rb') as f:
            files = {
                'file': (filename, f, mime_type)
            }
            data = {
                'metadata': json.dumps(metadata),
                'force_refresh': 'true'
            }
            
            # Send request
            start_time = time.time()
            async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
                response = await client.post(
                    RAG_SERVICE_URL,
                    files=files,
                    data=data
                )
                
                elapsed = time.time() - start_time
                
                if response.status_code == 200:
                    result = response.json()
                    print(f"  ✓ Ingested in {elapsed:.1f}s")
                    print(f"  Document ID: {result.get('document_id', 'N/A')}")
                    return {
                        'filename': filename,
                        'status': 'success',
                        'document_id': result.get('document_id'),
                        'elapsed': elapsed,
                        'chunks': result.get('chunks_created', 0)
                    }
                else:
                    error_msg = response.text
                    print(f"  ✗ HTTP {response.status_code}: {error_msg}")
                    return {
                        'filename': filename,
                        'status': 'error',
                        'error': f"HTTP {response.status_code}: {error_msg}",
                        'elapsed': elapsed
                    }
                    
    except httpx.TimeoutException:
        print(f"  ✗ Timeout after {TIMEOUT_SECONDS} seconds")
        return {
            'filename': filename,
            'status': 'timeout',
            'error': f'Timeout after {TIMEOUT_SECONDS} seconds'
        }
    except Exception as e:
        print(f"  ✗ Error: {str(e)}")
        return {
            'filename': filename,
            'status': 'error',
            'error': str(e)
        }


async def ingest_files_batch(file_paths: List[str], batch_size: int = MAX_CONCURRENT) -> List[Dict]:
    """Ingest files in batches."""
    results = []
    
    for i in range(0, len(file_paths), batch_size):
        batch = file_paths[i:i + batch_size]
        print(f"\n{'='*60}")
        print(f"Processing batch {i//batch_size + 1} ({len(batch)} files)")
        print(f"{'='*60}")
        
        # Process batch concurrently
        tasks = []
        for file_path in batch:
            filename = os.path.basename(file_path)
            tasks.append(ingest_file(file_path, filename))
        
        batch_results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Handle exceptions
        for j, result in enumerate(batch_results):
            if isinstance(result, Exception):
                filename = os.path.basename(batch[j])
                results.append({
                    'filename': filename,
                    'status': 'exception',
                    'error': str(result)
                })
                print(f"Exception processing {filename}: {result}")
            else:
                results.append(result)
        
        # Brief pause between batches
        if i + batch_size < len(file_paths):
            print("\nPausing 3 seconds before next batch...")
            await asyncio.sleep(3)
    
    return results


def scan_source_directory() -> List[str]:
    """Scan the source directory for supported files."""
    if not os.path.exists(SOURCE_DIR):
        raise FileNotFoundError(f"Source directory not found: {SOURCE_DIR}")
    
    files = []
    skipped = []
    
    for filename in os.listdir(SOURCE_DIR):
        file_path = os.path.join(SOURCE_DIR, filename)
        
        if os.path.isfile(file_path):
            ext = Path(filename).suffix.lower()
            
            if ext in SUPPORTED_EXTENSIONS:
                files.append(file_path)
            else:
                skipped.append((filename, ext))
    
    files.sort()  # Process in alphabetical order
    
    print(f"Found {len(files)} supported files")
    if skipped:
        print(f"Skipped {len(skipped)} unsupported files:")
        for filename, ext in skipped:
            print(f"  - {filename} ({ext})")
    
    return files


async def main():
    """Main ingestion process."""
    print("=" * 80)
    print("FAM Source Files Batch Ingestion")
    print("=" * 80)
    
    # Check service health
    print("Checking RAG service health...")
    if not await check_service_health():
        print("✗ RAG service is not healthy. Please check the service.")
        return False
    print("✓ RAG service is healthy")
    
    # Get initial document count
    initial_count = await get_document_count()
    print(f"Initial document count: {initial_count:,}")
    
    # Scan source directory
    try:
        file_paths = scan_source_directory()
    except FileNotFoundError as e:
        print(f"✗ {e}")
        return False
    
    if not file_paths:
        print("No supported files found to ingest.")
        return True
    
    print(f"\nStarting ingestion of {len(file_paths)} files...")
    print(f"Max concurrent: {MAX_CONCURRENT}")
    print(f"Timeout per file: {TIMEOUT_SECONDS} seconds")
    
    # Start ingestion
    start_time = time.time()
    results = await ingest_files_batch(file_paths)
    total_elapsed = time.time() - start_time
    
    # Analyze results
    successful = [r for r in results if r['status'] == 'success']
    failed = [r for r in results if r['status'] != 'success']
    
    # Get final document count
    final_count = await get_document_count()
    
    # Print summary
    print("\n" + "=" * 80)
    print("INGESTION SUMMARY")
    print("=" * 80)
    print(f"Total files processed: {len(results)}")
    print(f"Successful: {len(successful)}")
    print(f"Failed: {len(failed)}")
    print(f"Total time: {total_elapsed:.1f} seconds")
    print(f"Average time per file: {total_elapsed/len(results):.1f} seconds")
    print(f"\nDocument count: {initial_count:,} → {final_count:,} (+{final_count - initial_count:,})")
    
    if successful:
        total_chunks = sum(r.get('chunks', 0) for r in successful)
        avg_time = sum(r['elapsed'] for r in successful) / len(successful)
        print(f"Total chunks created: {total_chunks:,}")
        print(f"Average processing time: {avg_time:.1f}s")
    
    if failed:
        print(f"\nFailed files ({len(failed)}):")
        for result in failed:
            print(f"  ✗ {result['filename']}: {result.get('error', 'Unknown error')}")
    
    print("\n" + "=" * 80)
    
    return len(failed) == 0


if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1)