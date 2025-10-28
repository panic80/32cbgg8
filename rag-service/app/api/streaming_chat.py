"""Streaming chat API endpoint that streams LLM tokens as they are generated."""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import time
import uuid
from datetime import datetime
from typing import AsyncGenerator, Dict, List, Optional, Tuple, Any

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from langchain_core.messages import HumanMessage, SystemMessage

from app.api.chat import get_llm
from app.api.chat import generate_followup
from app.api.prompt_constants import (
    CHAT_SYSTEM_PROMPT,
    GMT_GLOSSARY_NOTE,
    NO_CONTEXT_PROMPT_TEMPLATE,
    SHORT_ANSWER_PROMPT,
    TRIP_PLAN_INSTRUCTION,
)
from app.components.result_processor import ResultProcessor
from app.core.config import settings
from app.core.logging import get_logger
from app.models.query import ChatRequest, ChatResponse, Provider, Source, FollowUpRequest
from app.models.query_history import QueryStatus
from app.pipelines.parallel_retrieval import create_parallel_pipeline
from app.pipelines.query_optimizer import QueryOptimizer
from app.services.advanced_cache import AdvancedCacheService, create_context_hash
from app.services.llm_pool import llm_pool
from app.services.performance_monitor import get_performance_monitor
from app.services.query_logger import get_query_logger
from app.utils.message_utils import build_history_messages
from app.utils.metrics import compute_quality_metrics
from app.utils.streaming_utils import (
    extract_chunk_text,
    extract_token_usage_from_chunk,
)

logger = get_logger(__name__)
router = APIRouter()


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


def _should_use_hybrid(chat_request: ChatRequest) -> bool:
    return getattr(chat_request, "use_hybrid_search", False)


async def _create_retrieval_pipeline(vector_store_manager, app_state, llm_wrapper, chat_request: ChatRequest):
    enable_unified = getattr(settings, "enable_unified_retrieval", False)
    retriever_configs = None

    requested_model = (chat_request.model or "").strip().lower()
    is_smart_gpt5 = requested_model == "gpt-5-mini"

    cache_service = getattr(app_state, "cache_service", None)
    redis_client = getattr(cache_service, "redis_client", None) if cache_service and hasattr(cache_service, "redis_client") else None
    enable_stateful = getattr(settings, "enable_stateful_retrieval", False)

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
            enable_stateful=enable_stateful,
            redis_client=redis_client,
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


def _coerce_chat_response(payload: Any) -> Optional[ChatResponse]:
    """Coerce cached payloads into a ChatResponse model."""

    if isinstance(payload, ChatResponse):
        return payload

    if payload is None:
        return None

    if isinstance(payload, dict):
        return ChatResponse(**payload)

    dump_method = getattr(payload, "model_dump", None)
    if callable(dump_method):
        return ChatResponse(**dump_method())

    dict_method = getattr(payload, "dict", None)
    if callable(dict_method):
        return ChatResponse(**dict_method())

    logger.debug("Unable to coerce cached payload into ChatResponse: %s", type(payload))
    return None


def _coerce_source(payload: Any) -> Optional[Source]:
    """Coerce cached source payloads into Source models."""

    if isinstance(payload, Source):
        return payload

    if payload is None:
        return None

    if isinstance(payload, dict):
        return Source(**payload)

    dump_method = getattr(payload, "model_dump", None)
    if callable(dump_method):
        return Source(**dump_method())

    dict_method = getattr(payload, "dict", None)
    if callable(dict_method):
        return Source(**dict_method())

    logger.debug("Unable to coerce cached source payload: %s", type(payload))
    return None


async def _stream_cached_response(
    chat_request: ChatRequest,
    conversation_id: str,
    cached_response: ChatResponse,
    perf_monitor,
    start_time: datetime,
    request_timer: float,
    query_logger,
    source_repository: Any,
) -> AsyncGenerator[str, None]:
    """Emit SSE events for a cached chat response."""

    cache_latency_ms = (time.perf_counter() - request_timer) * 1000
    response_seconds = cache_latency_ms / 1000 if cache_latency_ms else 0.0

    perf_monitor.record_latency("search_latency_ms", 0)
    perf_monitor.record_latency("context_build_latency_ms", 0)
    perf_monitor.record_latency("answer_generation_latency_ms", cache_latency_ms)
    perf_monitor.record_latency("llm_latency_ms", cache_latency_ms)
    perf_monitor.record_latency("total_request_latency_ms", cache_latency_ms)
    perf_monitor.record_latency("first_token_latency_ms", cache_latency_ms)

    tokens_used = cached_response.tokens_used
    if tokens_used is not None:
        try:
            perf_monitor.record_token_usage(str(chat_request.provider), int(tokens_used))
        except (TypeError, ValueError):
            logger.debug("Cached tokens_used not numeric: %s", tokens_used)

    raw_sources = cached_response.sources or []
    sources: List[Source] = []
    for item in raw_sources:
        coerced = _coerce_source(item)
        if coerced:
            sources.append(coerced)

    yield f"data: {json.dumps({'type': 'retrieval_start'})}\n\n"
    yield f"data: {json.dumps({'type': 'retrieval_complete', 'duration': 0, 'count': len(sources)})}\n\n"

    if chat_request.include_sources and sources:
        yield f"data: {json.dumps({'type': 'sources', 'sources': [src.model_dump() for src in sources]})}\n\n"

    perf_monitor.increment_counter("successful_requests")

    quality_metrics = compute_quality_metrics(cached_response.response, sources, None)
    for key, value in quality_metrics.items():
        perf_monitor.record_value(key, value)

    yield f"data: {json.dumps({'type': 'first_token', 'latency': cache_latency_ms})}\n\n"
    yield f"data: {json.dumps({'type': 'token', 'content': cached_response.response})}\n\n"
    yield f"data: {json.dumps({'type': 'complete', 'duration': response_seconds})}\n\n"

    processing_time = (datetime.utcnow() - start_time).total_seconds()

    metadata = {
        "temperature": chat_request.temperature,
        "max_tokens": chat_request.max_tokens,
        "include_sources": chat_request.include_sources,
        "retrieval_count": len(sources),
        "retrieval_ms": 0,
        "context_build_ms": 0,
        "follow_up_count": 0,
        "cache_hit": True,
    }

    query_id = str(uuid.uuid4())
    model_name = cached_response.model or chat_request.model or "unknown"

    try:
        await query_logger.log_query(
            query_id=query_id,
            user_query=chat_request.message,
            provider=str(chat_request.provider),
            model=model_name,
            use_rag=chat_request.use_rag,
            response=cached_response.response,
            sources_count=len(sources),
            processing_time=processing_time,
            tokens_used=tokens_used,
            conversation_id=conversation_id,
            status=QueryStatus.SUCCESS,
            metadata=metadata,
        )
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.warning("Failed to log cached streaming query: %s", exc)

    if source_repository and chat_request.include_sources and sources:
        try:
            await source_repository.record_query_sources(
                query_id,
                [source.model_dump() for source in sources],
            )
        except Exception as repo_error:  # pragma: no cover - defensive logging
            logger.warning("Failed to record cached query sources: %s", repo_error)



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

    cache_service = getattr(request.app.state, "cache_service", None)
    advanced_cache = AdvancedCacheService(cache_service) if cache_service else None
    source_repository = getattr(request.app.state, "source_repository", None)

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
                    advanced_cache=advanced_cache,
                    source_repository=source_repository,
                    query_logger=query_logger,
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
                advanced_cache=advanced_cache,
                source_repository=source_repository,
                query_logger=query_logger,
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
    advanced_cache: Optional[AdvancedCacheService],
    source_repository: Any,
    query_logger: Any,
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
    context = ""
    sources: List[Source] = []
    retrieval_count = 0
    retrieval_time_ms = 0.0
    context_time_ms = 0.0
    glossary_source: Optional[Source] = None
    glossary_injected = False

    cached_response: Optional[ChatResponse] = None
    cache_model = chat_request.model or "default"
    cache_lookup_hash = None

    if advanced_cache:
        cache_lookup_hash = hashlib.md5(f"{chat_request.message}:{chat_request.provider}".encode()).hexdigest()
        try:
            cached_payload = await advanced_cache.get_response(
                query=chat_request.message,
                context_hash=cache_lookup_hash,
                model=cache_model,
            )
        except Exception as cache_error:  # pragma: no cover - defensive logging
            logger.warning("Advanced cache lookup failed: %s", cache_error)
            cached_payload = None

        if cached_payload:
            cached_response = _coerce_chat_response(cached_payload)
            if cached_response:
                perf_monitor.record_cache_hit("l3", True)
                async for event in _stream_cached_response(
                    chat_request=chat_request,
                    conversation_id=conversation_id,
                    cached_response=cached_response,
                    perf_monitor=perf_monitor,
                    start_time=start_time,
                    request_timer=request_timer,
                    query_logger=query_logger,
                    source_repository=source_repository,
                ):
                    yield event
                return
            logger.debug("Cached payload not coercible to ChatResponse; treating as miss")
            perf_monitor.record_cache_hit("l3", False)
        else:
            perf_monitor.record_cache_hit("l3", False)

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

            if "gmt" in (chat_request.message or "").lower():
                glossary_block = f"[Glossary - Government Motor Transport]\n{GMT_GLOSSARY_NOTE}\n"
                if "government motor transport" not in context.lower():
                    context = f"{glossary_block}\n{context}" if context else glossary_block
                    glossary_source = Source(
                        id="glossary_gmt",
                        source_id="glossary_gmt",
                        text=GMT_GLOSSARY_NOTE,
                        title="Government Motor Transport (GMT) definition",
                        url=None,
                        section="Glossary",
                        page=None,
                        score=1.0,
                        metadata={
                            "source": "cbthis glossary",
                            "source_type": "glossary",
                            "content_type": "definition",
                            "tags": ["glossary", "gmt", "crown vehicle"],
                        },
                    )
                    sources = [glossary_source] + (sources or [])
                    glossary_injected = True

            if is_smart_gpt5:
                char_limit = getattr(settings, "smart_mode_context_char_limit", 0)
                if char_limit and len(context) > char_limit:
                    context = context[:char_limit]

            context_time_ms = (time.perf_counter() - context_build_start) * 1000
            perf_monitor.record_latency("context_build_latency_ms", context_time_ms)

            if chat_request.include_sources and sources:
                yield f"data: {json.dumps({'type': 'sources', 'sources': [s.model_dump() for s in sources]})}\n\n"
        else:
            perf_monitor.record_latency("context_build_latency_ms", 0)
    else:
        perf_monitor.record_latency("search_latency_ms", 0)
        perf_monitor.record_latency("context_build_latency_ms", 0)

    system_prompt = CHAT_SYSTEM_PROMPT
    if chat_request.additional_instructions:
        system_prompt = f"{CHAT_SYSTEM_PROMPT}\n\nADDITIONAL DIRECTIVES:\n{chat_request.additional_instructions.strip()}"

    messages: List[Any] = [SystemMessage(content=system_prompt)]
    if chat_request.short_answer_mode:
        messages.append(SystemMessage(content=SHORT_ANSWER_PROMPT))
    messages.extend(build_history_messages(chat_request))

    if context:
        context_prompt = (
            "Based on the following official documentation, answer the user's question:\n\n"
            f"{context}{TRIP_PLAN_INSTRUCTION}\n"
            f"User Question: {chat_request.message}"
        )
        messages.append(HumanMessage(content=context_prompt))
    else:
        if chat_request.use_rag:
            no_context_prompt = NO_CONTEXT_PROMPT_TEMPLATE.format(question=chat_request.message)
            messages.append(HumanMessage(content=no_context_prompt))
        else:
            messages.append(HumanMessage(content=chat_request.message))

    llm = getattr(llm_wrapper, "llm", llm_wrapper)

    generation_start = time.perf_counter()
    first_token_sent = False
    full_response_parts: List[str] = []
    token_usage_total: Optional[int] = None

    stream_kwargs: Dict[str, Any] = {}
    underlying_llm = getattr(llm, "llm", llm)
    model_name = getattr(underlying_llm, "model_name", resolved_model_name)
    model_name_lower = (model_name or "").strip().lower()

    if provider_enum == Provider.OPENAI:
        if model_name_lower.startswith("o") and chat_request.reasoning_effort:
            stream_kwargs["reasoning"] = {"effort": chat_request.reasoning_effort}
        if chat_request.response_verbosity:
            if model_name_lower.startswith("o"):
                stream_kwargs.setdefault("reasoning", {})["verbosity"] = chat_request.response_verbosity
            else:
                logger.debug("Skipping response_verbosity for non-reasoning model %s", model_name)
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

        token_text = extract_chunk_text(chunk)
        if not token_text:
            continue

        full_response_parts.append(token_text)

        usage_from_chunk = extract_token_usage_from_chunk(chunk)
        if usage_from_chunk is not None:
            token_usage_total = usage_from_chunk

        if not first_token_sent and token_text.strip():
            first_token_sent = True
            latency_ms = (time.perf_counter() - generation_start) * 1000
            perf_monitor.record_latency("first_token_latency_ms", latency_ms)
            yield f"data: {json.dumps({'type': 'first_token', 'latency': latency_ms})}\n\n"

        yield f"data: {json.dumps({'type': 'token', 'content': token_text})}\n\n"

    full_response = "".join(full_response_parts).strip()

    if glossary_injected:
        normalized_response = full_response.lower()
        if "government motor transport" not in normalized_response or "crown vehicle" not in normalized_response:
            glossary_note_text = f"\n\n**Glossary Note:** {GMT_GLOSSARY_NOTE}"
            full_response += glossary_note_text
            yield f"data: {json.dumps({'type': 'token', 'content': glossary_note_text})}\n\n"

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

    source_ids = [source.source_id or source.id for source in sources] if sources else []
    metadata = {
        "temperature": chat_request.temperature,
        "max_tokens": chat_request.max_tokens,
        "include_sources": chat_request.include_sources,
        "retrieval_count": retrieval_count,
        "retrieval_ms": retrieval_time_ms,
        "context_build_ms": context_time_ms,
        "follow_up_count": len(follow_up_questions_payload),
        "source_ids": source_ids,
        "cache_hit": False,
    }

    query_id = str(uuid.uuid4())

    try:
        await query_logger.log_query(
            query_id=query_id,
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
            metadata=metadata,
        )
    except Exception as log_exc:  # pragma: no cover - avoid breaking stream on logging
        logger.warning("Failed to log streaming query: %s", log_exc)

    if source_repository and sources:
        try:
            await source_repository.record_query_sources(
                query_id,
                [source.model_dump() for source in sources],
            )
        except Exception as repo_error:  # pragma: no cover - defensive logging
            logger.warning("Failed to record query sources: %s", repo_error)


@router.post("/chat/stream")
async def streaming_chat_endpoint(request: Request, chat_request: ChatRequest) -> StreamingResponse:
    """Return an SSE stream for chat responses."""
    return StreamingResponse(_stream_events(request, chat_request), media_type="text/event-stream")


@router.post("/streaming_chat")
async def streaming_chat_legacy(request: Request, chat_request: ChatRequest) -> StreamingResponse:
    """Legacy endpoint maintained for existing gateway integration."""
    return await streaming_chat_endpoint(request, chat_request)
