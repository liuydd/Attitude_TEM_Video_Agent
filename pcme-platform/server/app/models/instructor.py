from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDMixin


class Instructor(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "instructors"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    employee_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
