import enum
import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class GroupType(enum.StrEnum):
    CONTROL = "control"
    EXPERIMENTAL = "experimental"


class ExperimentCreate(BaseModel):
    name: str = Field(..., max_length=255)
    description: str | None = None
    group_type: GroupType
    training_video_filename: str = Field(..., max_length=500)
    config: dict | None = None


class ExperimentResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    group_type: GroupType
    training_video_filename: str
    config: dict | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ExperimentList(BaseModel):
    items: list[ExperimentResponse]
    total: int
