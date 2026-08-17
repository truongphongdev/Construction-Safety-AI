import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, CheckConstraint, text, JSON
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class ViolationModel(Base):
    __tablename__ = "violations"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    camera_id = Column(
        UUID(as_uuid=True),
        ForeignKey("cameras.id", ondelete="RESTRICT"),
        nullable=False,
    )
    detected_time = Column(DateTime(timezone=True), nullable=False)
    violation_type = Column(String(50), nullable=False)
    severity_level = Column(
        String(20),
        nullable=False,
        default="MEDIUM",
        server_default=text("'MEDIUM'"),
    )
    worker_code = Column(String(50), nullable=True)
    track_id = Column(String(50), nullable=True)
    evidence_key = Column(String(1024), nullable=True)
    video_bucket = Column(String(50), nullable=True)
    video_path = Column(String(1024), nullable=True)
    image_path = Column(String(1024), nullable=True)
    status = Column(
        String(20),
        nullable=False,
        default="PENDING",
        server_default=text("'PENDING'"),
    )
    reviewed_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    ai_metadata = Column(JSON().with_variant(JSONB, "postgresql"), nullable=True)
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
    camera = relationship(
        "CameraModel",
        back_populates="violations",
    )
    reviewer = relationship(
        "UserModel",
        back_populates="reviewed_violations",
    )

    __table_args__ = (
        CheckConstraint(
            "severity_level IN ('LOW', 'MEDIUM', 'CRITICAL')",
            name="chk_violation_severity",
        ),
        CheckConstraint(
            "status IN ('PENDING', 'CONFIRMED', 'WARNING_SENT', 'FALSE_ALARM')",
            name="chk_violation_status",
        ),
        CheckConstraint(
            "status <> 'PENDING' OR (reviewed_by IS NULL AND reviewed_at IS NULL)",
            name="chk_review_consistency",
        ),
    )
