#!/usr/bin/env python3
"""
Debug script to test the complete ingestion pipeline like the API does.
"""
import asyncio
import tempfile
import os
import sys
sys.path.insert(0, '/var/www/cbthis/rag-service')

from app.pipelines.ingestion import IngestionPipeline
from app.core.vectorstore import VectorStoreManager
from app.services.cache import CacheService
from app.models.documents import DocumentIngestionRequest, DocumentType

async def debug_full_pipeline():
    """Test the complete ingestion pipeline."""
    print("=== Testing Complete Ingestion Pipeline ===")
    
    # Read the source file (simulating uploaded content)
    source_file = '/var/www/cbthis/source/1014-1-1.doc'
    with open(source_file, 'rb') as f:
        content = f.read()
    
    print(f"Source file size: {len(content)} bytes")
    
    # Create temp file exactly like the API
    file_extension = '.doc'
    tmp_file = tempfile.NamedTemporaryFile(delete=False, suffix=file_extension)
    tmp_file.write(content)
    tmp_file.flush()
    tmp_file.close()
    tmp_file_path = tmp_file.name
    
    print(f"Temp file: {tmp_file_path}")
    
    try:
        # Initialize services like the API does
        print("\\nInitializing services...")
        vector_store_manager = VectorStoreManager()
        await vector_store_manager.initialize()
        
        cache_service = CacheService()
        await cache_service.connect()
        
        # Create pipeline
        pipeline = IngestionPipeline(vector_store_manager, cache_service)
        
        # Create metadata like the API does
        metadata = {
            "test": "debug_full_pipeline",
            "chapter": "1014-1-1",
            "original_filename": "1014-1-1.doc"
        }
        
        # Create ingestion request exactly like the API
        request = DocumentIngestionRequest(
            file_path=tmp_file_path,
            type=DocumentType.DOCX,  # API auto-detects this for .doc files
            metadata=metadata,
            force_refresh=True
        )
        
        print(f"\\nTesting ingestion pipeline...")
        print(f"Request: file_path={request.file_path}, type={request.type}")
        
        # Call the ingestion pipeline
        response = await pipeline.ingest_document(request)
        
        print(f"\\nIngestion completed!")
        print(f"Status: {response.status}")
        print(f"Document ID: {response.document_id}")
        print(f"Chunks created: {response.chunks_created}")
        print(f"Processing time: {response.processing_time}")
        
    except Exception as e:
        print(f"\\nException in pipeline: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        # Clean up
        if os.path.exists(tmp_file_path):
            os.unlink(tmp_file_path)
        print("\\nTemp file cleaned up")

if __name__ == "__main__":
    asyncio.run(debug_full_pipeline())