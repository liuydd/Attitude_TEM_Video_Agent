"""LLM service — wraps OpenAI ChatCompletion streaming for conversation."""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator

from openai import AsyncOpenAI

from app.config import settings

logger = logging.getLogger(__name__)


class LLMService:
    """Maintains conversation history and streams GPT-4o responses."""

    def __init__(self, *, system_prompt: str | None = None) -> None:
        self._client = AsyncOpenAI(api_key=settings.openai_api_key)
        self._model = settings.voice_agent_model
        self._messages: list[dict[str, str]] = [
            {"role": "system", "content": system_prompt or settings.voice_agent_system_prompt},
        ]

    def add_user_message(self, text: str) -> None:
        self._messages.append({"role": "user", "content": text})

    def add_context_message(self, text: str) -> None:
        """Add a hidden system-level context (injected as 'system' role, invisible to user UI)."""
        self._messages.append({"role": "system", "content": text})

    def add_assistant_message(self, text: str) -> None:
        self._messages.append({"role": "assistant", "content": text})

    async def stream_response(self) -> AsyncIterator[str]:
        """Yield content deltas from the streaming ChatCompletion."""
        stream = await self._client.chat.completions.create(
            model=self._model,
            messages=self._messages,
            stream=True,
        )
        async for chunk in stream:
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta
            if delta.content:
                yield delta.content
