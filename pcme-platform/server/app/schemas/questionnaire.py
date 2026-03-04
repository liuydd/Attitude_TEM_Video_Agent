import uuid
from datetime import datetime

from pydantic import BaseModel


class QuestionnaireSubmit(BaseModel):
    questionnaire_type: str
    answers: dict


class QuestionnaireResponseSchema(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    questionnaire_type: str
    answers: dict
    created_at: datetime

    model_config = {"from_attributes": True}
