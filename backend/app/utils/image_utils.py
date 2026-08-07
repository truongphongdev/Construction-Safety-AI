"""
image_utils.py — Helper functions cho xử lý ảnh.
Không phụ thuộc FastAPI hay YOLOv8 — thuần NumPy / OpenCV / Pillow.
"""

import io

import cv2
import numpy as np
from PIL import Image


def bytes_to_numpy(image_bytes: bytes) -> np.ndarray:
    """
    Chuyển raw image bytes (JPEG/PNG/WebP) → numpy array BGR (OpenCV format).

    Args:
        image_bytes: Raw bytes của file ảnh.

    Returns:
        np.ndarray: Ảnh dạng (H, W, 3) BGR uint8.
    """
    image_pil = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    image_np = np.array(image_pil)
    return cv2.cvtColor(image_np, cv2.COLOR_RGB2BGR)


def numpy_to_bytes(image: np.ndarray, format: str = ".jpg") -> bytes:
    """
    Chuyển numpy array BGR (OpenCV format) → raw image bytes (JPEG/PNG).

    Args:
        image: Ảnh dạng np.ndarray (BGR).
        format: Định dạng nén (".jpg" hoặc ".png").

    Returns:
        bytes: Raw image bytes.
    """
    success, encoded_img = cv2.imencode(format, image)
    if not success:
        raise ValueError(f"Không thể encode ảnh sang định dạng {format}")
    return encoded_img.tobytes()



def resize_keep_aspect(
    image: np.ndarray,
    max_size: int = 1280,
) -> np.ndarray:
    """
    Resize ảnh giữ tỉ lệ, đảm bảo cạnh dài không vượt quá max_size.

    Args:
        image: Ảnh numpy BGR.
        max_size: Kích thước tối đa (pixel).

    Returns:
        np.ndarray: Ảnh đã resize.
    """
    h, w = image.shape[:2]
    if max(h, w) <= max_size:
        return image
    scale = max_size / max(h, w)
    new_w, new_h = int(w * scale), int(h * scale)
    return cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_LINEAR)


def draw_bounding_boxes(
    image: np.ndarray,
    detections: list,
    color: tuple = (0, 255, 0),
    thickness: int = 2,
) -> np.ndarray:
    """
    Vẽ bounding boxes lên ảnh (dùng cho debug / visualization).

    Args:
        image: Ảnh numpy BGR.
        detections: List DetectedObject từ DetectionResponse.
        color: Màu BGR của box.
        thickness: Độ dày đường viền.

    Returns:
        np.ndarray: Ảnh đã vẽ bounding boxes.
    """
    result = image.copy()
    for obj in detections:
        x1, y1, x2, y2 = (
            int(obj.bbox.x1), int(obj.bbox.y1),
            int(obj.bbox.x2), int(obj.bbox.y2),
        )
        cv2.rectangle(result, (x1, y1), (x2, y2), color, thickness)
        label = f"{obj.label} {obj.confidence:.2f}"
        cv2.putText(
            result, label, (x1, y1 - 6),
            cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1,
        )
    return result
