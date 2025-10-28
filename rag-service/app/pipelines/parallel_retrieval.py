"""Parallel retrieval pipeline for concurrent retriever execution."""

import asyncio
import hashlib
from typing import List, Dict, Any, Optional, Tuple, Set
from datetime import datetime
import time

from langchain_core.documents import Document
from langchain_core.retrievers import BaseRetriever
from langchain_core.language_models import BaseLLM

from app.core.logging import get_logger
from app.core.config import settings
from app.components.reranker import CrossEncoderReranker
from app.components.table_ranker import TableRanker
from app.unified_retrieval.unified_retriever import UnifiedRetriever
from app.services.performance_monitor import get_performance_monitor

logger = get_logger(__name__)

_FLOAT_EPSILON = 1e-9


class CircuitBreaker:
    """Circuit breaker for failing retrievers."""
    
    def __init__(self, failure_threshold: int = 3, timeout: float = 60.0):
        """Initialize circuit breaker."""
        self.failure_threshold = failure_threshold
        self.timeout = timeout
        self.failures: Dict[str, int] = {}
        self.last_failure_time: Dict[str, float] = {}
        
    def is_open(self, retriever_name: str) -> bool:
        """Check if circuit is open (retriever should be skipped)."""
        if retriever_name not in self.failures:
            return False
            
        if self.failures[retriever_name] >= self.failure_threshold:
            # Check if timeout has passed
            if time.time() - self.last_failure_time[retriever_name] > self.timeout:
                # Reset circuit
                self.failures[retriever_name] = 0
                return False
            return True
        return False
        
    def record_failure(self, retriever_name: str):
        """Record a failure for a retriever."""
        self.failures[retriever_name] = self.failures.get(retriever_name, 0) + 1
        self.last_failure_time[retriever_name] = time.time()
        
    def record_success(self, retriever_name: str):
        """Record a success for a retriever."""
        if retriever_name in self.failures:
            self.failures[retriever_name] = 0


class ParallelRetrievalPipeline:
    """Pipeline for executing multiple retrievers in parallel."""
    
    def __init__(
        self,
        retrievers: Dict[str, BaseRetriever],
        weights: Optional[Dict[str, float]] = None,
        concurrency_limit: int = 5,
        timeout_per_retriever: float = 10.0,
        circuit_breaker: Optional[CircuitBreaker] = None,
        reranker: Optional[CrossEncoderReranker] = None,
        table_ranker: Optional[TableRanker] = None
    ):
        """
        Initialize parallel retrieval pipeline.
        
        Args:
            retrievers: Dictionary of retriever name to retriever instance
            weights: Optional weights for each retriever (for result merging)
            concurrency_limit: Maximum number of concurrent retriever calls
            timeout_per_retriever: Timeout for each retriever in seconds
            circuit_breaker: Optional circuit breaker for handling failures
            reranker: Optional CrossEncoderReranker for result reranking
            table_ranker: Optional TableRanker for table-specific queries
        """
        self.retrievers = retrievers
        self.weights = weights or {name: 1.0 for name in retrievers}
        self.concurrency_limit = concurrency_limit
        self.timeout_per_retriever = timeout_per_retriever
        self.circuit_breaker = circuit_breaker or CircuitBreaker()
        self.reranker = reranker
        self.table_ranker = table_ranker
        
        # Normalize weights
        total_weight = sum(self.weights.values())
        self.weights = {k: v / total_weight for k, v in self.weights.items()}

    def _get_document_key(self, doc: Document) -> str:
        """Return a deterministic identifier for a document."""
        metadata = getattr(doc, "metadata", {}) or {}
        if hasattr(metadata, "model_dump"):
            metadata = metadata.model_dump()
        if not isinstance(metadata, dict):
            metadata = {}

        for field in (
            "id",
            "chunk_id",
            "document_id",
            "parent_id",
            "source_id",
            "page_id",
            "uid",
        ):
            value = metadata.get(field)
            if value:
                return f"{field}:{value}"

        content = doc.page_content or ""
        return hashlib.md5(content.encode("utf-8")).hexdigest()

    def _should_replace_candidate(
        self,
        existing: Dict[str, Any],
        candidate: Dict[str, Any]
    ) -> bool:
        """Determine if candidate should replace existing document entry."""
        if candidate["score"] > existing["score"] + _FLOAT_EPSILON:
            return True
        if existing["score"] > candidate["score"] + _FLOAT_EPSILON:
            return False

        if candidate["weight"] > existing["weight"] + _FLOAT_EPSILON:
            return True
        if existing["weight"] > candidate["weight"] + _FLOAT_EPSILON:
            return False

        if candidate["position"] < existing["position"]:
            return True
        if candidate["position"] > existing["position"]:
            return False

        if candidate["retriever"] < existing["retriever"]:
            return True
        if candidate["retriever"] > existing["retriever"]:
            return False

        return candidate["key"] < existing["key"]
        
    async def _retrieve_with_timeout(
        self,
        retriever_name: str,
        retriever: BaseRetriever,
        query: str,
        k: int
    ) -> Tuple[str, List[Document], float]:
        """Retrieve documents with timeout."""
        start_time = time.time()
        
        try:
            # Check if it's a UnifiedRetriever and pass k parameter
            if isinstance(retriever, UnifiedRetriever):
                # UnifiedRetriever supports passing k directly
                docs = await asyncio.wait_for(
                    retriever.aget_relevant_documents(query, top_k=k),
                    timeout=self.timeout_per_retriever
                )
            else:
                # Standard retriever
                docs = await asyncio.wait_for(
                    retriever.aget_relevant_documents(query),
                    timeout=self.timeout_per_retriever
                )
            
            elapsed = time.time() - start_time
            
            # Record success
            self.circuit_breaker.record_success(retriever_name)
            
            # Log metrics for UnifiedRetriever
            if isinstance(retriever, UnifiedRetriever):
                metrics = retriever.get_pipeline_metrics()
                logger.info(f"UnifiedRetriever {retriever_name} metrics: {metrics}")
            
            # Limit results to k
            return retriever_name, docs[:k], elapsed
            
        except asyncio.TimeoutError:
            logger.warning(f"Retriever {retriever_name} timed out after {self.timeout_per_retriever}s")
            self.circuit_breaker.record_failure(retriever_name)
            return retriever_name, [], self.timeout_per_retriever
            
        except Exception as e:
            logger.error(f"Retriever {retriever_name} failed: {e}")
            self.circuit_breaker.record_failure(retriever_name)
            elapsed = time.time() - start_time
            return retriever_name, [], elapsed
    
    async def retrieve(
        self,
        query: str,
        k: int = 5,
        merge_strategy: str = "weighted"
    ) -> List[Tuple[Document, float]]:
        """
        Retrieve documents from all retrievers in parallel.
        
        Args:
            query: Search query
            k: Number of documents to return
            merge_strategy: How to merge results ("weighted", "round_robin", "score_based")
            
        Returns:
            List of (document, score) tuples
        """
        # Filter out retrievers with open circuits
        active_retrievers = {
            name: retriever
            for name, retriever in self.retrievers.items()
            if not self.circuit_breaker.is_open(name)
        }
        
        if not active_retrievers:
            logger.warning("All retrievers have open circuits!")
            return []
        
        # Create retrieval tasks
        tasks = []
        for name, retriever in active_retrievers.items():
            task = self._retrieve_with_timeout(name, retriever, query, k * 2)  # Get more for merging
            tasks.append(task)
        
        monitor = get_performance_monitor()

        # Execute with concurrency limit
        results_by_retriever = {}
        latencies = {}
        
        # Process in batches based on concurrency limit
        for i in range(0, len(tasks), self.concurrency_limit):
            batch = tasks[i:i + self.concurrency_limit]
            batch_results = await asyncio.gather(*batch, return_exceptions=True)
            
            for result in batch_results:
                if isinstance(result, Exception):
                    logger.error(f"Retrieval task failed: {result}")
                else:
                    name, docs, latency = result
                    if docs:
                        results_by_retriever[name] = docs
                    latencies[name] = latency
                    if monitor:
                        try:
                            monitor.record_retriever_performance(
                                name,
                                float(latency) * 1000,
                                len(docs),
                            )
                        except Exception as exc:  # pragma: no cover - defensive logging
                            logger.debug("Failed to record retriever metric for %s: %s", name, exc)
        
        # Log retrieval metrics
        logger.info(f"Parallel retrieval completed - Active: {len(active_retrievers)}, "
                   f"Successful: {len(results_by_retriever)}, "
                   f"Latencies: {latencies}")
        
        # Merge results based on strategy
        merged_results = self._merge_results(results_by_retriever, k * 2 if self.reranker else k, merge_strategy)
        
        # Apply reranking if available
        if self.reranker and merged_results:
            # Extract documents from tuples
            documents = [doc for doc, _ in merged_results]
            
            # Check if this is a table query or trip planning query needing rates
            query_lower = query.lower()
            is_table_query = any(term in query_lower for term in ["rate", "allowance", "table", "$", "meal", "incidental", "kilometric", "per km"])
            
            # Also check for trip planning queries that need rate information
            is_trip_planning = any(term in query_lower for term in ["trip", "travel", "journey", "planning"])
            needs_cost_info = any(term in query_lower for term in ["cost", "expense", "estimate", "budget", "how much"])
            
            # If it's a trip planning query with cost estimation, treat it as needing table data
            if is_trip_planning and needs_cost_info:
                is_table_query = True
                logger.info("Detected trip planning query with cost estimation - applying table ranking")
            
            # Apply table-specific ranking first if it's a table query
            if is_table_query and self.table_ranker:
                logger.info("Applying table-specific ranking")
                documents = self.table_ranker.filter_and_rerank(
                    documents,
                    query,
                    top_k=min(len(documents), k * 2),  # Keep more for final reranking
                    query_type="table"
                )
            
            # Apply general reranking
            logger.info(f"Applying reranking to {len(documents)} documents")
            reranked_docs = await self.reranker.arerank(query, documents, k)
            
            # Convert back to tuples with scores
            merged_results = [(doc, 1.0 - (i * 0.1)) for i, doc in enumerate(reranked_docs)]
            logger.info(f"Reranking complete, returning {len(merged_results)} documents")
        
        return merged_results
    
    def _merge_results(
        self,
        results_by_retriever: Dict[str, List[Document]],
        k: int,
        strategy: str
    ) -> List[Tuple[Document, float]]:
        """Merge results from multiple retrievers."""
        
        if strategy == "weighted":
            return self._weighted_merge(results_by_retriever, k)
        elif strategy == "round_robin":
            return self._round_robin_merge(results_by_retriever, k)
        elif strategy == "score_based":
            return self._score_based_merge(results_by_retriever, k)
        else:
            logger.warning(f"Unknown merge strategy: {strategy}, using weighted")
            return self._weighted_merge(results_by_retriever, k)
    
    def _ordered_retriever_items(
        self,
        results_by_retriever: Dict[str, List[Document]]
    ) -> List[Tuple[str, List[Document]]]:
        """Return retriever results in deterministic priority order."""
        return sorted(
            results_by_retriever.items(),
            key=lambda item: (-self.weights.get(item[0], 0.0), item[0])
        )
    
    def _weighted_merge(
        self,
        results_by_retriever: Dict[str, List[Document]],
        k: int
    ) -> List[Tuple[Document, float]]:
        """Merge results using weighted scores."""
        merged: Dict[str, Dict[str, Any]] = {}
        
        for retriever_name, docs in self._ordered_retriever_items(results_by_retriever):
            weight = self.weights.get(retriever_name, 1.0)
            
            for position, doc in enumerate(docs):
                key = self._get_document_key(doc)
                position_score = 1.0 / (position + 1)
                final_score = weight * position_score
                
                candidate = {
                    "doc": doc,
                    "score": final_score,
                    "weight": weight,
                    "position": position,
                    "retriever": retriever_name,
                    "key": key,
                }
                
                existing = merged.get(key)
                if existing is None or self._should_replace_candidate(existing, candidate):
                    merged[key] = candidate
        
        ordered = sorted(
            merged.values(),
            key=lambda item: (
                -item["score"],
                -item["weight"],
                item["position"],
                item["retriever"],
                item["key"],
            )
        )
        return [(item["doc"], item["score"]) for item in ordered[:k]]
    
    def _round_robin_merge(
        self,
        results_by_retriever: Dict[str, List[Document]],
        k: int
    ) -> List[Tuple[Document, float]]:
        """Merge results using round-robin selection."""
        seen_keys: Set[str] = set()
        merged_results: List[Tuple[Document, float]] = []
        
        ordered_items = self._ordered_retriever_items(results_by_retriever)
        iterators = {name: iter(docs) for name, docs in ordered_items}
        ordered_names = [name for name, _ in ordered_items]
        
        while len(merged_results) < k and ordered_names:
            exhausted: List[str] = []
            
            for name in ordered_names:
                iterator = iterators[name]
                while True:
                    try:
                        doc = next(iterator)
                    except StopIteration:
                        exhausted.append(name)
                        break
                    
                    key = self._get_document_key(doc)
                    if key in seen_keys:
                        # Try next document from the same retriever
                        continue
                    
                    seen_keys.add(key)
                    score = self.weights.get(name, 1.0)
                    merged_results.append((doc, score))
                    
                    if len(merged_results) >= k:
                        break
                    
                    # move to next retriever after recording a result
                    break
                
                if len(merged_results) >= k:
                    break
            
            # Remove exhausted retrievers from the rotation
            if exhausted:
                ordered_names = [name for name in ordered_names if name not in exhausted]
        
        # Deterministic ordering for returned results
        merged_results.sort(
            key=lambda item: (
                -item[1],
                self._get_document_key(item[0]),
            )
        )
        return merged_results[:k]
    
    def _score_based_merge(
        self,
        results_by_retriever: Dict[str, List[Document]],
        k: int
    ) -> List[Tuple[Document, float]]:
        """Merge results based on metadata scores if available."""
        merged: Dict[str, Dict[str, Any]] = {}
        
        for retriever_name, docs in self._ordered_retriever_items(results_by_retriever):
            weight = self.weights.get(retriever_name, 1.0)
            
            for position, doc in enumerate(docs):
                key = self._get_document_key(doc)
                
                metadata = getattr(doc, "metadata", {}) or {}
                if hasattr(metadata, "model_dump"):
                    metadata = metadata.model_dump()
                if not isinstance(metadata, dict):
                    metadata = {}
                
                metadata_score = metadata.get("score", 0.5)
                try:
                    metadata_score = float(metadata_score)
                except (TypeError, ValueError):
                    metadata_score = 0.5
                
                final_score = weight * metadata_score
                
                candidate = {
                    "doc": doc,
                    "score": final_score,
                    "weight": weight,
                    "position": position,
                    "retriever": retriever_name,
                    "key": key,
                }
                
                existing = merged.get(key)
                if existing is None or self._should_replace_candidate(existing, candidate):
                    merged[key] = candidate
        
        ordered = sorted(
            merged.values(),
            key=lambda item: (
                -item["score"],
                -item["weight"],
                item["position"],
                item["retriever"],
                item["key"],
            )
        )
        return [(item["doc"], item["score"]) for item in ordered[:k]]
    
    def get_retriever_stats(self) -> Dict[str, Any]:
        """Get statistics about retriever performance."""
        stats = {
            "retrievers": list(self.retrievers.keys()),
            "weights": self.weights,
            "circuit_breaker": {
                name: {
                    "failures": self.circuit_breaker.failures.get(name, 0),
                    "is_open": self.circuit_breaker.is_open(name)
                }
                for name in self.retrievers
            }
        }
        return stats


def create_parallel_pipeline(
    vector_store_manager,
    llm: Optional[BaseLLM] = None,
    retriever_configs: Optional[Dict[str, Dict[str, Any]]] = None,
    enable_unified: bool = None,
    enable_reranker: bool = True,
    enable_stateful: bool = None,
    redis_client = None,
) -> ParallelRetrievalPipeline:
    """Create a parallel retrieval pipeline with default retrievers."""
    from app.pipelines.retriever_factory import HybridRetrieverFactory, RetrieverConfig, RetrieverMode
    from app.unified_retrieval.migration import create_example_unified_config
    
    # Check if unified retrieval should be enabled from environment
    if enable_unified is None:
        enable_unified = settings.enable_unified_retrieval
    
    logger.info(f"Creating parallel pipeline - enable_unified: {enable_unified}")
    
    # Default retriever configurations
    if retriever_configs is None:
        retriever_configs = {
            "vector_similarity": {
                "type": "vector",
                "search_type": "similarity",
                "k": 10
            },
            "vector_mmr": {
                "type": "vector", 
                "search_type": "mmr",
                "k": 10,
                "lambda_mult": 0.5
            },
            "bm25": {
                "type": "bm25",
                "k": 10
            }
        }
        
        # Add multi-query if LLM is available
        if llm:
            retriever_configs["multi_query"] = {
                "type": "multi_query",
                "base_retriever": "vector_similarity",
                "llm": llm
            }
            
        # Add unified retriever if enabled
        if enable_unified:
            logger.info("Adding unified retriever to configuration")
            # Create a balanced unified retriever config
            unified_config = create_example_unified_config("balanced")
            retriever_configs["unified"] = {
                "mode": "unified",
                "unified_config": unified_config,
                "k": 10
            }
            logger.info(f"Unified config created: {list(unified_config.keys())}")
    
    # Create retrievers
    # Attempt to provide a BM25 corpus by loading all documents once and caching
    all_documents = None
    try:
        all_documents = vector_store_manager.get_all_documents()
        if all_documents:
            logger.info(f"BM25 corpus available: {len(all_documents)} documents")
        else:
            logger.warning("BM25 corpus not available or empty; BM25 will be disabled or fallback to vector")
    except Exception as e:
        logger.warning(f"Unable to prepare BM25 corpus: {e}")

    factory = HybridRetrieverFactory(
        vectorstore=vector_store_manager.vector_store,
        llm=llm,
        embeddings=vector_store_manager.embeddings,
        all_documents=all_documents
    )
    retrievers = {}
    
    for name, config in retriever_configs.items():
        try:
            # Handle unified retriever specially
            if config.get("mode") == "unified":
                logger.info(f"Creating unified retriever: {name}")
                retriever_config = RetrieverConfig(
                    mode=RetrieverMode.UNIFIED,
                    k=config.get("k", 10),
                    unified_config=config.get("unified_config", {})
                )
                retriever = factory.create_retriever(retriever_config)
                if retriever:
                    logger.info(f"Successfully created unified retriever: {name}")
                else:
                    logger.error(f"Failed to create unified retriever: {name}")
            else:
                retriever = factory.create_retriever(config)
                
            if retriever:
                retrievers[name] = retriever
        except Exception as e:
            import traceback
            logger.error(f"Failed to create retriever {name}: {e}")
            logger.error(f"Traceback: {traceback.format_exc()}")
    
    # Define weights based on retriever importance
    default_weights = {
        "vector_similarity": 0.4,
        "vector_mmr": 0.2,
        "bm25": 0.3,
        "multi_query": 0.1,
        "unified": 0.5,
    }
    if retrievers:
        fallback_weight = 1.0 / len(retrievers)
    else:
        fallback_weight = 1.0
    weights = {name: default_weights.get(name, fallback_weight) for name in retrievers.keys()}
    
    reranker = None
    if enable_reranker:
        reranker = CrossEncoderReranker(
            model_name="cross-encoder/ms-marco-MiniLM-L-6-v2",
            device="cpu"
        )
    
    # Create table ranker for table-specific queries
    table_ranker = TableRanker()
    
    pipeline = ParallelRetrievalPipeline(
        retrievers=retrievers,
        weights=weights,
        concurrency_limit=settings.parallel_retrieval_limit,
        timeout_per_retriever=settings.retriever_timeout,
        reranker=reranker,
        table_ranker=table_ranker
    )
    
    # Wrap with stateful pipeline if requested
    if enable_stateful is None:
        enable_stateful = settings.enable_stateful_retrieval
        
    if enable_stateful:
        from app.pipelines.stateful_retrieval import StatefulRetrievalPipeline
        from app.pipelines.query_optimizer import QueryOptimizer
        
        logger.info("Wrapping pipeline with stateful retrieval (LangGraph + Redis)")
        query_optimizer = QueryOptimizer(llm=llm)
        
        return StatefulRetrievalPipeline(
            parallel_pipeline=pipeline,
            query_optimizer=query_optimizer,
            redis_client=redis_client,
            max_iterations=settings.max_retrieval_iterations,
            relevance_threshold=settings.relevance_threshold,
            enable_checkpointing=bool(redis_client)
        )
    
    return pipeline
