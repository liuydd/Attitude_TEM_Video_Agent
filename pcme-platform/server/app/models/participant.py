from sqlalchemy import JSON, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class Participant(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "participants"

    student_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    age: Mapped[int | None] = mapped_column(Integer, nullable=True)
    gender: Mapped[str | None] = mapped_column(String(20), nullable=True)
    flight_hours: Mapped[float | None] = mapped_column(nullable=True)
    demographics: Mapped[dict | None] = mapped_column(JSON, nullable=True, default=dict)

    sessions: Mapped[list["Session"]] = relationship(back_populates="participant")  # noqa: F821
