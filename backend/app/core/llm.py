"""
LLM Provider Abstraction Layer
Supports Gemini, Groq, OpenAI with automatic fallback.

Design: FULLY LAZY — no network calls at import or startup.
Client objects are created on the first ainvoke/astream call only.
"""
from __future__ import annotations
from typing import Optional, Any, AsyncIterator
import asyncio
from app.core.config import settings
from app.core.logging import logger


def _has_key(key: Optional[str]) -> bool:
    return bool(key) and "your_" not in key and len(key.strip()) > 10


class _MockResponse:
    def __init__(self):
        self.content = (
            "⚠️ No LLM API key configured. "
            "Add GEMINI_API_KEY or GROQ_API_KEY to backend/.env and restart the server."
        )


class LLMProvider:
    """Singleton — lazy client creation, automatic fallback."""

    _instance: Optional[LLMProvider] = None
    _primary = None
    _fallback = None
    _clients_created: bool = False
    _lock: Optional[asyncio.Lock] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    # ── startup hook (no network) ─────────────────────────────────────────
    def initialize(self) -> None:
        """Called at app startup. Only logs config — zero network calls."""
        if _has_key(settings.GEMINI_API_KEY):
            logger.info("llm_key_found", provider="gemini", model=settings.LLM_MODEL)
        if _has_key(settings.GROQ_API_KEY):
            logger.info("llm_key_found", provider="groq")
        if not _has_key(settings.GEMINI_API_KEY) and not _has_key(settings.GROQ_API_KEY):
            logger.warning("llm_no_keys", tip="Add GEMINI_API_KEY or GROQ_API_KEY to backend/.env")

    # ── lazy client builder ───────────────────────────────────────────────
    def _ensure_clients(self) -> None:
        """Create client objects if not yet done. Called before first inference."""
        if self._clients_created:
            return
        self._clients_created = True

        provider = settings.LLM_PROVIDER.lower()

        # Primary
        try:
            self._primary = self._build(provider)
            logger.info("llm_client_ready", provider=provider)
        except Exception as e:
            logger.warning("llm_primary_skip", reason=str(e)[:100])

        # Fallback (different provider)
        alt = "groq" if provider != "groq" else "gemini"
        try:
            if alt != provider:
                self._fallback = self._build(alt)
                logger.info("llm_fallback_ready", provider=alt)
        except Exception:
            pass

    def _build(self, provider: str):
        if provider == "gemini":
            if not _has_key(settings.GEMINI_API_KEY):
                raise ValueError("GEMINI_API_KEY not set")
            from langchain_google_genai import ChatGoogleGenerativeAI
            return ChatGoogleGenerativeAI(
                model=settings.LLM_MODEL,
                google_api_key=settings.GEMINI_API_KEY,
                temperature=settings.LLM_TEMPERATURE,
                max_output_tokens=settings.LLM_MAX_TOKENS,
            )
        if provider == "groq":
            if not _has_key(settings.GROQ_API_KEY):
                raise ValueError("GROQ_API_KEY not set")
            from langchain_groq import ChatGroq
            return ChatGroq(
                model="llama-3.3-70b-versatile",
                groq_api_key=settings.GROQ_API_KEY,
                temperature=settings.LLM_TEMPERATURE,
                max_tokens=settings.LLM_MAX_TOKENS,
            )
        if provider == "openai":
            if not _has_key(settings.OPENAI_API_KEY):
                raise ValueError("OPENAI_API_KEY not set")
            from langchain_openai import ChatOpenAI
            return ChatOpenAI(
                model="gpt-4o-mini",
                openai_api_key=settings.OPENAI_API_KEY,
                temperature=settings.LLM_TEMPERATURE,
                max_tokens=settings.LLM_MAX_TOKENS,
            )
        raise ValueError(f"Unknown provider: {provider}")

    # ── inference ─────────────────────────────────────────────────────────
    async def ainvoke(self, messages: list, **kwargs) -> Any:
        self._ensure_clients()
        llm = self._primary or self._fallback
        if llm is None:
            return _MockResponse()
        try:
            return await (self._primary or llm).ainvoke(messages, **kwargs)
        except Exception as e:
            logger.warning("primary_llm_failed", error=str(e)[:150])
            if self._fallback and self._primary is not None:
                try:
                    return await self._fallback.ainvoke(messages, **kwargs)
                except Exception as e2:
                    logger.warning("fallback_llm_failed", error=str(e2)[:150])
                    raise e2
            raise

    async def astream(self, messages: list, **kwargs) -> AsyncIterator[str]:
        self._ensure_clients()
        llm = self._primary or self._fallback
        if llm is None:
            yield _MockResponse().content
            return
        try:
            async for chunk in llm.astream(messages, **kwargs):
                yield chunk.content if hasattr(chunk, "content") else str(chunk)
        except Exception as e:
            logger.warning("stream_failed", error=str(e)[:150])
            if self._fallback and llm is not self._fallback:
                async for chunk in self._fallback.astream(messages, **kwargs):
                    yield chunk.content if hasattr(chunk, "content") else str(chunk)
            else:
                raise

    @property
    def is_ready(self) -> bool:
        return _has_key(settings.GEMINI_API_KEY) or _has_key(settings.GROQ_API_KEY)


# ── singleton ─────────────────────────────────────────────────────────────────
llm_provider = LLMProvider()


def build_messages(system: str, user: str, history: list = None) -> list:
    """
    Build LangChain message list compatible with Gemini, Groq, and OpenAI.
    System prompt is merged into the HumanMessage to avoid Gemini SystemMessage issues.
    """
    from langchain_core.messages import HumanMessage, AIMessage

    messages = []

    # Add history turns first (if any)
    if history:
        for msg in history[-6:]:
            role = msg.get("role", "")
            content = msg.get("content", "")
            if role == "user":
                messages.append(HumanMessage(content=content))
            elif role == "assistant":
                messages.append(AIMessage(content=content))

    # Current turn: system + user merged into one HumanMessage
    messages.append(HumanMessage(content=f"{system}\n\n---\n\n{user}"))
    return messages
