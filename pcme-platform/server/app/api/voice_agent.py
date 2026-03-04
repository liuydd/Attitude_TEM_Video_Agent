"""WebSocket endpoint for real-time voice agent (STT → LLM → TTS) and control mode (STT-only)."""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.config import settings
from app.services.deepgram_stt import DeepgramSTTService
from app.services.llm_service import LLMService
from app.services.tts_service import TTSService
from app.services.video_timeline import VideoTimelineService
from app.store import store

logger = logging.getLogger(__name__)

router = APIRouter()

# Track active connections per session to prevent duplicates
_active_connections: dict[str, WebSocket] = {}

SENTENCE_ENDINGS = set("。！？.!?")


def _session_path(session_id: str):
    return settings.metadata_dir / "sessions" / f"{session_id}.json"


def _extract_speaker(alternatives: list[dict]) -> int | None:
    """Extract speaker ID from Deepgram diarization word data."""
    if not alternatives:
        return None
    words = alternatives[0].get("words", [])
    if not words:
        return None
    # Use the speaker of the first word as the utterance speaker
    return words[0].get("speaker")


@router.websocket("/ws/voice-agent/{session_id}")
async def voice_agent_ws(ws: WebSocket, session_id: str):
    # Validate session exists
    session_data = await asyncio.to_thread(store.load_one, _session_path(session_id))
    if not session_data:
        await ws.close(code=4004, reason="Session not found")
        return

    # Reject duplicate connections
    if session_id in _active_connections:
        await ws.close(code=4009, reason="Session already has an active voice connection")
        return

    # Determine mode from experiment group_type
    group_type = "experimental"  # default
    exp_id = session_data.get("experiment_id")
    exp_data: dict | None = None
    if exp_id:
        exp_path = settings.metadata_dir / "experiments.json"
        experiments = await asyncio.to_thread(store.load_all, exp_path)
        exp_data = store.find_by_field(experiments, "id", exp_id)
        if exp_data:
            group_type = exp_data.get("group_type", "experimental")

    is_agent_mode = group_type == "experimental"

    await ws.accept()
    _active_connections[session_id] = ws

    # Init STT — diarize only in control mode (two humans)
    stt = DeepgramSTTService(diarize=not is_agent_mode)

    # Only init LLM/TTS in agent mode
    llm: LLMService | None = None
    tts: TTSService | None = None
    timeline: VideoTimelineService | None = None
    if is_agent_mode:
        llm = LLMService()
        tts = TTSService()
        if exp_data and exp_data.get("training_video_filename"):
            timeline = VideoTimelineService(exp_data["training_video_filename"])

    respond_task: asyncio.Task | None = None
    stt_listener_task: asyncio.Task | None = None
    current_video_time: float = 0.0

    async def _send_json(data: dict) -> None:
        try:
            await ws.send_text(json.dumps(data, ensure_ascii=False))
        except Exception:
            pass

    # ---- Agent mode helpers ----

    async def _respond(user_text: str, turn_id: str) -> None:
        """Run LLM streaming + sentence-level TTS pipeline for one turn."""
        assert llm is not None and tts is not None

        # Inject video timeline context (invisible to user UI)
        if timeline:
            ctx = timeline.get_context(current_video_time)
            if ctx:
                llm.add_context_message(ctx)

        llm.add_user_message(user_text)
        full_text = ""
        sentence_buf = ""

        try:
            async for delta in llm.stream_response():
                full_text += delta
                sentence_buf += delta
                await _send_json({"type": "llm_delta", "text": delta, "turn_id": turn_id})

                # Check for sentence boundary → kick off TTS immediately
                if sentence_buf and sentence_buf[-1] in SENTENCE_ENDINGS:
                    await _stream_tts(sentence_buf, turn_id)
                    sentence_buf = ""

            # Flush remaining text to TTS
            if sentence_buf.strip():
                await _stream_tts(sentence_buf, turn_id)

            await _send_json({"type": "llm_done", "full_text": full_text, "turn_id": turn_id})
            llm.add_assistant_message(full_text)

            await _send_json({"type": "tts_done", "turn_id": turn_id})

            # Persist conversation turn
            await _save_turn(session_id, turn_id, user_text, full_text)

        except asyncio.CancelledError:
            llm.add_assistant_message(full_text or "(interrupted)")
            await _save_turn(session_id, turn_id, user_text, full_text or "(interrupted)")
            raise

    async def _stream_tts(text: str, turn_id: str) -> None:
        """Stream TTS audio chunks as binary frames."""
        assert tts is not None
        try:
            async for audio_chunk in tts.stream_speech(text):
                await ws.send_bytes(audio_chunk)
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.error("TTS error: %s", e)

    async def _save_turn(
        session_id: str,
        turn_id: str,
        user_text: str,
        assistant_text: str,
        *,
        speaker: int | None = None,
    ) -> None:
        """Append conversation turn to session JSON."""
        turn: dict = {
            "turn_id": turn_id,
            "user_text": user_text,
            "assistant_text": assistant_text,
            "timestamp": datetime.now(UTC).isoformat(),
        }
        if speaker is not None:
            turn["speaker"] = speaker

        def _write():
            data = store.load_one(_session_path(session_id))
            if data:
                data.setdefault("conversation", []).append(turn)
                store.save_one(_session_path(session_id), data)

        await asyncio.to_thread(_write)

    # ---- Control mode helper ----

    async def _save_control_utterance(turn_id: str, text: str, speaker: int | None) -> None:
        """Save a transcribed utterance in control mode (no LLM response)."""
        turn: dict = {
            "turn_id": turn_id,
            "speaker": speaker,
            "text": text,
            "timestamp": datetime.now(UTC).isoformat(),
        }

        def _write():
            data = store.load_one(_session_path(session_id))
            if data:
                data.setdefault("conversation", []).append(turn)
                store.save_one(_session_path(session_id), data)

        await asyncio.to_thread(_write)

    # ---- STT listener (handles both modes) ----

    async def _stt_listener() -> None:
        """Listen to Deepgram transcripts and dispatch based on mode."""
        nonlocal respond_task
        try:
            async for msg in stt.transcripts():
                msg_type = msg.get("type", "")

                if msg_type == "Results":
                    channel = msg.get("channel", {})
                    alternatives = channel.get("alternatives", [{}])
                    transcript = alternatives[0].get("transcript", "") if alternatives else ""
                    is_final = msg.get("is_final", False)
                    speech_final = msg.get("speech_final", False)
                    speaker = _extract_speaker(alternatives) if not is_agent_mode else None

                    if transcript:
                        if not is_final:
                            partial_msg: dict = {
                                "type": "transcript_partial",
                                "text": transcript,
                            }
                            if speaker is not None:
                                partial_msg["speaker"] = speaker
                            await _send_json(partial_msg)

                        elif is_final:
                            turn_id = str(uuid.uuid4())
                            final_msg: dict = {
                                "type": "transcript_final",
                                "text": transcript,
                                "turn_id": turn_id,
                            }
                            if speaker is not None:
                                final_msg["speaker"] = speaker
                            await _send_json(final_msg)

                            if speech_final:
                                if is_agent_mode:
                                    # Agent mode: trigger LLM response
                                    if respond_task and not respond_task.done():
                                        respond_task.cancel()
                                        try:
                                            await respond_task
                                        except (asyncio.CancelledError, Exception):
                                            pass
                                    respond_task = asyncio.create_task(
                                        _respond(transcript, turn_id)
                                    )
                                else:
                                    # Control mode: just save the utterance
                                    await _save_control_utterance(turn_id, transcript, speaker)

        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error("STT listener error: %s", e)

    try:
        # Connect to Deepgram
        await stt.connect()
        await _send_json(
            {
                "type": "ready",
                "mode": "agent" if is_agent_mode else "control",
            }
        )

        # Start STT listener
        stt_listener_task = asyncio.create_task(_stt_listener())

        # Main receive loop
        while True:
            message = await ws.receive()

            if message["type"] == "websocket.disconnect":
                break

            if "bytes" in message and message["bytes"]:
                # Binary frame = audio data
                await stt.send_audio(message["bytes"])

            elif "text" in message and message["text"]:
                # Text frame = control message
                try:
                    ctrl = json.loads(message["text"])
                except json.JSONDecodeError:
                    continue

                if ctrl.get("type") == "interrupt" and is_agent_mode:
                    turn_id = ""
                    if respond_task and not respond_task.done():
                        turn_id = "current"
                        respond_task.cancel()
                        try:
                            await respond_task
                        except (asyncio.CancelledError, Exception):
                            pass
                    await _send_json({"type": "interrupted", "turn_id": turn_id})

                elif ctrl.get("type") == "video_time":
                    current_video_time = float(ctrl.get("time", 0))

                elif ctrl.get("type") == "config":
                    logger.info("Runtime config update: %s", ctrl)

    except WebSocketDisconnect:
        logger.info("Voice WS disconnected: session=%s", session_id)
    except Exception as e:
        logger.error("Voice WS error: %s", e)
        await _send_json({"type": "error", "message": str(e), "code": "internal"})
    finally:
        # Cleanup
        if stt_listener_task:
            stt_listener_task.cancel()
            try:
                await stt_listener_task
            except (asyncio.CancelledError, Exception):
                pass
        if respond_task and not respond_task.done():
            respond_task.cancel()
            try:
                await respond_task
            except (asyncio.CancelledError, Exception):
                pass
        await stt.close()
        _active_connections.pop(session_id, None)
