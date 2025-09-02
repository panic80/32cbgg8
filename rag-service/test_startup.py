#!/usr/bin/env python3
"""Test RAG service startup issue"""
import asyncio
import time

async def test_startup():
    print("Testing ChromaDB initialization...")
    start = time.time()
    
    try:
        from app.core.vectorstore import VectorStore
        print("VectorStore imported successfully")
        
        vector_store = VectorStore()
        print("VectorStore instance created")
        
        # This might be where it hangs
        await vector_store.initialize()
        print(f"VectorStore initialized in {time.time() - start:.2f} seconds")
        
    except Exception as e:
        print(f"Error during initialization: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_startup())