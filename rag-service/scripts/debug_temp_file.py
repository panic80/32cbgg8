#!/usr/bin/env python3
"""
Debug script to test temporary file creation like the API does.
"""
import tempfile
import os
import sys
sys.path.insert(0, '/var/www/cbthis/rag-service')

from langchain_community.document_loaders import UnstructuredWordDocumentLoader

def test_api_style_temp_file():
    """Test the exact same way the API creates temp files."""
    print("=== Testing API-style temp file creation ===")
    
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
    
    print(f"Temp file path: {tmp_file_path}")
    print(f"Temp file size: {os.path.getsize(tmp_file_path)} bytes")
    print(f"File exists: {os.path.exists(tmp_file_path)}")
    print(f"File readable: {os.access(tmp_file_path, os.R_OK)}")
    
    # Try to load with UnstructuredWordDocumentLoader
    try:
        print("\\nTesting UnstructuredWordDocumentLoader...")
        loader = UnstructuredWordDocumentLoader(tmp_file_path)
        documents = loader.load()
        
        print(f"Loader returned {len(documents)} documents")
        if documents:
            print(f"First doc content length: {len(documents[0].page_content)}")
            print(f"First 100 chars: {repr(documents[0].page_content[:100])}")
        else:
            print("No documents returned - this is the problem!")
            
    except Exception as e:
        print(f"Exception in loader: {e}")
        import traceback
        traceback.print_exc()
    
    # Clean up
    os.unlink(tmp_file_path)
    print("\\nTemp file cleaned up")

if __name__ == "__main__":
    test_api_style_temp_file()