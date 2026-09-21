import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ParticipantCreate(BaseModel):
    student_id: str | None = Field(default=None, max_length=100)
    name: str = Field(..., max_length=100)
    age: int | None = None
    gender: str | None = None
    flight_hours: float | None = None
    demographics: dict | None = None


class ParticipantResponse(BaseModel):
    id: uuid.UUID
    student_id: str
    name: str
    age: int | None
    gender: str | None
    flight_hours: float | None
    demographics: dict | None
    created_at: datetime

    model_config = {"from_attributes": True}
