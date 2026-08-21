import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean, Text, CheckConstraint, text, JSON
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class ZoneModel(Base):
    __tablename__ = "zones"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    camera_id = Column(
        UUID(as_uuid=True),
        ForeignKey("cameras.id", ondelete="CASCADE"),
        nullable=False,
    )
    name = Column(String(100), nullable=False)
    polygon_coords = Column(JSON().with_variant(JSONB, "postgresql"), nullable=False)
    severity = Column(
        String(20),
        nullable=False,
        default="CRITICAL",
        server_default=text("'CRITICAL'"),
    )
    color = Column(
        String(10),
        nullable=False,
        default="#ef4444",
        server_default=text("'#ef4444'"),
    )
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, server_default=text("true"))
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=func.now(),
        server_default=func.now(),
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=func.now(),
        server_default=func.now(),
        onupdate=func.now(),
    )

    # Relationship
    camera = relationship("CameraModel", backref="zones")

    __table_args__ = (
        CheckConstraint(
            "severity IN ('LOW', 'MEDIUM', 'CRITICAL')",
            name="chk_zone_severity",
        ),
    )
