from typing import List, Optional
from pydantic import BaseModel, Field


class BoundingBox(BaseModel):
    """Tọa độ bounding box theo định dạng [x1, y1, x2, y2] pixel."""
    x1: float = Field(..., description="Tọa độ x góc trên trái")
    y1: float = Field(..., description="Tọa độ y góc trên trái")
    x2: float = Field(..., description="Tọa độ x góc dưới phải")
    y2: float = Field(..., description="Tọa độ y góc dưới phải")


class DetectedObject(BaseModel):
    """Một đối tượng vi phạm được phát hiện."""
    label: str = Field(..., description="Nhãn vi phạm, ví dụ: 'no_helmet', 'fall'")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Độ tin cậy (0–1)")
    bbox: BoundingBox = Field(..., description="Vị trí trong ảnh")


class DetectionResponse(BaseModel):
    """Kết quả trả về sau khi inference."""
    total_violations: int = Field(..., description="Tổng số vi phạm phát hiện được")
    objects: List[DetectedObject] = Field(default_factory=list)
    inference_time_ms: Optional[float] = Field(None, description="Thời gian inference (ms)")
    image_width: Optional[int] = None
    image_height: Optional[int] = None
