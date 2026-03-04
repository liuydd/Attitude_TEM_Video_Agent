import uuid

from sqlalchemy import JSON, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class QuestionnaireResponse(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "questionnaire_responses"

    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sessions.id"), nullable=False)
    questionnaire_type: Mapped[str] = mapped_column(String(100), nullable=False)
    answers: Mapped[dict] = mapped_column(JSON, nullable=False)

    session: Mapped["Session"] = relationship(  # noqa: F821
        back_populates="questionnaire_responses"
    )
