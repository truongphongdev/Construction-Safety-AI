from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class ViolationType(str, Enum):
    NO_HELMET = "no_helmet"
    NO_VEST = "no_vest"
    NO_GLOVES = "no_gloves"
    NO_BOOTS = "no_boots"
    ZONE_INTRUSION = "zone_intrusion"
    FALL = "fall"
    UNKNOWN = "unknown"


class AlertSeverity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class Alert(BaseModel):
    """Một sự kiện cảnh báo vi phạm an toàn."""
    id: str = Field(..., description="UUID của cảnh báo")
    violation_type: ViolationType
    severity: AlertSeverity
    confidence: float = Field(..., ge=0.0, le=1.0)
    camera_id: Optional[str] = Field(None, description="ID camera nguồn")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    image_snapshot_url: Optional[str] = Field(None, description="URL ảnh lưu cảnh báo")
    notes: Optional[str] = None


class AlertList(BaseModel):
    """Danh sách cảnh báo có phân trang."""
    total: int
    offset: int
    limit: int
    items: List[Alert]
