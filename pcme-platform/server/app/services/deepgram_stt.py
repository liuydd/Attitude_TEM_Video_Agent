"""Deepgram Streaming STT service — connects to Deepgram WebSocket for real-time transcription."""

from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import AsyncIterator

import websockets
from websockets.asyncio.client import ClientConnection

from app.config import settings

logger = logging.getLogger(__name__)

DEEPGRAM_WS_URL = "wss://api.deepgram.com/v1/listen"


class DeepgramSTTService:
    """Streams raw PCM audio to Deepgram and yields transcription events."""

    def __init__(self, *, language: str | None = None, diarize: bool = False) -> None:
        self._ws: ClientConnection | None = None
        self._language = language or settings.deepgram_language
        self._diarize = diarize
        self._closed = False

    async def connect(self) -> None:
        params = (
            f"encoding=linear16&sample_rate=16000&channels=1"
            f"&model=nova-2&language={self._language}"
            f"&interim_results=true&utterance_end_ms=1200&vad_events=true"
        )
        if self._diarize:
            params += "&diarize=true"
        url = f"{DEEPGRAM_WS_URL}?{params}"
        headers = {"Authorization": f"Token {settings.deepgram_api_key}"}
        self._ws = await websockets.connect(url, additional_headers=headers)
        logger.info("Deepgram STT connected (diarize=%s)", self._diarize)

    async def send_audio(self, pcm_bytes: bytes) -> None:
        if self._ws and not self._closed:
            await self._ws.send(pcm_bytes)

    async def transcripts(self) -> AsyncIterator[dict]:
        """Async iterator yielding parsed Deepgram transcript messages."""
        if not self._ws:
            return
        try:
            async for raw in self._ws:
                if isinstance(raw, bytes):
                    continue
                msg = json.loads(raw)
                yield msg
        except websockets.exceptions.ConnectionClosed:
            if not self._closed:
                logger.warning("Deepgram WS closed unexpectedly")
        except asyncio.CancelledError:
            pass

    async def close(self) -> None:
        self._closed = True
        if self._ws:
            try:
                await self._ws.send(b"")  # close signal
                await self._ws.close()
            except Exception:
                pass
            self._ws = None
        logger.info("Deepgram STT closed")
