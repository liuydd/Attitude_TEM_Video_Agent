import enum

from sqlalchemy import JSON, Enum, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class GroupType(enum.StrEnum):
    CONTROL = "control"
    EXPERIMENTAL = "experimental"


class Experiment(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "experiments"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    group_type: Mapped[GroupType] = mapped_column(
        Enum(GroupType, name="group_type_enum"), nullable=False
    )
    training_video_filename: Mapped[str] = mapped_column(String(500), nullable=False)
    config: Mapped[dict | None] = mapped_column(JSON, nullable=True, default=dict)

    sessions: Mapped[list["Session"]] = relationship(back_populates="experiment")  # noqa: F821
