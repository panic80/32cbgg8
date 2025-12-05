"""Enhanced retrieval pipeline using LangGraph for orchestrated workflows."""
import asyncio
import hashlib
import json
import time
from typing import Any, Dict, List, Optional, Tuple, Union, TypedDict
from enum import Enum

from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from langgraph.graph import StateGraph, END

from app.core.logging import get_logger
from app.core.config import settings

# Timeout constants
RETRIEVAL_TIMEOUT = 30.0  # seconds for vector search operations
LLM_TIMEOUT = 60.0  # seconds for LLM calls
from app.services.cache import CacheService
from app.components.ensemble_retriever import WeightedEnsembleRetriever
from app.components.contextual_compressor import TravelContextualCompressor
from app.components.reranker import CrossEncoderReranker, CohereReranker, LLMReranker
from app.components.result_processor import ResultProcessor
from app.components.table_query_rewriter import TableQueryRewriter
from app.components.table_ranker import TableRanker
from app.services.llm_pool import LLMPool
from app.models.query import Provider


class QueryType(str, Enum):
    """Types of queries for routing."""
    SIMPLE = "simple"
    TABLE = "table"
    COMPLEX = "complex"
    MULTI_HOP = "multi_hop"
    COMPARISON = "comparison"


class RetrievalState(TypedDict):
    """State for the retrieval workflow."""
    query: str
    query_type: Optional[str]  # Store as string value, not enum
    expanded_queries: List[str]
    retrieved_documents: List[Document]
    compressed_documents: List[Document]
    reranked_documents: List[Document]
    synthesized_answer: Optional[str]
    sources: List[Dict[str, Any]]
    conversation_history: List[Dict[str, str]]
    error: Optional[str]
    metadata: Dict[str, Any]


class EnhancedRetrievalPipeline:
    """Advanced retrieval pipeline with LangGraph orchestration."""

    def __init__(
        self,
        retriever: WeightedEnsembleRetriever,
        compressor: TravelContextualCompressor,
        reranker: Union[CrossEncoderReranker, CohereReranker, LLMReranker],
        processor: ResultProcessor,
        table_rewriter: TableQueryRewriter,
        cache_service: Optional[CacheService] = None,
        llm_pool: Optional[LLMPool] = None,
        fallback_keywords: Optional[str] = None,
    ):
        self.retriever = retriever
        self.compressor = compressor
        self.reranker = reranker
        self.processor = processor
        self.table_rewriter = table_rewriter
        self.table_ranker = TableRanker()  # Initialize table ranker
        self.cache_service = cache_service
        self.llm_pool = llm_pool or LLMPool()
        self.fallback_keywords = fallback_keywords or ""
        self.logger = get_logger(__name__)
        
        # Build the workflow graph
        self.workflow = self._build_workflow()
        
        # Query classifier
        self.query_classifier = self._create_query_classifier()
        
        # Query expander for multi-hop queries
        self.query_expander = self._create_query_expander()
        
        # Answer synthesizer
        self.answer_synthesizer = self._create_answer_synthesizer()

    async def _invoke_json_prompt(
        self,
        prompt: ChatPromptTemplate,
        llm: Any,
        timeout: float = LLM_TIMEOUT,
        **inputs: Any
    ) -> Dict[str, Any]:
        """Execute a prompt expecting JSON output using the retryable LLM."""
        parser = JsonOutputParser()
        messages = prompt.format_messages(**inputs)
        try:
            response = await asyncio.wait_for(
                llm.ainvoke(messages),
                timeout=timeout
            )
        except asyncio.TimeoutError:
            self.logger.error(f"LLM call timed out after {timeout}s")
            raise
        content = self._extract_text_content(response)
        return parser.parse(content)

    @staticmethod
    def _extract_text_content(response: Any) -> str:
        """Normalize LangChain/LLM responses into a plain string."""
        if response is None:
            return ""

        content = getattr(response, "content", response)

        if isinstance(content, str):
            return content

        if isinstance(content, list):
            parts: List[str] = []
            for block in content:
                if isinstance(block, str):
                    parts.append(block)
                elif isinstance(block, dict):
                    text_value = block.get("text") or block.get("content")
                    if isinstance(text_value, str):
                        parts.append(text_value)
                    elif text_value is not None:
                        parts.append(json.dumps(text_value))
                else:
                    text_attr = getattr(block, "text", None)
                    if isinstance(text_attr, str):
                        parts.append(text_attr)
                    else:
                        parts.append(str(block))
            return "".join(parts)

        text_attr = getattr(content, "text", None)
        if isinstance(text_attr, str):
            return text_attr

        return str(content)

    @staticmethod
    def _serialize_document(doc: Document) -> Dict[str, Any]:
        """Convert a LangChain document into a JSON-serializable dict."""
        serialized_metadata: Dict[str, Any] = {}
        for key, value in (doc.metadata or {}).items():
            try:
                json.dumps(value)
                serialized_metadata[key] = value
            except (TypeError, ValueError):
                serialized_metadata[key] = str(value)

        return {
            "page_content": doc.page_content,
            "metadata": serialized_metadata
        }

    @classmethod
    def _serialize_documents(cls, docs: List[Document]) -> List[Dict[str, Any]]:
        """Serialize a list of documents for caching."""
        return [cls._serialize_document(doc) for doc in docs]

    @staticmethod
    def _deserialize_documents(data: List[Dict[str, Any]]) -> List[Document]:
        """Rehydrate cached document payloads back into LangChain documents."""
        documents: List[Document] = []
        for item in data or []:
            documents.append(
                Document(
                    page_content=item.get("page_content", ""),
                    metadata=item.get("metadata", {}) or {}
                )
            )
        return documents

    @staticmethod
    def _get_doc_id(doc: Document) -> str:
        """Generate a unique document ID for deduplication.

        Prefers existing IDs from metadata, falls back to content hash.
        """
        # Prefer existing ID if available
        if doc.metadata.get("id"):
            return str(doc.metadata["id"])
        if doc.metadata.get("doc_id"):
            return str(doc.metadata["doc_id"])
        if doc.metadata.get("chunk_id"):
            return str(doc.metadata["chunk_id"])
        # Fall back to content hash for reliable deduplication
        content_hash = hashlib.sha256(doc.page_content.encode()).hexdigest()[:16]
        source = doc.metadata.get("source", "unknown")
        return f"{source}:{content_hash}"

    def _build_workflow(self) -> StateGraph:
        """Build the LangGraph workflow."""
        workflow = StateGraph(RetrievalState)
        
        # Add nodes
        workflow.add_node("understand_query", self._understand_query)
        workflow.add_node("expand_query", self._expand_query)
        workflow.add_node("retrieve_documents", self._retrieve_documents)
        workflow.add_node("compress_documents", self._compress_documents)
        workflow.add_node("rerank_documents", self._rerank_documents)
        workflow.add_node("synthesize_answer", self._synthesize_answer)
        workflow.add_node("fallback_retrieval", self._fallback_retrieval)
        workflow.add_node("handle_error", self._handle_error)
        
        # Add edges with conditional routing
        workflow.add_conditional_edges(
            "understand_query",
            self._route_by_query_type,
            {
                "expand_query": "expand_query",
                "retrieve_documents": "retrieve_documents"
            }
        )
        workflow.add_edge("expand_query", "retrieve_documents")
        workflow.add_conditional_edges(
            "retrieve_documents",
            self._check_retrieval_quality,
            {
                "handle_error": "handle_error",
                "fallback_retrieval": "fallback_retrieval",
                "compress_documents": "compress_documents"
            }
        )
        workflow.add_edge("compress_documents", "rerank_documents")
        workflow.add_edge("rerank_documents", "synthesize_answer")
        workflow.add_edge("fallback_retrieval", "compress_documents")
        workflow.add_edge("synthesize_answer", END)
        workflow.add_edge("handle_error", END)
        
        # Set entry point
        workflow.set_entry_point("understand_query")
        
        return workflow.compile()
    
    def _create_query_classifier(self) -> ChatPromptTemplate:
        """Create query classification prompt."""
        return ChatPromptTemplate.from_messages([
            ("system", """Classify the user query into one of these types:
            - simple: Basic factual questions
            - table: Questions about rates, allowances, or tabular data
            - complex: Questions requiring multiple sources
            - multi_hop: Questions requiring reasoning across documents
            - comparison: Questions comparing different scenarios
            
            IMPORTANT: If a complex query mentions rates, allowances, costs, or pricing (even within a larger request like trip planning), it should ALSO be marked as needing table data.
            
            For complex queries that also need table data, return:
            {{"type": "<primary_type>", "needs_table_data": true, "reasoning": "<brief explanation>"}}
            
            Otherwise return:
            {{"type": "<type>", "reasoning": "<brief explanation>"}}"""),
            ("human", "{query}")
        ])
    
    def _create_query_expander(self) -> ChatPromptTemplate:
        """Create query expansion prompt."""
        return ChatPromptTemplate.from_messages([
            ("system", """Break down this complex query into simpler sub-queries.
            Each sub-query should target specific information needed.
            
            CRITICAL RULES:
            1. Preserve ALL mentions of rates, costs, allowances, or dollar amounts as separate sub-queries
            2. If the query mentions trip planning or cost estimation, ALWAYS include these sub-queries:
               - "meal allowances and rates"
               - "kilometric rates"
               - "incidental allowances"
            3. Keep specific keywords like "meal", "rate", "allowance", "cost" in your sub-queries
            4. Create focused sub-queries that will retrieve specific tables and values
            
            Example: "I'm planning a 4-day trip from Toronto to Ottawa with R&Q, what are my costs?"
            Should expand to include:
            - "Toronto to Ottawa travel distance and time"
            - "meal allowances and rates"
            - "kilometric rates for personal vehicle"
            - "incidental allowances daily rates"
            - "R&Q impact on meal allowances"
            
            Return JSON: {"sub_queries": ["query1", "query2", ...]}"""),
            ("human", "Query: {query}\nType: {query_type}")
        ])
    
    def _create_answer_synthesizer(self) -> ChatPromptTemplate:
        """Create answer synthesis prompt."""
        return ChatPromptTemplate.from_messages([
            ("system", """Synthesize a comprehensive answer from the retrieved documents.
            Be precise. When references are needed, use proper document titles and sections.

            Context documents:
            {context}"""),
            ("human", "Query: {query}")
        ])
    
    async def _understand_query(self, state: RetrievalState) -> RetrievalState:
        """Understand and classify the query."""
        try:
            self.logger.debug(f"Starting query classification for: {state['query']}")
            
            async with self.llm_pool.acquire(Provider.OPENAI, "gpt-4o-mini") as llm:
                # Log the prompt template
                self.logger.debug(f"Query classifier prompt template: {self.query_classifier}")

                try:
                    # Log what we're passing to the chain
                    invoke_params = {"query": state["query"]}
                    self.logger.debug(f"Invoking chain with params: {invoke_params}")

                    result = await self._invoke_json_prompt(
                        self.query_classifier,
                        llm,
                        **invoke_params
                    )
                except Exception as chain_error:
                    self.logger.error(f"Chain invocation error: {chain_error}", exc_info=True)
                    raise

                self.logger.debug(f"Classification result: {result}")
                
                # result["type"] is already a string like "simple", just validate it's a valid enum value
                query_type_str = result.get("type", "simple")
                # Validate it's a valid QueryType
                if query_type_str in [qt.value for qt in QueryType]:
                    state["query_type"] = query_type_str
                else:
                    state["query_type"] = QueryType.SIMPLE.value
                    
                state["metadata"]["classification"] = result
                
                # Check if this query also needs table data
                if result.get("needs_table_data", False):
                    state["metadata"]["needs_table_data"] = True
                    self.logger.info(f"Query classified as: {state['query_type']} (also needs table data)")
                else:
                    self.logger.info(f"Query classified as: {state['query_type']}")
            
        except Exception as e:
            self.logger.error(f"Query classification failed: {e}", exc_info=True)
            state["query_type"] = QueryType.SIMPLE.value
            
        return state
    
    async def _expand_query(self, state: RetrievalState) -> RetrievalState:
        """Expand complex queries into sub-queries."""
        try:
            if state["query_type"] in [QueryType.MULTI_HOP.value, QueryType.COMPLEX.value]:
                self.logger.debug(f"Expanding query. Type: {state['query_type']}")
                
                async with self.llm_pool.acquire(Provider.OPENAI, "gpt-4o-mini") as llm:
                    invoke_params = {
                        "query": state["query"],
                        "query_type": state["query_type"]
                    }
                    self.logger.debug(f"Expanding with params: {invoke_params}")

                    try:
                        result = await self._invoke_json_prompt(
                            self.query_expander,
                            llm,
                            **invoke_params
                        )
                    except Exception as chain_error:
                        self.logger.error(f"Expansion chain error: {chain_error}", exc_info=True)
                        raise

                    state["expanded_queries"] = result.get("sub_queries", [state["query"]])
                    self.logger.info(f"Expanded query into {len(state['expanded_queries'])} sub-queries")
            else:
                state["expanded_queries"] = [state["query"]]
                
        except Exception as e:
            self.logger.error(f"Query expansion failed: {e}", exc_info=True)
            state["expanded_queries"] = [state["query"]]
            
        return state
    
    async def _retrieve_documents(self, state: RetrievalState) -> RetrievalState:
        """Retrieve documents for all queries."""
        try:
            all_docs = []
            value_patterns = []

            # Handle table queries specially (including complex queries that need table data)
            if state["query_type"] == QueryType.TABLE.value or state["metadata"].get("needs_table_data", False):
                rewritten_result = await self.table_rewriter.arewrite_query(state["query"])
                rewritten_query = rewritten_result.get("rewritten_query", state["query"])
                value_patterns = rewritten_result.get("value_patterns", [])

                if rewritten_query != state["query"]:
                    state["expanded_queries"].append(rewritten_query)

                # For complex queries needing table data, also add specific rate lookups
                if state["metadata"].get("needs_table_data", False) and state["query_type"] != QueryType.TABLE.value:
                    # Add specific sub-queries for rates
                    state["expanded_queries"].extend([
                        "meal allowances breakfast lunch dinner rates",
                        "kilometric rates per km",
                        "incidental allowances daily rates"
                    ])

                # Store value patterns in metadata for later use
                state["metadata"]["value_patterns"] = value_patterns
                state["metadata"]["table_keywords"] = rewritten_result.get("table_keywords", [])

            # Ensure we always have at least the original query to search with
            if not state["expanded_queries"]:
                state["expanded_queries"] = [state["query"]]

            # Retrieve documents in parallel for all expanded queries
            async def fetch_docs_for_query(query: str) -> List[Document]:
                """Fetch documents for a single query, checking cache first."""
                # Check cache first
                if self.cache_service:
                    cached = await self.cache_service.get(f"retrieval:{query}")
                    if cached:
                        return self._deserialize_documents(cached)

                # Retrieve documents using the public async API with timeout
                try:
                    docs = await asyncio.wait_for(
                        self.retriever.aget_relevant_documents(query),
                        timeout=RETRIEVAL_TIMEOUT
                    )
                except asyncio.TimeoutError:
                    self.logger.warning(f"Retrieval timeout for query: {query[:50]}...")
                    return []

                # Cache results
                if self.cache_service and docs:
                    await self.cache_service.set(
                        f"retrieval:{query}",
                        self._serialize_documents(docs),
                        ttl=300
                    )
                return docs

            # Execute all queries in parallel
            results = await asyncio.gather(
                *[fetch_docs_for_query(q) for q in state["expanded_queries"]],
                return_exceptions=True
            )

            # Collect results, logging any errors
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    self.logger.warning(f"Query '{state['expanded_queries'][i][:50]}...' failed: {result}")
                elif isinstance(result, list):
                    all_docs.extend(result)
            
            # Deduplicate using proper document IDs
            seen = set()
            unique_docs = []
            for doc in all_docs:
                doc_id = self._get_doc_id(doc)
                if doc_id not in seen:
                    seen.add(doc_id)
                    unique_docs.append(doc)
            
            # Apply table ranking for table queries
            if state["query_type"] == QueryType.TABLE.value and unique_docs:
                unique_docs = self.table_ranker.filter_and_rerank(
                    unique_docs,
                    state["query"],
                    top_k=30,  # Keep more documents for table queries
                    query_type=state["query_type"],
                    value_patterns=value_patterns
                )
                self.logger.info(f"Table ranker applied, kept top {len(unique_docs)} documents")
            
            state["retrieved_documents"] = unique_docs
            self.logger.info(f"Retrieved {len(unique_docs)} unique documents")
            
        except Exception as e:
            self.logger.error(f"Document retrieval failed: {e}")
            state["error"] = str(e)
            
        return state
    
    async def _compress_documents(self, state: RetrievalState) -> RetrievalState:
        """Compress documents to relevant passages."""
        try:
            # Use the compressor's retrieve method which handles compression
            compressed = await self.compressor.retrieve(
                state["query"],
                k=len(state["retrieved_documents"])
            )
            
            state["compressed_documents"] = compressed
            self.logger.info(f"Compressed to {len(compressed)} documents")
            
        except Exception as e:
            self.logger.error(f"Document compression failed: {e}")
            state["compressed_documents"] = state["retrieved_documents"]
            
        return state
    
    async def _rerank_documents(self, state: RetrievalState) -> RetrievalState:
        """Rerank documents for relevance."""
        try:
            # For table queries or complex queries needing table data, apply table-specific reranking first
            if state["query_type"] == QueryType.TABLE.value or state["metadata"].get("needs_table_data", False):
                # Apply table ranker with value patterns
                value_patterns = state["metadata"].get("value_patterns", [])
                table_ranked = self.table_ranker.filter_and_rerank(
                    state["compressed_documents"],
                    state["query"],
                    top_k=15,  # Pre-filter before main reranking
                    query_type=state["query_type"],
                    value_patterns=value_patterns
                )
                
                # Then apply main reranker on table-ranked results
                reranked = await self.reranker.arerank(
                    state["query"],
                    table_ranked
                )
            else:
                # Standard reranking for non-table queries
                reranked = await self.reranker.arerank(
                    state["query"],
                    state["compressed_documents"]
                )
            
            # Keep top documents based on query type
            max_docs = {
                QueryType.SIMPLE.value: 5,
                QueryType.TABLE.value: 8,
                QueryType.COMPLEX.value: 10,
                QueryType.MULTI_HOP.value: 12,
                QueryType.COMPARISON.value: 10
            }
            
            limit = max_docs.get(state["query_type"], 5)
            state["reranked_documents"] = reranked[:limit]
            
            self.logger.info(f"Reranked to top {len(state['reranked_documents'])} documents")
            
        except Exception as e:
            self.logger.error(f"Document reranking failed: {e}")
            state["reranked_documents"] = state["compressed_documents"][:5]
            
        return state
    
    async def _synthesize_answer(self, state: RetrievalState) -> RetrievalState:
        """Synthesize final answer from documents."""
        try:
            self.logger.debug(f"Starting answer synthesis. Query type: {state.get('query_type', 'unknown')}")
            
            # Format context without source labels
            context = "\n\n".join([
                doc.page_content
                for doc in state["reranked_documents"]
            ])
            
            self.logger.debug(f"Context length: {len(context)} chars, Documents: {len(state['reranked_documents'])}")
            
            # Get appropriate LLM based on query complexity
            model = "gpt-4o" if state.get("query_type") in [QueryType.COMPLEX.value, QueryType.MULTI_HOP.value] else "gpt-4o-mini"
            self.logger.debug(f"Using model: {model}")
            
            async with self.llm_pool.acquire(Provider.OPENAI, model) as llm:
                try:
                    messages = self.answer_synthesizer.format_messages(
                        context=context,
                        query=state["query"]
                    )
                    response = await asyncio.wait_for(
                        llm.ainvoke(messages),
                        timeout=LLM_TIMEOUT
                    )
                except asyncio.TimeoutError:
                    self.logger.error(f"Answer synthesis LLM call timed out after {LLM_TIMEOUT}s")
                    raise
                except Exception as chain_error:
                    self.logger.error(f"Synthesis chain error: {chain_error}", exc_info=True)
                    raise

                state["synthesized_answer"] = self._extract_text_content(response)
            
            # Extract sources
            state["sources"] = [
                {
                    "source": doc.metadata.get("source", "Unknown"),
                    "title": doc.metadata.get("title", ""),
                    "page": doc.metadata.get("page", 0),
                    "relevance_score": doc.metadata.get("relevance_score", 0.0),
                    "page_content": doc.page_content  # Include content for debugging
                }
                for doc in state["reranked_documents"]
            ]
            
            self.logger.info("Answer synthesized successfully")
            
        except Exception as e:
            self.logger.error(f"Answer synthesis failed: {e}", exc_info=True)
            state["error"] = str(e)
            
        return state
    
    async def _fallback_retrieval(self, state: RetrievalState) -> RetrievalState:
        """Fallback retrieval strategy for poor results."""
        try:
            self.logger.info("Attempting fallback retrieval")

            # Check if retriever exists
            if not self.retriever:
                self.logger.error("No retriever available for fallback")
                state["retrieved_documents"] = []
                return state

            # Try broader search with configurable keywords
            broader_query = f"{state['query']} {self.fallback_keywords}".strip()
            try:
                docs = await asyncio.wait_for(
                    self.retriever.aget_relevant_documents(broader_query),
                    timeout=RETRIEVAL_TIMEOUT
                )
            except asyncio.TimeoutError:
                self.logger.warning(f"Fallback retrieval timed out for query: {broader_query[:50]}...")
                docs = []
            
            # Combine with original results
            all_docs = state["retrieved_documents"] + docs
            
            # Deduplicate using proper document IDs
            seen = set()
            unique_docs = []
            for doc in all_docs:
                doc_id = self._get_doc_id(doc)
                if doc_id not in seen:
                    seen.add(doc_id)
                    unique_docs.append(doc)
            
            state["retrieved_documents"] = unique_docs
            self.logger.info(f"Fallback retrieval added {len(docs)} documents")
            
        except Exception as e:
            self.logger.error(f"Fallback retrieval failed: {e}")
            
        return state
    
    async def _handle_error(self, state: RetrievalState) -> RetrievalState:
        """Handle errors gracefully."""
        self.logger.error(f"Workflow error: {state['error']}")
        
        if not state["synthesized_answer"]:
            state["synthesized_answer"] = (
                "I apologize, but I encountered an error while processing your query. "
                "Please try rephrasing your question or contact support if the issue persists."
            )
        
        return state
    
    def _route_by_query_type(self, state: RetrievalState) -> str:
        """Route based on query type."""
        # state["query_type"] is already a string like "multi_hop" or "complex"
        if state["query_type"] in [QueryType.MULTI_HOP.value, QueryType.COMPLEX.value]:
            return "expand_query"
        return "retrieve_documents"
    
    def _check_retrieval_quality(self, state: RetrievalState) -> str:
        """Check retrieval quality and route accordingly."""
        if state.get("error"):
            return "handle_error"
        
        if not state["retrieved_documents"]:
            return "fallback_retrieval"
        
        # Check quality threshold
        min_docs = {
            QueryType.SIMPLE.value: 1,
            QueryType.TABLE.value: 2,
            QueryType.COMPLEX.value: 3,
            QueryType.MULTI_HOP.value: 5,
            QueryType.COMPARISON.value: 4
        }
        
        required = min_docs.get(state["query_type"], 2)
        if len(state["retrieved_documents"]) < required:
            return "fallback_retrieval"
        
        return "compress_documents"
    
    async def retrieve(
        self, 
        query: str,
        conversation_history: Optional[List[Dict[str, str]]] = None
    ) -> Dict[str, Any]:
        """Execute the enhanced retrieval workflow."""
        start_time = time.time()
        
        # Initialize state
        initial_state = RetrievalState(
            query=query,
            query_type=None,
            expanded_queries=[],
            retrieved_documents=[],
            compressed_documents=[],
            reranked_documents=[],
            synthesized_answer=None,
            sources=[],
            conversation_history=conversation_history or [],
            error=None,
            metadata={}
        )
        
        try:
            # Run workflow
            final_state = await self.workflow.ainvoke(initial_state)
            
            # Process results
            result = {
                "answer": final_state["synthesized_answer"],
                "sources": final_state["sources"],
                "query_type": final_state["query_type"] if final_state["query_type"] else "unknown",
                "metadata": {
                    **final_state["metadata"],
                    "retrieval_time": time.time() - start_time,
                    "num_documents": len(final_state["reranked_documents"]),
                    "expanded_queries": final_state["expanded_queries"]
                }
            }
            
            return result
            
        except Exception as e:
            self.logger.error(f"Enhanced retrieval failed: {e}", exc_info=True)
            return {
                "answer": "I apologize, but I couldn't process your query. Please try again.",
                "sources": [],
                "error": str(e),
                "metadata": {
                    "retrieval_time": time.time() - start_time,
                    "error_type": type(e).__name__
                }
            }
