"""
DetectionService — Business logic tầng service cho YOLOv8 inference.
Không phụ thuộc vào FastAPI, có thể test độc lập.
"""

import asyncio
import time
from pathlib import Path

import cv2
import httpx
import numpy as np

from app.config import get_settings
from app.core.constants import VIOLATION_LABELS
from app.schemas.detection import BoundingBox, DetectedObject, DetectionResponse
from app.utils.image_utils import bytes_to_numpy


class DetectionService:
    def __init__(self):
        self._settings = get_settings()
        self._model = None  # Lazy-load khi có request đầu tiên

    def _load_model(self):
        """Lazy-load YOLOv8 model — tránh tốn bộ nhớ khi startup."""
        if self._model is None:
            # Thử tìm weights theo thứ tự ưu tiên
            candidates = [
                Path(self._settings.MODEL_PATH),                         # từ .env
                Path("ai/weights/best.pt"),                               # trong backend/
                Path("ppe_5classes_model_results/weights/best.pt"),       # ở root project
                Path(__file__).resolve().parents[3] / "ppe_5classes_model_results/weights/best.pt",
                Path(__file__).resolve().parents[2] / "ai/weights/best.pt",
            ]
            model_path = None
            for candidate in candidates:
                if candidate.exists():
                    model_path = candidate
                    break

            if model_path is None:
                raise FileNotFoundError(
                    "Không tìm thấy model weights .pt. "
                    "Đặt file best.pt vào backend/ai/weights/ hoặc ppe_5classes_model_results/weights/"
                )

            from ai.detector import YOLODetector
            self._model = YOLODetector(
                model_path=str(model_path),
                conf=self._settings.CONFIDENCE_THRESHOLD,
                iou=self._settings.IOU_THRESHOLD,
                device=self._settings.DEVICE,
            )

    def _predict_sync(self, image_np: np.ndarray):
        """Sync worker chạy model inference trong thread pool."""
        self._load_model()
        t0 = time.perf_counter()
        raw_results = self._model.predict(image_np)
        inference_ms = (time.perf_counter() - t0) * 1000
        return raw_results, inference_ms

    async def detect_from_bytes(self, image_bytes: bytes) -> DetectionResponse:
        """Chạy inference từ raw image bytes không làm block event loop."""
        image_np = await asyncio.to_thread(bytes_to_numpy, image_bytes)
        h, w = image_np.shape[:2]

        raw_results, inference_ms = await asyncio.to_thread(self._predict_sync, image_np)

        objects = self._parse_results(raw_results)
        violations = [o for o in objects if o.label in VIOLATION_LABELS]

        return DetectionResponse(
            total_violations=len(violations),
            objects=objects,
            inference_time_ms=round(inference_ms, 2),
            image_width=w,
            image_height=h,
        )

    async def detect_from_numpy(self, image_np: np.ndarray) -> DetectionResponse:
        """Chạy inference từ numpy array BGR (dùng cho stream) không làm block event loop."""
        h, w = image_np.shape[:2]

        raw_results, inference_ms = await asyncio.to_thread(self._predict_sync, image_np)

        objects = self._parse_results(raw_results)
        violations = [o for o in objects if o.label in VIOLATION_LABELS]

        return DetectionResponse(
            total_violations=len(violations),
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
        Parse output từ Ultralytics YOLOv8 Results object sang list[DetectedObject].

        Ultralytics Results structure:
          results[0].boxes.xyxy   → tensor [[x1,y1,x2,y2], ...]
          results[0].boxes.conf   → tensor [conf, ...]
          results[0].boxes.cls    → tensor [class_id, ...]
          results[0].names        → dict {0: 'helmet', 1: 'no_helmet', ...}
        """
        from ai.detector import YOLODetector

        objects: list[DetectedObject] = []

        for result in raw_results:
            boxes = result.boxes
            if boxes is None or len(boxes) == 0:
                continue

            # Lấy class names từ model (ưu tiên model.names, fallback DEFAULT_LABELS)
            names = result.names if result.names else YOLODetector.DEFAULT_LABELS

            xyxy = boxes.xyxy.cpu().numpy()   # shape (N, 4)
            confs = boxes.conf.cpu().numpy()  # shape (N,)
            cls_ids = boxes.cls.cpu().numpy().astype(int)  # shape (N,)

            for i in range(len(xyxy)):
                x1, y1, x2, y2 = xyxy[i]
                conf = float(confs[i])
                cls_id = int(cls_ids[i])
                label = names.get(cls_id, f"class_{cls_id}")

                objects.append(
                    DetectedObject(
                        label=label,
                        confidence=round(conf, 4),
                        bbox=BoundingBox(
                            xmin=float(x1),
                            ymin=float(y1),
                            xmax=float(x2),
                            ymax=float(y2),
                        ),
                        is_violation=label in VIOLATION_LABELS,
                    )
                )

        return objects

    def draw_annotations(self, image_np: np.ndarray, objects: list[DetectedObject]) -> np.ndarray:
        """Vẽ bounding boxes và nhãn lên ảnh numpy BGR."""
        annotated = image_np.copy()
        for obj in objects:
            x1 = int(obj.bbox.xmin)
            y1 = int(obj.bbox.ymin)
            x2 = int(obj.bbox.xmax)
            y2 = int(obj.bbox.ymax)

            color = (0, 0, 255) if obj.is_violation else (0, 200, 60)
            thickness = 2

            cv2.rectangle(annotated, (x1, y1), (x2, y2), color, thickness)

            text = f"{obj.label} {obj.confidence:.0%}"
            font_scale = 0.55
            (tw, th), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, font_scale, 1)
            label_y = max(y1 - 4, th + 4)
            cv2.rectangle(annotated, (x1, label_y - th - 4), (x1 + tw + 4, label_y + 2), color, -1)
            cv2.putText(annotated, text, (x1 + 2, label_y), cv2.FONT_HERSHEY_SIMPLEX, font_scale, (255, 255, 255), 1, cv2.LINE_AA)

        return annotated
