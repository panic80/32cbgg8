"""Streaming chat API endpoint that streams LLM tokens as they are generated."""

from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from datetime import datetime
from typing import AsyncGenerator, Iterable, List, Optional, Tuple, Dict, Any

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from app.api.chat import get_llm
from app.api.prompt_constants import SHORT_ANSWER_PROMPT
from app.core.config import settings
from app.core.logging import get_logger
from app.models.query import ChatRequest, Provider, Source, FollowUpRequest
from app.pipelines.parallel_retrieval import create_parallel_pipeline
from app.pipelines.query_optimizer import QueryOptimizer
from app.components.result_processor import ResultProcessor
from app.services.performance_monitor import get_performance_monitor
from app.services.llm_pool import llm_pool
from app.services.query_logger import get_query_logger
from app.models.query_history import QueryStatus
from app.utils.metrics import compute_quality_metrics
from app.api.chat import generate_followup

logger = get_logger(__name__)
router = APIRouter()

# Reuse the same system prompt as the synchronous chat endpoint to keep behaviour aligned.
SYSTEM_PROMPT = """You are a helpful assistant for Canadian Forces members seeking information about travel instructions and policies.
Always provide accurate, specific information based on the official documentation provided.
If you're not certain about something, clearly state that.

IMPORTANT RULES:
1. When multiple sources are present, prioritize the source that provides the most specific and complete information (e.g., actual dollar amounts over references to appendices)
2. NEVER mention source numbers, citations, or reference which source you used
3. Do NOT say things like "according to Source X" or "as stated in the documentation"
4. Give direct, clear answers without referencing the documentation structure
5. If specific values are found, state them directly without qualification
6. Always use proper markdown formatting in your responses:
   - Tables for structured data
   - **Bold** for important values or headers
   - Bullet points or numbered lists for multiple items
   - Clear section headers when appropriate

CRITICAL: When answering questions about rates, allowances, or tables:
- ALWAYS include the actual dollar amounts or specific values found in the documentation
- If you find a table structure (with | characters), preserve and present it as a markdown table
- For meal allowances, include breakfast, lunch, and dinner rates with specific dollar amounts
- For kilometric rates, include the cents per kilometer values
- For incidental allowances, include the daily rates
- If the documentation contains a complete table, reproduce it in your response
- Do not summarize or generalize when specific values are available

SPECIAL INSTRUCTION FOR CLASS A RESERVISTS:
- After providing the general answer, ALWAYS add a section titled "**For Class A Reservists:**"
- In this section, provide specific information that applies to Class A Primary Reserve members
- Include any special conditions, restrictions, or entitlements that specifically apply to Class A service
- If there are differences in rates, allowances, or procedures for Class A members, highlight them
- Common Class A specific considerations include travel time limits, meal allowance eligibility during training, accommodation entitlements, kilometric rate applications, and TD limitations
"""


def _ensure_provider(provider: Provider | str) -> Provider:
    if isinstance(provider, Provider):
        return provider
    try:
        return Provider(provider)
    except ValueError:
        logger.warning("Unknown provider %s, defaulting to OPENAI", provider)
        return Provider.OPENAI


def _resolve_model(provider: Provider, requested_model: Optional[str]) -> str:
    if requested_model:
        return requested_model
    if provider == Provider.OPENAI:
        return getattr(settings, "openai_chat_model", "gpt-4.1-mini")
    if provider == Provider.ANTHROPIC:
        return getattr(settings, "anthropic_chat_model", "claude-3-sonnet-20240229")
    if provider == Provider.GOOGLE:
        return getattr(settings, "google_chat_model", "gemini-pro")
    return "default"


def _coerce_to_text(payload: Any) -> str:
    """Safely coerce OpenAI streaming payload structures into plain text."""
    if payload is None:
        return ""

    if isinstance(payload, str):
        return payload

    if isinstance(payload, (int, float)):
        return str(payload)

    # Handle mapping-like payloads
    if isinstance(payload, dict):
        # Prefer common text-bearing keys
        for key in ("text", "output_text", "content", "delta", "message"):
            if key in payload:
                text_value = _coerce_to_text(payload[key])
                if text_value:
                    return text_value
        # Fallback: iterate values
        fragments = [_coerce_to_text(value) for value in payload.values()]
        return "".join(fragment for fragment in fragments if fragment)

    # Handle objects with helpful attributes (LangChain/OpenAI delta classes)
    for attr in ("content", "text", "output_text", "delta", "message"):
        if hasattr(payload, attr):
            text_value = _coerce_to_text(getattr(payload, attr))
            if text_value:
                return text_value

    if hasattr(payload, "additional_kwargs"):
        # Message-like payload with no textual delta yet
        return ""

    # Handle iterable collections (lists/tuples of blocks)
    if isinstance(payload, Iterable):
        fragments = [_coerce_to_text(item) for item in payload]
        return "".join(fragment for fragment in fragments if fragment)

    return ""


def _extract_chunk_text(chunk) -> str:
    """Extract textual content from a LangChain chunk object."""
    if chunk is None:
        return ""

    if isinstance(chunk, str):
        return chunk

    return _coerce_to_text(chunk)


def _extract_token_usage_from_chunk(chunk) -> Optional[int]:
    """Best-effort extraction of token usage from a streaming chunk."""
    if chunk is None:
        return None

    candidate_maps = []
    for attr in ("generation_info", "response_metadata", "metadata", "info"):
        value = getattr(chunk, attr, None)
        if isinstance(value, dict):
            candidate_maps.append(value)
    if isinstance(chunk, dict):
        candidate_maps.append(chunk)

    for mapping in candidate_maps:
        for key in ("token_usage", "usage", "usage_metadata"):
            usage = mapping.get(key)
            if isinstance(usage, dict):
                for token_key in ("total_tokens", "total", "totalTokens", "completion_tokens"):
                    token_value = usage.get(token_key)
                    if isinstance(token_value, (int, float)):
                        return int(token_value)
    return None


def _build_history_messages(chat_request: ChatRequest) -> List[SystemMessage | HumanMessage | AIMessage]:
    history_messages: List[SystemMessage | HumanMessage | AIMessage] = []
    if not chat_request.chat_history:
        return history_messages

    for item in chat_request.chat_history:
        if item.role == "user":
            history_messages.append(HumanMessage(content=item.content))
        elif item.role == "assistant":
            history_messages.append(AIMessage(content=item.content))
        else:
            # Skip system messages from history to avoid stacking prompts
            logger.debug("Skipping non user/assistant history role: %s", item.role)
    return history_messages


def _should_use_hybrid(chat_request: ChatRequest) -> bool:
    return getattr(chat_request, "use_hybrid_search", False)


async def _create_retrieval_pipeline(vector_store_manager, app_state, llm_wrapper, chat_request: ChatRequest):
    enable_unified = getattr(settings, "enable_unified_retrieval", False)
    retriever_configs = None

    requested_model = (chat_request.model or "").strip().lower()
    is_smart_gpt5 = requested_model == "gpt-5-mini"

    if _should_use_hybrid(chat_request):
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
        if llm_wrapper:
            retriever_configs["multi_query"] = {
                "type": "multi_query",
                "base_retriever": "vector_similarity",
                "llm": llm_wrapper,
            }

    if retriever_configs is None and is_smart_gpt5:
        logger.info("Smart GPT-5 Mini detected - using streamlined vector retriever configuration")
        retriever_configs = {
            "vector_similarity": {
                "type": "vector",
                "search_type": "similarity",
                "k": max(8, getattr(settings, "smart_mode_max_chunks", 4) * 2),
            }
        }

    pipeline_cache_store = getattr(app_state, "retrieval_pipeline_cache", None)

    provider_key = str(chat_request.provider)
    model_key = chat_request.model or "default"
    hybrid_key = "hybrid" if _should_use_hybrid(chat_request) else "vector"
    cache_key = f"{hybrid_key}|unified={enable_unified}|{provider_key}|{model_key}"

    if pipeline_cache_store is not None and cache_key in pipeline_cache_store:
        pipeline = pipeline_cache_store[cache_key]
        logger.info("Using cached retrieval pipeline: %s", cache_key)
    else:
        pipeline = await asyncio.to_thread(
            create_parallel_pipeline,
            vector_store_manager=vector_store_manager,
            llm=llm_wrapper,
            enable_unified=enable_unified,
            retriever_configs=retriever_configs,
            enable_reranker=not is_smart_gpt5,
        )
        if pipeline_cache_store is not None:
            pipeline_cache_store[cache_key] = pipeline
            logger.info("Cached retrieval pipeline: %s", cache_key)

    return pipeline


async def _process_retrieval_results(
    result_processor: ResultProcessor,
    results: List[Tuple],
    query: str,
) -> Tuple[str, List[Source]]:
    if not results:
        return "", []

    documents = [doc for doc, _ in results]
    processed_docs = await asyncio.to_thread(result_processor.process_results, documents, query)

    context_parts: List[str] = []
    sources: List[Source] = []
    max_length = getattr(settings, "source_preview_max_length", 700)

    for index, doc in enumerate(processed_docs):
        metadata = dict(getattr(doc, "metadata", {}) or {})
        score = metadata.get("score", 0.0)
        is_table_content = "|" in doc.page_content or "table" in (metadata.get("content_type", "") or "").lower()

        if is_table_content:
            context_parts.append(f"[Source {index + 1} - Table Content]\n{doc.page_content}\n")
        else:
            context_parts.append(f"[Source {index + 1}]\n{doc.page_content}\n")

        preview_text = doc.page_content
        if max_length > 0 and not is_table_content and len(preview_text) > max_length:
            preview_text = preview_text[:max_length] + "..."

        source = Source(
            id=metadata.get("id", f"source_{index}"),
            text=preview_text,
            title=metadata.get("title") or metadata.get("filename") or metadata.get("source"),
            url=metadata.get("canonical_url") or metadata.get("source"),
            section=metadata.get("section"),
            page=metadata.get("page_number"),
            score=score,
            metadata=metadata,
        )
        sources.append(source)

    return "\n".join(context_parts), sources


async def _stream_events(
    request: Request,
    chat_request: ChatRequest,
) -> AsyncGenerator[str, None]:
    perf_monitor = get_performance_monitor()
    query_logger = get_query_logger()

    perf_monitor.increment_counter("streaming_requests")
    perf_monitor.increment_counter("total_requests")

    start_time = datetime.utcnow()
    request_timer = time.perf_counter()

    connection_id = str(uuid.uuid4())
    yield f"data: {json.dumps({'type': 'connection', 'id': connection_id})}\n\n"

    conversation_id = chat_request.conversation_id or str(uuid.uuid4())
    yield f"data: {json.dumps({'type': 'metadata', 'conversation_id': conversation_id})}\n\n"

    provider_enum = _ensure_provider(chat_request.provider)
    model_name = _resolve_model(provider_enum, chat_request.model)

    vector_store = getattr(request.app.state, "vector_store_manager", None)
    if vector_store is None:
        raise RuntimeError("Vector store manager is not configured")

    llm_wrapper = None
    from_pool = False

    try:
        try:
            async with llm_pool.acquire(provider_enum, model_name) as pooled_llm:
                llm_wrapper = pooled_llm
                from_pool = True
                async for event in _run_streaming_flow(
                    request=request,
                    chat_request=chat_request,
                    conversation_id=conversation_id,
                    llm_wrapper=llm_wrapper,
                    vector_store=vector_store,
                    app_state=request.app.state,
                    perf_monitor=perf_monitor,
                    start_time=start_time,
                    request_timer=request_timer,
                ):
                    yield event
            return
        except Exception as pool_error:
            logger.warning("LLM pool acquisition failed (%s). Falling back to direct client.", pool_error)
            llm_wrapper = await asyncio.to_thread(get_llm, provider_enum, model_name)
            async for event in _run_streaming_flow(
                request=request,
                chat_request=chat_request,
                conversation_id=conversation_id,
                llm_wrapper=llm_wrapper,
                vector_store=vector_store,
                app_state=request.app.state,
                perf_monitor=perf_monitor,
                start_time=start_time,
                request_timer=request_timer,
            ):
                yield event
    except asyncio.CancelledError:
        logger.info("Streaming request cancelled by client")
        perf_monitor.increment_counter("failed_requests")
        yield f"data: {json.dumps({'type': 'error', 'message': 'Connection cancelled'})}\n\n"
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.exception("Streaming chat failed: %s", exc)
        perf_monitor.increment_counter("failed_requests")
        error_payload = {
            "type": "error",
            "message": "Streaming temporarily unavailable",
        }
        yield f"data: {json.dumps(error_payload)}\n\n"


async def _run_streaming_flow(
    request: Request,
    chat_request: ChatRequest,
    conversation_id: str,
    llm_wrapper,
    vector_store,
    app_state,
    perf_monitor,
    start_time: datetime,
    request_timer: float,
) -> AsyncGenerator[str, None]:
    if await request.is_disconnected():
        return

    provider_enum = _ensure_provider(chat_request.provider)
    resolved_model_name = _resolve_model(provider_enum, chat_request.model)
    requested_model = (chat_request.model or resolved_model_name or "").strip().lower()
    is_smart_gpt5 = requested_model == "gpt-5-mini"

    optimizer_llm = None if is_smart_gpt5 else llm_wrapper
    query_optimizer = QueryOptimizer(optimizer_llm)
    result_processor = ResultProcessor()

    retrieval_results: List[Tuple] = []
    follow_up_questions_payload: List[Dict[str, Any]] = []

    optimized_query = chat_request.message
    try:
        optimized_query = query_optimizer.expand_abbreviations(chat_request.message)
        classification = await query_optimizer.classify_query(optimized_query)
        if classification and classification.intent != "unknown":
            expanded = query_optimizer.expand_query(optimized_query, classification.intent)
            if expanded:
                optimized_query = expanded[0]
        if (not getattr(classification, "location_context", None)) and getattr(settings, "default_location", None):
            optimized_query = f"{optimized_query} {settings.default_location}"
    except Exception as exc:
        logger.warning("Query optimisation skipped due to error: %s", exc)

    context = ""
    sources: List[Source] = []
    retrieval_count = 0
    retrieval_time_ms = 0.0
    context_time_ms = 0.0

    if chat_request.use_rag:
        yield f"data: {json.dumps({'type': 'retrieval_start'})}\n\n"
        retrieval_pipeline = await _create_retrieval_pipeline(vector_store, app_state, llm_wrapper, chat_request)
        retrieval_start = time.perf_counter()
        results = await retrieval_pipeline.retrieve(
            query=optimized_query,
            k=getattr(settings, "max_chunks_per_query", 6),
        )
        if is_smart_gpt5:
            smart_chunk_limit = getattr(settings, "smart_mode_max_chunks", 0)
            if smart_chunk_limit:
                results = results[:smart_chunk_limit]
        retrieval_results = results
        retrieval_time_ms = (time.perf_counter() - retrieval_start) * 1000
        retrieval_count = len(results)
        yield f"data: {json.dumps({'type': 'retrieval_complete', 'duration': retrieval_time_ms / 1000, 'count': retrieval_count})}\n\n"

        perf_monitor.record_latency("search_latency_ms", retrieval_time_ms)

        if results:
            context_build_start = time.perf_counter()
            context, sources = await _process_retrieval_results(result_processor, results, optimized_query)
            if is_smart_gpt5:
                char_limit = getattr(settings, "smart_mode_context_char_limit", 0)
                if char_limit and len(context) > char_limit:
                    context = context[:char_limit]
            context_time_ms = (time.perf_counter() - context_build_start) * 1000
            perf_monitor.record_latency("context_build_latency_ms", context_time_ms)

            if sources:
                yield f"data: {json.dumps({'type': 'sources', 'sources': [s.model_dump() for s in sources]})}\n\n"
    else:
        perf_monitor.record_latency("search_latency_ms", 0)
        perf_monitor.record_latency("context_build_latency_ms", 0)

    messages: List[SystemMessage | HumanMessage | AIMessage] = [SystemMessage(content=SYSTEM_PROMPT)]
    if chat_request.short_answer_mode:
        messages.append(SystemMessage(content=SHORT_ANSWER_PROMPT))
    messages.extend(_build_history_messages(chat_request))

    if context:
        context_prompt = (
            "Based on the following official documentation, answer the user's question:\n\n"
            f"{context}\n\nUser Question: {chat_request.message}"
        )
        messages.append(HumanMessage(content=context_prompt))
    else:
        messages.append(HumanMessage(content=chat_request.message))

    llm = getattr(llm_wrapper, "llm", llm_wrapper)

    generation_start = time.perf_counter()
    first_token_sent = False
    full_response_parts: List[str] = []
    token_usage_total: Optional[int] = None

    stream_kwargs: Dict[str, Any] = {}
    underlying_llm = getattr(llm, "llm", llm)
    model_name = getattr(underlying_llm, "model_name", requested_model)
    model_name_lower = (model_name or "").strip().lower()

    if provider_enum == Provider.OPENAI:
        if model_name_lower.startswith("o") and chat_request.reasoning_effort:
            stream_kwargs["reasoning"] = {"effort": chat_request.reasoning_effort}
        verbosity_value = None
        if chat_request.response_verbosity:
            if model_name_lower.startswith("o"):
                stream_kwargs.setdefault("reasoning", {})["verbosity"] = chat_request.response_verbosity
            else:
                logger.debug("Skipping response_verbosity for non-reasoning model %s", model_name)
            if isinstance(chat_request.response_verbosity, str):
                verbosity_value = chat_request.response_verbosity.lower()
        if chat_request.max_tokens:
            stream_kwargs["max_tokens"] = int(chat_request.max_tokens)

    chunk_debug_counter = 0
    async for chunk in llm.astream(messages, **stream_kwargs):
        if await request.is_disconnected():
            logger.info("Client disconnected during generation")
            raise asyncio.CancelledError

        if (
            provider_enum == Provider.OPENAI
            and requested_model == "gpt-5-mini"
            and chunk_debug_counter < 5
            and logger.isEnabledFor(logging.DEBUG)
        ):
            logger.debug("[STREAM_CHUNK_DEBUG] %s", repr(chunk))
            chunk_debug_counter += 1

        token_text = _extract_chunk_text(chunk)
        if not token_text:
            continue

        full_response_parts.append(token_text)

        usage_from_chunk = _extract_token_usage_from_chunk(chunk)
        if usage_from_chunk is not None:
            token_usage_total = usage_from_chunk

        if not first_token_sent and token_text.strip():
            first_token_sent = True
            latency_ms = (time.perf_counter() - generation_start) * 1000
            perf_monitor.record_latency("first_token_latency_ms", latency_ms)
            yield f"data: {json.dumps({'type': 'first_token', 'latency': latency_ms})}\n\n"

        yield f"data: {json.dumps({'type': 'token', 'content': token_text})}\n\n"

    full_response = "".join(full_response_parts).strip()

    if token_usage_total is not None:
        try:
            perf_monitor.record_token_usage(
                str(chat_request.provider),
                int(token_usage_total),
            )
        except (TypeError, ValueError):
            logger.debug("Streaming token usage not numeric: %s", token_usage_total)

    answer_latency_ms = (time.perf_counter() - generation_start) * 1000
    total_latency_ms = (time.perf_counter() - request_timer) * 1000
    perf_monitor.record_latency("answer_generation_latency_ms", answer_latency_ms)
    perf_monitor.record_latency("llm_latency_ms", answer_latency_ms)
    perf_monitor.record_latency("total_request_latency_ms", total_latency_ms)

    quality_metrics = compute_quality_metrics(full_response, sources, retrieval_results)
    for key, value in quality_metrics.items():
        perf_monitor.record_value(key, value)

    followup_task: Optional[asyncio.Task[List[Dict[str, Any]]]] = None

    if chat_request.use_rag and full_response:
        async def _generate_followups() -> List[Dict[str, Any]]:
            try:
                followup_request = FollowUpRequest(
                    user_question=chat_request.message,
                    ai_response=full_response,
                    sources=sources,
                    max_questions=3,
                )
                followup_response = await generate_followup(request, followup_request)
                return [q.model_dump() for q in followup_response.questions]
            except Exception as exc:  # pragma: no cover - defensive logging
                logger.warning("Failed to generate follow-up questions: %s", exc)
                return []

        followup_task = asyncio.create_task(_generate_followups())

    perf_monitor.increment_counter("successful_requests")

    yield f"data: {json.dumps({'type': 'complete', 'duration': total_latency_ms / 1000})}\n\n"

    if followup_task:
        try:
            follow_up_questions_payload = await followup_task
        except Exception as exc:  # pragma: no cover - defensive logging
            logger.warning("Follow-up task failed: %s", exc)
            follow_up_questions_payload = []

        if follow_up_questions_payload:
            yield f"data: {json.dumps({'type': 'metadata', 'follow_up_questions': follow_up_questions_payload})}\n\n"

    try:
        await query_logger.log_query(
            query_id=str(uuid.uuid4()),
            user_query=chat_request.message,
            provider=str(chat_request.provider),
            model=chat_request.model or getattr(llm, "model_name", "unknown"),
            use_rag=chat_request.use_rag,
            response=full_response,
            sources_count=len(sources),
            processing_time=(datetime.utcnow() - start_time).total_seconds(),
            tokens_used=token_usage_total,
            conversation_id=conversation_id,
            status=QueryStatus.SUCCESS,
            metadata={
                "temperature": chat_request.temperature,
                "max_tokens": chat_request.max_tokens,
                "include_sources": chat_request.include_sources,
                "retrieval_count": retrieval_count,
                "retrieval_ms": retrieval_time_ms,
                "context_build_ms": context_time_ms,
                "follow_up_count": len(follow_up_questions_payload),
            },
        )
    except Exception as log_exc:  # pragma: no cover - avoid breaking stream on logging
        logger.warning("Failed to log streaming query: %s", log_exc)


@router.post("/chat/stream")
async def streaming_chat_endpoint(request: Request, chat_request: ChatRequest) -> StreamingResponse:
    """Return an SSE stream for chat responses."""
    return StreamingResponse(_stream_events(request, chat_request), media_type="text/event-stream")


@router.post("/streaming_chat")
async def streaming_chat_legacy(request: Request, chat_request: ChatRequest) -> StreamingResponse:
    """Legacy endpoint maintained for existing gateway integration."""
    return await streaming_chat_endpoint(request, chat_request)
