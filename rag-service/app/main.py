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
from app.core.container import ServiceContainer, set_container
from app.api import health, chat, ingestion, sources, websocket, progress, streaming_chat, admin, metrics

# Set up logging
setup_logging(settings.log_level, settings.log_format)
logger = get_logger(__name__)


async def _preload_vector_store_corpus(container: ServiceContainer) -> None:
    """Preload vector store corpus in background.

    This runs as a background task to avoid blocking startup.
    """
    try:
        await asyncio.to_thread(
            container.vector_store_manager.get_all_documents, True
        )
        logger.info("Vector store corpus preloaded for retrieval")
    except Exception as e:
        logger.warning(f"Vector store preload failed (non-fatal): {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle."""
    logger.info("Starting RAG service...")

    # Create and initialize service container
    container = ServiceContainer()

    try:
        await container.initialize(settings)

        # Set global container for module-level access
        set_container(container)

        # Store container in app state for route access
        app.state.container = container

        # Backward compatibility: set individual services in app.state
        # These can be removed once all routes use container
        app.state.document_store = container.document_store
        app.state.vector_store_manager = container.vector_store_manager
        app.state.cache_service = container.cache_service
        app.state.query_logger = container.query_logger
        app.state.source_repository = container.source_repository
        app.state.retrieval_pipeline_cache = container.retrieval_pipeline_cache

        # Start corpus preload as background task (non-blocking)
        preload_task = asyncio.create_task(
            _preload_vector_store_corpus(container)
        )
        app.state.preload_task = preload_task

        logger.info("RAG service started successfully")

    except Exception as e:
        logger.error(f"Failed to initialize services: {e}")
        raise

    yield

    # Cleanup
    logger.info("Shutting down RAG service...")

    # Cancel preload task if still running
    if hasattr(app.state, 'preload_task') and not app.state.preload_task.done():
        app.state.preload_task.cancel()
        try:
            await app.state.preload_task
        except asyncio.CancelledError:
            pass

    # Shutdown container (handles all service cleanup)
    await container.shutdown()

    logger.info("RAG service shut down")


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
