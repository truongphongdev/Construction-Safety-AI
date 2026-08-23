from datetime import datetime
from pydantic import BaseModel, Field


class ReportSummary(BaseModel):
    total_violations: int = Field(0, description="Tổng số vụ vi phạm trong khoảng thời gian")
    total_cameras: int = Field(0, description="Tổng số camera đang hoạt động")
    compliance_rate: float = Field(100.0, description="Tỷ lệ tuân thủ an toàn ước tính (%)")
    false_alarm_rate: float = Field(0.0, description="Tỷ lệ báo động sai (%)")
    avg_response_minutes: float = Field(0.0, description="Thời gian phản hồi/xử lý trung bình (phút)")
    pending_count: int = Field(0, description="Số lượng vi phạm đang chờ duyệt")
    confirmed_count: int = Field(0, description="Số lượng vi phạm đã xác nhận")
    warning_sent_count: int = Field(0, description="Số lượng đã gửi cảnh báo")
    false_alarm_count: int = Field(0, description="Số lượng báo động sai")
    trend_percentage: float = Field(0.0, description="Tỷ lệ % thay đổi số lượng vi phạm so với kỳ trước")


class TrendDataPoint(BaseModel):
    date: str = Field(..., description="Ngày định dạng YYYY-MM-DD")
    label: str = Field(..., description="Nhãn hiển thị (VD: Thứ 2, 24/08)")
    violations: int = Field(0, description="Tổng số vi phạm")
    critical_count: int = Field(0, description="Số lượng vi phạm mức nguy hiểm cao")
    medium_count: int = Field(0, description="Số lượng vi phạm mức vừa")
    low_count: int = Field(0, description="Số lượng vi phạm mức nhẹ")


class TypeDistribution(BaseModel):
    type_code: str = Field(..., description="Mã loại vi phạm")
    type_name: str = Field(..., description="Tên hiển thị loại vi phạm tiếng Việt")
    count: int = Field(0, description="Số lượng vụ")
    percentage: float = Field(0.0, description="Tỷ lệ phần trăm (%)")


class SeverityDistribution(BaseModel):
    severity: str = Field(..., description="Mức độ (CRITICAL, MEDIUM, LOW)")
    label: str = Field(..., description="Nhãn tiếng Việt (Nguy hiểm cao, Vừa, Nhẹ)")
    count: int = Field(0, description="Số lượng vụ")
    percentage: float = Field(0.0, description="Tỷ lệ phần trăm (%)")


class HourlyDistribution(BaseModel):
    hour: int = Field(..., description="Khung giờ (0 - 23)")
    label: str = Field(..., description="Nhãn khung giờ (VD: 08:00)")
    count: int = Field(0, description="Số lượng vụ vi phạm")


class CameraHotspot(BaseModel):
    camera_id: str = Field(..., description="UUID của camera")
    camera_name: str = Field(..., description="Tên camera")
    location: str = Field(..., description="Vị trí lắp đặt")
    violation_count: int = Field(0, description="Tổng số vụ vi phạm")
    critical_count: int = Field(0, description="Số vụ vi phạm nghiêm trọng")
    percentage: float = Field(0.0, description="Tỷ trọng vi phạm (%)")


class FullReportResponse(BaseModel):
    period_start: str = Field(..., description="Ngày bắt đầu (ISO/Date)")
    period_end: str = Field(..., description="Ngày kết thúc (ISO/Date)")
    summary: ReportSummary
    trend: list[TrendDataPoint]
    by_type: list[TypeDistribution]
    by_severity: list[SeverityDistribution]
    hourly: list[HourlyDistribution]
    hotspots: list[CameraHotspot]
