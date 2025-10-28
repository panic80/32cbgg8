"""Chat API router (streaming-only service)."""

from __future__ import annotations

import asyncio
import uuid
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Request, status
from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI

from app.core.config import settings
from app.core.logging import get_logger
from app.models.query import (
    ChatRequest,
    ChatResponse,
    FollowUpQuestion,
    FollowUpRequest,
    FollowUpResponse,
    Provider,
)
from app.utils.langchain_utils import RetryableLLM

router = APIRouter()
logger = get_logger(__name__)


def get_llm(provider: Provider, model: Optional[str] = None) -> RetryableLLM:
    """Create a deterministic LLM client for the given provider/model."""

    if isinstance(provider, str):
        provider = Provider(provider)

    if provider == Provider.OPENAI:
        if not settings.openai_api_key:
            raise ValueError("OpenAI API key not configured")

        model_name = model or settings.openai_chat_model
        model_name_lower = (model_name or "").strip().lower()
        allowed_deterministic_models = {"gpt-5-mini", "gpt-4.1-mini"}

        is_reasoning_model = bool(model_name_lower) and (
            model_name_lower.startswith("o1")
            or model_name_lower.startswith("o3")
            or model_name_lower.startswith("o4")
        )
        is_allowed_deterministic = model_name_lower in allowed_deterministic_models

        if not (is_reasoning_model or is_allowed_deterministic):
            raise ValueError(
                f"Unsupported OpenAI chat model '{model_name}'. "
                "For deterministic retrieval runs, use gpt-5-mini, gpt-4.1-mini, "
                "or an O-series reasoning model."
            )

        logger.info(
            "Creating deterministic OpenAI LLM for model: %s (reasoning_model=%s)",
            model_name,
            is_reasoning_model,
        )

        llm_kwargs: Dict[str, Any] = {
            "api_key": settings.openai_api_key,
            "model": model_name,
        }

        if is_reasoning_model or model_name_lower == "gpt-5-mini":
            llm_kwargs["max_tokens"] = 8192

        llm = ChatOpenAI(**llm_kwargs)
        return RetryableLLM(llm)

    if provider in (Provider.GOOGLE, Provider.ANTHROPIC):
        raise ValueError(
            f"Provider '{provider}' is temporarily disabled to enforce deterministic retrieval."
        )

    raise ValueError(f"Unsupported provider: {provider}")


@router.post("/chat", response_model=ChatResponse)
async def chat(request: Request, chat_request: ChatRequest) -> ChatResponse:  # pylint: disable=unused-argument
    """Deprecated synchronous chat endpoint."""

    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail={
            "error": "deprecated_endpoint",
            "message": "The synchronous /chat endpoint is deprecated. Use /chat/stream instead.",
        },
    )


@router.post("/followup", response_model=FollowUpResponse)
async def generate_followup(
    request: Request,  # pylint: disable=unused-argument
    followup_request: FollowUpRequest,
) -> FollowUpResponse:
    """Generate follow-up questions for a completed chat exchange."""

    try:
        llm = await asyncio.to_thread(get_llm, Provider.OPENAI)

        sources_text = ""
        if followup_request.sources:
            sources_text = "\n\nBased on these sources:\n" + "\n".join(
                [
                    f"- {s.title or 'Document'}: {s.text[:100]}..."
                    for s in followup_request.sources[:3]
                ]
            )

        prompt = (
            f"Based on this conversation, generate {followup_request.max_questions} relevant "
            "follow-up questions that would help the user learn more:\n\n"
            f"User Question: \"{followup_request.user_question}\"\n"
            f"AI Response: \"{followup_request.ai_response}\""
            f"{sources_text}\n\n"
            "Generate follow-up questions that:\n"
            "1. Explore related topics mentioned in the response\n"
            "2. Clarify specific details\n"
            "3. Ask about practical applications\n\n"
            "Format each question on a new line, starting with \"Q:\"."
        )

        response = await llm.ainvoke([HumanMessage(content=prompt)])

        questions = []
        lines = response.content.split("\n")

        for i, line in enumerate(lines):
            line = line.strip()
            if line.startswith("Q:"):
                question_text = line[2:].strip()
            elif line and not line.startswith("Q:") and i > 0:
                question_text = line
            else:
                continue

            if not question_text:
                continue

            category = "general"
            lowered = question_text.lower()
            if any(word in lowered for word in ["how", "steps", "process"]):
                category = "procedural"
            elif any(word in lowered for word in ["why", "reason", "purpose"]):
                category = "explanatory"
            elif any(word in lowered for word in ["when", "deadline", "time"]):
                category = "temporal"

            questions.append(
                FollowUpQuestion(
                    id=f"followup_{uuid.uuid4().hex[:8]}",
                    question=question_text,
                    category=category,
                    confidence=0.7,
                )
            )

            if len(questions) >= followup_request.max_questions:
                break

        if not questions:
            questions = [
                FollowUpQuestion(
                    id="followup_default_1",
                    question="Can you provide more specific examples?",
                    category="clarification",
                    confidence=0.5,
                ),
                FollowUpQuestion(
                    id="followup_default_2",
                    question="What are the key requirements I should know?",
                    category="requirements",
                    confidence=0.5,
                ),
                FollowUpQuestion(
                    id="followup_default_3",
                    question="Where can I find the official documentation?",
                    category="resources",
                    confidence=0.5,
                ),
            ]

        return FollowUpResponse(questions=questions[: followup_request.max_questions])

    except Exception as exc:  # pragma: no cover - defensive logging
        logger.error("Follow-up generation failed: %s", exc, exc_info=True)
        return FollowUpResponse(
            questions=[
                FollowUpQuestion(
                    id="followup_error",
                    question="Could you clarify your question?",
                    category="clarification",
                    confidence=0.3,
                )
            ]
        )
