"""Main FastAPI application for RAG service."""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import asyncio
import time
import os
from typing import Dict, Any

from app.core.config import settings
from app.core.logging import setup_logging, get_logger
from app.core.langchain_config import LangChainConfig
from app.api import health, chat, ingestion, sources, websocket, progress, streaming_chat, admin, metrics
from app.services.document_store import DocumentStore
from app.core.vectorstore import VectorStoreManager
from app.services.cache import CacheService
from app.services.llm_pool import initialize_llm_pool, shutdown_llm_pool
from app.services.query_logger import query_logger
from app.services.source_repository import SourceRepository
from app.services.retrieval_cache import create_retrieval_l2_cache
from app.components.bm25_retriever import TravelBM25Retriever
from app.components.gated_retrieval_coordinator import create_gated_retrieval_coordinator, CoordinatorConfiguration

from typing import Optional, List
from langchain_core.documents import Document

# Set up logging
setup_logging(settings.log_level, settings.log_format)
logger = get_logger(__name__)

# Global instances
document_store: DocumentStore = None
vector_store_manager: VectorStoreManager = None
cache_service: CacheService = None
source_repository: SourceRepository = None
retrieval_coordinator = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle."""
    global document_store, vector_store_manager, cache_service, source_repository, retrieval_coordinator
    
    logger.info("Starting RAG service...")
    
    # Initialize services
    try:
        # Initialize LangChain configuration
        LangChainConfig.initialize()
        logger.info("LangChain configuration initialized")
        
        # Initialize cache service
        cache_service = CacheService()
        await cache_service.connect()
        logger.info("Cache service initialized")
        
        # Initialize vector store
        vector_store_manager = VectorStoreManager()
        await vector_store_manager.initialize()
        logger.info("Vector store initialized")
        if getattr(settings, "preload_vector_corpus", True):
            await asyncio.to_thread(vector_store_manager.get_all_documents, True)
            logger.info("Vector store corpus preloaded for retrieval")
        else:
            logger.info("Vector store corpus preload skipped (preload_vector_corpus=False)")

        # Initialize source repository (stores canonical source metadata)
        source_repository = SourceRepository()
        await source_repository.initialize()
        logger.info("Source repository initialized")

        # Initialize document store
        document_store = DocumentStore(
            vector_store_manager,
            cache_service,
            source_repository=source_repository
        )
        logger.info("Document store initialized")
        
        # Initialize LLM connection pool (if enabled)
        if settings.enable_llm_pool:
            await initialize_llm_pool()
            logger.info("LLM connection pool initialized")
        else:
            logger.info("LLM connection pool disabled by configuration")
        
        # Initialize query logger
        await query_logger.initialize()
        logger.info("Query logger initialized")
        
        # Set instances in app state
        app.state.document_store = document_store
        app.state.vector_store_manager = vector_store_manager
        app.state.cache_service = cache_service
        app.state.query_logger = query_logger
        app.state.source_repository = source_repository
        # Cache for retrieval pipelines (keyed by provider/model/hybrid flags)
        app.state.retrieval_pipeline_cache = {}
        if getattr(settings, "enable_l2_retrieval_cache", False) and cache_service and cache_service.enabled:
            ttl_seconds = getattr(settings, "l2_cache_ttl_days", 7) * 86400
            app.state.retrieval_l2_cache = create_retrieval_l2_cache(
                cache_service,
                ttl=ttl_seconds,
                enable_stats=True
            )
        else:
            app.state.retrieval_l2_cache = None

        retrieval_coordinator = None
        if getattr(settings, "enable_gated_retrieval", False):
            async def dense_retriever_fn(query: str, k: int) -> List[Document]:
                results = await vector_store_manager.search(
                    query=query,
                    k=k,
                    search_type="similarity"
                )
                return [doc for doc, _ in results]

            async def sparse_retriever_fn(query: str, k: int) -> List[Document]:
                results = await vector_store_manager.search(
                    query=query,
                    k=k,
                    search_type="mmr"
                )
                return [doc for doc, _ in results]

            def bm25_retriever_fn(query: str, k: int) -> List[Document]:
                try:
                    documents = vector_store_manager.get_all_documents()
                    bm25_retriever = TravelBM25Retriever(documents=documents, k=k)
                    return bm25_retriever.get_relevant_documents(query)
                except Exception as bm25_error:
                    logger.warning("BM25 retriever failed: %s", bm25_error)
                    return []

            coordinator_config = CoordinatorConfiguration(
                enable_l2_cache=getattr(settings, "enable_l2_retrieval_cache", False),
                enable_parallel_execution=True,
                max_parallel_workers=getattr(settings, "parallel_retrieval_limit", 5),
                retrieval_timeout_ms=float(getattr(settings, "retriever_timeout", 10.0)) * 1000.0,
                cache_threshold_docs=5,
                fallback_on_errors=True,
            )

            retrieval_coordinator = create_gated_retrieval_coordinator(
                dense_retriever=dense_retriever_fn,
                sparse_retriever=sparse_retriever_fn,
                bm25_retriever=bm25_retriever_fn,
                hybrid_retriever=None,
                l2_cache=app.state.retrieval_l2_cache,
                config=coordinator_config,
            )
            logger.info("Gated retrieval coordinator ready")
        else:
            logger.info("Gated retrieval coordinator disabled by configuration")

        app.state.retrieval_coordinator = retrieval_coordinator
        
    except Exception as e:
        logger.error(f"Failed to initialize services: {e}")
        raise
        
    yield
    
    # Cleanup
    logger.info("Shutting down RAG service...")
    
    # Shutdown LLM pool (if enabled)
    if settings.enable_llm_pool:
        await shutdown_llm_pool()
        logger.info("LLM connection pool shut down")
    
    if cache_service:
        await cache_service.disconnect()
    if vector_store_manager:
        await vector_store_manager.close()
    if retrieval_coordinator:
        retrieval_coordinator.close()


# Create FastAPI app
logger.info(f"[DIAGNOSTIC] Creating FastAPI app with api_prefix: {settings.api_prefix}")
logger.info(f"[DIAGNOSTIC] Environment RAG_API_PREFIX: {os.getenv('RAG_API_PREFIX', 'not set')}")

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    lifespan=lifespan,
    docs_url=f"{settings.api_prefix}/docs",
    redoc_url=f"{settings.api_prefix}/redoc",
    openapi_url=f"{settings.api_prefix}/openapi.json",
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Add request timing middleware
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    """Add request processing time to response headers."""
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    return response


# Exception handlers
@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    """Handle validation errors."""
    logger.error(f"Validation error: {exc}")
    return JSONResponse(
        status_code=400,
        content={"error": "Bad Request", "message": str(exc)},
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle general exceptions."""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": "Internal Server Error", "message": "An unexpected error occurred"},
    )


# Include routers
app.include_router(health.router, prefix=settings.api_prefix, tags=["health"])
app.include_router(chat.router, prefix=settings.api_prefix, tags=["chat"])
app.include_router(ingestion.router, prefix=settings.api_prefix, tags=["ingestion"])
app.include_router(sources.router, prefix=settings.api_prefix, tags=["sources"])
app.include_router(websocket.router, prefix=settings.api_prefix, tags=["websocket"])
app.include_router(progress.router, prefix=settings.api_prefix, tags=["progress"])
app.include_router(streaming_chat.router, prefix=settings.api_prefix, tags=["streaming"])
app.include_router(metrics.router, prefix=settings.api_prefix, tags=["metrics"])


@app.get("/")
async def root() -> Dict[str, Any]:
    """Root endpoint."""
    return {
        "service": settings.app_name,
        "version": settings.app_version,
        "status": "operational",
        "docs": f"{settings.api_prefix}/docs",
    }


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        workers=settings.workers,
        log_level=settings.log_level.lower(),
    )
