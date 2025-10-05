"""Chat API endpoints with RAG support."""

import asyncio
import hashlib
import time
from fastapi import APIRouter, Request, HTTPException
from typing import Dict, Any, Optional
from datetime import datetime
import uuid

from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage

from app.core.config import settings
from app.core.logging import get_logger
from app.models.query import (
    ChatRequest, ChatResponse, FollowUpRequest,
    FollowUpResponse, FollowUpQuestion, Provider, Source
)
from app.pipelines.parallel_retrieval import ParallelRetrievalPipeline, create_parallel_pipeline
from app.pipelines.query_optimizer import QueryOptimizer
from app.services.cache import QueryCache
from app.services.advanced_cache import AdvancedCacheService, create_context_hash
from app.services.performance_monitor import get_performance_monitor
from app.utils.langchain_utils import RetryableLLM, handle_llm_error
from app.utils.metrics import compute_quality_metrics
from app.api.streaming import create_streaming_response
from app.api.prompt_constants import SHORT_ANSWER_PROMPT
from app.components.result_processor import ResultProcessor
# Removed unused imports - now using ParallelRetrievalPipeline which includes these internally
from app.services.llm_pool import LLMPool
from app.services.query_logger import get_query_logger
from app.models.query_history import QueryStatus

logger = get_logger(__name__)

router = APIRouter()


def get_llm(provider: Provider, model: Optional[str] = None):
    """Get LLM instance based on provider."""
    # Handle both enum and string inputs
    if isinstance(provider, str):
        provider = Provider(provider)
    
    if provider == Provider.OPENAI:
        if not settings.openai_api_key:
            raise ValueError("OpenAI API key not configured")
        
        # Check if it's an O-series reasoning model
        model_name = model or settings.openai_chat_model
        is_o_series = (model_name and (
            model_name.startswith('o3') or 
            model_name.startswith('o4') or
            model_name == 'o1' or
            model_name == 'o1-mini'
        ))
        
        # Check if GPT-5 Mini/Nano or GPT-4.1 Mini (doesn't support temperature)
        is_gpt5_mini = (model_name and model_name.strip().lower() == 'gpt-5-mini')
        is_gpt5_nano = (model_name and model_name.strip().lower() == 'gpt-5-nano')
        is_gpt41_mini = (model_name and model_name.strip().lower() == 'gpt-4.1-mini')
        
        # Debug logging
        logger.info(f"Model check - model_name: '{model_name}', is_o_series: {is_o_series}, is_gpt5_mini: {is_gpt5_mini}, is_gpt5_nano: {is_gpt5_nano}, is_gpt41_mini: {is_gpt41_mini}")
        
        # O-series models, GPT-5 Mini/Nano, and GPT-4.1 Mini don't support temperature parameter
        try:
            if is_o_series or is_gpt5_mini or is_gpt5_nano or is_gpt41_mini:
                logger.info(f"Using {model_name}, temperature parameter disabled")
                llm = ChatOpenAI(
                    api_key=settings.openai_api_key,
                    model=model_name,
                    max_tokens=8192  # O-series and GPT-5 Mini models require max_tokens
                )
            else:
                logger.info(f"Creating OpenAI LLM for model: {model_name}")
                llm = ChatOpenAI(
                    api_key=settings.openai_api_key,
                    model=model_name,
                    temperature=0.7
                )
            logger.info(f"Successfully created OpenAI LLM for model: {model_name}")
            return RetryableLLM(llm)
        except Exception as e:
            logger.error(f"Failed to create OpenAI LLM: {type(e).__name__}: {str(e)}")
            raise
        
    elif provider == Provider.GOOGLE:
        if not settings.google_api_key:
            raise ValueError("Google API key not configured")
        llm = ChatGoogleGenerativeAI(
            google_api_key=settings.google_api_key,
            model=model or settings.google_chat_model,
            temperature=0.7
        )
        return RetryableLLM(llm)
        
    elif provider == Provider.ANTHROPIC:
        if not settings.anthropic_api_key:
            raise ValueError("Anthropic API key not configured")
        
        # Check if this is Claude Sonnet 4 and enable thinking mode
        model_name = model or settings.anthropic_chat_model
        extra_kwargs = {}
        
        if model_name == "claude-sonnet-4-20250514":
            # Enable extended thinking for Claude Sonnet 4
            # Note: thinking parameter is not directly supported by langchain-anthropic yet
            # We'll need to use the beta API directly or wait for langchain support
            logger.info(f"Claude Sonnet 4 detected - thinking mode requires direct API usage")
            # For now, use standard settings
            temperature = 1.0
        else:
            temperature = 0.7
        
        llm = ChatAnthropic(
            api_key=settings.anthropic_api_key,
            model=model_name,
            temperature=temperature
        )
        return RetryableLLM(llm)
        
    else:
        raise ValueError(f"Unsupported provider: {provider}")


@router.post("/chat", response_model=ChatResponse)
async def chat(request: Request, chat_request: ChatRequest) -> ChatResponse:
    """Chat endpoint with RAG support."""
    start_time = datetime.utcnow()
    perf_monitor = get_performance_monitor()

    # Record request
    perf_monitor.increment_counter("total_requests")
    request_timer = time.perf_counter()
    search_time_ms: Optional[float] = None
    context_time_ms: Optional[float] = None
    answer_time_ms: Optional[float] = None
    retrieval_results = []

    try:
        # Get services from app state
        app = request.app
        vector_store = app.state.vector_store_manager
        document_store = app.state.document_store
        cache_service = getattr(app.state, "cache_service", None)
        source_repository = getattr(app.state, "source_repository", None)
        
        # Initialize advanced cache if available
        advanced_cache = None
        if cache_service:
            advanced_cache = AdvancedCacheService(cache_service)
        
        # Initialize components using asyncio.to_thread for blocking operations
        logger.info("Creating LLM...")
        llm = await asyncio.to_thread(get_llm, chat_request.provider, chat_request.model)
        logger.info(f"LLM created: {type(llm)}")

        resolved_model_name = getattr(getattr(llm, 'llm', llm), 'model_name', chat_request.model or '')
        is_smart_gpt5 = (resolved_model_name or '').strip().lower() == 'gpt-5-mini'

        # Initialize query optimizer (skip LLM-powered classification for Smart mode)
        optimizer_llm = None if is_smart_gpt5 else llm
        query_optimizer = QueryOptimizer(optimizer_llm)
        
        # Initialize result processor
        result_processor = ResultProcessor()
        
        # Only create retrieval pipeline if RAG is enabled
        retrieval_pipeline = None
        if chat_request.use_rag:
            # Check L3 cache first (full response cache)
            cached_response = None
            if advanced_cache:
                # Create a simple context hash for cache key (will be updated after retrieval)
                context_hash = hashlib.md5(f"{chat_request.message}:{chat_request.provider}".encode()).hexdigest()
                cached_response = await advanced_cache.get_response(
                    query=chat_request.message,
                    context_hash=context_hash,
                    model=chat_request.model or "default"
                )
                
            if cached_response:
                cache_latency_ms = (time.perf_counter() - request_timer) * 1000
                perf_monitor.record_latency("total_request_latency_ms", cache_latency_ms)
                perf_monitor.record_latency("answer_generation_latency_ms", cache_latency_ms)
                perf_monitor.record_latency("llm_latency_ms", cache_latency_ms)
                perf_monitor.record_latency("search_latency_ms", 0)
                perf_monitor.record_latency("context_build_latency_ms", 0)

                if isinstance(cached_response, ChatResponse):
                    cached_model = cached_response
                elif isinstance(cached_response, dict):
                    cached_model = ChatResponse(**cached_response)
                else:
                    dump_method = getattr(cached_response, "model_dump", None)
                    if callable(dump_method):
                        cached_model = ChatResponse(**dump_method())
                    else:
                        cached_model = ChatResponse(**cached_response.dict())

                cached_model.processing_time = cache_latency_ms / 1000
                perf_monitor.increment_counter("successful_requests")
                perf_monitor.record_cache_hit("l3", True)
                quality_metrics = compute_quality_metrics(
                    cached_model.response,
                    cached_model.sources or [],
                    None,
                )
                for key, value in quality_metrics.items():
                    perf_monitor.record_value(key, value)

                tokens_used = getattr(cached_model, "tokens_used", None)
                if tokens_used is not None:
                    try:
                        perf_monitor.record_token_usage(
                            str(chat_request.provider),
                            int(tokens_used),
                        )
                    except (TypeError, ValueError):
                        logger.debug("Cached tokens_used not numeric: %s", tokens_used)

                logger.info("L3 cache hit - returning cached response")
                return cached_model
            else:
                if advanced_cache:
                    perf_monitor.record_cache_hit("l3", False)
                
            # Optimize query
            optimized_query = chat_request.message
            async with perf_monitor.measure_latency("query_optimization_ms"):
                # Use the query optimizer's expand_abbreviations and classify methods
                optimized_query = query_optimizer.expand_abbreviations(chat_request.message)
                # Classify intent first
                classification = await query_optimizer.classify_query(optimized_query)
                if classification and classification.intent != "unknown":
                    # Expand query based on intent
                    expanded_queries = query_optimizer.expand_query(optimized_query, classification.intent)
                    if expanded_queries:
                        # Use the first expanded query as optimized
                        optimized_query = expanded_queries[0]
                        logger.info(f"Query optimized: '{chat_request.message}' -> '{optimized_query}'")
                # If no location context is detected, optionally bias to default location
                try:
                    if (not getattr(classification, 'location_context', None)) and settings.default_location:
                        optimized_query = f"{optimized_query} {settings.default_location}"
                        logger.info(f"Applied default location bias: {settings.default_location}")
                except Exception as _e:
                    logger.warning(f"Unable to apply default location bias: {_e}")
            
            # Create or reuse parallel retrieval pipeline (cached by provider/model/hybrid)
            logger.info("Preparing ParallelRetrievalPipeline (with cache)...")

            # Check if unified retrieval is enabled
            enable_unified = getattr(settings, 'enable_unified_retrieval', False)

            # HYBRID_SEARCH_TOGGLE_START - Handle hybrid search configuration
            # Configure retriever based on hybrid search setting
            retriever_configs = None
            if chat_request.use_hybrid_search:
                logger.info("Hybrid search enabled - configuring BM25 + Vector retrievers")
                retriever_configs = {
                    "vector_similarity": {
                        "type": "vector",
                        "search_type": "similarity",
                        "k": 10
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
            # HYBRID_SEARCH_TOGGLE_END

            if retriever_configs is None and is_smart_gpt5:
                logger.info("Smart GPT-5 Mini detected - using streamlined vector retriever configuration")
                retriever_configs = {
                    "vector_similarity": {
                        "type": "vector",
                        "search_type": "similarity",
                        "k": max(8, getattr(settings, "smart_mode_max_chunks", 4) * 2),
                    }
                }

            # Build a cache key for the pipeline
            provider_key = str(chat_request.provider)
            model_key = chat_request.model or "default"
            hybrid_key = "hybrid" if chat_request.use_hybrid_search else "vector"
            pipeline_cache_key = f"{hybrid_key}|unified={enable_unified}|{provider_key}|{model_key}"

            pipeline_cache = getattr(app.state, 'retrieval_pipeline_cache', None)
            if pipeline_cache is not None and pipeline_cache_key in pipeline_cache:
                retrieval_pipeline = pipeline_cache[pipeline_cache_key]
                logger.info(f"Using cached retrieval pipeline: {pipeline_cache_key}")
            else:
                retrieval_pipeline = await asyncio.to_thread(
                    create_parallel_pipeline,
                    vector_store_manager=vector_store,
                    llm=llm,
                    enable_unified=enable_unified,
                    # HYBRID_SEARCH_TOGGLE_START
                    retriever_configs=retriever_configs,
                    enable_reranker=not is_smart_gpt5,
                    # HYBRID_SEARCH_TOGGLE_END
                )
                if pipeline_cache is not None:
                    pipeline_cache[pipeline_cache_key] = retrieval_pipeline
                    logger.info(f"Cached retrieval pipeline: {pipeline_cache_key}")

            logger.info("ParallelRetrievalPipeline ready")
        
        # Generate conversation ID if not provided
        conversation_id = chat_request.conversation_id or str(uuid.uuid4())
        
        # Retrieve context if RAG is enabled
        context = ""
        sources = []
        
        if chat_request.use_rag:
            logger.info("Retrieving context for query")
            
            # Use enhanced retrieval
            if retrieval_pipeline:
                # Use optimized query if available
                query = optimized_query if optimized_query != chat_request.message else chat_request.message
                
                # Build conversation history format for the pipeline
                conversation_history = []
                if chat_request.chat_history:
                    for msg in chat_request.chat_history:
                        conversation_history.append({
                            "role": msg.role,
                            "content": msg.content
                        })
                
                # Retrieve using parallel pipeline
                retrieval_start = time.perf_counter()
                results = await retrieval_pipeline.retrieve(
                    query=query,
                    k=settings.max_chunks_per_query
                )
                if is_smart_gpt5:
                    smart_chunk_limit = getattr(settings, "smart_mode_max_chunks", 0)
                    if smart_chunk_limit:
                        results = results[:smart_chunk_limit]
                retrieval_results = results
                search_time_ms = (time.perf_counter() - retrieval_start) * 1000
                perf_monitor.record_latency("search_latency_ms", search_time_ms)
                perf_monitor.record_latency("retriever_latency_ms", search_time_ms)
                perf_monitor.increment_counter("retrieval_operations", 1)
                perf_monitor.increment_counter("retrieved_documents_total", len(results))

                # Results are already in (doc, score) format
                logger.info(f"Retrieved {len(results)} documents in {search_time_ms:.2f} ms")
            else:
                # This shouldn't happen, but handle it gracefully
                logger.error("Retrieval pipeline not initialized despite RAG being enabled")
                results = []

            # Convert results to context and sources
            context_build_start = time.perf_counter()
            context_parts = []
            sources = []
            
            for i, (doc, score) in enumerate(results):
                # Check if this is table content
                metadata_dict = doc.metadata.model_dump() if hasattr(doc.metadata, 'model_dump') else doc.metadata
                is_table_content = "|" in doc.page_content or "table" in (metadata_dict.get("content_type", "") or "").lower()
                
                # DIAGNOSTIC: Log table detection details
                logger.info(f"[TABLE_DIAG] Source {i+1} analysis:")
                logger.info(f"  - Contains pipe chars: {'|' in doc.page_content}")
                logger.info(f"  - Content type: {metadata_dict.get('content_type', 'unknown')}")
                logger.info(f"  - Is table content: {is_table_content}")
                logger.info(f"  - Content preview (first 200 chars): {doc.page_content[:200]}")
                logger.info(f"  - Source: {metadata_dict.get('source', 'unknown')}")
                
                # Add to context with special handling for tables
                if is_table_content:
                    # Ensure table formatting is preserved
                    context_parts.append(f"[Source {i+1} - Table Content]\n{doc.page_content}\n")
                    logger.debug(f"Added table content from source {i+1}, length: {len(doc.page_content)}")
                else:
                    context_parts.append(f"[Source {i+1}]\n{doc.page_content}\n")
                    
                # Log if this contains specific values
                if "$" in doc.page_content:
                    logger.info(f"Source {i+1} contains dollar values")
                
                # Create source
                # Check if content has table structure
                is_table_content = "|" in doc.page_content or "table" in (metadata_dict.get("content_type", "") or "").lower()
                
                # Get max preview length from settings (0 = no limit)
                max_length = settings.source_preview_max_length
                
                # Never truncate table content
                if is_table_content:
                    text_preview = doc.page_content
                elif max_length == 0:
                    # No truncation
                    text_preview = doc.page_content
                else:
                    # Smart truncation at sentence boundary
                    if len(doc.page_content) <= max_length:
                        text_preview = doc.page_content
                    else:
                        # Find the last sentence boundary before max_length
                        truncated = doc.page_content[:max_length]
                        
                        # Look for sentence endings
                        last_period = truncated.rfind(". ")
                        last_exclaim = truncated.rfind("! ")
                        last_question = truncated.rfind("? ")
                        last_newline = truncated.rfind("\n")
                        
                        # Find the latest sentence boundary
                        boundaries = [b for b in [last_period, last_exclaim, last_question, last_newline] if b > max_length * 0.8]
                        
                        if boundaries:
                            # Truncate at sentence boundary
                            boundary = max(boundaries)
                            text_preview = doc.page_content[:boundary + 1].strip() + "..."
                        else:
                            # No good boundary found, truncate at word
                            last_space = truncated.rfind(" ")
                            if last_space > max_length * 0.9:
                                text_preview = doc.page_content[:last_space] + "..."
                            else:
                                text_preview = truncated + "..."
                
                source = Source(
                    id=metadata_dict.get("id", f"source_{i}"),
                    source_id=metadata_dict.get("source_id"),
                    text=text_preview,
                    title=metadata_dict.get("title"),
                    url=metadata_dict.get("canonical_url") or metadata_dict.get("source"),
                    section=metadata_dict.get("section"),
                    page=metadata_dict.get("page_number"),
                    score=score,
                    metadata=metadata_dict
                )
                sources.append(source)
            
            context = "\n".join(context_parts)
            if is_smart_gpt5:
                char_limit = getattr(settings, "smart_mode_context_char_limit", 0)
                if char_limit and len(context) > char_limit:
                    context = context[:char_limit]
            context_time_ms = (time.perf_counter() - context_build_start) * 1000
            perf_monitor.record_latency("context_build_latency_ms", context_time_ms)
            
            # Log context size for debugging
            logger.info(f"Retrieved {len(sources)} sources, total context length: {len(context)} characters")
            
            # Log if we found table content
            has_tables = any("|" in part for part in context_parts)
            if has_tables:
                logger.info("Context contains table-formatted content")
            if sources and len(sources) > 0:
                logger.info(f"Top source: {sources[0].metadata.get('source', 'Unknown')}")
                logger.info(f"Source type: {sources[0].metadata.get('source_type', 'Unknown')}")
                logger.info(f"Content preview: {sources[0].text[:100]}...")
            
        # Build prompt
        system_prompt = """You are a helpful assistant for Canadian Forces members seeking information about travel instructions and policies.
Always provide accurate, specific information based on the official documentation provided.
If you're not certain about something, clearly state that.

IMPORTANT RULES:
1. When multiple sources are present, prioritize the source that provides the most specific and complete information (e.g., actual dollar amounts over references to appendices).
2. NEVER mention source numbers, citations, or reference which source you used. Do NOT say things like "according to Source X" or "as stated in the documentation".
3. Give direct, clear answers without referencing the documentation structure.
4. If specific values are found, state them directly without qualification.
5. For ANY rates or dollar amounts NOT found in the retrieved context (especially meal rates), you MUST say "not available in current documentation"—never make up or estimate values.
6. When answering authorization or permission questions, always include restrictions, limitations, maximum values, distance limits, time restrictions, and approval requirements that appear in the documentation.
7. Preserve structured data: if the documentation contains a table (| separators), reproduce it as a markdown table. Use **bold** for important values, bullet or numbered lists for multiple items, and clear section headers when appropriate.
8. For rate and allowance questions:
   - Only use meal allowance values found in the retrieved content. If meal rates are missing, state "Meal rates not available in current documentation".
   - For kilometric rates, include the cents-per-kilometre values.
   - For incidental allowances, include the daily rates.
   - Do not summarize when specific values are available.

SPECIAL INSTRUCTION FOR CLASS A RESERVISTS:
- After providing the general answer, ALWAYS add a section titled "**For Class A Reservists:**".
- In this section, provide specific information that applies to Class A Primary Reserve members.
- Include any special conditions, restrictions, or entitlements that specifically apply to Class A service.
- If there are differences in rates, allowances, or procedures for Class A members, highlight them.
- Common Class A specific considerations include travel time limits and restrictions, meal allowance eligibility during training, accommodation entitlements, kilometric rate applications, and Temporary Duty (TD) limitations.
"""

        if chat_request.short_answer_mode:
            system_prompt = f"{system_prompt}\n\n{SHORT_ANSWER_PROMPT}"
        
        # DIAGNOSTIC: Log system prompt details
        logger.info(f"[PROMPT_DIAG] Using chat.py endpoint")
        logger.info(f"[PROMPT_DIAG] System prompt includes table formatting instructions: True")
        logger.info(f"[PROMPT_DIAG] Query: {chat_request.message}")

        messages = [SystemMessage(content=system_prompt)]
        
        # Add chat history
        if chat_request.chat_history:
            for msg in chat_request.chat_history:
                if msg.role == "user":
                    messages.append(HumanMessage(content=msg.content))
                elif msg.role == "assistant":
                    messages.append(AIMessage(content=msg.content))
                # Skip system messages from history to avoid consecutive system messages
                
        # Add context if available
        if context:
            context_prompt = f"""Based on the following official documentation, answer the user's question:

{context}

User Question: {chat_request.message}

⚠️ IMPORTANT: If this is a trip plan request, DO NOT show any summary table at the beginning.
Show trip details and calculations first, then the summary table at the very END.

Instructions:
1. Provide a clear, accurate answer based ONLY on the documentation above.
2. When multiple sources discuss the same item, use the source that provides the most specific information (e.g., actual values over references).
3. Do NOT mention source numbers, citations, or which source you used.
4. Give a direct answer without referencing the documentation structure.
5. If the documentation doesn't contain the answer, clearly state that the information is not available.
6. Format your response using proper markdown:
   - Use tables (|column|column|) for tabular data.
   - Use **bold** for emphasis.
   - Use bullet points or numbered lists where appropriate.
   - Use headers (##) to organize sections.
   - Preserve any formatting that makes the information clearer.
7. For authorization or permission topics, include any restrictions, limitations, distance limits, time limits, and approval requirements found in the documentation.
"""
            messages.append(HumanMessage(content=context_prompt))
        else:
            # If RAG is enabled but no context found, inform the user
            if chat_request.use_rag:
                no_context_prompt = f"""No documentation was found in the knowledge base to answer this question.

User Question: {chat_request.message}

Please inform the user that no relevant information is available in the current database and suggest they may need to ingest the appropriate documents first."""
                messages.append(HumanMessage(content=no_context_prompt))
            else:
                messages.append(HumanMessage(content=chat_request.message))
            
        # Generate response
        logger.info(f"Generating response with {chat_request.provider}")
        
        # Build kwargs based on model type
        invoke_kwargs = {}
        if hasattr(llm, "model_name"):
            model_name = llm.model_name
            is_o_series = (model_name and (
                model_name.startswith('o3') or 
                model_name.startswith('o4') or
                model_name == 'o1' or
                model_name == 'o1-mini'
            ))
            if not is_o_series:
                # Only add temperature for non-O-series models
                invoke_kwargs["temperature"] = chat_request.temperature
                if chat_request.max_tokens:
                    invoke_kwargs["max_tokens"] = chat_request.max_tokens
        else:
            # For non-OpenAI models, include temperature
            invoke_kwargs["temperature"] = chat_request.temperature
            if chat_request.max_tokens:
                invoke_kwargs["max_tokens"] = chat_request.max_tokens

        if str(chat_request.provider) == Provider.OPENAI.value:
            if chat_request.reasoning_effort:
                invoke_kwargs["reasoning"] = {"effort": chat_request.reasoning_effort}
            verbosity_value = None
            if chat_request.response_verbosity:
                invoke_kwargs["text"] = {"verbosity": chat_request.response_verbosity}
                if isinstance(chat_request.response_verbosity, str):
                    verbosity_value = chat_request.response_verbosity.lower()
            if chat_request.short_answer_mode or verbosity_value == "low":
                max_tokens_hint = getattr(settings, "smart_mode_short_answer_max_tokens", 0)
                if max_tokens_hint:
                    current_limit = invoke_kwargs.get("max_tokens") or chat_request.max_tokens or max_tokens_hint
                    invoke_kwargs["max_tokens"] = int(min(current_limit, max_tokens_hint))

        answer_start = time.perf_counter()
        response = await llm.ainvoke(messages, **invoke_kwargs)
        answer_time_ms = (time.perf_counter() - answer_start) * 1000
        perf_monitor.record_latency("answer_generation_latency_ms", answer_time_ms)
        perf_monitor.record_latency("llm_latency_ms", answer_time_ms)
        
        # Handle response content - it might be a string or a list of content blocks (for thinking mode)
        if isinstance(response.content, str):
            response_text = response.content
        elif isinstance(response.content, list):
            # Extract text content from thinking response blocks
            response_text = ""
            for block in response.content:
                if hasattr(block, 'type') and block.type == 'text':
                    response_text += block.text if hasattr(block, 'text') else str(block)
                elif hasattr(block, 'type') and block.type == 'thinking':
                    # Log thinking content but don't include in response
                    logger.info(f"[THINKING] {getattr(block, 'thinking', 'No thinking content')}")
                elif isinstance(block, str):
                    response_text += block
        else:
            response_text = str(response.content)
        
        # DIAGNOSTIC: Log response analysis
        logger.info(f"[RESPONSE_DIAG] Response length: {len(response_text)}")
        logger.info(f"[RESPONSE_DIAG] Response contains pipe chars: {'|' in response_text}")
        logger.info(f"[RESPONSE_DIAG] Response contains markdown table indicators: {any(indicator in response_text for indicator in ['|', '---', '| ---'])}")
        
        # Calculate processing time
        processing_time = (datetime.utcnow() - start_time).total_seconds()
        
        # Extract token usage if available
        tokens_used = None
        if hasattr(response, "usage_metadata") and response.usage_metadata:
            # Handle both dict and object cases
            if isinstance(response.usage_metadata, dict):
                tokens_used = response.usage_metadata.get("total_tokens")
            elif hasattr(response.usage_metadata, "total_tokens"):
                tokens_used = response.usage_metadata.total_tokens

        if tokens_used is not None:
            try:
                perf_monitor.record_token_usage(
                    str(chat_request.provider),
                    int(tokens_used),
                )
            except (TypeError, ValueError):
                logger.debug("tokens_used not numeric: %s", tokens_used)
        
        # Create response object
        chat_response = ChatResponse(
            response=response_text,
            sources=sources if chat_request.include_sources else [],
            conversation_id=conversation_id,
            model=chat_request.model or getattr(llm, 'model_name', 'unknown'),
            provider=chat_request.provider,  # Already a string due to use_enum_values=True
            processing_time=processing_time,
            tokens_used=tokens_used,
            confidence_score=0.8 if sources else 0.5  # Higher confidence with sources
        )

        # Finalise performance metrics
        total_latency_ms = (time.perf_counter() - request_timer) * 1000
        perf_monitor.record_latency("total_request_latency_ms", total_latency_ms)

        if search_time_ms is None:
            perf_monitor.record_latency("search_latency_ms", 0)
        if context_time_ms is None:
            perf_monitor.record_latency("context_build_latency_ms", 0)
        if answer_time_ms is None:
            perf_monitor.record_latency("answer_generation_latency_ms", total_latency_ms)
            perf_monitor.record_latency("llm_latency_ms", total_latency_ms)

        quality_metrics = compute_quality_metrics(response_text, sources, retrieval_results)
        for key, value in quality_metrics.items():
            perf_monitor.record_value(key, value)

        perf_monitor.increment_counter("successful_requests")
        
        # Log the query
        query_id = str(uuid.uuid4())
        query_logger = get_query_logger()
        await query_logger.log_query(
            query_id=query_id,
            user_query=chat_request.message,
            provider=str(chat_request.provider),
            model=chat_request.model or getattr(llm, 'model_name', 'unknown'),
            use_rag=chat_request.use_rag,
            response=response_text,
            sources_count=len(sources),
            processing_time=processing_time,
            tokens_used=tokens_used,
            conversation_id=conversation_id,
            status=QueryStatus.SUCCESS,
            metadata={
                "temperature": chat_request.temperature,
                "max_tokens": chat_request.max_tokens,
                "include_sources": chat_request.include_sources,
                "confidence_score": chat_response.confidence_score,
                "source_ids": [
                    source.source_id or source.id for source in sources
                ] if sources else []
            }
        )

        # Persist source usage for downstream auditing
        if source_repository and sources:
            try:
                await source_repository.record_query_sources(
                    query_id,
                    [source.model_dump() for source in sources]
                )
            except Exception as repo_error:
                logger.warning("Failed to record query sources: %s", repo_error)

        return chat_response
        
    except Exception as e:
        # Log the full error with traceback
        logger.error(f"Chat request failed: {e}", exc_info=True)

        failure_latency_ms = (time.perf_counter() - request_timer) * 1000
        perf_monitor.record_latency("total_request_latency_ms", failure_latency_ms)
        if search_time_ms is not None:
            perf_monitor.record_latency("search_latency_ms", search_time_ms)
        if context_time_ms is not None:
            perf_monitor.record_latency("context_build_latency_ms", context_time_ms)
        perf_monitor.increment_counter("failed_requests")

        # Log failed query
        processing_time = (datetime.utcnow() - start_time).total_seconds()
        query_id = str(uuid.uuid4())
        query_logger = get_query_logger()
        await query_logger.log_query(
            query_id=query_id,
            user_query=chat_request.message,
            provider=str(chat_request.provider),
            model=chat_request.model or "unknown",
            use_rag=chat_request.use_rag,
            response=None,
            sources_count=0,
            processing_time=processing_time,
            tokens_used=None,
            conversation_id=chat_request.conversation_id or str(uuid.uuid4()),
            status=QueryStatus.ERROR,
            error_message=str(e),
            metadata={
                "temperature": chat_request.temperature,
                "max_tokens": chat_request.max_tokens,
                "include_sources": chat_request.include_sources
            }
        )
        
        # Check if the error is the specific LLM .get() error
        if "'ChatOpenAI' object has no attribute 'get'" in str(e):
            logger.error("LLM .get() error detected - this usually means the LLM object is being used incorrectly somewhere")
            try:
                logger.error(f"LLM type: {type(llm)}")
            except NameError:
                logger.error("LLM was not created before error occurred")
            logger.error(f"Provider: {chat_request.provider}")
            logger.error(f"Model: {chat_request.model}")
        
        # Use our error handler for better user messages
        error_message = handle_llm_error(
            e,
            provider=str(chat_request.provider) if chat_request else "unknown"
        )
        
        raise HTTPException(
            status_code=500,
            detail={
                "error": error_message,
                "details": str(e) if settings.debug else None
            }
        )


@router.post("/followup", response_model=FollowUpResponse)
async def generate_followup(
    request: Request,
    followup_request: FollowUpRequest
) -> FollowUpResponse:
    """Generate follow-up questions."""
    try:
        # Get default LLM with async wrapper
        llm = await asyncio.to_thread(get_llm, Provider.OPENAI)  # Use OpenAI for follow-ups
        
        # Build prompt
        sources_text = ""
        if followup_request.sources:
            sources_text = "\n\nBased on these sources:\n" + "\n".join([
                f"- {s.title or 'Document'}: {s.text[:100]}..."
                for s in followup_request.sources[:3]
            ])
            
        prompt = f"""Based on this conversation, generate {followup_request.max_questions} relevant follow-up questions that would help the user learn more:

User Question: "{followup_request.user_question}"
AI Response: "{followup_request.ai_response}"{sources_text}

Generate follow-up questions that:
1. Explore related topics mentioned in the response
2. Clarify specific details
3. Ask about practical applications

Format each question on a new line, starting with "Q:"."""

        # Generate questions
        response = await llm.ainvoke([HumanMessage(content=prompt)])
        
        # Parse questions
        questions = []
        lines = response.content.split("\n")
        
        for i, line in enumerate(lines):
            line = line.strip()
            if line.startswith("Q:"):
                question_text = line[2:].strip()
            elif line and not line.startswith("Q:") and i > 0:
                # Handle multi-line format
                question_text = line
            else:
                continue
                
            if question_text:
                # Categorize question
                category = "general"
                if any(word in question_text.lower() for word in ["how", "steps", "process"]):
                    category = "procedural"
                elif any(word in question_text.lower() for word in ["why", "reason", "purpose"]):
                    category = "explanatory"
                elif any(word in question_text.lower() for word in ["when", "deadline", "time"]):
                    category = "temporal"
                    
                question = FollowUpQuestion(
                    id=f"followup_{uuid.uuid4().hex[:8]}",
                    question=question_text,
                    category=category,
                    confidence=0.7
                )
                questions.append(question)
                
                if len(questions) >= followup_request.max_questions:
                    break
                    
        # Fallback questions if generation failed
        if not questions:
            questions = [
                FollowUpQuestion(
                    id="followup_default_1",
                    question="Can you provide more specific examples?",
                    category="clarification",
                    confidence=0.5
                ),
                FollowUpQuestion(
                    id="followup_default_2",
                    question="What are the key requirements I should know?",
                    category="requirements",
                    confidence=0.5
                ),
                FollowUpQuestion(
                    id="followup_default_3",
                    question="Where can I find the official documentation?",
                    category="resources",
                    confidence=0.5
                )
            ]
            
        return FollowUpResponse(questions=questions[:followup_request.max_questions])
        
    except Exception as e:
        logger.error(f"Follow-up generation failed: {e}", exc_info=True)
        
        # Use our error handler for better user messages
        error_message = handle_llm_error(e, provider="openai")
        
        # Return default questions on error with error message
        return FollowUpResponse(questions=[
            FollowUpQuestion(
                id="followup_error",
                question="Could you clarify your question?",
                category="clarification",
                confidence=0.3
            )
        ])
