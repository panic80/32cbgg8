"""Streaming chat API endpoint for real-time responses."""

import asyncio
import json
import os
import time
from datetime import datetime
from typing import AsyncGenerator, Optional, Any, Dict
from weakref import WeakKeyDictionary
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import StreamingResponse
import uuid

from app.core.config import settings
from app.core.logging import get_logger
from app.models.query import ChatRequest, Provider
from app.api.chat import get_llm
from app.pipelines.parallel_retrieval import create_parallel_pipeline
from app.pipelines.query_optimizer import QueryOptimizer
from app.services.advanced_cache import AdvancedCacheService, create_context_hash
from app.services.performance_monitor import get_performance_monitor
from app.api.streaming import StreamingCallbackHandler, RetrievalStreamingHandler
from app.components.result_processor import StreamingResultProcessor
from app.services.llm_pool import llm_pool
from app.services.query_logger import get_query_logger
from app.models.query_history import QueryStatus

# New optimization components
from app.components.gated_retrieval_coordinator import GatedRetrievalCoordinator
from app.components.conditional_reranker import ConditionalReranker
from app.components.delayed_head_streaming import DelayedHeadStreamingHandler, StreamingDecision

from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from langchain_core.callbacks import AsyncCallbackManager

logger = get_logger(__name__)

router = APIRouter()

_pipeline_cache: "WeakKeyDictionary[Any, dict]" = WeakKeyDictionary()
_pipeline_cache_lock = asyncio.Lock()
PROMPT_DIAGNOSTICS_ENABLED = os.environ.get('ENABLE_PROMPT_DIAGNOSTICS') == 'true'


def should_use_gated_retrieval(chat_request: ChatRequest) -> bool:
    """Determine if gated retrieval should be used based on feature flags and A/B testing."""
    if not settings.enable_gated_retrieval:
        return False
    
    # A/B testing based on rollout percentage
    if settings.gated_retrieval_rollout_percentage < 1.0:
        # Use hash of message for consistent A/B testing
        import hashlib
        hash_value = int(hashlib.md5(chat_request.message.encode()).hexdigest()[:8], 16)
        should_use = (hash_value % 100) / 100.0 < settings.gated_retrieval_rollout_percentage
        if should_use:
            logger.info(f"A/B test: Using gated retrieval for query: {chat_request.message[:50]}...")
        else:
            logger.info(f"A/B test: Using legacy retrieval for query: {chat_request.message[:50]}...")
        return should_use
    
    return True


async def generate_follow_up_questions(
    user_question: str,
    ai_response: str,
    llm,
    sources: list = None
) -> list:
    """Generate contextual follow-up questions based on the conversation."""
    try:
        # Create a focused prompt for generating follow-up questions
        prompt = f"""Based on this conversation, generate 2-3 relevant questions that THE USER might ask next to learn more or get specific information.

User Question: "{user_question}"
AI Response: "{ai_response}"

CRITICAL INSTRUCTIONS:
Generate questions FROM THE USER'S PERSPECTIVE using FIRST-PERSON language (I, me, my).
These are suggested questions FOR THE USER to ask, NOT questions from you to the user.

CORRECT examples (using I/me/my):
✓ "How much would I get for driving my own car?"
✓ "What documentation do I need to submit?"
✓ "Can I claim meals if I'm staying with family?"
✓ "How do I calculate my total entitlement?"

WRONG examples (using you/your - DO NOT USE):
✗ "Do you intend to drive your own car?"
✗ "Are you planning to stay with family?"
✗ "Would you like to know about meal rates?"

The questions MUST:
- Use FIRST-PERSON pronouns (I, me, my) - NEVER use "you" or "your"
- Be from the user's perspective asking for information
- Be specific and actionable
- Be natural follow-ups to continue learning

Return ONLY a JSON array of question strings in FIRST-PERSON perspective:
["How much would I receive for...", "What do I need to submit for...", "Can I claim..."]

Focus on questions about:
- Specific details or rates ("How much would I get...")
- How to apply or implement ("How do I apply for...")
- Related policies ("Am I eligible for...")
- Practical next steps ("What should I do next...")"""

        # Use the existing LLM to generate questions
        messages = [HumanMessage(content=prompt)]
        
        # Temporarily disable streaming for this request
        original_streaming = getattr(llm, 'streaming', None)
        if hasattr(llm, 'streaming'):
            llm.streaming = False
        
        try:
            response = await llm.ainvoke(messages)
            
            # Extract content from response
            content = ""
            if hasattr(response, 'content'):
                content = response.content
            elif isinstance(response, dict) and 'content' in response:
                content = response['content']
            elif isinstance(response, str):
                content = response
            
            # Parse JSON array from response
            import re
            json_match = re.search(r'\[[\s\S]*?\]', content)
            if json_match:
                questions_array = json.loads(json_match.group())
                
                # Format as follow-up question objects
                follow_up_questions = []
                for idx, question in enumerate(questions_array[:3]):  # Limit to 3 questions
                    follow_up_questions.append({
                        "id": f"followup-{int(time.time() * 1000)}-{idx}",
                        "question": question,
                        "category": "related",  # You could enhance this with better categorization
                        "confidence": 0.7
                    })
                
                return follow_up_questions
            
        finally:
            # Restore original streaming setting
            if original_streaming is not None and hasattr(llm, 'streaming'):
                llm.streaming = original_streaming
        
    except Exception as e:
        logger.warning(f"Failed to generate follow-up questions: {e}")
    
    # Return empty list if generation fails
    return []


async def get_retrieval_pipeline(
    vector_store_manager,
    llm,
    enable_unified: bool
):
    """Return a cached retrieval pipeline for the given configuration."""
    cache_key = (bool(llm), enable_unified)
    async with _pipeline_cache_lock:
        cache_for_store: Dict[Any, Any] = _pipeline_cache.get(vector_store_manager)
        if cache_for_store is None:
            cache_for_store = {}
            _pipeline_cache[vector_store_manager] = cache_for_store
        pipeline = cache_for_store.get(cache_key)

    if pipeline is not None:
        return pipeline

    pipeline = await asyncio.to_thread(
        create_parallel_pipeline,
        vector_store_manager=vector_store_manager,
        llm=llm,
        enable_unified=enable_unified
    )

    async with _pipeline_cache_lock:
        cache_for_store = _pipeline_cache.setdefault(vector_store_manager, {})
        # If another coroutine populated the cache while we were building, reuse that instance
        existing = cache_for_store.get(cache_key)
        if existing is not None:
            pipeline = existing
        else:
            cache_for_store[cache_key] = pipeline

    return pipeline


async def generate_sse_events(
    chat_request: ChatRequest,
    request: Request
) -> AsyncGenerator[str, None]:
    """Generate Server-Sent Events for streaming chat responses."""
    start_time = datetime.utcnow()
    perf_monitor = get_performance_monitor()
    first_token_time = None
    first_token_latency_ms = None
    
    # Record request
    perf_monitor.increment_counter("streaming_requests")
    
    # Track connection
    connection_id = str(uuid.uuid4())
    logger.info(f"Streaming connection {connection_id} started")
    
    try:
        # Yield connection established event
        yield f"data: {json.dumps({'type': 'connection', 'id': connection_id})}\n\n"
        
        # Get services from app state
        app = request.app
        vector_store = app.state.vector_store_manager
        document_store = app.state.document_store
        cache_service = getattr(app.state, "cache_service", None)
        
        # Acquire LLM from pool
        llm_wrapper = None
        llm = None
        from_pool = False
        
        # Try to acquire from pool first
        # Ensure we have a Provider enum object
        provider_enum = chat_request.provider
        if isinstance(provider_enum, str):
            # Convert string to Provider enum
            provider_map = {
                "openai": Provider.OPENAI,
                "anthropic": Provider.ANTHROPIC,
                "google": Provider.GOOGLE,
                "Provider.OPENAI": Provider.OPENAI,
                "Provider.ANTHROPIC": Provider.ANTHROPIC,
                "Provider.GOOGLE": Provider.GOOGLE,
                "OPENAI": Provider.OPENAI,
                "ANTHROPIC": Provider.ANTHROPIC,
                "GOOGLE": Provider.GOOGLE
            }
            provider_enum = provider_map.get(provider_enum, Provider.OPENAI)
        
        try:
            # Use async context manager pattern
            async with llm_pool.acquire(provider_enum, chat_request.model or "gpt-4") as llm_wrapper:
                from_pool = True
                logger.info(f"Acquired LLM from pool: {provider_enum.value}:{chat_request.model}")
                
                # Process the entire request within the context manager
                # to ensure the connection stays alive
                
                # Initialize components
                query_optimizer = QueryOptimizer(llm_wrapper)
                
                # Get the underlying LLM from the RetryableLLM wrapper for streaming
                llm = llm_wrapper.llm
                
                # Initialize streaming handlers with queues
                streaming_queue = asyncio.Queue()
                retrieval_queue = asyncio.Queue()
                streaming_handler = StreamingCallbackHandler(streaming_queue)
                retrieval_handler = RetrievalStreamingHandler(retrieval_queue)
                
                # Setup callback manager for streaming (only include LangChain callback handlers)
                callback_manager = AsyncCallbackManager([streaming_handler])
                
                # Configure LLM with streaming
                llm.callbacks = callback_manager
                # Only set streaming for models that support it
                if hasattr(llm, 'streaming'):
                    llm.streaming = True
                elif provider_enum == Provider.OPENAI:
                    # OpenAI models support streaming even without the attribute
                    pass
                else:
                    logger.warning(f"Model {provider_enum.value} may not support streaming properly")
                
                # Initialize result processor for streaming
                result_processor = StreamingResultProcessor()
                
                # Advanced cache initialization
                advanced_cache = None
                cache_context_hash = None
                cached_response = None
                if cache_service:
                    advanced_cache = AdvancedCacheService(cache_service)
                
                # Only create retrieval pipeline if RAG is enabled
                retrieval_pipeline = None
                context = ""
                sources = []
                results = []
                
                if chat_request.use_rag:
                    # Yield retrieval start event
                    yield f"data: {json.dumps({'type': 'retrieval_start'})}\n\n"
                    
                    # Check cache first
                    cached_response = None
                    if advanced_cache:
                        context_hash = create_context_hash(
                            query=chat_request.message,
                            documents=[],  # Will be updated after retrieval
                            model=chat_request.model or "default"
                        )
                        cached_response = await advanced_cache.get_response(
                            query=chat_request.message,
                            context_hash=context_hash,
                            model=chat_request.model or "default"
                        )
                    
                    if cached_response:
                        # Stream cached response
                        yield f"data: {json.dumps({'type': 'cache_hit', 'level': 'l3'})}\n\n"
                        
                        # Split cached response into tokens for streaming effect
                        tokens = cached_response.get("response", "").split()
                        for i, token in enumerate(tokens):
                            if i == 0 and first_token_time is None:
                                first_token_time = datetime.utcnow()
                            yield f"data: {json.dumps({'type': 'token', 'content': token + ' '})}\n\n"
                            await asyncio.sleep(0.01)  # Small delay for streaming effect
                        
                        # Send sources if available
                        if cached_response.get("sources"):
                            yield f"data: {json.dumps({'type': 'sources', 'sources': cached_response['sources']})}\n\n"
                        
                        # Send follow-up questions if available
                        if cached_response.get("follow_up_questions"):
                            yield f"data: {json.dumps({'type': 'metadata', 'follow_up_questions': cached_response['follow_up_questions']})}\n\n"
                        
                        # Complete event
                        yield f"data: {json.dumps({'type': 'complete'})}\n\n"
                        return
                    
                    # Query optimization (use rule-based only for speed)
                    optimized_query = chat_request.message
                    async with perf_monitor.measure_latency("query_optimization_ms"):
                        # Expand abbreviations
                        optimized_query = query_optimizer.expand_abbreviations(chat_request.message)
                        # Use rule-based classification to avoid LLM call
                        classification = query_optimizer._rule_based_classification(optimized_query)
                        if classification and classification.intent != "unknown":
                            expanded_queries = query_optimizer.expand_query(optimized_query, classification.intent)
                            if expanded_queries:
                                optimized_query = expanded_queries[0]
                        
                        # Special handling for trip planning queries
                        query_lower = optimized_query.lower()
                        is_trip_planning = any(term in query_lower for term in ["trip", "travel", "journey", "planning"])
                        needs_cost_info = any(term in query_lower for term in ["cost", "expense", "estimate", "budget", "how much"])
                        
                        if is_trip_planning and needs_cost_info:
                            # Append rate-specific keywords to help retrieval
                            optimized_query += " meal allowances rates kilometric rates incidental allowances"
                            logger.info("Enhanced trip planning query with rate keywords")
                    
                    # Check if gated retrieval is enabled
                    use_gated_retrieval = should_use_gated_retrieval(chat_request)
                    
                    # Set up retrieval monitoring
                    retrieval_start = time.time()
                    
                    if use_gated_retrieval:
                        # Use gated retrieval (currently falls back to legacy with metrics)
                        logger.info("Using gated retrieval (optimized pipeline)")
                        enable_unified = chat_request.__dict__.get("enable_unified_retrieval", settings.enable_unified_retrieval)
                        
                        retrieval_pipeline = await get_retrieval_pipeline(
                            vector_store_manager=vector_store,
                            llm=llm_wrapper,
                            enable_unified=enable_unified
                        )
                        
                        # Use optimized timeouts for gated retrieval
                        retrieval_start_gated = time.time()
                        results = await retrieval_pipeline.retrieve(
                            query=optimized_query,
                            k=settings.max_chunks_per_query
                        )
                        retrieval_time_gated = time.time() - retrieval_start_gated
                        
                        # Yield gated metrics
                        yield f"data: {json.dumps({'type': 'gated_retrieval_complete', 'duration': retrieval_time_gated, 'count': len(results), 'optimized': True})}\n\n"
                        
                    else:
                        # Use legacy parallel retrieval pipeline
                        enable_unified = chat_request.__dict__.get("enable_unified_retrieval", settings.enable_unified_retrieval)
                        
                        retrieval_pipeline = await get_retrieval_pipeline(
                            vector_store_manager=vector_store,
                            llm=llm_wrapper,
                            enable_unified=enable_unified
                        )
                        
                        logger.info("Starting legacy retrieval for streaming query")
                        results = await retrieval_pipeline.retrieve(
                            query=optimized_query,
                            k=settings.max_chunks_per_query
                        )
                    
                    retrieval_time = time.time() - retrieval_start
                    yield f"data: {json.dumps({'type': 'retrieval_complete', 'duration': retrieval_time, 'count': len(results)})}\n\n"
                    
                    # Apply optimization metrics for gated retrieval
                    if use_gated_retrieval and results:
                        # Simple optimization indicator (advanced reranking disabled for now)
                        yield f"data: {json.dumps({'type': 'optimization_applied', 'components': ['gating', 'timeouts']})}\n\n"
                    
                    # Process results for streaming
                    if results:
                        # Stream process results
                        # Process results and collect them
                        processed_docs = []
                        async for doc in result_processor.process_results_stream(
                            documents=[doc for doc, _ in results],
                            query=optimized_query
                        ):
                            processed_docs.append(doc)
                        
                        # Use processed_docs instead of processed_results
                        processed_results = [(doc, doc.metadata.get('score', 0.0)) for doc in processed_docs]
                        
                        # Build context
                        context_parts = []
                        sources = []
                        
                        for i, (doc, score) in enumerate(processed_results):
                            is_table_content = "|" in doc.page_content or "table" in doc.metadata.get("content_type", "").lower()
                            
                            if is_table_content:
                                context_parts.append(f"[Source {i+1} - Table Content]\n{doc.page_content}\n")
                            else:
                                context_parts.append(f"[Source {i+1}]\n{doc.page_content}\n")
                            
                            # Create source object
                            from app.models.query import Source
                            
                            # Handle different metadata field names
                            url = doc.metadata.get("source") or doc.metadata.get("url") or doc.metadata.get("file_path", "Unknown")
                            title = doc.metadata.get("title") or doc.metadata.get("filename") or url
                            
                            source = Source(
                                id=doc.metadata.get("id", f"source_{i}"),
                                text=doc.page_content[:settings.source_preview_max_length] if settings.source_preview_max_length > 0 else doc.page_content,
                                title=title,
                                url=url,
                                section=doc.metadata.get("section"),
                                page=doc.metadata.get("page_number"),
                                score=score,
                                metadata=doc.metadata
                            )
                            sources.append(source.dict())
                        
                        context = "\n".join(context_parts)
                        
                        # Send sources event
                        yield f"data: {json.dumps({'type': 'sources', 'sources': sources})}\n\n"
                
                # Build messages
                # Add short answer mode instructions if enabled
                short_answer_prefix = ""
                logger.info(f"[SHORT_ANSWER_DEBUG] chat_request.short_answer_mode = {chat_request.short_answer_mode}")
                if chat_request.short_answer_mode:
                    short_answer_prefix = """RESPONSE MODE: SHORT ANSWER
Provide EXTREMELY BRIEF responses (1-3 sentences maximum).
Focus only on the essential information.
No elaboration, examples, or additional context unless specifically requested.

"""
                    logger.info("[SHORT_ANSWER_DEBUG] Short answer prefix ADDED to system prompt")
                else:
                    logger.info("[SHORT_ANSWER_DEBUG] Short answer mode is OFF - using normal prompt")
                
                system_prompt = short_answer_prefix + """You are a helpful assistant for Canadian Forces members seeking information about travel instructions and policies.
Always provide accurate, specific information based on the official documentation provided.
If you're not certain about something, clearly state that.

IMPORTANT RULES:
1. GLOSSARY PRIORITY: When glossary definitions are provided, they take ABSOLUTE PRECEDENCE over any conflicting information in the documents
2. When multiple sources are present, prioritize the source that provides the most specific and complete information (e.g., actual dollar amounts over references to appendices)
3. NEVER mention source numbers, citations, or reference which source you used
4. Do NOT say things like "according to Source X" or "as stated in the documentation"
5. Give direct, clear answers without referencing the documentation structure
6. If specific values are found, state them directly without qualification
7. CRITICAL: For ANY rates or dollar amounts NOT found in the retrieved context (especially meal rates), you MUST say "not available in current documentation" - NEVER make up or estimate values
8. Always use proper markdown formatting in your responses:
   - Tables for structured data
   - **Bold** for important values or headers
   - Bullet points or numbered lists for multiple items
   - Clear section headers when appropriate

CRITICAL: When answering questions about rates, allowances, or tables:
nCRITICAL: When answering questions about authorization or permissions:
- ALWAYS include ANY restrictions, limitations, or maximum values found in the documentation
- Include distance limitations (e.g., 500 km per day)
- Include time restrictions

TRIP COST ESTIMATION INSTRUCTIONS:
When presented with a "Trip Plan Request with Cost Estimate", analyze the provided information and calculate costs based on current CF travel regulations.

CRITICAL - MANDATORY 30+ DAY INCIDENTAL RULE:
For ANY trip exceeding 30 days, you MUST calculate incidentals as follows:
- Days 1-30: $17.30 per day
- Days 31 to (Total Days - 1): $13.00 per day (75% reduction)
- Last Day: $17.30 (Change in Location - CIL rate)
NEVER simply multiply total days by $17.30 for trips over 30 days!

IMPORTANT - Current Standard Rates (use these specific values):
- Incidental Expense Allowance: $17.30 per day (first 30 days), $13.00 per day (days 31+ except last day)
- Kilometric Rate (Personal Vehicle): $0.68/km for first 5,000 km
- Standard Meal Rates (when R&Q not provided): Check documentation for current rates

When calculating costs:

1. **Meal Allowances:**
   
   **KEY PRINCIPLE: Travel time meals are ALWAYS evaluated based on departure/arrival times, regardless of R&Q status**
   - R&Q only affects meals AT the destination, NOT during travel
   - FIRST DAY (Outbound):
     * Depart at 12:00 hrs
     * Breakfast: NO (depart after 07:00)
     * Lunch: NO (depart at 12:00)
     * Dinner: YES only if arrival after 18:00
   
   - LAST DAY (Return):
     * Depart at 15:00 hrs
     * Breakfast: NO (depart after 07:00)
     * Lunch: NO (depart after 12:00)
     * Dinner: YES only if arrival after 18:00
   
   - FULL DAYS at destination (all days between first and last):
     * Without R&Q: All three meals entitled
     * With R&Q: No meals (R&Q covers meals at destination)
   
   - Calculate arrival time = departure time + travel duration
   - IMPORTANT: Even with R&Q provided, members are entitled to meals DURING TRAVEL TIME
   - R&Q only covers meals AT THE DESTINATION, not during transit
   - Calculate which meals fall during travel time and award those
   - CRITICAL: Only use meal rates from retrieved documentation - if not available, state "Meal rates not found in documentation"

   EXAMPLE for 1.5 hour travel:
   - First day: Depart 12:00, arrive 13:30 → No meals (arrive before 18:00)
   - Last day: Depart 15:00, arrive 16:30 → No meals (arrive before 18:00)
   - R&Q STATUS: Irrelevant for travel day meals - only affects meals at destination


CRITICAL - MULTI-DAY TRIP TRANSPORTATION:
⚠️ COMMON ERROR TO AVOID: Do NOT multiply round-trip distance by number of days!
- For multi-day trips with personal/government vehicles:
  - Member travels ONE WAY on the first day (departure)
  - Member travels ONE WAY on the last day (return)
  - Member does NOT travel daily between locations
  - CORRECT: Total distance = round-trip distance ONLY (2 × one-way distance)
  - WRONG: Total distance = round-trip × days (This is INCORRECT!)
  
EXAMPLES:
✅ CORRECT: 19-day trip, 96.5km one-way = 193km total = 193km × $0.68 = $131.24
❌ WRONG: 19-day trip, 96.5km one-way = 193km × 19 days = 3,667km (DO NOT DO THIS!)

For transportation calculations, you MUST write:
"Total distance: [one-way] km × 2 = [round-trip] km (one round trip for entire journey)"
"Transportation cost: [round-trip] km × $0.68/km = $[amount]"
NEVER write "round trip per day" or multiply by days!

2. **Transportation Costs:**
   REMINDER: For multi-day trips, calculate total distance as one-way × 2 ONLY!
   DO NOT multiply by number of days!
   - Personal vehicle: Apply the kilometric rate of $0.68/km
   - Government vehicle: No kilometric allowance
   - Air/Train/Bus: Estimate actual fare costs or state that receipts will be required

3. **Accommodation:**
   - If R&Q is NOT provided, include commercial accommodation estimates
   - Apply government rates where applicable

4. **Incidental Expense Allowance:**
   - Apply the daily rate of $17.30 per day
   - Pro-rate for partial days as per regulations

5. **Format the Response:**
   - DO NOT show any summary table at the beginning
   - Start with trip details and calculations FIRST
   - ONLY show the summary table at the END after all calculations

Example format:
## Trip Cost Estimate

### Summary
| Category | Amount |
|----------|--------|
| Transportation | $XXX.XX |
| Meals | $XXX.XX |
| Accommodation | $XXX.XX |
| Incidentals | $XX.XX |
| **Total Estimate** | **$XXX.XX** |

### Detailed Breakdown
[Provide calculations here]
- Include approval requirements
- Never omit restrictions even if they seem secondary to the main question
- ALWAYS include the actual dollar amounts or specific values found in the documentation
- If you find a table structure (with | characters), preserve and present it as a markdown table
- For meal allowances: ONLY use breakfast, lunch, and dinner rates found in the retrieved documentation. If meal rates are not in the context, state "Meal rates not available in current documentation" - DO NOT make up or estimate rates
- For kilometric rates, include the cents per kilometer values
- For incidental allowances:
  • First 30 days: .30 per day
  • Days 31+: .00 per day (75% reduction) when staying in the same location
  • Last day (Change in Location - CIL): Always .30 per day regardless of trip duration
  • IMPORTANT: The last day is always at the full rate due to Change in Location (CIL)
  
  MANDATORY CALCULATION FOR TRIPS OVER 30 DAYS:
  You MUST apply this formula for any trip exceeding 30 days:
  - Days 1-30: Count × $17.30
  - Days 31 to (Total Days - 1): Count × $13.00
  - Last Day (CIL): .30
  
  Example for 44-day trip:
  - Days 1-30: 30 × $17.30 = $519.00
  - Days 31-43: 13 × $13.00 = $169.00  
  - Day 44 (CIL): 1 × $17.30 = $17.30
  - Total: $705.30
  
  ⚠️ WARNING: Simply multiplying total days × $17.30 is INCORRECT for trips over 30 days
- If the documentation contains a complete table, reproduce it in your response
- Do not summarize or generalize when specific values are available

SPECIAL INSTRUCTION FOR CLASS A RESERVISTS:
- After providing the general answer, ALWAYS add a section titled "**For Class A Reservists:**"
- In this section, provide specific information that applies to Class A Primary Reserve members
- Include any special conditions, restrictions, or entitlements that specifically apply to Class A service
- If there are differences in rates, allowances, or procedures for Class A members, highlight them
- Common Class A specific considerations include:
  - Travel time limits and restrictions
  - Meal allowance eligibility during training
  - Accommodation entitlements
  - Kilometric rate applications
  - TD (Temporary Duty) limitations
"""

                # DIAGNOSTIC: Log system prompt comparison
                if PROMPT_DIAGNOSTICS_ENABLED:
                    logger.info(f"[PROMPT_DIAG] Using streaming_chat.py endpoint")
                    logger.info(f"[PROMPT_DIAG] System prompt includes table formatting instructions: False")
                    logger.info(f"[PROMPT_DIAG] Query: {chat_request.message}")
                    logger.info(f"[SHORT_ANSWER_DEBUG] System prompt starts with: {system_prompt[:150]}...")

                messages = [SystemMessage(content=system_prompt)]
                
                # Add chat history
                if chat_request.chat_history:
                    for msg in chat_request.chat_history:
                        if msg.role == "user":
                            messages.append(HumanMessage(content=msg.content))
                        elif msg.role == "assistant":
                            messages.append(AIMessage(content=msg.content))
                        # Skip system messages from history to avoid consecutive system messages
                
                # Add context or current message
                if context:
                    # Extract glossary terms from the query
                    from app.utils.glossary_loader import get_glossary_loader
                    glossary_loader = get_glossary_loader()
                    query_words = chat_request.message.split()
                    glossary_terms = []
                    
                    for word in query_words:
                        cleaned_word = word.lower().strip(".,!?;:()")
                        expansion = glossary_loader.get_expansion(cleaned_word)
                        if expansion:
                            glossary_terms.append(f"- {cleaned_word.upper()}: {expansion}")
                    
                    # Format glossary context
                    glossary_context = ""
                    if glossary_terms:
                        glossary_context = f"""
IMPORTANT GLOSSARY DEFINITIONS (These take precedence over document content):
{chr(10).join(glossary_terms)}

"""
                    
                    context_prompt = f"""Based on the following official documentation, answer the user's question:

{glossary_context}{context}


⚠️ IMPORTANT: If this is a trip plan request, DO NOT show any summary table at the beginning.
Show trip details and calculations first, then the summary table at the very END.
User Question: {chat_request.message}"""
                    messages.append(HumanMessage(content=context_prompt))
                else:
                    messages.append(HumanMessage(content=chat_request.message))
                
                # Apply delayed head streaming if using gated retrieval
                if use_gated_retrieval and settings.delayed_streaming_enabled:
                    # Simple delay for gated retrieval queries (advanced streaming logic disabled for now)
                    yield f"data: {json.dumps({'type': 'streaming_optimization', 'enabled': True})}\n\n"
                    # Small delay to allow background processing
                    await asyncio.sleep(0.05)  # 50ms delay
                
                # Yield generation start event
                yield f"data: {json.dumps({'type': 'generation_start'})}\n\n"
                
                # Stream the response
                token_count = 0
                full_response = ""
                async for chunk in llm.astream(messages):
                    # Handle different chunk types from different providers
                    content = None
                    
                    # Handle thinking mode chunks
                    if hasattr(chunk, 'content'):
                        if isinstance(chunk.content, str):
                            content = chunk.content
                        elif isinstance(chunk.content, list):
                            # For thinking mode, extract text content
                            for block in chunk.content:
                                if hasattr(block, 'type') and block.type == 'text':
                                    content = block.text if hasattr(block, 'text') else str(block)
                                elif hasattr(block, 'type') and block.type == 'thinking':
                                    # Log thinking but don't send to client
                                    logger.debug(f"[THINKING] {getattr(block, 'thinking', '')}")
                        else:
                            content = str(chunk.content) if chunk.content else None
                    elif isinstance(chunk, dict) and 'content' in chunk:
                        content = chunk['content']
                    elif isinstance(chunk, str):
                        content = chunk
                    
                    if content:
                        # Record first token time
                        if first_token_time is None:
                            first_token_time = datetime.utcnow()
                            first_token_latency = (first_token_time - start_time).total_seconds() * 1000
                            perf_monitor.record_latency("first_token_latency_ms", first_token_latency)
                            first_token_latency_ms = first_token_latency
                            yield f"data: {json.dumps({'type': 'first_token', 'latency': first_token_latency})}\n\n"
                        
                        # Send token
                        yield f"data: {json.dumps({'type': 'token', 'content': content})}\n\n"
                        full_response += content
                        token_count += 1
                        
                        # Backpressure management - slow down if client is slow
                        if token_count % 10 == 0:
                            await asyncio.sleep(0.001)
                
                follow_up_task = None
                follow_up_questions = []
                if full_response:
                    logger.info("Generating follow-up questions for streaming response")
                    follow_up_task = asyncio.create_task(
                        generate_follow_up_questions(
                            user_question=chat_request.message,
                            ai_response=full_response,
                            llm=llm,
                            sources=sources
                        )
                    )
                
                # Calculate final metrics
                total_time = (datetime.utcnow() - start_time).total_seconds()
                
                # Record metrics
                perf_monitor.record_latency("streaming_total_time_ms", total_time * 1000)
                perf_monitor.record_token_usage(str(chat_request.provider), token_count)
                
                query_id = str(uuid.uuid4())
                query_logger = get_query_logger()
                logger.info(f"Attempting to log query {query_id} - logger enabled: {query_logger.enabled}")
                log_task = None
                if query_logger.enabled:
                    log_task = asyncio.create_task(query_logger.log_query(
                        query_id=query_id,
                        user_query=chat_request.message,
                        provider=str(chat_request.provider),
                        model=chat_request.model or getattr(llm, 'model_name', 'unknown'),
                        use_rag=chat_request.use_rag,
                        response=full_response,
                        sources_count=len(sources) if sources else 0,
                        processing_time=total_time,
                        tokens_used=token_count,
                        conversation_id=chat_request.conversation_id,
                        status=QueryStatus.SUCCESS,
                        metadata={
                            "temperature": chat_request.temperature,
                            "max_tokens": chat_request.max_tokens,
                            "include_sources": chat_request.include_sources,
                            "first_token_latency_ms": first_token_latency_ms,
                            "streaming": True
                        }
                    ))

                # Send completion event as soon as tokens finish streaming
                yield f"data: {json.dumps({'type': 'complete', 'duration': total_time, 'tokens': token_count})}\n\n"

                if follow_up_task:
                    try:
                        follow_up_questions = await follow_up_task
                    except Exception as fu_error:
                        logger.warning(f"Follow-up question generation failed: {fu_error}")
                        follow_up_questions = []
                    if follow_up_questions:
                        yield f"data: {json.dumps({'type': 'metadata', 'follow_up_questions': follow_up_questions})}\n\n"

                if advanced_cache and context and sources and full_response:
                    if cache_context_hash is None:
                        cache_context_hash = create_context_hash(
                            query=chat_request.message,
                            documents=[doc for doc, _ in results] if results else [],
                            model=chat_request.model or "default"
                        )
                    await advanced_cache.set_response(
                        query=chat_request.message,
                        context_hash=cache_context_hash,
                        response={
                            "response": full_response,
                            "sources": sources,
                            "follow_up_questions": follow_up_questions
                        },
                        model=chat_request.model or "default"
                    )

                if log_task is not None:
                    try:
                        await log_task
                    except Exception as log_error:
                        logger.error(f"Failed to log query: {log_error}")

        except Exception as pool_error:
            logger.warning(f"Failed to acquire from pool: {pool_error}. Creating new instance.")
            # Fallback to creating new instance
            llm_wrapper = await asyncio.to_thread(get_llm, chat_request.provider, chat_request.model)
            llm = llm_wrapper.llm
            
            # Continue with the same logic as above but without the pool
            # Initialize components
            query_optimizer = QueryOptimizer(llm_wrapper)
            
            # Initialize streaming handlers with queues
            streaming_queue = asyncio.Queue()
            retrieval_queue = asyncio.Queue()
            streaming_handler = StreamingCallbackHandler(streaming_queue)
            retrieval_handler = RetrievalStreamingHandler(retrieval_queue)
            
            # Setup callback manager for streaming (only include LangChain callback handlers)
            callback_manager = AsyncCallbackManager([streaming_handler])
            
            # Configure LLM with streaming
            llm.callbacks = callback_manager
            # Only set streaming for models that support it
            if hasattr(llm, 'streaming'):
                llm.streaming = True
            elif chat_request.provider == Provider.OPENAI or chat_request.provider == "openai":
                # OpenAI models support streaming even without the attribute
                pass
            else:
                logger.warning(f"Model {chat_request.provider} may not support streaming properly")
            
            # Initialize result processor for streaming
            result_processor = StreamingResultProcessor()
            
            # Advanced cache initialization
            advanced_cache = None
            cache_context_hash = None
            cached_response = None
            if cache_service:
                advanced_cache = AdvancedCacheService(cache_service)
            
            # Only create retrieval pipeline if RAG is enabled
            retrieval_pipeline = None
            context = ""
            sources = []
            results = []
            
            if chat_request.use_rag:
                # Yield retrieval start event
                yield f"data: {json.dumps({'type': 'retrieval_start'})}\n\n"
                
                # Query optimization (use rule-based only for speed)
                optimized_query = chat_request.message
                async with perf_monitor.measure_latency("query_optimization_ms"):
                    # Expand abbreviations
                    optimized_query = query_optimizer.expand_abbreviations(chat_request.message)
                    # Use rule-based classification to avoid LLM call
                    classification = query_optimizer._rule_based_classification(optimized_query)
                    if classification and classification.intent != "unknown":
                        expanded_queries = query_optimizer.expand_query(optimized_query, classification.intent)
                        if expanded_queries:
                            optimized_query = expanded_queries[0]
                    # If no location context is detected, optionally bias to default location
                    try:
                        if (not getattr(classification, 'location_context', None)) and settings.default_location:
                            optimized_query = f"{optimized_query} {settings.default_location}"
                            logger.info(f"[STREAM] Applied default location bias: {settings.default_location}")
                    except Exception as _e:
                        logger.warning(f"[STREAM] Unable to apply default location bias: {_e}")
                
                # Check if unified retrieval is enabled in request or config
                enable_unified = chat_request.__dict__.get("enable_unified_retrieval", settings.enable_unified_retrieval)
                
                # Use parallel retrieval pipeline (use wrapper for non-streaming operations)
                retrieval_pipeline = await get_retrieval_pipeline(
                    vector_store_manager=vector_store,
                    llm=llm_wrapper,
                    enable_unified=enable_unified
                )
                
                # Retrieve with progress updates
                logger.info("Starting retrieval for streaming query")
                
                # Set up retrieval monitoring
                retrieval_start = time.time()
                
                results = await retrieval_pipeline.retrieve(
                    query=optimized_query,
                    k=settings.max_chunks_per_query
                )
                
                retrieval_time = time.time() - retrieval_start
                yield f"data: {json.dumps({'type': 'retrieval_complete', 'duration': retrieval_time, 'count': len(results)})}\n\n"
                
                # Process results for streaming
                if results:
                    # Stream process results
                    # Process results and collect them
                    processed_docs = []
                    async for doc in result_processor.process_results_stream(
                        documents=[doc for doc, _ in results],
                        query=optimized_query
                    ):
                        processed_docs.append(doc)

                    if advanced_cache is not None:
                        try:
                            cache_documents = processed_docs or [doc for doc, _ in results]
                            cache_context_hash = create_context_hash(
                                query=chat_request.message,
                                documents=cache_documents,
                                model=chat_request.model or "default"
                            )
                            cached_response = await advanced_cache.get_response(
                                query=chat_request.message,
                                context_hash=cache_context_hash,
                                model=chat_request.model or "default"
                            )
                        except Exception as cache_error:
                            logger.warning(f"Advanced cache lookup failed: {cache_error}")

                    if cached_response:
                        yield f"data: {json.dumps({'type': 'cache_hit', 'level': 'l3'})}\n\n"
                        response_text = cached_response.get("response", "")
                        if response_text and first_token_time is None:
                            first_token_time = datetime.utcnow()
                            first_token_latency = (first_token_time - start_time).total_seconds() * 1000
                            perf_monitor.record_latency("first_token_latency_ms", first_token_latency)
                            first_token_latency_ms = first_token_latency
                            yield f"data: {json.dumps({'type': 'first_token', 'latency': first_token_latency})}\n\n"
                        if response_text:
                            yield f"data: {json.dumps({'type': 'token', 'content': response_text})}\n\n"
                        if cached_response.get("sources"):
                            yield f"data: {json.dumps({'type': 'sources', 'sources': cached_response['sources']})}\n\n"

                        yield f"data: {json.dumps({'type': 'complete'})}\n\n"

                        cached_followups = cached_response.get("follow_up_questions") or []
                        if cached_followups:
                            yield f"data: {json.dumps({'type': 'metadata', 'follow_up_questions': cached_followups})}\n\n"

                        return

                    # Use processed_docs instead of processed_results
                    processed_results = [(doc, doc.metadata.get('score', 0.0)) for doc in processed_docs]

                    # Build context
                    context_parts = []
                    sources = []
                    
                    for i, (doc, score) in enumerate(processed_results):
                        is_table_content = "|" in doc.page_content or "table" in doc.metadata.get("content_type", "").lower()
                        
                        if is_table_content:
                            context_parts.append(f"[Source {i+1} - Table Content]\n{doc.page_content}\n")
                        else:
                            context_parts.append(f"[Source {i+1}]\n{doc.page_content}\n")
                        
                        # Create source object
                        from app.models.query import Source
                        
                        # Handle different metadata field names
                        url = doc.metadata.get("source") or doc.metadata.get("url") or doc.metadata.get("file_path", "Unknown")
                        title = doc.metadata.get("title") or doc.metadata.get("filename") or url
                        
                        source = Source(
                            id=doc.metadata.get("id", f"source_{i}"),
                            text=doc.page_content[:settings.source_preview_max_length] if settings.source_preview_max_length > 0 else doc.page_content,
                            title=title,
                            url=url,
                            section=doc.metadata.get("section"),
                            page=doc.metadata.get("page_number"),
                            score=score,
                            metadata=doc.metadata
                        )
                        sources.append(source.dict())
                    
                    context = "\n".join(context_parts)
                    
                    # Send sources event
                    yield f"data: {json.dumps({'type': 'sources', 'sources': sources})}\n\n"
            
            # Build messages
            # Add short answer mode instructions if enabled
            short_answer_prefix = ""
            logger.info(f"[SHORT_ANSWER_DEBUG FALLBACK] chat_request.short_answer_mode = {chat_request.short_answer_mode}")
            if chat_request.short_answer_mode:
                short_answer_prefix = """RESPONSE MODE: SHORT ANSWER
Provide EXTREMELY BRIEF responses (1-3 sentences maximum).
Focus only on the essential information.
No elaboration, examples, or additional context unless specifically requested.

"""
                logger.info("[SHORT_ANSWER_DEBUG FALLBACK] Short answer prefix ADDED to system prompt")
            else:
                logger.info("[SHORT_ANSWER_DEBUG FALLBACK] Short answer mode is OFF - using normal prompt")
            
            system_prompt = short_answer_prefix + """You are a helpful assistant for Canadian Forces members seeking information about travel instructions and policies.
Always provide accurate, specific information based on the official documentation provided.
If you're not certain about something, clearly state that.

IMPORTANT RULES:
1. When multiple sources are present, prioritize the source that provides the most specific and complete information (e.g., actual dollar amounts over references to appendices)
2. NEVER mention source numbers, citations, or reference which source you used
3. Do NOT say things like "according to Source X" or "as stated in the documentation"
4. Give direct, clear answers without referencing the documentation structure
5. If specific values are found, state them directly without qualification
6. CRITICAL: For ANY rates or dollar amounts NOT found in the retrieved context (especially meal rates), you MUST say "not available in current documentation" - NEVER make up or estimate values
6. Always use proper markdown formatting in your responses:
   - Tables for structured data
   - **Bold** for important values or headers
   - Bullet points or numbered lists for multiple items
   - Clear section headers when appropriate

CRITICAL: When answering questions about rates, allowances, or tables:
nCRITICAL: When answering questions about authorization or permissions:
- ALWAYS include ANY restrictions, limitations, or maximum values found in the documentation
- Include distance limitations (e.g., 500 km per day)
- Include time restrictions
- Include approval requirements
- Never omit restrictions even if they seem secondary to the main question
- ALWAYS include the actual dollar amounts or specific values found in the documentation
- If you find a table structure (with | characters), preserve and present it as a markdown table
- For meal allowances: ONLY use breakfast, lunch, and dinner rates found in the retrieved documentation. If meal rates are not in the context, state "Meal rates not available in current documentation" - DO NOT make up or estimate rates
- For kilometric rates, include the cents per kilometer values
- For incidental allowances:
  • First 30 days: .30 per day
  • Days 31+: .00 per day (75% reduction) when staying in the same location
  • Last day (Change in Location - CIL): Always .30 per day regardless of trip duration
  • IMPORTANT: The last day is always at the full rate due to Change in Location (CIL)
  
  MANDATORY CALCULATION FOR TRIPS OVER 30 DAYS:
  You MUST apply this formula for any trip exceeding 30 days:
  - Days 1-30: Count × $17.30
  - Days 31 to (Total Days - 1): Count × $13.00
  - Last Day (CIL): .30
  
  Example for 44-day trip:
  - Days 1-30: 30 × $17.30 = $519.00
  - Days 31-43: 13 × $13.00 = $169.00  
  - Day 44 (CIL): 1 × $17.30 = $17.30
  - Total: $705.30
  
  ⚠️ WARNING: Simply multiplying total days × $17.30 is INCORRECT for trips over 30 days
- If the documentation contains a complete table, reproduce it in your response
- Do not summarize or generalize when specific values are available

SPECIAL INSTRUCTION FOR CLASS A RESERVISTS:
- After providing the general answer, ALWAYS add a section titled "**For Class A Reservists:**"
- In this section, provide specific information that applies to Class A Primary Reserve members
- Include any special conditions, restrictions, or entitlements that specifically apply to Class A service
- If there are differences in rates, allowances, or procedures for Class A members, highlight them
- Common Class A specific considerations include:
  - Travel time limits and restrictions
  - Meal allowance eligibility during training
  - Accommodation entitlements
  - Kilometric rate applications
  - TD (Temporary Duty) limitations
"""

            # DIAGNOSTIC: Log system prompt comparison (fallback flow)
            if PROMPT_DIAGNOSTICS_ENABLED:
                logger.info(f"[PROMPT_DIAG] Using streaming_chat.py endpoint (fallback)")
                logger.info(f"[PROMPT_DIAG] System prompt includes table formatting instructions: False")
                logger.info(f"[PROMPT_DIAG] Query: {chat_request.message}")
                logger.info(f"[SHORT_ANSWER_DEBUG FALLBACK] System prompt starts with: {system_prompt[:150]}...")

            messages = [SystemMessage(content=system_prompt)]
            
            # Add chat history
            if chat_request.chat_history:
                for msg in chat_request.chat_history:
                    if msg.role == "user":
                        messages.append(HumanMessage(content=msg.content))
                    elif msg.role == "assistant":
                        messages.append(AIMessage(content=msg.content))
                    # Skip system messages from history to avoid consecutive system messages
            
            # Add context or current message
            if context:
                context_prompt = f"""Based on the following official documentation, answer the user's question:

{context}


⚠️ IMPORTANT: If this is a trip plan request, DO NOT show any summary table at the beginning.
Show trip details and calculations first, then the summary table at the very END.
User Question: {chat_request.message}"""
                messages.append(HumanMessage(content=context_prompt))
            else:
                messages.append(HumanMessage(content=chat_request.message))
            
            # Apply delayed head streaming if using gated retrieval (fallback case)
            if use_gated_retrieval and settings.delayed_streaming_enabled:
                # Simple delay for gated retrieval queries (advanced streaming logic disabled for now)
                yield f"data: {json.dumps({'type': 'streaming_optimization', 'enabled': True})}\n\n"
                # Small delay to allow background processing
                await asyncio.sleep(0.05)  # 50ms delay

            # Yield generation start event
            yield f"data: {json.dumps({'type': 'generation_start'})}\n\n"
            
            first_token_time = None
            first_token_latency_ms = None

            # Stream the response
            token_count = 0
            full_response = ""
            async for chunk in llm.astream(messages):
                # Handle different chunk types from different providers
                content = None
                if hasattr(chunk, 'content'):
                    content = chunk.content
                elif isinstance(chunk, dict) and 'content' in chunk:
                    content = chunk['content']
                elif isinstance(chunk, str):
                    content = chunk
                
                if content:
                    # Record first token time
                    if first_token_time is None:
                        first_token_time = datetime.utcnow()
                        first_token_latency = (first_token_time - start_time).total_seconds() * 1000
                        perf_monitor.record_latency("first_token_latency_ms", first_token_latency)
                        first_token_latency_ms = first_token_latency
                        yield f"data: {json.dumps({'type': 'first_token', 'latency': first_token_latency})}\n\n"
                    
                    # Send token
                    yield f"data: {json.dumps({'type': 'token', 'content': content})}\n\n"
                    full_response += content
                    token_count += 1
                    
                    # Backpressure management - slow down if client is slow
                    if token_count % 10 == 0:
                        await asyncio.sleep(0.001)
            
            follow_up_task = None
            follow_up_questions = []
            if full_response:
                logger.info("Generating follow-up questions for streaming response (fallback)")
                follow_up_task = asyncio.create_task(
                    generate_follow_up_questions(
                        user_question=chat_request.message,
                        ai_response=full_response,
                        llm=llm,
                        sources=sources
                    )
                )

            # Calculate final metrics
            total_time = (datetime.utcnow() - start_time).total_seconds()
            
            # Record metrics
            perf_monitor.record_latency("streaming_total_time_ms", total_time * 1000)
            perf_monitor.record_token_usage(str(chat_request.provider), token_count)

            query_id = str(uuid.uuid4())
            query_logger = get_query_logger()
            log_task = None
            if query_logger.enabled:
                log_task = asyncio.create_task(query_logger.log_query(
                    query_id=query_id,
                    user_query=chat_request.message,
                    provider=str(chat_request.provider),
                    model=chat_request.model or getattr(llm, 'model_name', 'unknown'),
                    use_rag=chat_request.use_rag,
                    response=full_response,
                    sources_count=len(sources) if sources else 0,
                    processing_time=total_time,
                    tokens_used=token_count,
                    conversation_id=chat_request.conversation_id,
                    status=QueryStatus.SUCCESS,
                    metadata={
                        "temperature": chat_request.temperature,
                        "max_tokens": chat_request.max_tokens,
                        "include_sources": chat_request.include_sources,
                        "first_token_latency_ms": first_token_latency_ms,
                        "streaming": True,
                        "fallback": True
                    }
                ))

            yield f"data: {json.dumps({'type': 'complete', 'duration': total_time, 'tokens': token_count})}\n\n"

            if follow_up_task:
                try:
                    follow_up_questions = await follow_up_task
                except Exception as fu_error:
                    logger.warning(f"Follow-up question generation failed (fallback): {fu_error}")
                    follow_up_questions = []
                if follow_up_questions:
                    yield f"data: {json.dumps({'type': 'metadata', 'follow_up_questions': follow_up_questions})}\n\n"

            if advanced_cache and context and sources and full_response:
                if cache_context_hash is None:
                    cache_context_hash = create_context_hash(
                        query=chat_request.message,
                        documents=[doc for doc, _ in results] if results else [],
                        model=chat_request.model or "default"
                    )
                await advanced_cache.set_response(
                    query=chat_request.message,
                    context_hash=cache_context_hash,
                    response={
                        "response": full_response,
                        "sources": sources,
                        "follow_up_questions": follow_up_questions
                    },
                    model=chat_request.model or "default"
                )

            if log_task is not None:
                try:
                    await log_task
                except Exception as log_error:
                    logger.error(f"Failed to log query (fallback): {log_error}")
        
    except asyncio.CancelledError:
        # Client disconnected
        logger.info(f"Streaming connection {connection_id} cancelled by client")
        yield f"data: {json.dumps({'type': 'error', 'message': 'Connection cancelled'})}\n\n"
        raise
        
    except Exception as e:
        logger.error(f"Streaming chat error: {e}", exc_info=True)
        perf_monitor.increment_counter("streaming_errors")
        
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
            conversation_id=chat_request.conversation_id,
            status=QueryStatus.ERROR,
            error_message=str(e),
            metadata={
                "temperature": chat_request.temperature,
                "max_tokens": chat_request.max_tokens,
                "include_sources": chat_request.include_sources,
                "streaming": True
            }
        )
        
        error_message = str(e)
        if "rate limit" in error_message.lower():
            error_type = "rate_limit"
        elif "api key" in error_message.lower():
            error_type = "auth_error"
        else:
            error_type = "unknown_error"
        
        yield f"data: {json.dumps({'type': 'error', 'error_type': error_type, 'message': error_message})}\n\n"
        
    finally:
        # Connection cleanup is handled automatically by the async context manager
        logger.info(f"Streaming connection {connection_id} closed")
        perf_monitor.increment_counter("streaming_connections_closed")


@router.post("/streaming_chat")
async def streaming_chat(request: Request, chat_request: ChatRequest):
    """
    Streaming chat endpoint using Server-Sent Events.
    
    Returns real-time token-by-token responses with progress updates.
    """
    # Validate streaming support
    if not hasattr(settings, "enable_streaming") or not settings.enable_streaming:
        raise HTTPException(
            status_code=501,
            detail="Streaming is not enabled in this deployment"
        )
    
    # Create streaming response
    return StreamingResponse(
        generate_sse_events(chat_request, request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable Nginx buffering
        }
    )


@router.get("/streaming_chat/test")
async def test_streaming():
    """Test endpoint for streaming functionality."""
    async def generate():
        for i in range(10):
            yield f"data: {json.dumps({'type': 'test', 'count': i})}\n\n"
            await asyncio.sleep(0.5)
        yield f"data: {json.dumps({'type': 'complete'})}\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )
