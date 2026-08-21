from datetime import datetime
from enum import Enum
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class CameraStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    MAINTENANCE = "MAINTENANCE"


class CameraBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Tên thiết bị camera")
    location_desc: str | None = Field(None, description="Mô tả vị trí lắp đặt")
    ip_address: str | None = Field(None, max_length=45, description="Địa chỉ IP (IPv4 hoặc IPv6)")
    status: CameraStatus = Field(default=CameraStatus.ACTIVE, description="Trạng thái camera")
    ppe_enabled: bool = Field(default=True, description="Bật/tắt phát hiện PPE (mũ, áo)")
    zone_enabled: bool = Field(default=True, description="Bật/tắt phát hiện xâm nhập vùng cấm")


class CameraCreate(CameraBase):
    pass


class CameraUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100, description="Tên thiết bị camera")
    location_desc: str | None = Field(None, description="Mô tả vị trí lắp đặt")
    ip_address: str | None = Field(None, max_length=45, description="Địa chỉ IP")
    status: CameraStatus | None = Field(None, description="Trạng thái camera")
    ppe_enabled: bool | None = Field(None, description="Bật/tắt phát hiện PPE")
    zone_enabled: bool | None = Field(None, description="Bật/tắt phát hiện vùng cấm")


class CameraToggle(BaseModel):
    ppe_enabled: bool | None = Field(None, description="Bật/tắt phát hiện PPE")
    zone_enabled: bool | None = Field(None, description="Bật/tắt phát hiện vùng cấm")


class CameraOut(CameraBase):
    id: UUID = Field(..., description="UUID của camera")
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class CameraList(BaseModel):
    total: int
    offset: int
    limit: int
    items: list[CameraOut]
