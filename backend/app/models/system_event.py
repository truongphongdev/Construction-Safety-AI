import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.core.database import Base


class SystemEventModel(Base):
    __tablename__ = "system_events"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    event_type = Column(String(50), nullable=False)  # CAMERA_OFFLINE, WORKER_CRASH, DETECTOR_RESTART, etc.
    camera_id = Column(
        UUID(as_uuid=True),
        ForeignKey("cameras.id", ondelete="SET NULL"),
        nullable=True,
    )
    level = Column(String(20), nullable=False, default="INFO", server_default=text("'INFO'"))
    message = Column(Text, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=func.now(),
        server_default=func.now(),
    )
