from fastapi import APIRouter, File, HTTPException, UploadFile

from app.schemas.detection import DetectionResponse
from app.services.detection_service import DetectionService

router = APIRouter()
_service = DetectionService()


@router.post(
    "/image",
    response_model=DetectionResponse,
    summary="Phát hiện vi phạm từ ảnh",
)
async def detect_from_image(file: UploadFile = File(...)):
    """
    Nhận file ảnh (JPG/PNG), chạy YOLOv8 inference,
    trả về danh sách bounding box và nhãn vi phạm.
    """
    if file.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(
            status_code=415,
            detail="Chỉ hỗ trợ định dạng ảnh: JPEG, PNG, WebP.",
        )

    image_bytes = await file.read()
    result = await _service.detect_from_bytes(image_bytes)
    return result


@router.post(
    "/url",
    response_model=DetectionResponse,
    summary="Phát hiện vi phạm từ URL ảnh",
)
async def detect_from_url(image_url: str):
    """Nhận URL ảnh, download và chạy inference."""
    result = await _service.detect_from_url(image_url)
    return result
