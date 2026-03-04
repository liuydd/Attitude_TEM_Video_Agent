import uuid

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class EventLogBatch(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "event_log_batches"

    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sessions.id"), nullable=False)
    log_file_path: Mapped[str] = mapped_column(String(1000), nullable=False)
    event_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    session: Mapped["Session"] = relationship(back_populates="event_log_batches")  # noqa: F821
