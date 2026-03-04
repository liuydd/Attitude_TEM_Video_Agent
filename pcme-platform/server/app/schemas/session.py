import enum
import uuid
from datetime import datetime

from pydantic import BaseModel


class SessionStatus(enum.StrEnum):
    CREATED = "created"
    STARTED = "started"
    RECORDING = "recording"
    QUESTIONNAIRE = "questionnaire"
    UPLOADING = "uploading"
    COMPLETED = "completed"
    ABORTED = "aborted"


class SessionCreate(BaseModel):
    experiment_id: uuid.UUID
    participant_id: uuid.UUID
    notes: str | None = None


class SessionUpdate(BaseModel):
    status: SessionStatus | None = None
    anchor_timestamp_ms: int | None = None
    started_at: datetime | None = None
    ended_at: datetime | None = None
    notes: str | None = None


class SessionResponse(BaseModel):
    id: uuid.UUID
    experiment_id: uuid.UUID
    participant_id: uuid.UUID
    status: SessionStatus
    anchor_timestamp_ms: int | None
    started_at: datetime | None
    ended_at: datetime | None
    notes: str | None
    training_video_filename: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
