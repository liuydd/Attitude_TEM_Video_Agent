import enum
import uuid
from datetime import datetime

from pydantic import BaseModel


class TrackType(enum.StrEnum):
    CAMERA = "camera"
    MICROPHONE = "microphone"


class RecordingResponse(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    track_type: str
    file_path: str
    mime_type: str
    file_size_bytes: int
    checksum_sha256: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
