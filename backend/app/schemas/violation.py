from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, model_validator


class ViolationSeverity(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    CRITICAL = "CRITICAL"


class ViolationStatus(str, Enum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    WARNING_SENT = "WARNING_SENT"
    FALSE_ALARM = "FALSE_ALARM"


class ViolationBase(BaseModel):
    camera_id: UUID = Field(..., description="ID thiết bị camera phát hiện vi phạm")
    detected_time: datetime = Field(..., description="Thời gian phát hiện vi phạm")
    violation_type: str = Field(..., max_length=50, description="Loại vi phạm (VD: NO_HELMET, NO_VEST...)")
    severity_level: ViolationSeverity = Field(default=ViolationSeverity.MEDIUM, description="Mức độ nghiêm trọng")
    worker_code: str | None = Field(None, max_length=50, description="Mã số công nhân (nếu có)")
    video_bucket: str = Field(..., max_length=50, description="Bucket lưu trữ video")
    video_path: str = Field(..., max_length=255, description="Đường dẫn file video")
    image_path: str | None = Field(None, max_length=255, description="Đường dẫn file ảnh")
    status: ViolationStatus = Field(default=ViolationStatus.PENDING, description="Trạng thái xử lý")
    reviewed_by: UUID | None = Field(None, description="Người phê duyệt")
    reviewed_at: datetime | None = Field(None, description="Thời điểm phê duyệt")
    ai_metadata: dict[str, Any] | None = Field(None, description="Dữ liệu AI metadata (bounding box, confidence score...)")


class ViolationCreate(ViolationBase):
    @model_validator(mode="after")
    def validate_review_consistency(self) -> "ViolationCreate":
        if self.status == ViolationStatus.PENDING:
            if self.reviewed_by is not None or self.reviewed_at is not None:
                raise ValueError("reviewed_by và reviewed_at phải là null nếu status là PENDING.")
        return self


class ViolationUpdate(BaseModel):
    camera_id: UUID | None = Field(None, description="ID thiết bị camera")
    detected_time: datetime | None = Field(None, description="Thời gian phát hiện")
    violation_type: str | None = Field(None, max_length=50, description="Loại vi phạm")
    severity_level: ViolationSeverity | None = Field(None, description="Mức độ nghiêm trọng")
    worker_code: str | None = Field(None, max_length=50, description="Mã số công nhân")
    video_bucket: str | None = Field(None, max_length=50, description="Bucket lưu trữ video")
    video_path: str | None = Field(None, max_length=255, description="Đường dẫn file video")
    image_path: str | None = Field(None, max_length=255, description="Đường dẫn file ảnh")
    status: ViolationStatus | None = Field(None, description="Trạng thái xử lý")
    reviewed_by: UUID | None = Field(None, description="Người phê duyệt")
    reviewed_at: datetime | None = Field(None, description="Thời điểm phê duyệt")
    ai_metadata: dict[str, Any] | None = Field(None, description="Dữ liệu AI metadata")

    @model_validator(mode="after")
    def validate_review_consistency_update(self) -> "ViolationUpdate":
        # Nếu status được đặt là PENDING hoặc giữ nguyên PENDING (cần kiểm tra xem có truyền reviewed_by/reviewed_at hay không)
        if self.status == ViolationStatus.PENDING:
            if self.reviewed_by is not None or self.reviewed_at is not None:
                raise ValueError("reviewed_by và reviewed_at phải là null nếu status là PENDING.")
        return self


class ViolationOut(ViolationBase):
    id: UUID = Field(..., description="UUID của vi phạm")
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class ViolationList(BaseModel):
    total: int
    offset: int
    limit: int
    items: list[ViolationOut]
