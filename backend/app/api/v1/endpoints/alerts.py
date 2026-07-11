from typing import List

from fastapi import APIRouter, Query

from app.schemas.alert import Alert, AlertList
from app.services.alert_service import AlertService

router = APIRouter()
_service = AlertService()


@router.get(
    "/",
    response_model=AlertList,
    summary="Lấy danh sách cảnh báo",
)
def get_alerts(
    limit: int = Query(default=20, ge=1, le=100, description="Số lượng cảnh báo trả về"),
    offset: int = Query(default=0, ge=0, description="Vị trí bắt đầu (pagination)"),
):
    """Trả về danh sách cảnh báo vi phạm gần nhất, có phân trang."""
    return _service.get_alerts(limit=limit, offset=offset)


@router.delete(
    "/{alert_id}",
    summary="Xóa một cảnh báo",
)
def delete_alert(alert_id: str):
    """Xóa cảnh báo theo ID."""
    deleted = _service.delete_alert(alert_id)
    if not deleted:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"Alert '{alert_id}' không tồn tại.")
    return {"message": f"Alert '{alert_id}' đã được xóa."}
