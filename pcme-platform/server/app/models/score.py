import uuid

from sqlalchemy import JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDMixin


class Score(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "scores"

    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sessions.id"), nullable=False)
    instructor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("instructors.id"), nullable=False)
    dimension_scores: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    behavior_markers: Mapped[dict | None] = mapped_column(JSON, nullable=True, default=dict)
