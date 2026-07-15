import uuid
from sqlalchemy import Column, String, Boolean, DateTime, CheckConstraint, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class UserModel(Base):
    __tablename__ = "users"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=True)
    role = Column(
        String(20),
        nullable=False,
        default="ADMIN",
        server_default=text("'ADMIN'"),
    )
    is_active = Column(
        Boolean,
        nullable=False,
        default=True,
        server_default=text("true"),
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

    # Relationships
    reviewed_violations = relationship(
        "ViolationModel",
        back_populates="reviewer",
    )

    __table_args__ = (
        CheckConstraint(
            "role IN ('ADMIN', 'SUPER_ADMIN')",
            name="chk_user_role",
        ),
    )
