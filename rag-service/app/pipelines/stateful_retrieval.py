"""Stateful retrieval pipeline with LangGraph orchestration and Redis persistence.

This module wraps ParallelRetrievalPipeline with LangGraph's StateGraph to enable:
- Redis-backed state persistence for conversation continuity
- Iterative refinement cycles when retrieval quality is low
- Automatic query reformulation for better results
"""

import asyncio
import hashlib
import time
from typing import Any, Dict, List, Optional, Tuple, TypedDict

from langchain_core.documents import Document
from langchain_core.retrievers import BaseRetriever
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
import redis.asyncio as redis

from app.core.config import settings
from app.core.logging import get_logger
from app.pipelines.parallel_retrieval import ParallelRetrievalPipeline
from app.pipelines.query_optimizer import QueryOptimizer
from app.services.performance_monitor import get_performance_monitor

logger = get_logger(__name__)


class RetrievalState(TypedDict):
    """State schema for stateful retrieval workflow."""
    query: str
    original_query: str
    documents: List[Tuple[Document, float]]
    relevance_scores: List[float]
    iteration_count: int
    metadata: Dict[str, Any]
    error: Optional[str]
    finalized: bool


class RedisCheckpointer:
    """Custom Redis-based checkpointer for LangGraph state persistence."""
    
    def __init__(self, redis_client: redis.Redis, ttl: int = 3600):
        """Initialize Redis checkpointer.
        
        Args:
            redis_client: Async Redis client
            ttl: Time-to-live for checkpoints in seconds
        """
        self.redis_client = redis_client
        self.ttl = ttl
        self.checkpoint_prefix = "langgraph:checkpoint:"
        
    async def aput(self, config: Dict[str, Any], checkpoint: Dict[str, Any]) -> None:
        """Save checkpoint to Redis.
        
        Args:
            config: Configuration with thread_id
            checkpoint: State snapshot to save
        """
        thread_id = config.get("configurable", {}).get("thread_id")
        if not thread_id:
            logger.warning("No thread_id in config, skipping checkpoint")
            return
            
        key = f"{self.checkpoint_prefix}{thread_id}"
        
        # Serialize checkpoint (simplified - in production use pickle or msgpack)
        import json
        try:
            # Convert documents to serializable format
            serializable_checkpoint = self._make_serializable(checkpoint)
            value = json.dumps(serializable_checkpoint)
            await self.redis_client.setex(key, self.ttl, value)
            logger.debug(f"Saved checkpoint for thread {thread_id}")
        except Exception as e:
            logger.error(f"Failed to save checkpoint: {e}")
            
    async def aget(self, config: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Load checkpoint from Redis.
        
        Args:
            config: Configuration with thread_id
            
        Returns:
            Checkpoint state or None if not found
        """
        thread_id = config.get("configurable", {}).get("thread_id")
        if not thread_id:
            return None
            
        key = f"{self.checkpoint_prefix}{thread_id}"
        
        try:
            value = await self.redis_client.get(key)
            if value:
                import json
                checkpoint = json.loads(value)
                return self._deserialize_checkpoint(checkpoint)
            return None
        except Exception as e:
            logger.error(f"Failed to load checkpoint: {e}")
            return None
            
    def _make_serializable(self, checkpoint: Dict[str, Any]) -> Dict[str, Any]:
        """Convert checkpoint to JSON-serializable format."""
        serializable = {}
        for key, value in checkpoint.items():
            if key == "documents" and isinstance(value, list):
                # Convert document tuples to dicts
                serializable[key] = [
                    {
                        "page_content": doc.page_content if isinstance(doc, Document) else doc[0].page_content,
                        "metadata": doc.metadata if isinstance(doc, Document) else doc[0].metadata,
                        "score": score if isinstance(doc, tuple) else 1.0
                    }
                    for doc, score in (value if value and isinstance(value[0], tuple) else [(d, 1.0) for d in value])
                ]
            else:
                serializable[key] = value
        return serializable
        
    def _deserialize_checkpoint(self, checkpoint: Dict[str, Any]) -> Dict[str, Any]:
        """Convert checkpoint back from JSON format."""
        deserialized = {}
        for key, value in checkpoint.items():
            if key == "documents" and isinstance(value, list):
                # Convert dicts back to document tuples
                deserialized[key] = [
                    (Document(page_content=item["page_content"], metadata=item["metadata"]), item.get("score", 1.0))
                    for item in value
                ]
            else:
                deserialized[key] = value
        return deserialized


class StatefulRetrievalPipeline:
    """LangGraph-based stateful retrieval pipeline with iterative refinement."""
    
    def __init__(
        self,
        parallel_pipeline: ParallelRetrievalPipeline,
        query_optimizer: Optional[QueryOptimizer] = None,
        redis_client: Optional[redis.Redis] = None,
        max_iterations: Optional[int] = None,
        relevance_threshold: Optional[float] = None,
        enable_checkpointing: bool = True
    ):
        """Initialize stateful retrieval pipeline.
        
        Args:
            parallel_pipeline: Underlying parallel retrieval pipeline
            query_optimizer: Query optimizer for refinement
            redis_client: Redis client for checkpointing
            max_iterations: Maximum refinement iterations (default from settings)
            relevance_threshold: Minimum avg relevance to proceed (default from settings)
            enable_checkpointing: Whether to enable Redis checkpointing
        """
        self.parallel_pipeline = parallel_pipeline
        self.query_optimizer = query_optimizer or QueryOptimizer(llm=None)
        self.max_iterations = max_iterations or settings.max_retrieval_iterations
        self.relevance_threshold = relevance_threshold or settings.relevance_threshold
        self.enable_checkpointing = enable_checkpointing
        self.perf_monitor = get_performance_monitor()
        
        # Setup checkpointer
        if enable_checkpointing and redis_client:
            self.checkpointer = RedisCheckpointer(
                redis_client,
                ttl=settings.stateful_retrieval_session_ttl
            )
        else:
            self.checkpointer = MemorySaver()  # Fallback to in-memory
            
        # Build the workflow graph
        self.workflow = self._build_workflow()
        
    def _build_workflow(self) -> StateGraph:
        """Build the LangGraph workflow with nodes and edges."""
        workflow = StateGraph(RetrievalState)
        
        # Add nodes
        workflow.add_node("retrieve", self._retrieve_node)
        workflow.add_node("assess_quality", self._assess_quality_node)
        workflow.add_node("refine_query", self._refine_query_node)
        workflow.add_node("finalize", self._finalize_node)
        
        # Add edges
        workflow.add_edge("retrieve", "assess_quality")
        
        # Conditional edge from assess_quality
        workflow.add_conditional_edges(
            "assess_quality",
            self._should_refine,
            {
                "refine": "refine_query",
                "finalize": "finalize"
            }
        )
        
        # Loop back from refine to retrieve
        workflow.add_edge("refine_query", "retrieve")
        
        # Terminal edge
        workflow.add_edge("finalize", END)
        
        # Set entry point
        workflow.set_entry_point("retrieve")
        
        # Compile with checkpointer
        if self.enable_checkpointing and isinstance(self.checkpointer, RedisCheckpointer):
            # For custom checkpointers, we need to handle this differently
            # LangGraph 0.2.38 may not support custom async checkpointers directly
            # For now, compile without checkpointer and handle persistence manually
            compiled = workflow.compile()
        else:
            compiled = workflow.compile(checkpointer=self.checkpointer)
            
        return compiled
        
    async def _retrieve_node(self, state: RetrievalState) -> RetrievalState:
        """Retrieve documents using parallel pipeline.
        
        Args:
            state: Current retrieval state
            
        Returns:
            Updated state with retrieved documents
        """
        start_time = time.time()
        query = state["query"]
        iteration = state["iteration_count"]
        
        logger.info(f"Retrieval iteration {iteration + 1}: query='{query}'")
        
        try:
            # Call parallel retrieval pipeline
            documents = await self.parallel_pipeline.retrieve(
                query=query,
                k=settings.retrieval_k,
                merge_strategy="weighted"
            )
            
            state["documents"] = documents
            state["metadata"]["last_retrieval_time"] = time.time() - start_time
            
            # Extract relevance scores from document metadata
            relevance_scores = []
            for doc, score in documents:
                # Try to get relevance score from metadata, fallback to score
                relevance = doc.metadata.get("relevance_score", score)
                relevance_scores.append(float(relevance))
                
            state["relevance_scores"] = relevance_scores
            
            logger.info(f"Retrieved {len(documents)} documents in {state['metadata']['last_retrieval_time']:.2f}s")
            
            # Record metrics
            if self.perf_monitor:
                self.perf_monitor.record_latency(
                    "stateful_retrieval_node_latency_ms",
                    state["metadata"]["last_retrieval_time"] * 1000
                )
                
        except Exception as e:
            logger.error(f"Retrieval failed: {e}", exc_info=True)
            state["error"] = str(e)
            state["documents"] = []
            state["relevance_scores"] = []
            
        return state
        
    async def _assess_quality_node(self, state: RetrievalState) -> RetrievalState:
        """Assess retrieval quality based on relevance scores.
        
        Args:
            state: Current retrieval state
            
        Returns:
            Updated state with quality assessment
        """
        relevance_scores = state.get("relevance_scores", [])
        
        if not relevance_scores:
            state["metadata"]["avg_relevance"] = 0.0
            state["metadata"]["quality_assessment"] = "no_results"
            logger.warning("No relevance scores to assess")
            return state
            
        # Calculate average relevance
        avg_relevance = sum(relevance_scores) / len(relevance_scores)
        state["metadata"]["avg_relevance"] = avg_relevance
        
        # Determine quality
        if avg_relevance >= self.relevance_threshold:
            quality = "acceptable"
        elif state["iteration_count"] >= self.max_iterations - 1:
            quality = "max_iterations_reached"
        else:
            quality = "needs_refinement"
            
        state["metadata"]["quality_assessment"] = quality
        
        logger.info(
            f"Quality assessment: avg_relevance={avg_relevance:.3f}, "
            f"threshold={self.relevance_threshold:.3f}, "
            f"quality={quality}, iteration={state['iteration_count'] + 1}/{self.max_iterations}"
        )
        
        # Record metrics
        if self.perf_monitor:
            self.perf_monitor.record_latency("retrieval_avg_relevance", avg_relevance)
            
        return state
        
    async def _refine_query_node(self, state: RetrievalState) -> RetrievalState:
        """Refine query for better retrieval results.
        
        Args:
            state: Current retrieval state
            
        Returns:
            Updated state with refined query
        """
        iteration = state["iteration_count"]
        original_query = state["original_query"]
        current_query = state["query"]
        
        logger.info(f"Refining query (iteration {iteration + 1})")
        
        try:
            if iteration == 0:
                # First retry: Expand query with synonyms and context
                refined_query = self.query_optimizer.expand_query_for_retry(original_query)
                strategy = "expansion"
            else:
                # Second retry: Simplify to core terms
                refined_query = self.query_optimizer.simplify_query_for_retry(original_query)
                strategy = "simplification"
                
            state["query"] = refined_query
            state["iteration_count"] = iteration + 1
            state["metadata"]["refinement_strategy"] = strategy
            state["metadata"]["previous_queries"] = state["metadata"].get("previous_queries", []) + [current_query]
            
            logger.info(f"Refined query using {strategy}: '{refined_query}'")
            
            # Record metrics
            if self.perf_monitor:
                self.perf_monitor.increment_counter("retrieval_refinements_total")
                
        except Exception as e:
            logger.error(f"Query refinement failed: {e}", exc_info=True)
            # Keep original query on failure
            state["iteration_count"] = iteration + 1
            
        return state
        
    async def _finalize_node(self, state: RetrievalState) -> RetrievalState:
        """Finalize retrieval results.
        
        Args:
            state: Current retrieval state
            
        Returns:
            Finalized state
        """
        state["finalized"] = True
        
        total_iterations = state["iteration_count"] + 1
        avg_relevance = state["metadata"].get("avg_relevance", 0.0)
        
        logger.info(
            f"Finalized retrieval: {len(state['documents'])} documents, "
            f"avg_relevance={avg_relevance:.3f}, iterations={total_iterations}"
        )
        
        # Record final metrics
        if self.perf_monitor:
            self.perf_monitor.record_latency("retrieval_iterations_count", total_iterations)
            if total_iterations > 1:
                self.perf_monitor.increment_counter("retrieval_cycles_triggered_total")
                
        return state
        
    def _should_refine(self, state: RetrievalState) -> str:
        """Decide whether to refine query or finalize.
        
        Args:
            state: Current retrieval state
            
        Returns:
            "refine" to continue refinement, "finalize" to end
        """
        # Check for errors
        if state.get("error"):
            logger.warning(f"Error detected, skipping refinement: {state['error']}")
            return "finalize"
            
        # Check quality assessment
        quality = state["metadata"].get("quality_assessment", "unknown")
        
        if quality == "needs_refinement":
            return "refine"
        else:
            return "finalize"
            
    async def retrieve(
        self,
        query: str,
        k: int = 5,
        session_id: Optional[str] = None,
        merge_strategy: str = "weighted"
    ) -> List[Tuple[Document, float]]:
        """Execute stateful retrieval with iterative refinement.
        
        Args:
            query: Search query
            k: Number of documents to return
            session_id: Session ID for persistence (optional)
            merge_strategy: Strategy for merging results (passed to parallel pipeline)
            
        Returns:
            List of (document, score) tuples
        """
        start_time = time.time()
        
        # Create thread ID for this retrieval session
        if session_id:
            # Use session + query hash for thread ID
            query_hash = hashlib.md5(query.encode()).hexdigest()[:8]
            thread_id = f"{session_id}:{query_hash}"
        else:
            # Use just query hash
            thread_id = hashlib.md5(query.encode()).hexdigest()
            
        config = {"configurable": {"thread_id": thread_id}}
        
        # Initialize state
        initial_state: RetrievalState = {
            "query": query,
            "original_query": query,
            "documents": [],
            "relevance_scores": [],
            "iteration_count": 0,
            "metadata": {
                "start_time": start_time,
                "k": k,
                "merge_strategy": merge_strategy
            },
            "error": None,
            "finalized": False
        }
        
        # Manual checkpoint save for custom Redis checkpointer
        if isinstance(self.checkpointer, RedisCheckpointer):
            await self.checkpointer.aput(config, initial_state)
        
        try:
            # Execute workflow
            logger.info(f"Starting stateful retrieval for query: '{query}' (thread_id={thread_id})")
            
            result = await self.workflow.ainvoke(initial_state, config)
            
            # Manual checkpoint save for final state
            if isinstance(self.checkpointer, RedisCheckpointer):
                await self.checkpointer.aput(config, result)
            
            # Extract documents from final state
            documents = result.get("documents", [])
            
            # Record total latency
            total_latency = time.time() - start_time
            if self.perf_monitor:
                self.perf_monitor.record_latency("stateful_retrieval_total_latency_ms", total_latency * 1000)
                
            logger.info(
                f"Stateful retrieval completed in {total_latency:.2f}s: "
                f"{len(documents)} documents, {result['iteration_count'] + 1} iterations"
            )
            
            return documents[:k]  # Return top-k results
            
        except Exception as e:
            logger.error(f"Stateful retrieval failed: {e}", exc_info=True)
            
            # Fallback to direct parallel pipeline
            logger.info("Falling back to parallel pipeline")
            return await self.parallel_pipeline.retrieve(query, k, merge_strategy)

