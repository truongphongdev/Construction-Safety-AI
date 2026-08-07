from typing import List, Optional
from pydantic import BaseModel, Field


class BoundingBox(BaseModel):
    """Tọa độ bounding box theo định dạng [xmin, ymin, xmax, ymax] pixel."""
    xmin: float = Field(..., description="Tọa độ x góc trên trái")
    ymin: float = Field(..., description="Tọa độ y góc trên trái")
    xmax: float = Field(..., description="Tọa độ x góc dưới phải")
    ymax: float = Field(..., description="Tọa độ y góc dưới phải")


class DetectedObject(BaseModel):
    """Một đối tượng được phát hiện trong ảnh."""
    label: str = Field(..., description="Nhãn đối tượng, ví dụ: 'no_helmet', 'helmet', 'vest'")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Độ tin cậy (0–1)")
    bbox: BoundingBox = Field(..., description="Vị trí bounding box trong ảnh")
    is_violation: bool = Field(default=False, description="True nếu đây là vi phạm an toàn")


class DetectionResponse(BaseModel):
    """Kết quả trả về sau khi inference YOLOv8."""
    total_violations: int = Field(..., description="Tổng số vi phạm phát hiện được")
    objects: List[DetectedObject] = Field(default_factory=list, description="Danh sách tất cả đối tượng phát hiện")
    inference_time_ms: Optional[float] = Field(None, description="Thời gian inference (ms)")
    image_width: Optional[int] = None
    image_height: Optional[int] = None
