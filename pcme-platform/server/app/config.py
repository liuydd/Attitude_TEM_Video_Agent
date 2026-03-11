import os
from pathlib import Path

from pydantic_settings import BaseSettings


def _load_deepgram_key() -> str:
    """Load Deepgram API key from api.env in project root."""
    env_file = Path(__file__).resolve().parent.parent.parent.parent / "api.env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if line.startswith("deepgram_api"):
                _, _, value = line.partition("=")
                return value.strip().strip("'\"")
    return ""


class Settings(BaseSettings):
    # Storage paths (use pathlib for macOS/cross-platform compatibility)
    data_dir: Path = Path(__file__).resolve().parent.parent.parent / "data"
    metadata_dir: Path = Path("")
    recordings_dir: Path = Path("")
    logs_dir: Path = Path("")
    exports_dir: Path = Path("")
    evaluations_dir: Path = Path("")
    physio_dir: Path = Path("")

    # Server
    api_prefix: str = "/api"
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ]

    # Upload limits
    max_upload_size_bytes: int = 5 * 1024 * 1024 * 1024  # 5GB

    # Voice agent
    deepgram_api_key: str = ""
    openai_api_key: str = ""
    voice_agent_model: str = "gpt-4o"
    voice_agent_system_prompt: str = ""
    tts_model: str = "tts-1"
    tts_voice: str = "alloy"
    deepgram_language: str = "zh"
    endpointing_ms: int = 500                      # Deepgram endpointing: ms of silence before speech_final fires
    speech_accumulation_timeout: float = 3        # Server debounce: seconds after last transcript activity
    min_transcript_length: int = 4                  # Minimum chars to trigger LLM (filters "嗯" "啊")
    transcript_correction_model: str = "gpt-4o-mini" # Fast model for STT text correction

    model_config = {"env_prefix": "PCME_"}

    def model_post_init(self, __context: object) -> None:
        if not self.metadata_dir.parts:
            self.metadata_dir = self.data_dir / "metadata"
        if not self.recordings_dir.parts:
            self.recordings_dir = self.data_dir / "recordings"
        if not self.logs_dir.parts:
            self.logs_dir = self.data_dir / "logs"
        if not self.exports_dir.parts:
            self.exports_dir = self.data_dir / "exports"
        if not self.evaluations_dir.parts:
            self.evaluations_dir = self.metadata_dir / "evaluations"
        if not self.physio_dir.parts:
            self.physio_dir = self.data_dir / "physio_data"
        # Ensure directories exist
        for d in [
            self.metadata_dir,
            self.metadata_dir / "sessions",
            self.recordings_dir,
            self.logs_dir,
            self.exports_dir,
            self.data_dir / "timelines",
            self.data_dir / "prompts",
            self.evaluations_dir,
            self.physio_dir,
        ]:
            d.mkdir(parents=True, exist_ok=True)

        # Load API keys from environment / api.env
        if not self.deepgram_api_key:
            self.deepgram_api_key = _load_deepgram_key()
        if not self.openai_api_key:
            self.openai_api_key = os.environ.get("OPENAI_API_KEY", "")

        # Load system prompt from file if not set via env
        if not self.voice_agent_system_prompt:
            prompt_file = self.data_dir / "prompts" / "voice_agent_system.txt"
            if prompt_file.exists():
                self.voice_agent_system_prompt = prompt_file.read_text(encoding="utf-8").strip()
            else:
                self.voice_agent_system_prompt = "你是一位飞行训练助手。"


settings = Settings()
