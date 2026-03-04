"""Tests for voice agent WebSocket endpoint with mocked external services."""

from unittest.mock import patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.config import settings
from app.main import app


@pytest.fixture(autouse=True)
def use_tmp_data_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "data_dir", tmp_path)
    monkeypatch.setattr(settings, "metadata_dir", tmp_path / "metadata")
    monkeypatch.setattr(settings, "recordings_dir", tmp_path / "recordings")
    monkeypatch.setattr(settings, "logs_dir", tmp_path / "logs")
    monkeypatch.setattr(settings, "exports_dir", tmp_path / "exports")
    monkeypatch.setattr(settings, "deepgram_api_key", "test-key")
    monkeypatch.setattr(settings, "openai_api_key", "test-key")
    for d in [
        tmp_path / "metadata",
        tmp_path / "metadata" / "sessions",
        tmp_path / "recordings",
        tmp_path / "logs",
        tmp_path / "exports",
    ]:
        d.mkdir(parents=True, exist_ok=True)


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.fixture
async def session_id(client: AsyncClient):
    """Create a test session and return its ID."""
    exp = await client.post(
        "/api/experiments",
        json={
            "name": "Voice Test",
            "group_type": "control",
            "training_video_filename": "test.mp4",
        },
    )
    part = await client.post(
        "/api/participants",
        json={"student_id": "V001", "name": "测试用户"},
    )
    sess = await client.post(
        "/api/sessions",
        json={
            "experiment_id": exp.json()["id"],
            "participant_id": part.json()["id"],
        },
    )
    return sess.json()["id"]


async def test_ws_rejects_invalid_session():
    """WS should close with 4004 for nonexistent session."""
    from starlette.testclient import TestClient
    from starlette.websockets import WebSocketDisconnect

    with TestClient(app) as tc:
        with pytest.raises(WebSocketDisconnect) as exc_info:
            with tc.websocket_connect("/ws/voice-agent/nonexistent-id"):
                pass
        assert exc_info.value.code == 4004


async def test_voice_agent_config_loaded(monkeypatch):
    """Voice agent config fields are accessible."""
    assert settings.voice_agent_model == "gpt-4o"
    assert settings.tts_model == "tts-1"
    assert settings.tts_voice == "alloy"
    assert settings.deepgram_language == "zh"


async def test_llm_service_messages():
    """LLMService maintains conversation history."""
    with patch("app.services.llm_service.AsyncOpenAI"):
        from app.services.llm_service import LLMService

        svc = LLMService(system_prompt="Test prompt")
        svc.add_user_message("Hello")
        svc.add_assistant_message("Hi there")

        assert len(svc._messages) == 3
        assert svc._messages[0]["role"] == "system"
        assert svc._messages[1]["role"] == "user"
        assert svc._messages[2]["role"] == "assistant"


async def test_tts_service_empty_text():
    """TTSService should not call API for empty text."""
    with patch("app.services.tts_service.AsyncOpenAI"):
        from app.services.tts_service import TTSService

        svc = TTSService()
        chunks = []
        async for chunk in svc.stream_speech(""):
            chunks.append(chunk)
        assert chunks == []


async def test_deepgram_stt_close():
    """DeepgramSTTService close should be idempotent."""
    from app.services.deepgram_stt import DeepgramSTTService

    svc = DeepgramSTTService()
    # Close without connecting should not raise
    await svc.close()
    assert svc._closed is True
