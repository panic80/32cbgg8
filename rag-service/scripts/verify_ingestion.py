#!/usr/bin/env python3
"""
Verify the ingestion of source files by checking the vector database.
"""
import asyncio
import httpx
from datetime import datetime, timedelta

async def check_health():
    """Check service health and get document count."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get("http://localhost:8000/api/v1/health")
            if response.status_code == 200:
                data = response.json()
                return {
                    'status': 'healthy',
                    'document_count': data.get("components", {}).get("vector_store", {}).get("document_count", 0),
                    'collection': data.get("components", {}).get("vector_store", {}).get("collection", "N/A")
                }
    except Exception as e:
        return {'status': 'error', 'error': str(e)}
    
    return {'status': 'unknown'}

async def test_chat_query():
    """Test a chat query that might return FAM information."""
    try:
        payload = {
            "message": "Tell me about FAM chapter 1014",
            "llm_provider": "openai",
            "llm_model": "gpt-4o-mini",
            "enable_web_search": False,
            "enable_structured_output": False
        }
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "http://localhost:8000/api/v1/chat/stream",
                json=payload,
                headers={"Accept": "text/plain"}
            )
            
            if response.status_code == 200:
                # For streaming response, just check if we got a response
                content = response.text
                return {
                    'status': 'success',
                    'has_content': len(content) > 0,
                    'preview': content[:200] if content else "No content"
                }
            else:
                return {
                    'status': 'error', 
                    'code': response.status_code,
                    'message': response.text
                }
                
    except Exception as e:
        return {'status': 'exception', 'error': str(e)}

async def verify_vector_db_files():
    """Check the vector database files for recent modifications."""
    import os
    from pathlib import Path
    
    db_path = Path("./chroma_db")
    if not db_path.exists():
        return {'status': 'error', 'message': 'ChromaDB directory not found'}
    
    # Check modification times
    files_info = []
    for file_path in db_path.rglob("*"):
        if file_path.is_file():
            stat = file_path.stat()
            mod_time = datetime.fromtimestamp(stat.st_mtime)
            files_info.append({
                'file': str(file_path.relative_to(db_path)),
                'size': stat.st_size,
                'modified': mod_time,
                'recent': (datetime.now() - mod_time) < timedelta(hours=1)
            })
    
    # Sort by modification time
    files_info.sort(key=lambda x: x['modified'], reverse=True)
    
    recent_files = [f for f in files_info if f['recent']]
    
    return {
        'status': 'success',
        'total_files': len(files_info),
        'recent_files': len(recent_files),
        'most_recent': files_info[:3] if files_info else [],
        'db_size': sum(f['size'] for f in files_info)
    }

async def main():
    """Main verification process."""
    print("=" * 60)
    print("Source Files Ingestion Verification")
    print("=" * 60)
    
    # Check service health
    print("1. Checking RAG service health...")
    health = await check_health()
    print(f"   Status: {health['status']}")
    if health['status'] == 'healthy':
        print(f"   Document count: {health['document_count']:,}")
        print(f"   Collection: {health['collection']}")
    elif health['status'] == 'error':
        print(f"   Error: {health.get('error', 'Unknown')}")
    
    # Check vector database files
    print("\n2. Checking vector database files...")
    db_info = await verify_vector_db_files()
    if db_info['status'] == 'success':
        print(f"   Total DB files: {db_info['total_files']}")
        print(f"   Recently modified: {db_info['recent_files']}")
        print(f"   Total DB size: {db_info['db_size']:,} bytes")
        if db_info['most_recent']:
            print("   Most recently modified files:")
            for file_info in db_info['most_recent']:
                print(f"     - {file_info['file']}: {file_info['modified'].strftime('%Y-%m-%d %H:%M:%S')}")
    else:
        print(f"   Error: {db_info.get('message', 'Unknown error')}")
    
    # Test chat query
    print("\n3. Testing chat query for FAM content...")
    chat_result = await test_chat_query()
    print(f"   Status: {chat_result['status']}")
    if chat_result['status'] == 'success':
        print(f"   Has content: {chat_result['has_content']}")
        if chat_result['has_content']:
            print(f"   Preview: {chat_result['preview']}...")
    elif chat_result['status'] == 'error':
        print(f"   HTTP {chat_result['code']}: {chat_result['message']}")
    else:
        print(f"   Error: {chat_result.get('error', 'Unknown')}")
    
    print("\n" + "=" * 60)
    print("VERIFICATION SUMMARY")
    print("=" * 60)
    
    # Summary
    service_ok = health['status'] == 'healthy'
    db_updated = db_info['status'] == 'success' and db_info['recent_files'] > 0
    chat_works = chat_result['status'] == 'success'
    
    print(f"✓ Service Health: {'PASS' if service_ok else 'FAIL'}")
    print(f"✓ Database Updated: {'PASS' if db_updated else 'FAIL'}")  
    print(f"✓ Chat Functionality: {'PASS' if chat_works else 'FAIL'}")
    
    if service_ok and db_updated:
        print(f"\n🎉 SUCCESS: Source files ingestion appears to be working!")
        print(f"   • {health['document_count']:,} total documents in the vector database")
        print(f"   • Database files were recently modified")
        if chat_works and chat_result.get('has_content'):
            print(f"   • Chat queries are returning content")
    else:
        print(f"\n⚠️  ISSUES DETECTED:")
        if not service_ok:
            print(f"   • Service health check failed")
        if not db_updated:
            print(f"   • No recent database modifications detected")
        if not chat_works:
            print(f"   • Chat functionality not working properly")
    
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())