"""
DetectionService — Business logic tầng service cho YOLOv8 inference.
Không phụ thuộc vào FastAPI, có thể test độc lập.
"""

import time
from io import BytesIO
from pathlib import Path
from typing import Optional

import httpx

from app.config import get_settings
from app.schemas.detection import BoundingBox, DetectedObject, DetectionResponse
from app.utils.image_utils import bytes_to_numpy


class DetectionService:
    def __init__(self):
        self._settings = get_settings()
        self._model = None  # Lazy-load khi có request đầu tiên

    def _load_model(self):
        """Lazy-load YOLOv8 model — tránh tốn bộ nhớ khi startup."""
        if self._model is None:
            model_path = Path(self._settings.MODEL_PATH)
            if not model_path.exists():
                raise FileNotFoundError(
                    f"Model weights không tìm thấy tại: {model_path}. "
                    "Đặt file .pt vào ai/weights/ và cập nhật MODEL_PATH trong .env."
                )
            from ai.detector import YOLODetector
            self._model = YOLODetector(
                model_path=str(model_path),
                conf=self._settings.CONFIDENCE_THRESHOLD,
                iou=self._settings.IOU_THRESHOLD,
                device=self._settings.DEVICE,
            )

    async def detect_from_bytes(self, image_bytes: bytes) -> DetectionResponse:
        """Chạy inference từ raw image bytes."""
        self._load_model()
        image_np = bytes_to_numpy(image_bytes)
        h, w = image_np.shape[:2]

        t0 = time.perf_counter()
        raw_results = self._model.predict(image_np)
        inference_ms = (time.perf_counter() - t0) * 1000

        objects = self._parse_results(raw_results)
        return DetectionResponse(
            total_violations=len(objects),
            objects=objects,
            inference_time_ms=round(inference_ms, 2),
            image_width=w,
            image_height=h,
        )

    async def detect_from_url(self, image_url: str) -> DetectionResponse:
        """Download ảnh từ URL rồi chạy inference."""
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(image_url)
            resp.raise_for_status()
        return await self.detect_from_bytes(resp.content)

    # ── Internal helpers ──────────────────────────────────────────────────────
    @staticmethod
    def _parse_results(raw_results) -> list[DetectedObject]:
        """
        Chuyển đổi output thô của YOLOv8 sang list DetectedObject.
        Sẽ triển khai chi tiết khi tích hợp model thực tế.
        """
        # TODO: parse raw_results từ ultralytics Results object
        return []
