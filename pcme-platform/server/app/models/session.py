import enum
import uuid
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class SessionStatus(enum.StrEnum):
    CREATED = "created"
    STARTED = "started"
    RECORDING = "recording"
    QUESTIONNAIRE = "questionnaire"
    UPLOADING = "uploading"
    COMPLETED = "completed"
    ABORTED = "aborted"


class Session(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "sessions"

    experiment_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("experiments.id"), nullable=False)
    participant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("participants.id"), nullable=False)
    status: Mapped[SessionStatus] = mapped_column(
        Enum(SessionStatus, name="session_status_enum"),
        default=SessionStatus.CREATED,
        nullable=False,
    )
    anchor_timestamp_ms: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    notes: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    experiment: Mapped["Experiment"] = relationship(back_populates="sessions")  # noqa: F821
    participant: Mapped["Participant"] = relationship(back_populates="sessions")  # noqa: F821
    recordings: Mapped[list["Recording"]] = relationship(back_populates="session")  # noqa: F821
    event_log_batches: Mapped[list["EventLogBatch"]] = relationship(  # noqa: F821
        back_populates="session"
    )
    questionnaire_responses: Mapped[list["QuestionnaireResponse"]] = relationship(  # noqa: F821
        back_populates="session"
    )
