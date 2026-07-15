import uuid
from sqlalchemy import Column, String, DateTime, Text, CheckConstraint, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class CameraModel(Base):
    __tablename__ = "cameras"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    name = Column(String(100), nullable=False)
    location_desc = Column(Text, nullable=True)
    ip_address = Column(String(45), nullable=True)
    status = Column(
        String(20),
        nullable=False,
        default="ACTIVE",
        server_default=text("'ACTIVE'"),
    )
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
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    violations = relationship(
        "ViolationModel",
        back_populates="camera",
    )

    __table_args__ = (
        CheckConstraint(
            "status IN ('ACTIVE', 'INACTIVE', 'MAINTENANCE')",
            name="chk_camera_status",
        ),
    )
