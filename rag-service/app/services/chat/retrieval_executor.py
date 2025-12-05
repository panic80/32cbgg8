"""Retrieval execution service for document search."""

import asyncio
from typing import Any, Dict, List, Optional, Tuple

from app.core.config import settings
from app.core.logging import get_logger
from app.models.query import ChatRequest
from app.pipelines.parallel_retrieval import create_parallel_pipeline
from app.services.chat.query_processor import should_use_hybrid

logger = get_logger(__name__)


class RetrievalExecutor:
    """Executes retrieval operations."""

    def __init__(
        self,
        vector_store_manager: Any,
        app_state: Any,
        llm_wrapper: Optional[Any] = None,
    ):
        """Initialize retrieval executor.

        Args:
            vector_store_manager: The vector store manager.
            app_state: Application state for cache access.
            llm_wrapper: Optional LLM for multi-query retrieval.
        """
        self.vector_store_manager = vector_store_manager
        self.app_state = app_state
        self.llm_wrapper = llm_wrapper

    async def create_pipeline(
        self,
        chat_request: ChatRequest,
        is_smart_mode: bool = False,
    ) -> Any:
        """Create or retrieve cached retrieval pipeline.

        Args:
            chat_request: The chat request.
            is_smart_mode: Whether using smart/streamlined mode.

        Returns:
            The retrieval pipeline.
        """
        enable_unified = getattr(settings, "enable_unified_retrieval", False)
        retriever_configs = None

        cache_service = getattr(self.app_state, "cache_service", None)
        redis_client = (
            getattr(cache_service, "redis_client", None)
            if cache_service and hasattr(cache_service, "redis_client")
            else None
        )
        enable_stateful = getattr(settings, "enable_stateful_retrieval", False)

        if should_use_hybrid(chat_request):
            logger.info("Hybrid search enabled - configuring BM25 + Vector retrievers")
            retriever_configs = {
                "vector_similarity": {
                    "type": "vector",
                    "search_type": "similarity",
                    "k": 10,
                },
                "bm25": {
                    "type": "bm25",
                    "k": 10,
                },
            }
            if self.llm_wrapper:
                retriever_configs["multi_query"] = {
                    "type": "multi_query",
                    "base_retriever": "vector_similarity",
                    "llm": self.llm_wrapper,
                }

        if retriever_configs is None and is_smart_mode:
            logger.info(
                "Smart mode detected - using streamlined vector retriever configuration"
            )
            retriever_configs = {
                "vector_similarity": {
                    "type": "vector",
                    "search_type": "similarity",
                    "k": max(8, getattr(settings, "smart_mode_max_chunks", 4) * 2),
                }
            }

        pipeline_cache_store = getattr(self.app_state, "retrieval_pipeline_cache", None)

        provider_key = str(chat_request.provider)
        model_key = chat_request.model or "default"
        hybrid_key = "hybrid" if should_use_hybrid(chat_request) else "vector"
        cache_key = f"{hybrid_key}|unified={enable_unified}|{provider_key}|{model_key}"

        if pipeline_cache_store is not None and cache_key in pipeline_cache_store:
            pipeline = pipeline_cache_store[cache_key]
            logger.info("Using cached retrieval pipeline: %s", cache_key)
        else:
            pipeline = await asyncio.to_thread(
                create_parallel_pipeline,
                vector_store_manager=self.vector_store_manager,
                llm=self.llm_wrapper,
                enable_unified=enable_unified,
                retriever_configs=retriever_configs,
                enable_reranker=not is_smart_mode,
                enable_stateful=enable_stateful,
                redis_client=redis_client,
            )
            if pipeline_cache_store is not None:
                pipeline_cache_store[cache_key] = pipeline
                logger.info("Cached retrieval pipeline: %s", cache_key)

        return pipeline

    async def retrieve(
        self,
        pipeline: Any,
        query: str,
        k: Optional[int] = None,
        is_smart_mode: bool = False,
    ) -> List[Tuple]:
        """Execute retrieval.

        Args:
            pipeline: The retrieval pipeline.
            query: The query string.
            k: Number of results (defaults to settings).
            is_smart_mode: Whether to apply smart mode limits.

        Returns:
            List of (document, score) tuples.
        """
        if k is None:
            k = getattr(settings, "max_chunks_per_query", 6)

        results = await pipeline.retrieve(query=query, k=k)

        # Apply smart mode chunk limit
        if is_smart_mode:
            smart_chunk_limit = getattr(settings, "smart_mode_max_chunks", 0)
            if smart_chunk_limit:
                results = results[:smart_chunk_limit]

        return results

    async def search_supplemental(
        self,
        query: str,
        k: int = 5,
    ) -> List[Tuple]:
        """Search for supplemental documents.

        Args:
            query: The query string.
            k: Number of results.

        Returns:
            List of (document, score) tuples.
        """
        try:
            return await self.vector_store_manager.search(query, k=k)
        except Exception as exc:
            logger.debug("Supplemental search failed for '%s': %s", query, exc)
            return []
