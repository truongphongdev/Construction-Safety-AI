"""
YOLODetector — Wrapper nhỏ gọn quanh ultralytics YOLO.
Tách biệt hoàn toàn khỏi FastAPI để dễ test độc lập.
"""

from pathlib import Path

import numpy as np
from ultralytics import YOLO


class YOLODetector:
    """
    Singleton-style wrapper cho YOLOv8 inference.

    Usage:
        detector = YOLODetector("ai/weights/best.pt", conf=0.5)
        results = detector.predict(image_np)   # numpy BGR image
    """

    # Nhãn mặc định cho bài toán an toàn công trường
    DEFAULT_LABELS = {
        0: "helmet",
        1: "no_helmet",
        2: "vest",
        3: "no_vest",
        4: "person",
        5: "zone_intrusion",
        6: "fall",
    }

    def __init__(
        self,
        model_path: str,
        conf: float = 0.5,
        iou: float = 0.45,
        device: str = "cpu",
    ):
        """
        Args:
            model_path: Đường dẫn tới file .pt (YOLOv8 weights).
            conf: Ngưỡng confidence tối thiểu.
            iou: Ngưỡng IoU cho NMS.
            device: "cpu" | "cuda" | "mps".
        """
        if not Path(model_path).exists():
            raise FileNotFoundError(f"Không tìm thấy model: {model_path}")

        self.model = YOLO(model_path)
        self.conf = conf
        self.iou = iou
        self.device = device

    def predict(self, image: np.ndarray) -> list:
        """
        Chạy inference trên một ảnh numpy (BGR).

        Args:
            image: np.ndarray shape (H, W, 3) BGR uint8.

        Returns:
            List ultralytics Results objects.
        """
        results = self.model.predict(
            source=image,
            conf=self.conf,
            iou=self.iou,
            device=self.device,
            verbose=False,
        )
        return results

    def predict_batch(self, images: list[np.ndarray]) -> list:
        """Chạy inference trên nhiều ảnh cùng lúc (batch)."""
        results = self.model.predict(
            source=images,
            conf=self.conf,
            iou=self.iou,
            device=self.device,
            verbose=False,
        )
        return results
