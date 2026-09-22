"""WebSocket endpoint for real-time voice agent (STT → LLM → TTS) and control mode (STT-only)."""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from openai import AsyncOpenAI

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

_PERSONA_MODULES = {
    "high_warmth": """
## 高温暖条件
你应表现出较高程度的社会温暖和互动亲和力。

### 具体要求
1. 对学员的观点进行适度的积极回应。
2. 在合适的时候表达理解、感谢或鼓励。
3. 使用自然、口语化的表达。
4. 适当邀请学员继续说明自己的判断。
5. 让互动具有合作讨论的感觉。
6. 可以使用“我理解你的判断”“这个思路是合理的”“我们可以进一步看看”等表达。

### 注意
1. 不要过度夸奖。
2. 不要无条件认同学员。
3. 不要为了表现友好而牺牲分析质量。
4. 不要频繁使用情绪化语言。
5. 不要使用明显的人格化或亲密称呼。
""",
    "low_warmth": """
## 低温暖条件
你应表现出较低程度的社会温暖，但保持专业、礼貌和中性。

### 具体要求
1. 直接回应学员的问题和观点。
2. 使用正式、客观、简洁的表达。
3. 不主动表达共情、鼓励或称赞。
4. 不主动感谢学员。
5. 不主动建立社会关系或营造亲近感。
6. 可以指出学员观点合理或存在问题，但使用客观描述，不进行情绪化评价。

### 注意
1. 低温暖不等于无礼。
2. 不要表现出敌意、嘲讽、不耐烦或贬低。
3. 不要故意拒绝回答。
4. 不要使用攻击性语言。
5. 主要通过减少社会性表达和增加正式、直接的表达来体现低温暖。
""",
    "high_competence": """
## 高能力条件
你应表现出较高程度的专业能力和情境分析能力。

### 具体要求
1. 准确理解当前飞行情境。
2. 主动识别与当前任务相关的重要威胁和潜在差错。
3. 综合考虑多个相关因素，而不是只考虑单一因素。
4. 对判断提供清晰、合理的解释。
5. 在适当情况下考虑风险之间的相互影响。
6. 使用准确、适当的飞行训练相关术语。
7. 如果学员遗漏了重要因素，应主动指出。
8. 在信息允许的情况下，可以提出多个合理的分析角度。

回答应体现出完整、系统和有依据的分析能力，同时仍须遵守基础提示词规定的实时语音回复长度。
""",
    "low_competence": """
## 低能力条件
你应表现出相对有限的专业分析能力，但仍能够完成基本的情境讨论。

### 具体要求
1. 能够理解当前情境的主要信息。
2. 可以识别较明显的威胁或风险。
3. 分析通常围绕一到两个较明显的因素展开。
4. 对复杂问题的分析深度有限。
5. 可以遗漏部分次要或隐含因素。
6. 可以对复杂情境进行适度简化。
7. 较少主动提出多角度分析。
8. 对判断的依据解释较少。

### 重要限制
1. 不得故意提供危险的飞行操作建议。
2. 不得虚构航空法规或训练标准。
3. 不得故意颠倒实验情境中的核心事实。
4. 不得制造明显违反飞行安全原则的建议。
5. “低能力”主要通过分析不完整、推理深度不足和信息遗漏体现，而不是通过危险性错误体现。
""",
}
def _persona_system_prompt(experiment: dict | None) -> str | None:
    """Append the assigned experimental Persona modules to the base system prompt."""
    config = (experiment or {}).get("config") or {}
    warmth = config.get("warmth_level")
    competence = config.get("competence_level")
    warmth_key = f"{warmth}_warmth"
    competence_key = f"{competence}_competence"
    if warmth_key not in _PERSONA_MODULES or competence_key not in _PERSONA_MODULES:
        return None

    return (
        f"{settings.voice_agent_system_prompt}\n\n"
        "# AI Persona 实验条件（交互风格最高优先级）\n"
        "本次实验已分配以下温暖与能力条件。你必须在整个 session 中持续、一致地执行两个模块。"
        "当模块与基础提示词中的语气、互动风格示例冲突时，以本模块为准；"
        "但本模块不得覆盖基础提示词中的安全规则、仅讨论当前视频进度的规则和回复长度限制。\n"
        f"{_PERSONA_MODULES[warmth_key]}\n{_PERSONA_MODULES[competence_key]}"
    )

_CORRECTION_PROMPT = (
    "你是语音识别纠错助手。修正以下中文语音识别文本中的错别字、同音误识别和专业术语错误。"
    "规则：1)保持原意不变 2)不添加或删除内容 3)不改变语序 4)只输出修正后的纯文本，不要任何解释。"
)

_correction_client: AsyncOpenAI | None = None


def _get_correction_client() -> AsyncOpenAI:
    global _correction_client
    if _correction_client is None:
        _correction_client = AsyncOpenAI(api_key=settings.openai_api_key)
    return _correction_client


async def _correct_transcript(raw_text: str) -> str:
    """Use a fast LLM to correct STT errors. Returns corrected text, or raw_text on failure."""
    try:
        client = _get_correction_client()
        resp = await client.chat.completions.create(
            model=settings.transcript_correction_model,
            messages=[
                {"role": "system", "content": _CORRECTION_PROMPT},
                {"role": "user", "content": raw_text},
            ],
            temperature=0,
            max_tokens=len(raw_text) * 2 + 50,
        )
        corrected = (resp.choices[0].message.content or "").strip()
        if corrected:
            logger.info("Transcript corrected: %r → %r", raw_text[:80], corrected[:80])
            return corrected
        return raw_text
    except Exception as e:
        logger.warning("Transcript correction failed, using raw text: %s", e)
        return raw_text


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

    # Init STT — no diarization (control mode uses manual speaker selection)
    stt = DeepgramSTTService()

    # Only init LLM/TTS in agent mode
    llm: LLMService | None = None
    tts: TTSService | None = None
    timeline: VideoTimelineService | None = None
    if is_agent_mode:
        llm = LLMService(system_prompt=_persona_system_prompt(exp_data))
        tts = TTSService()
        if exp_data and exp_data.get("training_video_filename"):
            timeline = VideoTimelineService(exp_data["training_video_filename"])

    respond_task: asyncio.Task | None = None
    stt_listener_task: asyncio.Task | None = None
    current_video_time: float = 0.0

    # Accumulation buffer for speech fragments (both modes)
    _accumulation_buffer: list[str] = []
    _accumulation_turn_ids: list[str] = []
    _accumulation_timer: asyncio.Task | None = None
    _accumulation_speaker: int | None = None  # track speaker for control mode

    # Manual speaker selection (control mode — set by frontend toggle)
    _manual_speaker: int = 0

    # Normalize Deepgram speaker IDs to {0, 1} (control mode only)
    _speaker_map: dict[int, int] = {}

    def _normalize_speaker(raw_speaker: int | None) -> int | None:
        """Map arbitrary Deepgram speaker IDs to 0 or 1 by first-seen order."""
        if raw_speaker is None:
            return None
        if raw_speaker in _speaker_map:
            return _speaker_map[raw_speaker]
        if len(_speaker_map) < 2:
            mapped = len(_speaker_map)  # 0 for first, 1 for second
            _speaker_map[raw_speaker] = mapped
            return mapped
        # Already have 2 speakers; find closest existing mapping
        # Default to speaker 0 for any unexpected extra IDs
        return 0

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

    # ---- Accumulation buffer helpers (both modes) ----

    async def _flush_accumulation_buffer() -> None:
        """Timer expired — correct text, send aggregated message, dispatch by mode."""
        nonlocal respond_task, _accumulation_buffer, _accumulation_turn_ids, _accumulation_timer, _accumulation_speaker
        if not _accumulation_buffer:
            return

        raw_text = " ".join(_accumulation_buffer)
        aggregated_turn_id = _accumulation_turn_ids[-1]  # use last turn_id
        fragment_count = len(_accumulation_buffer)
        flushed_speaker = _accumulation_speaker

        _accumulation_buffer = []
        _accumulation_turn_ids = []
        _accumulation_timer = None
        _accumulation_speaker = None

        # Filter ultra-short utterances (filler words like "嗯", "啊")
        if len(raw_text.strip()) < settings.min_transcript_length:
            logger.debug("Dropping short utterance (%d chars): %s", len(raw_text.strip()), raw_text)
            return

        logger.info("Flushing %d fragments (%d chars): %s", fragment_count, len(raw_text), raw_text[:100])

        # Correct STT errors with fast LLM
        corrected_text = await _correct_transcript(raw_text)

        agg_msg: dict = {
            "type": "transcript_aggregated",
            "text": corrected_text,
            "raw_text": raw_text,
            "turn_id": aggregated_turn_id,
        }
        if flushed_speaker is not None:
            agg_msg["speaker"] = flushed_speaker
        await _send_json(agg_msg)

        if is_agent_mode:
            # Cancel any in-flight LLM response before starting new one
            if respond_task and not respond_task.done():
                respond_task.cancel()
                try:
                    await respond_task
                except (asyncio.CancelledError, Exception):
                    pass
            # Feed corrected text to LLM for better response quality
            respond_task = asyncio.create_task(_respond(corrected_text, aggregated_turn_id))
        else:
            # Control mode: save corrected utterance
            await _save_control_utterance(aggregated_turn_id, corrected_text, flushed_speaker)

    async def _accumulation_timer_coro() -> None:
        """Sleep for the configured timeout then flush."""
        try:
            await asyncio.sleep(settings.speech_accumulation_timeout)
            await _flush_accumulation_buffer()
        except asyncio.CancelledError:
            pass

    def _reset_accumulation_timer() -> None:
        """Cancel existing timer (if any) and start a new debounce timer."""
        nonlocal _accumulation_timer
        if _accumulation_timer and not _accumulation_timer.done():
            _accumulation_timer.cancel()
        _accumulation_timer = asyncio.create_task(_accumulation_timer_coro())

    # ---- STT listener (handles both modes) ----

    async def _stt_listener() -> None:
        """Listen to Deepgram transcripts and dispatch based on mode."""
        nonlocal respond_task, _accumulation_speaker
        try:
            async for msg in stt.transcripts():
                msg_type = msg.get("type", "")

                if msg_type == "Results":
                    channel = msg.get("channel", {})
                    alternatives = channel.get("alternatives", [{}])
                    transcript = alternatives[0].get("transcript", "") if alternatives else ""
                    is_final = msg.get("is_final", False)
                    speech_final = msg.get("speech_final", False)

                    # Control mode: use manual speaker from frontend toggle
                    speaker: int | None = _manual_speaker if not is_agent_mode else None

                    if transcript:
                        if not is_final:
                            partial_msg: dict = {
                                "type": "transcript_partial",
                                "text": transcript,
                            }
                            if speaker is not None:
                                partial_msg["speaker"] = speaker
                            await _send_json(partial_msg)

                            # Interim results prove someone is still speaking —
                            # reset debounce timer to prevent premature flush
                            if _accumulation_buffer:
                                _reset_accumulation_timer()

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

                            # Control mode: flush buffer on speaker change
                            if not is_agent_mode and _accumulation_buffer and speaker != _accumulation_speaker:
                                await _flush_accumulation_buffer()

                            # Both modes: accumulate all is_final chunks
                            _accumulation_buffer.append(transcript)
                            _accumulation_turn_ids.append(turn_id)
                            _accumulation_speaker = speaker
                            _reset_accumulation_timer()
                            logger.debug(
                                "Accumulated chunk (speech_final=%s, buffer_size=%d, speaker=%s): %s",
                                speech_final, len(_accumulation_buffer), speaker, transcript[:60],
                            )

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
                    # Cancel accumulation timer and clear buffer first
                    if _accumulation_timer and not _accumulation_timer.done():
                        _accumulation_timer.cancel()
                    _accumulation_buffer.clear()
                    _accumulation_turn_ids.clear()

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

                elif ctrl.get("type") == "set_speaker" and not is_agent_mode:
                    new_speaker = int(ctrl.get("speaker", 0))
                    # Flush current buffer before switching (different speaker's text)
                    if _accumulation_buffer and new_speaker != _manual_speaker:
                        await _flush_accumulation_buffer()
                    _manual_speaker = new_speaker
                    logger.debug("Manual speaker set to %d", _manual_speaker)

                elif ctrl.get("type") == "config":
                    logger.info("Runtime config update: %s", ctrl)

    except WebSocketDisconnect:
        logger.info("Voice WS disconnected: session=%s", session_id)
    except Exception as e:
        logger.error("Voice WS error: %s", e)
        await _send_json({"type": "error", "message": str(e), "code": "internal"})
    finally:
        # Cleanup
        if _accumulation_timer and not _accumulation_timer.done():
            _accumulation_timer.cancel()
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
