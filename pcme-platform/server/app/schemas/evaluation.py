"""Instructor evaluation schemas – CBTA competency dimensions, annotations, scores."""

from __future__ import annotations

import enum

from pydantic import BaseModel, Field


class CbtaDimension(enum.StrEnum):
    COMMUNICATION = "communication"
    LEADERSHIP_TEAMWORK = "leadership_teamwork"
    SITUATION_AWARENESS = "situation_awareness"
    PROBLEM_SOLVING = "problem_solving"
    WORKLOAD_MANAGEMENT = "workload_management"
    KNOWLEDGE_APPLICATION = "knowledge_application"
    FLIGHT_PATH_MANUAL = "flight_path_manual"
    FLIGHT_PATH_AUTOMATED = "flight_path_automated"
    APPLICATION_OF_PROCEDURES = "application_of_procedures"


CBTA_DIMENSION_LABELS: dict[str, str] = {
    "communication": "沟通",
    "leadership_teamwork": "领导力与团队合作",
    "situation_awareness": "情景意识",
    "problem_solving": "问题解决与决策",
    "workload_management": "工作负荷管理",
    "knowledge_application": "知识应用",
    "flight_path_manual": "飞行航径管理(手动)",
    "flight_path_automated": "飞行航径管理(自动)",
    "application_of_procedures": "程序应用",
}


# ---------------------------------------------------------------------------
# Annotations
# ---------------------------------------------------------------------------


class AnnotationCreate(BaseModel):
    start_time: float = Field(..., ge=0, description="Segment start in seconds")
    end_time: float = Field(..., gt=0, description="Segment end in seconds")
    competencies: list[CbtaDimension] = Field(..., min_length=1)
    rating: int = Field(..., ge=1, le=5)
    comment: str = ""


class AnnotationUpdate(BaseModel):
    start_time: float | None = Field(None, ge=0)
    end_time: float | None = Field(None, gt=0)
    competencies: list[CbtaDimension] | None = Field(None, min_length=1)
    rating: int | None = Field(None, ge=1, le=5)
    comment: str | None = None


class AnnotationResponse(BaseModel):
    id: str
    start_time: float
    end_time: float
    competencies: list[str]
    rating: int
    comment: str
    created_at: str


# ---------------------------------------------------------------------------
# Dimension scores
# ---------------------------------------------------------------------------


class DimensionScore(BaseModel):
    score: int = Field(..., ge=1, le=5)
    comment: str = ""


# ---------------------------------------------------------------------------
# Evaluation
# ---------------------------------------------------------------------------


class EvaluationUpdate(BaseModel):
    instructor_name: str = Field("", max_length=100)
    dimension_scores: dict[CbtaDimension, DimensionScore] = Field(default_factory=dict)
    overall_comment: str = ""


class EvaluationResponse(BaseModel):
    session_id: str
    instructor_name: str
    created_at: str
    updated_at: str
    annotations: list[AnnotationResponse]
    dimension_scores: dict[str, DimensionScore]
    overall_comment: str


# ---------------------------------------------------------------------------
# Physio data
# ---------------------------------------------------------------------------


class PhysioDataPoint(BaseModel):
    time: float
    value: float


class PhysioChannel(BaseModel):
    key: str
    label: str
    unit: str
    source: str
    data: list[PhysioDataPoint]


class PhysioData(BaseModel):
    """Physiological signal data for a session."""

    session_id: str
    channels: list[PhysioChannel] = Field(default_factory=list)
    has_data: bool = False


# ---------------------------------------------------------------------------
# Session list / detail for instructor view
# ---------------------------------------------------------------------------


class SessionListItem(BaseModel):
    id: str
    experiment_id: str
    experiment_name: str
    participant_id: str
    participant_name: str
    group_type: str
    status: str
    has_evaluation: bool
    duration_seconds: float | None = None
    created_at: str


class SessionDetailEnriched(BaseModel):
    """Full session data for the review page."""

    id: str
    experiment_id: str
    experiment_name: str
    participant_id: str
    participant_name: str
    group_type: str
    status: str
    anchor_timestamp_ms: int | None = None
    started_at: str | None = None
    ended_at: str | None = None
    training_video_filename: str | None = None
    recordings: list[dict] = Field(default_factory=list)
    questionnaires: list[dict] = Field(default_factory=list)
    conversation: list[dict] = Field(default_factory=list)
    events: list[dict] = Field(default_factory=list)
    evaluation: EvaluationResponse | None = None
    physio: PhysioData | None = None
    created_at: str
