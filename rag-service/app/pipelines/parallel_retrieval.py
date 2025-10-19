"""Parallel retrieval pipeline for concurrent retriever execution."""

import asyncio
from collections import Counter
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
from app.components.rrf_merger import RRFDocument
from app.unified_retrieval.unified_retriever import UnifiedRetriever
from app.services.performance_monitor import get_performance_monitor
from app.services.retrieval_cache import RetrievalL2Cache

logger = get_logger(__name__)


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
        table_ranker: Optional[TableRanker] = None,
        l2_cache: Optional[RetrievalL2Cache] = None
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
        self.l2_cache = l2_cache
        
        # Normalize weights
        total_weight = sum(self.weights.values())
        self.weights = {k: v / total_weight for k, v in self.weights.items()}
        
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

        retriever_name_list = list(active_retrievers.keys())
        cached_results = await self._get_cached_results(query, retriever_name_list, k, merge_strategy)
        if cached_results is not None:
            return cached_results

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
        final_results = merged_results
        
        # Apply reranking if available
        if self.reranker and merged_results:
            if self._should_skip_reranker(query, merged_results):
                logger.info(
                    "Skipping reranker for query '%s' due to high-confidence heuristics",
                    query[:80],
                )
                final_results = merged_results[:k]
            else:
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
                final_results = [(doc, 1.0 - (i * 0.1)) for i, doc in enumerate(reranked_docs)]
                logger.info(f"Reranking complete, returning {len(final_results)} documents")
        
        retriever_stats_snapshot = {
            "latencies": latencies,
            "documents": {name: len(docs) for name, docs in results_by_retriever.items()},
        }
        await self._store_cached_results(
            query,
            retriever_name_list,
            k,
            merge_strategy,
            final_results,
            retriever_stats_snapshot,
        )

        return final_results
    
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
    
    def _weighted_merge(
        self,
        results_by_retriever: Dict[str, List[Document]],
        k: int
    ) -> List[Tuple[Document, float]]:
        """Merge results using weighted scores."""
        # Track unique documents by content hash
        seen_hashes: Set[int] = set()
        merged_results: List[Tuple[Document, float]] = []
        
        # Score each document based on retriever weight and position
        for retriever_name, docs in results_by_retriever.items():
            weight = self.weights.get(retriever_name, 1.0)
            
            for i, doc in enumerate(docs):
                # Create content hash for deduplication
                content_hash = hash(doc.page_content)
                
                if content_hash not in seen_hashes:
                    seen_hashes.add(content_hash)
                    
                    # Calculate score based on position and weight
                    position_score = 1.0 / (i + 1)  # Higher score for earlier positions
                    final_score = weight * position_score
                    
                    merged_results.append((doc, final_score))
        
        # Sort by score and return top k
        merged_results.sort(key=lambda x: x[1], reverse=True)
        return merged_results[:k]
    
    def _round_robin_merge(
        self,
        results_by_retriever: Dict[str, List[Document]],
        k: int
    ) -> List[Tuple[Document, float]]:
        """Merge results using round-robin selection."""
        seen_hashes: Set[str] = set()
        merged_results: List[Tuple[Document, float]] = []
        
        # Create iterators for each retriever's results
        iterators = {
            name: iter(docs)
            for name, docs in results_by_retriever.items()
        }
        
        # Round-robin through retrievers
        while len(merged_results) < k and iterators:
            empty_iterators = []
            
            for name, iterator in iterators.items():
                try:
                    doc = next(iterator)
                    content_hash = hash(doc.page_content)
                    
                    if content_hash not in seen_hashes:
                        seen_hashes.add(content_hash)
                        # Use retriever weight as score
                        score = self.weights.get(name, 1.0)
                        merged_results.append((doc, score))
                        
                        if len(merged_results) >= k:
                            break
                            
                except StopIteration:
                    empty_iterators.append(name)
            
            # Remove exhausted iterators
            for name in empty_iterators:
                del iterators[name]
        
        return merged_results[:k]
    
    def _score_based_merge(
        self,
        results_by_retriever: Dict[str, List[Document]],
        k: int
    ) -> List[Tuple[Document, float]]:
        """Merge results based on metadata scores if available."""
        seen_hashes: Set[str] = set()
        all_results: List[Tuple[Document, float]] = []
        
        for retriever_name, docs in results_by_retriever.items():
            weight = self.weights.get(retriever_name, 1.0)
            
            for doc in docs:
                content_hash = hash(doc.page_content)
                
                if content_hash not in seen_hashes:
                    seen_hashes.add(content_hash)
                    
                    # Try to get score from metadata
                    metadata_score = doc.metadata.get("score", 0.5)
                    final_score = weight * metadata_score
                    
                    all_results.append((doc, final_score))
        
        # Sort by score and return top k
        all_results.sort(key=lambda x: x[1], reverse=True)
        return all_results[:k]
    
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

    def _should_skip_reranker(
        self,
        query: str,
        merged_results: List[Tuple[Document, float]]
    ) -> bool:
        """Return True if reranking can be skipped."""
        similarity_threshold = getattr(settings, "reranker_skip_similarity_threshold", None)
        redundancy_threshold = getattr(settings, "reranker_skip_redundancy_threshold", None)

        if similarity_threshold is None and redundancy_threshold is None:
            return False

        top_document, fused_score = merged_results[0]
        metadata = getattr(top_document, "metadata", {}) or {}
        similarity_score = metadata.get("score") or metadata.get("similarity") or fused_score

        skip_due_to_similarity = (
            similarity_threshold is not None
            and isinstance(similarity_score, (int, float))
            and similarity_score >= similarity_threshold
        )

        skip_due_to_redundancy = False
        if redundancy_threshold is not None and redundancy_threshold > 0:
            window = merged_results[: max(redundancy_threshold + 1, 5)]
            source_keys = []
            for doc, _ in window:
                meta = getattr(doc, "metadata", {}) or {}
                identifier = meta.get("source_id") or meta.get("id") or meta.get("source")
                if identifier:
                    source_keys.append(identifier)

            if source_keys:
                most_common = Counter(source_keys).most_common(1)[0][1]
                skip_due_to_redundancy = most_common >= redundancy_threshold

        if skip_due_to_similarity or skip_due_to_redundancy:
            logger.debug(
                "Reranker skip: query='%s', similarity_skip=%s, redundancy_skip=%s",
                query[:80],
                skip_due_to_similarity,
                skip_due_to_redundancy,
            )

        return skip_due_to_similarity or skip_due_to_redundancy

    async def _get_cached_results(
        self,
        query: str,
        active_retrievers: List[str],
        k: int,
        merge_strategy: str
    ) -> Optional[List[Tuple[Document, float]]]:
        """Attempt to load merged results from the L2 retrieval cache."""
        if not self.l2_cache or not getattr(settings, "enable_l2_retrieval_cache", False):
            return None

        dedup_params = {"merge_strategy": merge_strategy}
        cached = await self.l2_cache.get(
            query=query,
            retriever_names=active_retrievers,
            rrf_k=k,
            dedup_params=dedup_params,
            max_docs=k,
        )
        if not cached:
            return None

        cached_docs, _stats = cached
        logger.info("L2 retrieval cache hit for query '%s'", query[:80])
        return [(rrf_doc.document, rrf_doc.rrf_score) for rrf_doc in cached_docs[:k]]

    async def _store_cached_results(
        self,
        query: str,
        active_retrievers: List[str],
        k: int,
        merge_strategy: str,
        merged_results: List[Tuple[Document, float]],
        retriever_stats: Dict[str, Any]
    ) -> None:
        """Persist merged results into the L2 retrieval cache."""
        if not self.l2_cache or not getattr(settings, "enable_l2_retrieval_cache", False):
            return

        if not merged_results:
            return

        dedup_params = {"merge_strategy": merge_strategy}
        rrf_documents = [
            RRFDocument(
                document=doc,
                rrf_score=score,
                retriever_ranks={},
                retriever_scores={},
            )
            for doc, score in merged_results
        ]

        try:
            await self.l2_cache.set(
                query=query,
                retriever_names=active_retrievers,
                rrf_k=k,
                dedup_params=dedup_params,
                rrf_documents=rrf_documents,
                retriever_stats=retriever_stats,
                max_docs=k,
            )
        except Exception as cache_error:
            logger.warning("Failed to cache retrieval results: %s", cache_error)


def create_parallel_pipeline(
    vector_store_manager,
    llm: Optional[BaseLLM] = None,
    retriever_configs: Optional[Dict[str, Dict[str, Any]]] = None,
    enable_unified: bool = None,
    enable_reranker: bool = True,
    l2_cache: Optional[RetrievalL2Cache] = None,
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
    
    return ParallelRetrievalPipeline(
        retrievers=retrievers,
        weights=weights,
        concurrency_limit=settings.parallel_retrieval_limit,
        timeout_per_retriever=settings.retriever_timeout,
        reranker=reranker,
        table_ranker=table_ranker,
        l2_cache=l2_cache,
    )
