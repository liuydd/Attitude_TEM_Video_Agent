"""TTS service — calls OpenAI TTS API and streams PCM audio."""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator

from openai import AsyncOpenAI

from app.config import settings

logger = logging.getLogger(__name__)


class TTSService:
    """Streams speech audio from OpenAI TTS as raw PCM 24kHz 16-bit LE mono."""

    def __init__(self) -> None:
        self._client = AsyncOpenAI(api_key=settings.openai_api_key)

    async def stream_speech(self, text: str) -> AsyncIterator[bytes]:
        """Yield PCM audio chunks for the given text."""
        if not text.strip():
            return
        response = await self._client.audio.speech.create(
            model=settings.tts_model,
            voice=settings.tts_voice,
            input=text,
            response_format="pcm",  # 24kHz 16-bit LE mono
        )
        async for chunk in response.response.aiter_bytes(chunk_size=4800):
            yield chunk
