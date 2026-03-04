import enum
import uuid

from sqlalchemy import BigInteger, Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class TrackType(enum.StrEnum):
    CAMERA = "camera"
    MICROPHONE = "microphone"


class Recording(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "recordings"

    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sessions.id"), nullable=False)
    track_type: Mapped[TrackType] = mapped_column(
        Enum(TrackType, name="track_type_enum"), nullable=False
    )
    file_path: Mapped[str] = mapped_column(String(1000), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    checksum_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)

    session: Mapped["Session"] = relationship(back_populates="recordings")  # noqa: F821
