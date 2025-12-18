
import os
import sys
import time
import asyncio
from dotenv import load_dotenv

# Add the parent directory to sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Load environment variables
load_dotenv()

from app.core.config import settings
from app.core.vectorstore import VectorStoreManager

async def benchmark_retrieval():
    print("--- Benchmarking Retrieval Breakdown ---")
    print(f"Vector Store Type: {settings.vector_store_type}")
    print(f"Collection: {settings.chroma_collection_name}")
    print(f"Embedding Model: {settings.openai_embedding_model}")
    print(f"Dimensions: {settings.openai_embedding_dimensions}")
    
    manager = VectorStoreManager()
    
    try:
        await manager.initialize()
        
        # 1. Benchmark Embedding Generation (Network + Model)
        print("\n1. Benchmarking Embedding Generation (Network Call)...")
        query_text = "What are the travel allowances for meals in Ontario?"
        
        start_time = time.perf_counter()
        query_vector = manager.embeddings.embed_query(query_text)
        end_time = time.perf_counter()
        embedding_latency = (end_time - start_time) * 1000
        print(f"   Embedding Latency: {embedding_latency:.2f} ms")
        
        vector_dim = len(query_vector)
        print(f"   Vector Dimension: {vector_dim}")
        
        # 2. Benchmark Pure Vector Search (ChromaDB Lookup)
        print("\n2. Benchmarking Pure Vector Search (ChromaDB)...")
        
        start_time = time.perf_counter()
        if hasattr(manager.vector_store, 'similarity_search_by_vector_with_score'):
            results = manager.vector_store.similarity_search_by_vector_with_score(
                query_vector,
                k=settings.retrieval_k
            )
        elif hasattr(manager.vector_store, 'similarity_search_by_vector'):
             results = manager.vector_store.similarity_search_by_vector(
                query_vector,
                k=settings.retrieval_k
            )
        elif hasattr(manager.vector_store, '_collection'):
             # Direct Chroma collection access
             results = manager.vector_store._collection.query(
                query_embeddings=[query_vector],
                n_results=settings.retrieval_k
             )
        else:
            print("   [Warning] Could not find method for vector-only search.")
            results = []

        end_time = time.perf_counter()
        search_latency = (end_time - start_time) * 1000
        print(f"   Vector Search Latency: {search_latency:.2f} ms")


        # 3. Benchmark End-to-End Search (Manager.search)
        # This might include thread pool overhead or other logic in Manager.search
        print("\n3. Benchmarking Manager.search (Text -> ThreadPool -> Search)...")
        start_time = time.perf_counter()
        # This function typically handles embedding internally via the vector_store calls
        # But Manager.search uses `similarity_search_with_score` which re-embeds the query.
        results_e2e = await manager.search(query_text, k=settings.retrieval_k)
        end_time = time.perf_counter()
        e2e_latency = (end_time - start_time) * 1000
        print(f"   Manager.search Latency: {e2e_latency:.2f} ms")
        
        print("\n--- Summary ---")
        print(f"Embedding Generation: {embedding_latency:.2f} ms")
        print(f"Vector Search (Index): {search_latency:.2f} ms")
        print(f"Total Overhead (Thread/Processing): {e2e_latency - embedding_latency - search_latency:.2f} ms")

        if embedding_latency > search_latency * 5:
            print("\nCONCLUSION: Embedding Generation (API Latency) is the dominant factor.")
        elif search_latency > embedding_latency:
             print("\nCONCLUSION: Vector Search (Index Lookup) is the dominant factor.")
        else:
            print("\nCONCLUSION: Latency is balanced between Embedding and Search.")
            
    except Exception as e:
        print(f"Error during benchmark: {e}")
    finally:
        await manager.close()

async def benchmark_small_model():
    print("\n--- Benchmarking text-embedding-3-small ---")
    if not settings.openai_api_key:
        return

    from langchain_openai import OpenAIEmbeddings
    try:
        embeddings = OpenAIEmbeddings(
            api_key=settings.openai_api_key,
            model="text-embedding-3-small",
            dimensions=1536
        )
        
        query_text = "What are the travel allowances for meals in Ontario?"
        
        start_time = time.perf_counter()
        embeddings.embed_query(query_text)
        end_time = time.perf_counter()
        latency = (end_time - start_time) * 1000
        print(f"   Small Model Latency: {latency:.2f} ms")
        
    except Exception as e:
        print(f"Error benchmarking small model: {e}")

if __name__ == "__main__":
    asyncio.run(benchmark_retrieval())
    asyncio.run(benchmark_small_model())
